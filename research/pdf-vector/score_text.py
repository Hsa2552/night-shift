"""Compare PDF.js text colours with independent PyMuPDF rawdict text and Edge ink.

The input browser trace contains local excerpt text. Only aggregate counts are printed.
"""

import argparse
from collections import Counter
import colorsys
import hashlib
import re
from statistics import median
import unicodedata
from pathlib import Path
import json

import pymupdf as fitz

IGNORED = re.compile(r"[\s\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]")


def plain(text):
    return IGNORED.sub("", unicodedata.normalize("NFKD", text))


def source_offsets(text):
    return [
        start
        for char, start in chars_at_utf16(text)
        for _ in plain(char)
    ]


def chars_at_utf16(text):
    offset = 0
    for char in text:
        yield char, offset
        offset += 1 if ord(char) <= 0xffff else 2


def raw_lines(page):
    raw = page.get_text("rawdict", flags=fitz.TEXTFLAGS_RAWDICT & ~fitz.TEXT_PRESERVE_IMAGES)
    lines = []
    for block in raw["blocks"]:
        if block["type"] != 0:
            continue
        for line in block["lines"]:
            chars = []
            points = []
            for span in line["spans"]:
                rgb = tuple((span["color"] >> bit) & 0xff for bit in (16, 8, 0))
                # char_flags marks filled and stroked text; a transparent OCR layer is excluded.
                if span.get("alpha", 255) < 250 or not (span.get("char_flags", 8) & 24):
                    continue
                for char in span["chars"]:
                    bbox = fitz.Rect(char["bbox"]) * page.rotation_matrix
                    point = ((bbox.x0 + bbox.x1) / 2, (bbox.y0 + bbox.y1) / 2, rgb)
                    for normalized in plain(char["c"]):
                        chars.append(normalized)
                        points.append(point)
            if chars:
                lines.append(("".join(chars), points))
    return lines


def reference(item, lines):
    content = plain(item["text"])
    if not content:
        return
    box = item["bbox"]
    x, y, w, h = (box[k] for k in ("x", "y", "width", "height"))
    pad = max(1, 0.25 * item.get("fontSize", min(w, h)))
    candidates = []
    for text, points in lines:
        start = text.find(content)
        while start >= 0:
            matched = points[start: start + len(content)]
            if all(x-pad <= cx <= x+w+pad and y-pad <= cy <= y+h+pad for cx, cy, _ in matched):
                candidates.append(tuple(rgb for _, _, rgb in matched))
            start = text.find(content, start + 1)
    if len(candidates) == 1:
        return candidates[0]


def native_colors(item, observation):
    ranges = observation["ranges"]
    return tuple(
        next((tuple(r["rgb"]) for r in ranges if r["start"] <= at < r["end"]), None)
        for at in source_offsets(item["text"])
    )


def hue(rgb):
    chroma = max(rgb) - min(rgb)
    if chroma < 34 or max(rgb) == 0 or chroma < 0.2 * max(rgb):
        return
    return colorsys.rgb_to_hsv(*(channel / 255 for channel in rgb))[0] * 360


def hue_set(colors):
    return {value for color in colors if color and (value := hue(color)) is not None}


def agrees(reference_hues, reported_hues):
    def covered(source, target):
        return all(any(abs((a - b + 180) % 360 - 180) <= 15 for b in target) for a in source)

    return covered(reference_hues, reported_hues) and covered(reported_hues, reference_hues)


def evaluate(path, report):
    counts = Counter()
    timings = [[], [], []]
    with fitz.open(path) as pdf:
        for page, observation in zip(pdf, report["pages"], strict=True):
            refs = raw_lines(page)
            by_item = {i["textIndex"]: i for i in observation["textColors"]}
            raster = {i["textIndex"]: i["colors"] for i in observation.get("rasterInk") or []}
            for time, key in zip(timings, ("ms", "renderMs", "rasterMs"), strict=True):
                time.append(observation[key])
            for index, item in enumerate(observation["textItems"]):
                if not plain(item["text"]):
                    continue
                detected = by_item[index]
                counts["fragments"] += 1
                counts[detected["status"]] += 1
                rgb = reference(item, refs)
                if rgb is None or len(rgb) != len(source_offsets(item["text"])):
                    continue
                counts["reference"] += 1
                expected = hue_set(rgb)
                if expected:
                    counts["reference_chromatic"] += 1
                if len(set(rgb)) > 1:
                    counts["reference_mixed"] += 1
                if detected["status"] == "matched":
                    native = native_colors(item, detected)
                    counts["reference_matched"] += 1
                    counts["reference_correct"] += native == rgb
                    counts["reference_correct_rgb2"] += all(
                        b is not None and max(abs(x-y) for x, y in zip(a, b)) <= 2
                        for a, b in zip(rgb, native, strict=True)
                    )
                    if len(set(rgb)) > 1:
                        counts["reference_mixed_correct"] += native == rgb
                    if expected:
                        counts["chromatic_native_covered"] += 1
                        counts["chromatic_native_agreement"] += agrees(expected, hue_set(native))
                    elif hue_set(native):
                        counts["neutral_native_leak"] += 1
                raster_hues = {entry["hue"] for entry in raster.get(index, ()) if entry["pixels"] >= 3}
                if expected:
                    counts["chromatic_raster_agreement"] += agrees(expected, raster_hues)
                elif raster_hues:
                    counts["neutral_raster_leak"] += 1
    return {
        "page_count": len(report["pages"]),
        **counts,
        **{
            name: {"sum": round(sum(sample), 1), "median_page": round(median(sample), 1)}
            for name, sample in zip(("native_ms", "render_ms", "raster_ms"), timings, strict=True)
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("trace", type=Path)
    parser.add_argument("pdf", type=Path, nargs="+")
    args = parser.parse_args()
    trace = json.loads(args.trace.read_bytes())
    documents = {d["sha256"]: d for d in trace["documents"]}
    for path in args.pdf:
        sha = hashlib.sha256(path.read_bytes()).hexdigest()
        print(json.dumps({"sha256": sha, **evaluate(path, documents[sha])}))


if __name__ == "__main__":
    main()

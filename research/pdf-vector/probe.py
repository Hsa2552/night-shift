"""Characterize visible PDF primitives in the C1 page frame. Local research only."""

import argparse
from collections import Counter, defaultdict
import hashlib
import json
import math
from pathlib import Path
from statistics import median
from time import perf_counter

import numpy as np
import pymupdf as pdf


def bounds(rect):
    """Rectangles are x, y, width, height. Keep subpixel geometry."""
    return [round(value, 4) for value in (rect.x0, rect.y0, rect.width, rect.height)]


def canonical(page, rect):
    return pdf.Rect(rect) * page.rotation_matrix


def rgba_color(color, opacity):
    return None if color is None else [*[round(c, 4) for c in color], opacity]


def rectangle_items(drawing):
    items = drawing["items"]
    for item in items:
        if item[0] == "re":
            yield pdf.Rect(item[1]), "rectangle"

    # A PDF can draw a box with three connected lines and closePath, or four lines.
    if not (3 <= len(items) <= 4 and all(item[0] == "l" for item in items)):
        return
    segments = [(item[1], item[2]) for item in items]
    if not all((previous[1] - current[0]).norm() < 0.1 for previous, current in zip(segments, segments[1:])):
        return
    start = segments[0][0]
    end = segments[-1][1]
    if (end - start).norm() >= 0.1:
        if not drawing.get("closePath") or len(segments) != 3:
            return
        segments.append((end, start))

    xs = sorted({round(point.x, 1) for line in segments for point in line})
    ys = sorted({round(point.y, 1) for line in segments for point in line})
    if len(xs) == len(ys) == 2 and all(
        abs(a.x - b.x) < 0.1 or abs(a.y - b.y) < 0.1 for a, b in segments
    ):
        yield pdf.Rect(xs[0], ys[0], xs[1], ys[1]), "segments"


def case_seeds(page, drawings):
    seeds = []
    for drawing in drawings:
        if not max(drawing.get("fill_opacity") or 0, drawing.get("stroke_opacity") or 0):
            continue
        for local, form in rectangle_items(drawing):
            rect = canonical(page, local)
            width, height = rect.width, rect.height
            if not (3 <= min(width, height) <= max(width, height) <= 32):
                continue
            if max(width, height) > 1.23 * min(width, height):
                continue

            def close(other):
                a, b = (rect.tl + rect.br) * 0.5, (other.tl + other.br) * 0.5
                return (a - b).norm() <= 1 and abs(rect.width - other.width) <= 2.1 and abs(rect.height - other.height) <= 2.1

            # Keep the innermost painted rectangle and the paint operations of its frame.
            previous = next((seed for seed in reversed(seeds) if close(seed["rect"])), None)
            paint = {
                "seq": drawing["seqno"],
                "form": form,
                "fill": rgba_color(drawing.get("fill"), drawing.get("fill_opacity")),
                "stroke": rgba_color(drawing.get("color"), drawing.get("stroke_opacity")),
                "stroke_width": drawing.get("width"),
                "layer": drawing.get("layer"),
            }
            if previous is None:
                seeds.append({"rect": rect, "paint": [paint]})
            else:
                if rect.get_area() < previous["rect"].get_area():
                    previous["rect"] = rect
                previous["paint"].append(paint)
    return seeds


def visible_cases(page, seeds, drawings, symbols):
    if not seeds:
        return []
    # Bound memory on oversize pages. Rendering is evidence of visibility only.
    scale = min(2.0, math.sqrt(6_000_000 / page.rect.get_area()))
    pix = page.get_pixmap(matrix=pdf.Matrix(scale, scale), colorspace=pdf.csGRAY, annots=True)
    dark = np.frombuffer(pix.samples_mv, dtype=np.uint8).reshape(pix.height, pix.width) < 150
    pad = max(1, math.ceil(scale))
    # Short interior oblique strokes can mark an outlined box. Keep the shape and ink evidence.
    interior_paths = []
    for path in drawings:
        if not path.get("stroke_opacity") or not all(item[0] == "l" for item in path["items"]):
            continue
        if not any(abs(item[1].x - item[2].x) > 0.5 and
                   abs(item[1].y - item[2].y) > 0.5 for item in path["items"]):
            continue
        interior_paths.append(canonical(page, path["rect"]))

    result = []
    for seed in seeds:
        rect = seed["rect"]
        x0, y0, x1, y1 = [round(x * scale) for x in rect]
        if not (pad <= x0 < x1 <= pix.width - pad and pad <= y0 < y1 <= pix.height - pad):
            result.append({"bbox": bounds(rect), "state": "ambiguous", "reason": "viewport", "paint": seed["paint"]})
            continue
        mx = max(1, (x1 - x0) // 5)
        my = max(1, (y1 - y0) // 5)
        cx0, cx1, cy0, cy1 = x0 + mx, x1 - mx, y0 + my, y1 - my
        if cx0 >= cx1 or cy0 >= cy1:
            result.append({"bbox": bounds(rect), "state": "ambiguous", "reason": "sampling", "paint": seed["paint"]})
            continue
        border = [
            float(dark[y - pad:y + pad + 1, cx0:cx1].mean(axis=1).max())
            for y in (y0, y1)
        ] + [
            float(dark[cy0:cy1, x - pad:x + pad + 1].mean(axis=0).max())
            for x in (x0, x1)
        ]
        interior = float(dark[cy0:cy1, cx0:cx1].mean())
        state = "ambiguous"
        fill = next((p["fill"] for p in reversed(seed["paint"]) if p["fill"]), None)
        pale_fill = fill and min(fill[:-1]) >= 0.85 and fill[-1] >= 0.85
        inner = pdf.Rect(rect.x0 + 0.3, rect.y0 + 0.3, rect.x1 - 0.3, rect.y1 - 0.3)
        native_mark = any(inner.contains(s) for s in interior_paths) or any(
            other["symbol"] in {"tick", "marked-square"} and
            rect.contains((box.tl + box.br) * 0.5)
            for box, other in symbols
        )
        if min(border) >= 0.60:
            if interior >= 0.76:
                state = "filled"
            elif interior <= 0.67:
                # A pale native fill can carry an alphanumeric label in an unmarked box.
                state = "marked" if native_mark or (interior > 0.23 and not pale_fill) else "empty"
        result.append({
            "bbox": bounds(rect), "state": state,
            "border_ink": [round(n, 3) for n in border],
            "interior_ink": round(interior, 3),
            "possible_mark_path": native_mark, "paint": seed["paint"],
        })
    return result


SYMBOLS = {
    0x25a0: "filled-square", 0x25a1: "empty-square", 0x25aa: "filled-square",
    0x25ab: "empty-square", 0x2610: "empty-square", 0x2611: "marked-square",
    0x2612: "marked-square", 0x2713: "tick", 0x2714: "tick",
    0x25cb: "empty-circle", 0x25cf: "filled-circle", 0x25ef: "empty-circle",
}


def styles_and_spans(page, coordinates):
    log = page.get_bboxlog(layers=True)
    styles = defaultdict(list)
    spans = []
    symbols = []
    for span in page.get_texttrace():
        rect = canonical(page, span["bbox"])
        seq = span["seqno"]
        kind = log[seq][0] if 0 <= seq < len(log) else None
        invisible = span["type"] == 3 or span["opacity"] <= 0 or kind == "ignore-text"
        # A later bounding box may overlap without concealing the underlying characters.
        possibly_covered = any(
            paint in {"fill-path", "fill-image", "fill-shade"} and pdf.Rect(box).contains(span["bbox"])
            for paint, box, _ in log[seq + 1:]
        )
        info = {
            "bbox": bounds(rect),
            "font": span["font"],
            "size": round(span["size"], 3),
            "flags": span["flags"],
            "bidi": span["bidi_lvl"],
            "direction": list(span["dir"]),
            "ink": rgba_color(span["color"], span["opacity"]),
            "seq": seq,
            "render": kind,
            "visibility": "invisible" if invisible else "possibly-covered" if possibly_covered else "painted",
            "glyph_count": len(span["chars"]),
        }
        if coordinates:
            info["glyphs"] = [
                {
                    "glyph_id": glyph,
                    "origin": list(pdf.Point(origin) * page.rotation_matrix),
                    "bbox": bounds(canonical(page, char_box)),
                }
                for _, glyph, origin, char_box in span["chars"]
            ]
        spans.append(info)
        if not invisible:
            for value, _, _, char_box in span["chars"]:
                if value in SYMBOLS:
                    box = canonical(page, char_box)
                    symbols.append((box, {
                        "bbox": bounds(box), "symbol": SYMBOLS[value],
                        "visibility": info["visibility"], "font": span["font"],
                    }))
            key = (info["font"], tuple(info["ink"][:-1]) if info["ink"] else None, info["flags"], round(info["size"] * 2) / 2)
            styles[key].append(info)
    grouped = []
    for (font, ink, flags, band), members in styles.items():
        xs = [s["bbox"][0] for s in members]
        ys = sorted({round(s["bbox"][1] * 2) / 2 for s in members})
        gaps = [b - a for a, b in zip(ys, ys[1:]) if b - a >= band * 0.7]
        grouped.append({
            "font": font, "ink": ink, "flags": flags, "size_band": band,
            "spans": len(members), "glyphs": sum(s["glyph_count"] for s in members),
            "median_x": round(median(xs), 3),
            "median_y_gap": round(median(gaps), 3) if gaps else None,
        })
    return log, spans, grouped, symbols


def inspect_page(page, coordinates):
    started = perf_counter()
    drawings = page.get_drawings()
    trace_log, spans, styles, symbols = styles_and_spans(page, coordinates)
    cases = visible_cases(page, case_seeds(page, drawings), drawings, symbols)
    for case in cases:
        x, y, w, h = case["bbox"]
        candidates = [
            (sx - x - w, index)
            for index, span in enumerate(spans)
            for sx, sy, _, sh in [span["bbox"]]
            if span["visibility"] == "painted" and -1 <= sx - x - w <= w * 8
            and abs(sy + sh / 2 - y - h / 2) <= h
        ]
        case["right_span"] = min(candidates)[1] if candidates else None
    paint_counts = Counter(paint for paint, _, _ in trace_log)
    raw_glyphs = sum(
        len(span["chars"])
        for block in page.get_text("rawdict", flags=pdf.TEXTFLAGS_RAWDICT & ~pdf.TEXT_PRESERVE_IMAGES)["blocks"]
        if block["type"] == 0
        for line in block["lines"]
        for span in line["spans"]
    )
    return {
        "pageIndex": page.number, "width": page.rect.width, "height": page.rect.height,
        "rotation": page.rotation, "rotation_matrix": list(page.rotation_matrix),
        "paint_counts": dict(paint_counts), "rawdict_glyphs": raw_glyphs,
        "text_spans": spans, "styles": styles, "cases": cases, "symbols": [record for _, record in symbols],
        "drawings": [{
            "bbox": bounds(canonical(page, d["rect"])),
            "seq": d["seqno"], "kind": d["type"], "primitives": dict(Counter(p[0] for p in d["items"])),
            "fill": rgba_color(d.get("fill"), d.get("fill_opacity")),
            "stroke": rgba_color(d.get("color"), d.get("stroke_opacity")),
            "stroke_width": d.get("width"), "layer": d.get("layer"),
        } for d in drawings],
        "annotations": [{"type": a.type[1], "bbox": bounds(canonical(page, a.rect)), "flags": a.flags, "opacity": a.opacity} for a in (page.annots() or ())],
        "widgets": [{"type": w.field_type_string, "bbox": bounds(canonical(page, w.rect))} for w in (page.widgets() or ())],
        "ms": round((perf_counter() - started) * 1_000, 2),
    }


def observe(path, coordinates=False):
    with pdf.open(path) as document:
        pages = [inspect_page(page, coordinates) for page in document]
    # A characteristic size is inferred from confirmed frames. Keep all candidates for the consumer.
    widths = [
        (case["bbox"][2] + case["bbox"][3]) / 2
        for page in pages for case in page["cases"] if case["state"] in {"empty", "marked"}
    ]
    votes = Counter(round(width * 2) / 2 for width in widths)
    reference = [
        round(median([w for w in widths if abs(w - bucket) <= 0.3]), 3)
        for bucket, count in votes.most_common()[:4] if count >= 2
    ]
    for page in pages:
        for case in page["cases"]:
            size = (case["bbox"][2] + case["bbox"][3]) / 2
            case["near_document_size"] = any(abs(size - w) <= w * 0.2 for w in reference)
    return {
        "format": "unspoil-vector-observation/1",
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "tool": {"pymupdf": pdf.__version__, "numpy": np.__version__},
        "case_size_modes": reference,
        "pages": pages,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--glyphs", action="store_true", help="Include glyph geometry; no character strings.")
    args = parser.parse_args()
    print(json.dumps(observe(args.pdf, args.glyphs), separators=(",", ":"), allow_nan=False))


if __name__ == "__main__":
    main()

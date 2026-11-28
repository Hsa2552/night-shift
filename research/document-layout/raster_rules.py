"""Diagnostic ablation for broken rules in raster pages. Requires the existing PDF lab venv."""

import argparse
from hashlib import sha256
import json
from pathlib import Path
from statistics import median
from time import perf_counter

import numpy as np
import pymupdf as fitz

from experiment import block_scores
from rulings import ruled_regions


def raster_strokes(image, em, resolution, close):
    sample = image[::8, ::8].astype(np.float32)
    paper = np.median(sample)
    mad = np.median(np.abs(sample - paper))
    binary = image < min(242, max(60, paper - max(14, 4 * mad)))
    minimum = max(12, round(5 * em * resolution))
    bridge = round(.4 * em * resolution) if close else 0
    strokes = []
    for axis, along in enumerate((binary, binary.T)):
        for normal, scan in enumerate(along):
            dark = np.flatnonzero(scan)
            if not dark.size:
                continue
            starts = np.r_[0, np.flatnonzero(np.diff(dark) > 1 + bridge) + 1]
            stops = np.r_[starts[1:] - 1, dark.size - 1]
            for lo, hi in zip(dark[starts], dark[stops] + 1, strict=True):
                if hi - lo < minimum:
                    continue
                box = (lo, normal, hi, normal + 1) if axis == 0 else (normal, lo, normal + 1, hi)
                strokes.append({"orientation": "h" if axis == 0 else "v",
                                "box": [float(value) / resolution for value in box]})
    return strokes


def evaluate(pdf, page_index, truth, resolution):
    with fitz.open(pdf) as document:
        page = document[page_index]
        pix = page.get_pixmap(matrix=fitz.Matrix(resolution, resolution), colorspace=fitz.csGRAY)
        image = np.frombuffer(pix.samples_mv, dtype=np.uint8).reshape(pix.height, pix.width)
        words = page.get_text("words")
        em = median(w[3] - w[1] for w in words) if words else min(page.rect.width, page.rect.height) / 64
    output = {}
    for close in (False, True):
        start = perf_counter()
        regions = ruled_regions(raster_strokes(image, em, resolution, close), em)
        label = "closing" if close else "uninterrupted"
        output[label] = {"regions": len(regions), "ms": round((perf_counter() - start) * 1000, 1)}
        if truth is not None:
            output[label].update(block_scores(truth, [region["box"] for region in regions]))
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("page", type=int, help="One-based index")
    parser.add_argument("--scale", type=float, default=1.5, choices=[1, 1.5, 2])
    args = parser.parse_args()
    truth_path = Path(__file__).with_name("public-reference.json")
    reference = json.loads(truth_path.read_bytes())
    digest = sha256(args.pdf.read_bytes()).hexdigest()
    truth = reference.get(digest, {}).get(str(args.page), {}).get("rulings")
    result = evaluate(args.pdf, args.page - 1, truth, args.scale)
    print(json.dumps({"pdf": digest, "page": args.page, "scale": args.scale, **result}))

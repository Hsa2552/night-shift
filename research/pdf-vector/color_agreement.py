"""Compare chromatic pixels at painted spans with the PDF's native ink, without using roles."""

import argparse
from collections import defaultdict
from hashlib import sha256
import json
import math
from pathlib import Path

import numpy as np
import pymupdf as pdf

from score import load


def compare(path, observation):
    if sha256(path.read_bytes()).hexdigest() != observation["sha256"]:
        raise ValueError("The observations were measured on a different PDF")
    totals = defaultdict(lambda: dict(spans=0, with_ink=0, strong_agreement=0, pixels=0, agree=0))
    with pdf.open(path) as document:
        for page, measured in zip(document, observation["pages"], strict=True):
            chromatic_spans = [
                span for span in measured["text_spans"]
                if span["visibility"] == "painted"
                and span["ink"] and len(span["ink"]) == 4
                and span["ink"][-1] >= 0.95
                and max(span["ink"][:-1]) - min(span["ink"][:-1]) > 0.2
            ]
            if not chromatic_spans:
                continue
            scale = min(2.0, math.sqrt(6_000_000 / page.rect.get_area()))
            pix = page.get_pixmap(matrix=pdf.Matrix(scale, scale), colorspace=pdf.csRGB)
            pixels = np.frombuffer(pix.samples_mv, dtype=np.uint8).reshape(pix.height, pix.width, 3)
            for span in chromatic_spans:
                ink = np.rint(np.array(span["ink"][:3]) * 255).astype(int)
                key = "#" + "".join(f"{v:02x}" for v in ink)
                stat = totals[key]
                stat["spans"] += 1
                x, y, w, h = span["bbox"]
                x0, x1 = np.clip([math.floor(x * scale), math.ceil((x + w) * scale)], 0, pix.width)
                y0, y1 = np.clip([math.floor(y * scale), math.ceil((y + h) * scale)], 0, pix.height)
                sample = pixels[y0:y1, x0:x1].reshape(-1, 3)
                chromatic = sample[np.ptp(sample, axis=1) >= 34]
                if len(chromatic) < 3:
                    continue
                stat["with_ink"] += 1
                stat["pixels"] += len(chromatic)
                # Antialiased pixels can lie between the native RGB and the white page.
                direction = 255.0 - ink
                distance = 255.0 - chromatic
                strength = distance @ direction / (direction @ direction)
                residual = np.max(np.abs(distance - strength[:, None] * direction), axis=1)
                matches = int(np.count_nonzero((strength >= 0.1) & (residual <= 20)))
                stat["agree"] += matches
                stat["strong_agreement"] += matches >= 0.90 * len(chromatic)
    return {
        color: {**stat, "compatible_fraction": round(stat["agree"] / stat["pixels"], 4)
                if stat["pixels"] else None}
        for color, stat in sorted(totals.items())
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("observation", type=Path)
    args = parser.parse_args()
    print(json.dumps(compare(args.pdf, load(args.observation)), indent=2))


if __name__ == "__main__":
    main()

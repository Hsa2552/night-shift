"""Score one-to-one object matches against explicit, external geometry observations."""

import argparse
from collections import Counter
import json
from pathlib import Path
from statistics import mean, median


def load(path):
    return json.loads(path.read_bytes())


def iou(a, b):
    x, y, w, h = a
    u, v, s, t = b
    overlap = max(0, min(x+w, u+s) - max(x, u)) * max(0, min(y+h, v+t) - max(y, v))
    return overlap / (w*h+s*t-overlap) if overlap else 0


def score(reference, observed, threshold=0.60):
    matches = []
    used_ref, used_obs = set(), set()
    candidates = []
    for i, a in enumerate(reference):
        for j, b in enumerate(observed):
            if a["pageIndex"] == b["pageIndex"]:
                overlap = iou(a["bbox"], b["bbox"])
                if overlap >= threshold:
                    candidates.append((overlap, i, j))
    for overlap, i, j in sorted(candidates, reverse=True):
        if i not in used_ref and j not in used_obs:
            used_ref.add(i)
            used_obs.add(j)
            matches.append((overlap, reference[i], observed[j]))

    confusion = Counter((a["state"], b["state"]) for _, a, b in matches)
    return {
        "targets": len(reference), "matches": len(matches),
        "missing": dict(Counter(a["state"] for i, a in enumerate(reference) if i not in used_ref)),
        "unmatched": len(observed) - len(matches),
        "state_table": {f"{left}/{right}": n for (left, right), n in sorted(confusion.items())},
        "median_iou": round(median(m[0] for m in matches), 3) if matches else None,
        "mean_iou": round(mean(m[0] for m in matches), 3) if matches else None,
    }


def observations(report, confirmed_only=False):
    return [
        {**case, "pageIndex": page["pageIndex"]}
        for page in report["pages"] for case in page["cases"]
        if not confirmed_only or case["state"] != "ambiguous"
    ]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("truth", type=Path, help="Prior annotation with elements carrying filled and bbox.")
    parser.add_argument("vector", type=Path)
    parser.add_argument("--raster", type=Path, help="Output of compare-browser.mjs.")
    parser.add_argument("--pdfjs", type=Path, help="Output of compare-browser.mjs --vector.")
    parser.add_argument("--iou", type=float, default=0.60)
    args = parser.parse_args()
    vector = load(args.vector)
    candidates = load(args.truth)["elements"]
    reference = [
        {
            "pageIndex": a["pageIndex"], "bbox": [a["bbox"][k] for k in ("x", "y", "width", "height")],
            "state": "filled" if a["filled"] else "empty",
        }
        for a in candidates if "filled" in a
    ]
    result = {
        "vector": score(reference, observations(vector, confirmed_only=True), args.iou),
        "ambiguous_vector": sum(case["state"] == "ambiguous" for case in observations(vector)),
        "vector_ms_sum": round(sum(p["ms"] for p in vector["pages"]), 2),
    }
    if args.raster:
        raster = next(d for d in load(args.raster)["documents"] if d["sha256"] == vector["sha256"])
        result["raster"] = score(reference, observations(raster), args.iou)
        result["raster_box_ms_sum"] = round(sum(p["ms"] for p in raster["pages"]), 2)
        result["raster_render_ms_sum"] = round(sum(p["rasterMs"] for p in raster["pages"]), 2)
    if args.pdfjs:
        native = next(d for d in load(args.pdfjs)["documents"] if d["sha256"] == vector["sha256"])
        result["pdfjs"] = score(reference, observations(native), args.iou)
        result["pdfjs_ms_sum"] = round(sum(p["ms"] for p in native["pages"]), 2)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

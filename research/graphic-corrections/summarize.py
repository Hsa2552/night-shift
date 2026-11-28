"""Aggregate the isolated Edge diagnostic. Variants remain separate from public references."""

import argparse
import json
from pathlib import Path
from statistics import median


def totals(entries):
    correction = [r for r in entries if r["role"] == "correction"]
    statement = [r for r in entries if r["role"] == "statement"]
    return {
        "strict": sum(r["strict"] for r in correction), "corrections": len(correction),
        "statement_touched": sum(r["masked"] > 0 for r in statement), "statements": len(statement),
        "pixels_covered": sum(r["masked"] for r in correction),
        "pixels_revealing": sum(r["ink"] for r in correction),
        "associated_strict": sum(0 < r["ink"] == r["associated"] for r in correction),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("result", type=Path)
    args = parser.parse_args()
    documents = json.loads(args.result.read_bytes())
    for name, filtered in (
        ("public", [d for d in documents if "diagnostic public" in d["label"]]),
        ("synthetic", [d for d in documents if d["label"] in {"synthetic", "synthetic-variant"}]),
        ("rotated", [d for d in documents if d["label"] == "synthetic-rotated"]),
    ):
        pages = [p for d in filtered for p in d["pages"]]
        if not pages:
            continue
        print(json.dumps({"sample": name, "mode": "historic", **totals([r for p in pages for r in p["historic"]])}))
        for mode in ("perception-only", "context", "native", "raster", "hybrid", "historical-blocks-only"):
            measurements = [m for p in pages for m in p["methods"] if m["name"] == mode]
            perception = [m["perception"] for m in measurements]
            ious = [iou for p in perception for iou in p["iou"]]
            print(json.dumps({"sample": name, "mode": mode,
                **totals([r for m in measurements for r in m["results"]]),
                "matched": sum(p["matched"] for p in perception),
                "targets": sum(p["targets"] for p in perception),
                "proposals": sum(p["candidatesOnPage"] for p in perception),
                "median_iou": round(median(ious), 3) if ious else None,
                "ambiguities": sum(m["ambiguity"] for m in measurements),
                "contradictions": sum(m["contradictions"] for m in measurements),
                "median_ms": round(median(m["ms"] for m in measurements), 1),
                "total_ms": round(sum(m["ms"] for m in measurements), 1)}))

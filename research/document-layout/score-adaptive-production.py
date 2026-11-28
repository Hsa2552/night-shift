"""Measure the production C1 alternative and its activation without Python's baseline hints."""

import argparse
from collections import defaultdict
import json
from pathlib import Path

from experiment import expand_reference, line_scores


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("trace", type=Path)
    args = parser.parse_args()
    traces = json.loads(args.trace.read_bytes())
    reference = json.loads(Path(__file__).with_name("public-reference.json").read_bytes())
    results = defaultdict(lambda: defaultdict(list))
    for doc in traces["docs"]:
        for page in doc["pages"]:
            if "production" not in page:
                continue
            truth = page.get("truth") or reference.get(doc["sha256"], {}).get(page["key"])
            if not truth:
                continue
            group = "public" if not doc.get("synthetic") else (
                "synthetic" if page["key"].endswith("/base") else "variants")
            current = {"lines": [line["box"] for line in page["baseline"]["lines"]]}
            configs = {"current": current, **page["production"]}
            for name in ("current", "local", "xy", "conditional"):
                score = line_scores(page, expand_reference(truth), configs[name])
                score["activation"] = int(page["production"]["activation"] != "off")
                results[group][name].append(score)
    for group, variants in results.items():
        for name, scores in variants.items():
            common = sum(s["pair"]["common"] for s in scores)
            total = sum(s["pair"]["expected"] + s["pair"]["output"] for s in scores)
            print(json.dumps({"group": group, "mode": name, "pages": len(scores),
                "activation": sum(s["activation"] for s in scores),
                "pair_f1": round(2 * common / total, 4),
                "mixed_lines": sum(s["mixed_col_lines"] for s in scores),
                "order_agree": sum(s["order_agree"] for s in scores),
                "order_pairs": sum(s["order_pairs"] for s in scores)}))

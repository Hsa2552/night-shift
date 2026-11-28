"""Compare independent physical layout methods against one shared reference."""

import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path
from statistics import median
from time import perf_counter

from geometry import (StripIndex, adaptive_lines, area, center, envelope, gap, iou,
                      neighbor_blocks, normalized_fragments, overlap, turn_box, xy_cut)


def graph(lines, blocks, order, objects, spacing, width, height):
    boxes = [line["box"] for line in lines]
    index = StripIndex([center(box) for box in boxes], 2 * spacing.em)
    edges = []
    for index_line, line in enumerate(lines):
        edges.extend({"from": f"fragment:{i}", "to": f"line:{index_line}", "kind": "same-line"}
                     for i in line["parts"])
    for group, ids in enumerate(blocks):
        edges.extend({"from": f"line:{i}", "to": f"block:{group}", "kind": "same-block"}
                     for i in ids)
    for a, b in zip(order, order[1:]):
        edges.append({"from": f"line:{a}", "to": f"line:{b}", "kind": "next-read"})
        if lines[a]["font"] is not None and lines[a]["font"] == lines[b]["font"]:
            edges.append({"from": f"line:{a}", "to": f"line:{b}", "kind": "same-font"})

    links = defaultdict(list)
    for obj_index, obj in enumerate(objects):
        box = obj["box"]
        if area(box) <= 0 or area(box) >= .6 * width * height:
            continue
        x, y = center(box)
        sample_x = (box[0], x, box[2])
        sample_y = (box[1], y, box[3])
        nearby = set(i for px in sample_x for py in sample_y
                     for i in index.around(px, py, 3 * spacing.em, limit=3))
        found = []
        for i in nearby:
            line = boxes[i]
            along = overlap(box, line, 0) / max(1e-6, min(box[2] - box[0], line[2] - line[0]))
            containment = overlap(box, line, 0) * overlap(box, line, 1) / max(1e-6, area(line))
            dx, dy = gap(box, line, 0), gap(box, line, 1)
            distance = ((dx / spacing.em) ** 2 + (dy / spacing.lead) ** 2) ** .5
            if distance > 4:
                continue
            score = distance + .75 * (1 - along) + .35 * abs(y - center(line)[1]) / spacing.lead
            kind = "contains" if containment >= .93 else "aligned" if along >= .45 else "near"
            if kind == "contains":
                score -= 2
            found.append((score, i, kind, along, containment, distance))
        for rank, (score, i, kind, along, containment, distance) in enumerate(sorted(found)[:4]):
            edge = {"from": f"object:{obj_index}", "to": f"line:{i}", "kind": kind,
                    "rank": rank + 1, "cost": round(score, 4),
                    "x_overlap": round(along, 4), "containment": round(containment, 4),
                    "gap_normalized": round(distance, 4)}
            edges.append(edge)
            links[obj_index].append(i)
    return edges, links


def reconstruct(page):
    start = perf_counter()
    rotation, fragments = normalized_fragments(page["fragments"])
    lines, spacing, candidates = adaptive_lines(fragments)
    line_ms = (perf_counter() - start) * 1000
    results = {}
    for name, partition in (("xy", lambda: xy_cut(lines, spacing)),
                            ("neighbors", lambda: neighbor_blocks(lines, spacing, candidates))):
        begin = perf_counter()
        blocks = partition()
        order = [i for group in blocks for i in group]
        results[name] = {
            "lines": [turn_box(lines[i]["box"], -rotation) for i in order],
            "parts": [lines[i]["parts"] for i in order],
            "blocks": [turn_box(envelope(lines[i]["box"] for i in group), -rotation) for group in blocks],
            "ms": line_ms + (perf_counter() - begin) * 1000,
        }
    objects = [{**obj, "box": turn_box(obj["box"], rotation)} for obj in page.get("objects", [])]
    use = xy_cut(lines, spacing)
    order = [i for group in use for i in group]
    begin = perf_counter()
    edges, rankings = graph(lines, use, order, objects, spacing, page["width"], page["height"])
    position = {i: j for j, i in enumerate(order)}
    areas = defaultdict(list)
    baseline = page["baseline"]
    for line in baseline["lines"]:
        areas[line["area"]].append(line["box"])
    results["current"] = {
        "lines": [line["box"] for line in baseline["lines"]],
        "blocks": [envelope(boxes) for boxes in areas.values()],
        "ms": baseline["ms"],
    }
    results["graph"] = {
        "lines": results["xy"]["lines"],
        "parts": results["xy"]["parts"],
        "blocks": results["xy"]["blocks"],
        "edges": edges,
        "rankings": {key: [position[i] for i in items] for key, items in rankings.items()},
        "ms": results["xy"]["ms"] + (perf_counter() - begin) * 1000,
    }
    return results, {"quarter_normalized": rotation, "spacing": vars(spacing)}


def assignment(fragments, boxes):
    output = {}
    for key, fragment in enumerate(fragments):
        rect = fragment["box"]
        x, y = center(rect)
        ranked = []
        for i, box in enumerate(boxes):
            common = overlap(rect, box, 0) * overlap(rect, box, 1)
            if box[0] <= x <= box[2] and box[1] <= y <= box[3]:
                ranked.append((-common, abs(y - center(box)[1]), i))
        if ranked:
            output[key] = min(ranked)[2]
    return output


def pair_score(truth, actual):
    gold = Counter(truth.values())
    seen = Counter(actual.values())
    common = Counter((truth[key], group) for key, group in actual.items())
    def pairs(n):
        return n * (n - 1) // 2
    tp = sum(map(pairs, common.values()))
    expected = sum(map(pairs, gold.values()))
    output = sum(map(pairs, seen.values()))
    return {"common": tp, "expected": expected, "output": output,
            "f1": round(2 * tp / (expected + output), 4) if expected + output else None}


def line_scores(page, truth, prediction):
    reference = assignment(page["fragments"], [x["box"] for x in truth])
    if "parts" in prediction:
        found = {i: j for j, group in enumerate(prediction["parts"]) for i in group if i in reference}
    else:
        found = {k: j for k, j in assignment(page["fragments"], prediction["lines"]).items()
                 if k in reference}
    by_expected = defaultdict(Counter)
    by_found = defaultdict(set)
    for key, group in found.items():
        by_expected[reference[key]][group] += 1
        column = truth[reference[key]].get("column")
        if column is not None:
            by_found[group].add(column)
    representatives = {}
    for key, groups in by_expected.items():
        choices = groups.most_common(2)
        if len(choices) == 1 or choices[0][1] != choices[1][1]:
            representatives[key] = choices[0][0]
    active = sorted(set(reference.values()))
    expected = len(active) * (len(active) - 1) // 2
    ordered = sum(representatives.get(i, float("inf")) < representatives.get(j, -float("inf"))
                  for i in active for j in active if i < j)
    return {"fragments": len(reference), "assigned": len(found),
            "lines": len(active), "line_hits": len(representatives),
            "pair": pair_score(reference, found),
            "order_agree": ordered, "order_pairs": expected,
            "mixed_col_lines": sum(len(c) > 1 for c in by_found.values())}


def block_scores(truth, observed):
    # Scope the count to the annotated regions, while keeping conflated boxes.
    seen = [b for b in observed if any(overlap(a, b, 0) * overlap(a, b, 1) > .1 * min(area(a), area(b)) for a in truth)]
    possibilities = sorted(((iou(a, b), i, j) for i, a in enumerate(truth)
                            for j, b in enumerate(seen)), reverse=True)
    gold, predicted, scores = set(), set(), []
    for score, i, j in possibilities:
        if score < .5:
            break
        if i not in gold and j not in predicted:
            gold.add(i)
            predicted.add(j)
            scores.append(score)
    return {"matched": len(scores), "expected": len(truth), "observed": len(seen),
            "median_iou": round(median(scores), 3) if scores else None}


def link_scores(page, truth, prediction, use_graph):
    successes = total = coverage = 0
    for link in truth:
        objects = page.get("objects", [])
        by_iou = [(iou(obj["box"], link["object"]), i) for i, obj in enumerate(objects) if obj["kind"] == link["kind"]]
        fit, index = max(by_iou, default=(0, -1))
        total += 1
        if fit < .5 or not prediction["lines"]:
            continue
        if use_graph:
            ranks = prediction["rankings"].get(index, ())
            if not ranks:
                continue
            chosen = ranks[0]
        else:
            box = objects[index]["box"]
            chosen = min(range(len(prediction["lines"])), key=lambda i: (
                sum(gap(box, prediction["lines"][i], axis)**2 for axis in (0, 1)),
                abs(center(box)[1] - center(prediction["lines"][i])[1])))
        coverage += 1
        line = prediction["lines"][chosen]
        if any(iou(line, target) >= .45 for target in link["targets"]):
            successes += 1
    return {"hits": successes, "expected": total, "covered": coverage}


def expand_reference(truth):
    return [
        {"box": (left, y - pad, right, y + pad), "column": group.get("column")}
        for group in truth.get("rows", ())
        for left, right, pad in [group["range"]]
        for y in group["y"]
    ] + truth.get("lines", [])


def measure(trace, reference, intermediate):
    for doc in trace["docs"]:
        labels = reference.get(doc["sha256"], {})
        print(json.dumps({"logical": {
            "sha256": doc["sha256"], "pages": len(doc["pages"]),
            "tagged": sum(p.get("structureNodes", 0) > 0 for p in doc["pages"]),
            "marked": sum(p.get("marked", 0) for p in doc["pages"]),
            "marked_ids": sum(p.get("markedIds", 0) for p in doc["pages"]),
            "outline": doc.get("outline", 0), "fields": doc.get("fields", 0), "layers": doc.get("layers", 0),
        }}))
        for page in doc["pages"]:
            truth = labels.get(page["key"], page.get("truth"))
            if truth is None:
                continue
            predictions, model = reconstruct(page)
            rows = expand_reference(truth)
            answer = {"page": page["key"], "group": "synthetic" if doc.get("synthetic") else labels["label"]}
            for name, result in predictions.items():
                answer[name] = {
                    "ms": round(result["ms"], 3),
                    **(line_scores(page, rows, result) if name != "graph" else {}),
                    **({"blocks": block_scores(truth["blocks"], result["blocks"])} if truth.get("blocks") and name != "graph" else {}),
                    **({"links": link_scores(page, truth["links"], result, name == "graph")} if truth.get("links") and name in {"current", "graph"} else {}),
                    **({"edges": len(result["edges"])} if name == "graph" else {}),
                }
            print(json.dumps(answer))
            if intermediate is not None:
                intermediate.append({"sha256": doc["sha256"], "key": page["key"], "model": model, "objects": page.get("objects", []), "predictions": predictions})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("trace", type=Path)
    parser.add_argument("--reference", type=Path, default=Path(__file__).with_name("public-reference.json"))
    parser.add_argument("--intermediate", type=Path)
    args = parser.parse_args()
    records = []
    measure(json.loads(args.trace.read_bytes()), json.loads(args.reference.read_bytes()),
            records if args.intermediate else None)
    if args.intermediate:
        args.intermediate.write_text(json.dumps(records), encoding="utf-8")


if __name__ == "__main__":
    main()

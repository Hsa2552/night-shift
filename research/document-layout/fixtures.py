"""Generate fully annotated synthetic layouts. No PDF text or external data is included."""

import argparse
import json
from pathlib import Path

from geometry import envelope, turn_box, turn


def fixture(name, groups, *, sx=1, sy=1, margin=0, quarter=0, letter=1, links=()):
    page = {"key": name, "width": 520 * sx + 2 * margin, "height": 590 * sy + 2 * margin,
            "fragments": [], "objects": []}
    mirror = page["height"]

    def project(p):
        x, y = turn((p[0] * sx + margin, p[1] * sy + margin), quarter)
        return [x + (mirror if quarter else 0), y]

    def project_box(box):
        x, y, u, v = box
        raw = turn_box((x * sx + margin, y * sy + margin, u * sx + margin, v * sy + margin), quarter)
        return [raw[0] + (mirror if quarter else 0), raw[1], raw[2] + (mirror if quarter else 0), raw[3]]

    truth = {"lines": [], "blocks": [], "links": []}
    for column, rows in groups:
        group = []
        for x, y, size, widths in rows:
            boxes = []
            for i, width in enumerate(widths):
                box = (x, y - size * letter * .8, x + width, y + letter * size * .2)
                boxes.append(project_box(box))
                page["fragments"].append({
                    "box": boxes[-1], "chars": max(2, round(width / (size * .49))),
                    "axis": turn((1, 0), quarter), "baseline": project((x, y)),
                    "font": "text" if i != 3 else "math",
                })
                x += width + size * .29
            whole = envelope(boxes)
            group.append(whole)
            truth["lines"].append({"box": whole, "column": column})
        truth["blocks"].append(envelope(group))
    for kind, box, targets in links:
        obj = {"kind": kind, "box": project_box(box)}
        page["objects"].append(obj)
        truth["links"].append({"kind": kind, "object": obj["box"],
                               "targets": [truth["lines"][i]["box"] for i in targets]})
    if quarter:
        page["width"], page["height"] = page["height"], page["width"]
    page["truth"] = truth
    return page


def rowset(x, start, n, shape=(31, 42, 55, 46), step=16, size=10):
    return [(x + (3 if i == 0 else 0), start + i * step, size, shape if i < n - 1 else shape[:2])
            for i in range(n)]


def fixtures():
    close_columns = [
        (0, rowset(55, 105, 6, (34, 47, 43, 44))),
        (1, rowset(241, 105, 6, (48, 39, 37, 35))),
    ]
    headings = [
        (None, [(53, 78, 14, (350,))]),
        (0, rowset(53, 109, 4)),
        (1, rowset(274, 115, 4)),
        (None, [(53, 191, 13, (380,))]),
        (0, rowset(53, 225, 4)),
        (1, rowset(274, 232, 4)),
    ]
    drawings = [
        (0, rowset(53, 114, 3, (44, 38, 55))),
        (0, [(65, 167, 11, (80, 42))]),
        (1, rowset(260, 106, 4, (36, 39, 49))),
        (1, rowset(273, 234, 3, (60, 44, 37))),
        (0, rowset(58, 299, 3, (43, 54))),
    ]
    return [
        fixture("prose/base", [(0, rowset(53, 108, 5)), (0, rowset(53, 210, 5))]),
        fixture("tight-columns/base", close_columns),
        fixture("mixed-bands/base", headings),
        fixture("three-columns/base", [(i, rowset(40 + 151 * i, 110, 6, (29, 36, 46))) for i in range(3)]),
        fixture("figures/base", drawings, links=[
            ("image", (296, 173, 391, 223), (8,)),
            ("frame", (263, 210, 446, 279), (9,)),
            ("symbol", (47, 284, 55, 295), (11,)),
        ]),
        fixture("tight-columns/half-scale", close_columns, sx=.5, sy=.5),
        fixture("tight-columns/wide-margins", close_columns, margin=140),
        fixture("mixed-bands/rotate-90", headings, quarter=1),
        fixture("mixed-bands/leading", headings, sy=1.45, letter=.74),
        fixture("prose/larger-glyphs", [(0, rowset(53, 108, 5)), (0, rowset(53, 210, 5))], letter=1.27),
    ]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    path = parser.parse_args().output
    path.write_text(json.dumps(fixtures()), encoding="utf-8")

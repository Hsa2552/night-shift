"""Produce synthetic diagnostic PDFs and independent geometry specifications."""

import argparse
import hashlib
import json
from pathlib import Path

import pymupdf as f


def dataset(pdf, scale, margin, color):
    truth = []

    def coords(x, y, w, h):
        return [x * scale + margin, y * scale + margin, w * scale, h * scale]

    def new():
        page = pdf.new_page(width=260 * scale + 2 * margin, height=270 * scale + 2 * margin)
        case = {"pageIndex": page.number, "targets": [], "anchors": [], "protected": [], "mixed": []}
        truth.append(case)
        return page, case

    def paint(page, box, rgb, fill=True):
        color = tuple(v / 255 for v in rgb)
        r = f.Rect(box[0], box[1], box[0]+box[2], box[1]+box[3])
        page.draw_rect(r, color=color, fill=color if fill else None, width=1.1*scale)

    def text(page, x, y, value):
        X, Y, _, _ = coords(x, y, 0, 0)
        page.insert_text((X, Y), value, fontsize=11*scale)

    def own(case, id, region, scope, role="correction"):
        case["anchors"].append({"id": id, "role": role, "reliability": "confirmed",
            "blockId": id, "region": coords(*region), "scope": coords(*scope)})

    def target(case, bbox, role, kind, block=None, rgb=None):
        case["targets"].append({"kind": kind, "role": role, "box": coords(*bbox),
            **({"blockId": block} if block else {}), **({"rgb": rgb} if rgb else {})})

    page, case = new()
    text(page, 23, 31, "Question figure")
    paint(page, coords(38, 49, 138, 43), (40, 40, 40), False)
    own(case, "question", (21, 20, 121, 15), (17, 15, 202, 90), "question")
    target(case, (36, 47, 142, 47), "statement", "figure")
    text(page, 23, 130, "Correction, two independent drawings")
    paint(page, coords(33, 153, 45, 33), (30, 30, 30), False)
    paint(page, coords(101, 157, 45, 29), color)
    own(case, "figures", (19, 117, 186, 17), (17, 112, 205, 110))
    target(case, (31, 151, 49, 37), "correction", "figure", "figures")
    target(case, (99, 155, 49, 33), "correction", "fill", "figures")

    page, case = new()
    text(page, 25, 34, "Reference graphic and correction additions")
    paint(page, coords(40, 122, 136, 5), (27, 27, 27))
    paint(page, coords(53, 69, 58, 5), color)
    paint(page, coords(119, 82, 31, 6), color)
    case["mixed"].append({"region": coords(30, 53, 163, 90), "blockId": "overlay", "correctionRgb": color})
    case["protected"].append(coords(38, 120, 140, 9))
    target(case, (38, 120, 140, 9), "statement", "figure")
    target(case, (51, 67, 62, 9), "correction", "fill", "overlay", color)
    target(case, (117, 80, 35, 10), "correction", "fill", "overlay", color)

    page, case = new()
    text(page, 25, 38, "Data table")
    text(page, 28, 63, "Energy")
    text(page, 150, 63, "Temperature")
    for x in (20, 124, 230):
        paint(page, coords(x, 47, 1, 44), (42, 42, 42))
    for y in (47, 70, 90):
        paint(page, coords(20, y, 211, 1), (42, 42, 42))
    own(case, "data", (23, 25, 85, 14), (15, 17, 220, 86), "question")
    target(case, (19, 46, 213, 47), "statement", "table")
    text(page, 25, 123, "Computed results")
    text(page, 29, 169, "124")
    text(page, 150, 169, "379")
    for x in (20, 124, 230):
        paint(page, coords(x, 143, 1, 68), (42, 42, 42))
    for y in (143, 177, 210):
        paint(page, coords(20, y, 211, 1), (42, 42, 42))
    own(case, "results", (23, 110, 115, 18), (15, 105, 224, 117))
    target(case, (19, 142, 214, 71), "correction", "table", "results")

    return truth


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("reference", type=Path)
    parser.add_argument("--variant", action="store_true")
    parser.add_argument("--rotated", action="store_true")
    args = parser.parse_args()
    with f.open() as pdf:
        pages = dataset(pdf, .8 if args.variant else 1, 37 if args.variant else 0,
                        (0, 68, 193) if args.variant else (176, 0, 116))
        if args.rotated:
            for page, case in zip(pdf, pages, strict=True):
                height = page.rect.height
                page.set_rotation(90)

                def rotated(bbox):
                    x, y, w, h = bbox
                    return [height - y - h, x, h, w]

                case["protected"] = [rotated(b) for b in case["protected"]]
                for anchor in case["anchors"]:
                    anchor["region"], anchor["scope"] = rotated(anchor["region"]), rotated(anchor["scope"])
                for figure in case["mixed"]:
                    figure["region"] = rotated(figure["region"])
                for item in case["targets"]:
                    item["box"] = rotated(item["box"])
        pdf.save(args.pdf)
    args.reference.write_text(json.dumps({
        "label": "synthetic-rotated" if args.rotated else "synthetic-variant" if args.variant else "synthetic",
        "sha256": hashlib.sha256(args.pdf.read_bytes()).hexdigest(), "pages": pages,
        "renderScale": 2 if args.variant else 1.5,
    }), encoding="utf-8")

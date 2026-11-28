"""Create a synthetic control with one interactive field and one optional layer."""

import argparse
from pathlib import Path

import pymupdf as fitz


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    path = parser.parse_args().output
    with fitz.open() as document:
        page = document.new_page(width=240, height=240)
        layer = document.add_ocg("Synthetic layer", on=True)
        page.draw_rect(fitz.Rect(30, 60, 120, 95), color=(0, 0, 0), oc=layer)
        widget = fitz.Widget()
        widget.field_name = "synthetic_check"
        widget.field_type = fitz.PDF_WIDGET_TYPE_CHECKBOX
        widget.rect = fitz.Rect(38, 68, 48, 78)
        page.add_widget(widget)
        document.save(path)

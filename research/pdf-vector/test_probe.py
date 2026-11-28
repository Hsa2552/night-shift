"""Synthetic geometry controls. The generated pages are kept in a temporary directory."""
import tempfile
from pathlib import Path
import unittest

import pymupdf as pdf

from probe import observe
from score import score


class VectorObservationTests(unittest.TestCase):
    def test_rectangles_marks_occlusion_and_rotation(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "synthetic.pdf"
            with pdf.open() as document:
                page = document.new_page(width=160, height=120)
                black, white = (0, 0, 0), (1, 1, 1)
                page.draw_rect(pdf.Rect(20, 20, 30, 30), color=black, fill=white)
                page.insert_text(pdf.Point(22, 28), "A", fontsize=7)
                page.draw_rect(pdf.Rect(40, 20, 50, 30), color=black, fill=black)
                page.draw_rect(pdf.Rect(60, 20, 70, 30), color=black, fill=white)
                page.draw_polyline([pdf.Point(62, 24), pdf.Point(64, 27), pdf.Point(68, 22)])
                page.draw_rect(pdf.Rect(80, 20, 90, 30), color=black, fill=black)
                page.draw_rect(pdf.Rect(76, 16, 94, 34), color=None, fill=white)
                page.insert_text(pdf.Point(20, 70), "invisible", render_mode=3)
                page.set_cropbox(pdf.Rect(10, 5, 150, 105))
                page.set_rotation(90)
                document.save(path)
            result = observe(path, coordinates=True)
        page = result["pages"][0]
        self.assertEqual((page["width"], page["height"]), (100, 140))
        self.assertEqual([case["state"] for case in page["cases"][:4]], ["empty", "filled", "marked", "ambiguous"])
        self.assertEqual(page["cases"][0]["bbox"], [75.0, 10.0, 10.0, 10.0])
        self.assertEqual(page["paint_counts"]["ignore-text"], 1)
        self.assertIn("invisible", {span["visibility"] for span in page["text_spans"]})
        self.assertNotIn("text", page["text_spans"][0])
        self.assertGreater(len(page["text_spans"][0]["glyphs"]), 0)

    def test_match_is_one_to_one(self):
        filled = {"pageIndex": 0, "bbox": [1, 2, 10, 10], "state": "filled"}
        empty = {"pageIndex": 0, "bbox": [14, 2, 10, 10], "state": "empty"}
        result = score([filled, empty], [filled, filled])
        self.assertEqual(result["matches"], 1)
        self.assertEqual(result["unmatched"], 1)
        self.assertEqual(result["missing"], {"empty": 1})


if __name__ == "__main__":
    unittest.main()

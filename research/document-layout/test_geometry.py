import unittest

from experiment import expand_reference, graph, line_scores
from fixtures import fixtures
from geometry import adaptive_lines, normalized_fragments, neighbor_blocks, turn_box, xy_cut
from rulings import ruled_regions


class GeometryTests(unittest.TestCase):
    def test_separates_short_gutter_at_multiple_scales(self):
        seen = 0
        for page in fixtures():
            if not page["key"].startswith("tight-columns/"):
                continue
            seen += 1
            _, fragments = normalized_fragments(page["fragments"])
            lines, spacing, candidates = adaptive_lines(fragments)
            groups = neighbor_blocks(lines, spacing, candidates)
            self.assertEqual([len(g) for g in groups], [6, 6])
            scores = line_scores(page, expand_reference(page["truth"]), {
                "lines": [line["box"] for line in lines],
                "parts": [lines[i]["parts"] for group in groups for i in group],
            })
            self.assertEqual(scores["pair"]["f1"], 1)
            self.assertEqual(scores["mixed_col_lines"], 0)
        self.assertEqual(seen, 3)

    def test_quarter_turn_keeps_membership(self):
        instances = {page["key"]: page for page in fixtures()}
        original = instances["mixed-bands/base"]
        rotated = instances["mixed-bands/rotate-90"]
        rotation, fragments = normalized_fragments(rotated["fragments"])
        self.assertEqual(rotation, -1)
        lines, spacing, candidates = adaptive_lines(fragments)
        flat = [i for group in neighbor_blocks(lines, spacing, candidates) for i in group]
        scores = line_scores(rotated, expand_reference(rotated["truth"]), {
            "lines": [turn_box(lines[i]["box"], -rotation) for i in flat],
            "parts": [lines[i]["parts"] for i in flat],
        })
        self.assertEqual(len(lines), len(original["truth"]["lines"]))
        self.assertEqual(scores["order_agree"], scores["order_pairs"])

    def test_graph_bounds_links_per_object_and_preserves_containment(self):
        page = next(p for p in fixtures() if p["key"] == "figures/base")
        _, fragments = normalized_fragments(page["fragments"])
        lines, spacing, _ = adaptive_lines(fragments)
        blocks = xy_cut(lines, spacing)
        order = [i for group in blocks for i in group]
        relations, ranking = graph(lines, blocks, order, page["objects"], spacing, page["width"], page["height"])
        self.assertTrue(ranking)
        self.assertTrue(all(len(rank) <= 4 for rank in ranking.values()))
        self.assertTrue(any(e["from"] == "object:1" and e["kind"] == "contains" for e in relations))

    def test_empty_page_does_not_create_lines(self):
        lines, spacing, candidates = adaptive_lines([])
        self.assertEqual(lines, [])
        self.assertEqual(xy_cut(lines, spacing), [])
        self.assertEqual(neighbor_blocks(lines, spacing, candidates), [])

    def test_joining_broken_separators_does_not_promote_dangling_strokes(self):
        frame = [
            {"orientation": "h", "box": (0, 0, 13, .2)},
            {"orientation": "h", "box": (15, 0, 40, .2)},
            {"orientation": "h", "box": (0, 10, 40, 10.2)},
            {"orientation": "v", "box": (0, 0, .2, 10)},
            {"orientation": "v", "box": (40, 0, 40.2, 10)},
            {"orientation": "v", "box": (20, 10, 20.2, 30)},
        ]
        found = ruled_regions(frame, 10)
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0]["crossings"], 4)
        self.assertEqual(ruled_regions(frame[:3], 10), [])


if __name__ == "__main__":
    unittest.main()

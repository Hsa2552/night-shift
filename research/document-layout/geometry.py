"""Local geometry experiments. Boxes use (left, top, right, bottom) in C1."""

from bisect import bisect_left
from collections import Counter, defaultdict
from dataclasses import dataclass
from math import floor, hypot
from statistics import median


def envelope(boxes):
    boxes = list(boxes)
    return (min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes))


def center(b):
    return ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)


def area(b):
    return max(0, b[2] - b[0]) * max(0, b[3] - b[1])


def overlap(a, b, axis):
    return max(0, min(a[axis + 2], b[axis + 2]) - max(a[axis], b[axis]))


def iou(a, b):
    common = overlap(a, b, 0) * overlap(a, b, 1)
    return common / (area(a) + area(b) - common) if common else 0


def gap(a, b, axis):
    return max(0, a[axis] - b[axis + 2], b[axis] - a[axis + 2])


def turn(p, quarter):
    x, y = p
    return ((x, y), (-y, x), (-x, -y), (y, -x))[quarter % 4]


def turn_box(box, quarter):
    x, y, u, v = box
    a, b = turn((x, y), quarter), turn((u, v), quarter)
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1]))


def normalized_fragments(fragments):
    votes = Counter()
    for fragment in fragments:
        x, y = fragment.get("axis", (0, 0))
        if hypot(x, y) == 0 or min(abs(x), abs(y)) > 0.18 * max(abs(x), abs(y)):
            continue
        key = (0 if x >= 0 else 2) if abs(x) >= abs(y) else (1 if y >= 0 else 3)
        votes[key] += max(1, fragment.get("chars", 1))
    choice, weight = votes.most_common(1)[0] if votes else (0, 0)
    rotation = -choice if weight * 3 >= sum(votes.values()) * 2 else 0
    return rotation, [
        {**fragment, "box": turn_box(fragment["box"], rotation),
         "base": turn(fragment["baseline"], rotation)[1] if "baseline" in fragment else None}
        for fragment in fragments
    ]


def robust(values, fallback):
    if not values:
        return fallback, 0
    mid = median(values)
    return mid, median(abs(x - mid) for x in values)


class StripIndex:
    """Index one coordinate into strips, each sorted by the other coordinate."""

    def __init__(self, points, step):
        self.step = max(step, 1e-6)
        buckets = defaultdict(list)
        for i, (along, normal) in enumerate(points):
            buckets[floor(normal / self.step)].append((along, i))
        self.buckets = {key: sorted(values) for key, values in buckets.items()}

    def around(self, along, normal, radius, limit=4):
        # Limit the scan to occupied strips and at most 2*limit entries per strip.
        i0, i1 = floor((normal - radius) / self.step), floor((normal + radius) / self.step)
        for key in range(i0, i1 + 1):
            values = self.buckets.get(key)
            if values:
                at = bisect_left(values, (along, -1))
                for _, index in values[max(0, at - limit):at + limit]:
                    yield index


class Components:
    def __init__(self, n):
        self.parent = list(range(n))

    def root(self, node):
        while node != self.parent[node]:
            self.parent[node] = self.parent[self.parent[node]]
            node = self.parent[node]
        return node

    def join(self, a, b):
        self.parent[self.root(b)] = self.root(a)

    def groups(self):
        result = defaultdict(list)
        for index in range(len(self.parent)):
            result[self.root(index)].append(index)
        return list(result.values())


@dataclass(frozen=True)
class Spacing:
    em: float
    character: float
    word_gap: float
    lead: float
    lead_mad: float


def adaptive_lines(fragments):
    boxes = [f["box"] for f in fragments]
    heights = [max(1e-6, b[3] - b[1]) for b in boxes]
    em = median(heights) if heights else 1
    widths = [(b[2] - b[0]) / max(1, f.get("chars", 1))
              for b, f in zip(boxes, fragments) if f.get("chars", 0) >= 2 and b[2] > b[0]]
    char = median(widths) if widths else em * .5
    baselines = [f.get("base") if f.get("base") is not None else b[3] - h * .20
                 for f, b, h in zip(fragments, boxes, heights)]
    index = StripIndex([(b[0], y) for b, y in zip(boxes, baselines)], em)

    def aligned(i, j):
        a, b = boxes[i], boxes[j]
        short = min(heights[i], heights[j])
        return (
            abs(baselines[i] - baselines[j]) <= .23 * max(heights[i], heights[j])
            and overlap(a, b, 1) >= .48 * short
        )

    edges = []
    gaps = []
    for i, a in enumerate(boxes):
        candidates = [
            j for j in index.around(a[2], baselines[i], em * .65)
            if j != i and boxes[j][0] >= a[0] and aligned(i, j)
            and boxes[j][2] > a[0]
        ]
        if not candidates:
            continue
        j = min(candidates, key=lambda j: (abs(boxes[j][0] - a[2]), abs(baselines[j] - baselines[i]), j))
        distance = gap(a, boxes[j], 0)
        edges.append((i, j, distance))
        if .03 * char < distance <= 2.5 * char:
            gaps.append(distance)
    typical, mad = robust(gaps, .65 * char)
    word_limit = max(1.8 * char, typical + 3 * mad)
    component = Components(len(boxes))
    for i, j, distance in edges:
        if distance <= word_limit * max(heights[i], heights[j]) / em:
            component.join(i, j)
    lines = [
        {"box": envelope(boxes[i] for i in group), "parts": group,
         "base": median(baselines[i] for i in group),
         "font": Counter(fragments[i].get("font") for i in group).most_common(1)[0][0]}
        for group in component.groups()
    ]
    lines.sort(key=lambda l: (l["base"], l["box"][0]))
    candidates = vertical_candidates(lines, em)
    leading = []
    for i, found in enumerate(candidates):
        below = [lines[j]["base"] - lines[i]["base"] for j in found
                 if .6 * em < lines[j]["base"] - lines[i]["base"] <= 3.5 * em]
        if below:
            leading.append(min(below))
    lead, lead_mad = robust(leading, 1.25 * em)
    return lines, Spacing(em, char, word_limit, lead, lead_mad), candidates


def vertical_candidates(lines, em):
    boxes = [line["box"] for line in lines]
    index = StripIndex([(line["base"], box[0]) for line, box in zip(lines, boxes)], 2 * em)
    mid = StripIndex([(line["base"], center(box)[0]) for line, box in zip(lines, boxes)], 2 * em)
    output = []
    for i, (line, box) in enumerate(zip(lines, boxes)):
        y = line["base"]
        pool = set(index.around(y, box[0], 2 * em)) | set(mid.around(y, center(box)[0], 2 * em))
        pool.discard(i)
        output.append([
            j for j in sorted(pool) if overlap(box, boxes[j], 0) >= .30 * min(
                box[2] - box[0], boxes[j][2] - boxes[j][0])
        ])
    return output


def whitespace(lines, ids, axis, threshold):
    ordered = sorted(ids, key=lambda i: lines[i]["box"][axis])
    end = lines[ordered[0]]["box"][axis + 2]
    best = None
    for offset, index in enumerate(ordered[1:], 1):
        box = lines[index]["box"]
        width = box[axis] - end
        # A single fragment on either side is weaker evidence for a column.
        if width >= threshold and (axis == 1 or min(offset, len(ordered) - offset) >= 2):
            strength = width / threshold
            if best is None or strength > best[0]:
                best = (strength, ordered, offset)
        end = max(end, box[axis + 2])
    return best


def xy_cut(lines, spacing, *, leading_margin=0):
    x_limit = max(spacing.word_gap * 1.5, 3 * spacing.character)
    y_limit = max(.56 * spacing.em, spacing.lead - spacing.em + max(2.5 * spacing.lead_mad, leading_margin * spacing.em))
    pending = [list(range(len(lines)))]
    blocks = []
    while pending:
        ids = pending.pop()
        if not ids:
            continue
        x = whitespace(lines, ids, 0, x_limit)
        y = whitespace(lines, ids, 1, y_limit)
        choice = max((cut for cut in (x, y) if cut), key=lambda cut: cut[0], default=None)
        if not choice:
            blocks.append(sorted(ids, key=lambda i: (lines[i]["base"], lines[i]["box"][0])))
            continue
        _, ordered, cut = choice
        pending.extend((ordered[cut:], ordered[:cut]))
    return blocks


def neighbor_blocks(lines, spacing, candidates):
    component = Components(len(lines))
    limit = spacing.lead + max(.45 * spacing.em, 3 * spacing.lead_mad)
    successors = {}
    predecessors = {}
    for i, a in enumerate(lines):
        choices = [[], []]
        for j in candidates[i]:
            b = lines[j]
            step = b["base"] - a["base"]
            if .54 * spacing.em <= abs(step) <= limit:
                left = abs(a["box"][0] - b["box"][0]) / spacing.em
                choices[step < 0].append((abs(step) / spacing.lead + .35 * left, j))
        if choices[0]:
            successors[i] = min(choices[0])[1]
        if choices[1]:
            predecessors[i] = min(choices[1])[1]
    for i, j in successors.items():
        if predecessors.get(j) == i:
            component.join(i, j)
    return sorted(component.groups(), key=lambda ids: (
        min(lines[i]["base"] for i in ids), min(lines[i]["box"][0] for i in ids)))

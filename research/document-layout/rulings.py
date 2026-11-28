"""Recover arrangements of intersecting horizontal/vertical separator observations."""

from bisect import bisect_left, bisect_right
from collections import deque
from statistics import median

from geometry import Components, center


def coalesce(objects, axis, tolerance):
    strokes = sorted(
        (center(obj["box"])[1 - axis], obj["box"][axis], obj["box"][2 + axis])
        for obj in objects if obj.get("orientation") == ("h" if axis == 0 else "v")
    )
    bands = []
    for normal, low, high in strokes:
        if not bands or normal - bands[-1][0][0] > tolerance / 2:
            bands.append([])
        bands[-1].append((normal, low, high))
    merged = []
    for band in bands:
        normal = median(s[0] for s in band)
        parts = sorted((b, e) for _, b, e in band)
        lo, hi = parts[0]
        for b, e in parts[1:]:
            if b <= hi + tolerance:
                hi = max(e, hi)
            else:
                merged.append((normal, lo, hi))
                lo, hi = b, e
        merged.append((normal, lo, hi))
    return sorted(merged)


def ruled_regions(objects, em):
    tolerance = .4 * em
    h = coalesce(objects, 0, tolerance)
    v = coalesce(objects, 1, tolerance)
    xs = [s[0] for s in v]
    adjacency = [set() for _ in range(len(h) + len(v))]
    for i, (y, left, right) in enumerate(h):
        for j in range(bisect_left(xs, left - tolerance), bisect_right(xs, right + tolerance)):
            _, top, bottom = v[j]
            if top - tolerance <= y <= bottom + tolerance:
                other = len(h) + j
                adjacency[i].add(other)
                adjacency[other].add(i)
    # Iteratively drop dangling strokes. A line attached at just one end does not close a frame.
    remove = deque(i for i, n in enumerate(adjacency) if len(n) < 2)
    cleared = set(remove)
    while remove:
        i = remove.popleft()
        for j in adjacency[i]:
            adjacency[j].discard(i)
            if len(adjacency[j]) < 2 and j not in cleared:
                cleared.add(j)
                remove.append(j)
        adjacency[i].clear()
    graph = Components(len(adjacency))
    for i, neighbors in enumerate(adjacency):
        for j in neighbors:
            graph.join(i, j)
    output = []
    for group in graph.groups():
        rows = sorted({h[i][0] for i in group if i < len(h)})
        cols = sorted({v[i - len(h)][0] for i in group if i >= len(h)})
        if len(rows) >= 2 and len(cols) >= 2:
            output.append({"box": [cols[0], rows[0], cols[-1], rows[-1]],
                           "horizontal": rows, "vertical": cols,
                           "crossings": sum(len(adjacency[i]) for i in group if i < len(h))})
    return output

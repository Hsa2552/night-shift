export type Box = readonly [left: number, top: number, right: number, bottom: number]
export interface Separator {
  orientation?: 'h' | 'v'
  box: Box
}
export interface RuledRegion {
  box: Box
  horizontal: number[]
  vertical: number[]
  crossings: number
}

type Stroke = [axis: number, start: number, end: number]

function middle(sorted: number[]) {
  const i = sorted.length >> 1
  return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2
}

function coalesce(separators: readonly Separator[], axis: 0 | 1, tolerance: number) {
  const orientation = axis === 0 ? 'h' : 'v'
  const normal = axis === 0 ? 1 : 0
  const strokes = separators
    .filter((item) => item.orientation === orientation && item.box.every(Number.isFinite))
    .map(({ box }): Stroke => [(box[normal] + box[normal + 2]) / 2, box[axis], box[axis + 2]])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
  const output: Stroke[] = []
  for (let i = 0; i < strokes.length;) {
    const head = i++
    while (i < strokes.length && strokes[i][0] - strokes[head][0] <= tolerance / 2) i++
    const band = strokes.slice(head, i)
    const at = middle(band.map(([position]) => position))
    const intervals = band.sort((a, b) => a[1] - b[1] || a[2] - b[2])
    let [, start, end] = intervals[0]
    for (const [, left, right] of intervals.slice(1)) {
      if (left <= end + tolerance) end = Math.max(end, right)
      else {
        output.push([at, start, end])
        start = left
        end = right
      }
    }
    output.push([at, start, end])
  }
  return output
}

function lowerBound(items: Stroke[], target: number) {
  let lo = 0
  let hi = items.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (items[mid][0] < target) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * Experimental transport-independent prototype. Inputs and outputs are in C1.
 * Returns geometric regions made of intersecting separators, without assigning documentary roles.
 */
export function locateRuledRegions(separators: readonly Separator[], em: number): RuledRegion[] {
  if (!Number.isFinite(em) || em <= 0) return []
  const tolerance = 0.4 * em
  const horizontal = coalesce(separators, 0, tolerance)
  const vertical = coalesce(separators, 1, tolerance)
  const split = horizontal.length
  const adjacency = Array.from({ length: split + vertical.length }, () => new Set<number>())
  for (const [i, [y, left, right]] of horizontal.entries()) {
    for (let j = lowerBound(vertical, left - tolerance); j < vertical.length; j++) {
      const [x, top, bottom] = vertical[j]
      if (x > right + tolerance) break
      if (top - tolerance <= y && y <= bottom + tolerance) {
        adjacency[i].add(split + j)
        adjacency[split + j].add(i)
      }
    }
  }
  const discard = adjacency.flatMap((neighbors, i) => (neighbors.size < 2 ? [i] : []))
  const removed = new Set(discard)
  for (const i of discard) {
    for (const j of adjacency[i]) {
      adjacency[j].delete(i)
      if (adjacency[j].size < 2 && !removed.has(j)) {
        removed.add(j)
        discard.push(j)
      }
    }
    adjacency[i].clear()
  }
  const output: RuledRegion[] = []
  for (let i = 0; i < adjacency.length; i++) {
    if (removed.has(i)) continue
    const queue = [i]
    const x = new Set<number>()
    const y = new Set<number>()
    let crossings = 0
    removed.add(i)
    for (const node of queue) {
      if (node < split) {
        y.add(horizontal[node][0])
        crossings += adjacency[node].size
      } else x.add(vertical[node - split][0])
      for (const neighbor of adjacency[node]) {
        if (removed.has(neighbor)) continue
        queue.push(neighbor)
        removed.add(neighbor)
      }
    }
    if (x.size < 2 || y.size < 2) continue
    const rows = [...y].sort((a, b) => a - b)
    const cols = [...x].sort((a, b) => a - b)
    output.push({
      box: [cols[0], rows[0], cols.at(-1)!, rows.at(-1)!],
      horizontal: rows,
      vertical: cols,
      crossings,
    })
  }
  return output
}

import type { PageData, Rect } from '../../../shared/types'
import { bottom, bounds, median, right } from './geometry.ts'

export interface AdaptiveLine {
  bbox: Rect
  baseline: number
  indices: number[]
}

export interface AdaptiveLayout {
  lines: AdaptiveLine[]
  xyBlocks: number[][]
  neighborBlocks: number[][]
  gutters: Rect[]
  alignments: { from: number; to: number; gap: number }[]
  spacing: { em: number; character: number; wordGap: number; leading: number; mad: number }
  confidence: 'insufficient' | 'local'
  baselineSource: 'estimated' | 'provided' | 'mixed'
  activation: 'off' | 'repeated-gutters'
}

function interval(a: Rect, b: Rect, vertical: boolean) {
  return Math.max(
    0,
    vertical
      ? Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y)
      : Math.min(right(a), right(b)) - Math.max(a.x, b.x),
  )
}

function stripIndex(points: [along: number, normal: number][], step: number) {
  const strips = new Map<number, { index: number; along: number }[]>()
  for (const [index, [along, normal]] of points.entries()) {
    const key = Math.floor(normal / step)
    const bucket = strips.get(key)
    if (bucket) bucket.push({ index, along })
    else strips.set(key, [{ index, along }])
  }
  for (const bucket of strips.values())
    bucket.sort((a, b) => a.along - b.along || a.index - b.index)
  return (along: number, normal: number, radius: number) => {
    const neighbors: number[] = []
    const first = Math.floor((normal - radius) / step)
    const last = Math.floor((normal + radius) / step)
    for (let offset = 0; offset < 5 && first + offset <= last; offset++) {
      const bucket = strips.get(first + offset)
      if (!bucket) continue
      let lo = 0
      let hi = bucket.length
      while (lo < hi) {
        const middle = (lo + hi) >>> 1
        if (bucket[middle].along < along) lo = middle + 1
        else hi = middle
      }
      for (const entry of bucket.slice(Math.max(0, lo - 4), lo + 4)) neighbors.push(entry.index)
    }
    return neighbors
  }
}

function components(size: number, edges: readonly (readonly [number, number])[]) {
  const parent = Array.from({ length: size }, (_, i) => i)
  function root(i: number) {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  for (const [a, b] of edges) parent[root(b)] = root(a)
  const groups = new Map<number, number[]>()
  for (let i = 0; i < size; i++) {
    const key = root(i)
    const group = groups.get(key)
    if (group) group.push(i)
    else groups.set(key, [i])
  }
  return [...groups.values()]
}

function deviation(values: number[], center: number) {
  return median(
    values.map((v) => Math.abs(v - center)),
    0,
  )
}

function segment(lines: AdaptiveLine[], model: AdaptiveLayout['spacing']) {
  const { em, character, wordGap, leading, mad } = model
  const xThreshold = Math.max(1.5 * wordGap, 3 * character)
  const yThreshold = Math.max(0.56 * em, leading - em + Math.max(2.5 * mad, 0.15 * em))
  const pending = [lines.map((_, i) => i)]
  const blocks: number[][] = []
  const gutters: Rect[] = []
  while (pending.length) {
    const ids = pending.pop()!
    if (!ids.length) continue
    let cut: { order: number[]; i: number; size: number; gutter?: Rect } | undefined
    const region = bounds(ids.map((i) => lines[i].bbox))
    for (const axis of ['x', 'y'] as const) {
      const threshold = axis === 'x' ? xThreshold : yThreshold
      const end = axis === 'x' ? right : bottom
      const order = ids.slice().sort((a, b) => lines[a].bbox[axis] - lines[b].bbox[axis])
      let last = end(lines[order[0]].bbox)
      for (let i = 1; i < order.length; i++) {
        const rect = lines[order[i]].bbox
        const gap = rect[axis] - last
        if (gap >= threshold && (axis === 'y' || Math.min(i, order.length - i) >= 2)) {
          const size = gap / threshold
          if (!cut || cut.size < size)
            cut = {
              order,
              size,
              i,
              gutter:
                axis === 'x'
                  ? { x: last, y: region.y, width: gap, height: region.height }
                  : undefined,
            }
        }
        last = Math.max(last, end(rect))
      }
    }
    if (cut) {
      if (cut.gutter) gutters.push(cut.gutter)
      pending.push(cut.order.slice(cut.i), cut.order.slice(0, cut.i))
    } else blocks.push(ids.sort((a, b) => a - b))
  }
  return { blocks, gutters }
}

/** Reconstructs physical lines in C1. No orientation is inferred from text-box ratios. */
export function reconstructAdaptiveLayout(
  page: PageData,
  baselineY?: ReadonlyMap<number, number>,
): AdaptiveLayout {
  const items = page.textItems.flatMap(({ bbox, text }, index) =>
    bbox.width >= 0 &&
    bbox.height > 0 &&
    [bbox.x, bbox.y, right(bbox), bottom(bbox)].every(Number.isFinite) &&
    text.trim()
      ? [{ bbox, count: Array.from(text.replace(/\s/gu, '')).length, index }]
      : [],
  )
  const em = Math.max(
    1e-3,
    median(
      items.map(({ bbox }) => bbox.height),
      1,
    ),
  )
  const character = Math.max(
    1e-3,
    median(
      items.flatMap(({ bbox, count }) =>
        count >= 2 && bbox.width > 0 ? [bbox.width / count] : [],
      ),
      em * 0.5,
    ),
  )
  const supplied = items.filter(({ index }) => Number.isFinite(baselineY?.get(index))).length
  const bases = items.map(({ bbox, index }) => {
    const external = baselineY?.get(index)
    return typeof external === 'number' && Number.isFinite(external)
      ? external
      : bottom(bbox) - 0.2 * bbox.height
  })
  const around = stripIndex(
    items.map(({ bbox }, i) => [bbox.x, bases[i]]),
    em,
  )
  const edges: { a: number; b: number; gap: number }[] = []
  for (const [a, { bbox }] of items.entries()) {
    const possible = around(right(bbox), bases[a], 0.65 * em).filter((b) => {
      const other = items[b].bbox
      return (
        a !== b &&
        other.x >= bbox.x &&
        right(other) > bbox.x &&
        Math.abs(bases[a] - bases[b]) <= 0.23 * Math.max(bbox.height, other.height) &&
        interval(bbox, other, true) >= 0.48 * Math.min(bbox.height, other.height)
      )
    })
    possible.sort(
      (b, c) =>
        Math.abs(items[b].bbox.x - right(bbox)) - Math.abs(items[c].bbox.x - right(bbox)) ||
        Math.abs(bases[a] - bases[b]) - Math.abs(bases[a] - bases[c]) ||
        b - c,
    )
    const b = possible[0]
    if (b !== undefined) edges.push({ a, b, gap: Math.max(0, items[b].bbox.x - right(bbox)) })
  }
  const sample = edges
    .map(({ gap }) => gap)
    .filter((gap) => gap > 0.03 * character && gap <= 2.5 * character)
  const typical = median(sample, 0.65 * character)
  const wordGap = Math.max(1.8 * character, typical + 3 * deviation(sample, typical))
  const local = edges.filter(
    ({ a, b, gap }) => gap <= (wordGap * Math.max(items[a].bbox.height, items[b].bbox.height)) / em,
  )
  const lines = components(
    items.length,
    local.map(({ a, b }) => [a, b] as const),
  )
    .map((group) => ({
      bbox: bounds(group.map((i) => items[i].bbox)),
      baseline: median(
        group.map((i) => bases[i]),
        0,
      ),
      indices: group.map((i) => items[i].index),
    }))
    .sort((a, b) => a.baseline - b.baseline || a.bbox.x - b.bbox.x)
  const centerX = (bbox: Rect) => bbox.x + bbox.width / 2
  const left = stripIndex(
    lines.map(({ baseline, bbox }) => [baseline, bbox.x]),
    2 * em,
  )
  const middle = stripIndex(
    lines.map(({ baseline, bbox }) => [baseline, centerX(bbox)]),
    2 * em,
  )
  const vertical = lines.map(({ bbox, baseline }, i) =>
    [
      ...new Set([...left(baseline, bbox.x, 2 * em), ...middle(baseline, centerX(bbox), 2 * em)]),
    ].filter(
      (j) =>
        j !== i &&
        interval(bbox, lines[j].bbox, false) >= 0.3 * Math.min(bbox.width, lines[j].bbox.width),
    ),
  )
  const leadingSamples = vertical.flatMap((neighbors, i) => {
    const gaps = neighbors
      .map((j) => lines[j].baseline - lines[i].baseline)
      .filter((gap) => gap > 0.6 * em && gap <= 3.5 * em)
    return gaps.length ? [Math.min(...gaps)] : []
  })
  const leading = median(leadingSamples, 1.25 * em)
  const mad = deviation(leadingSamples, leading)
  const spacing = { em, character, wordGap, leading, mad }
  const limit = leading + Math.max(0.45 * em, 3 * mad)
  const next = new Map<number, number>()
  const previous = new Map<number, number>()
  for (const [i, candidates] of vertical.entries()) {
    const line = lines[i]
    const choice = candidates
      .flatMap((id) => {
        const step = lines[id].baseline - line.baseline
        return Math.abs(step) >= 0.54 * em && Math.abs(step) <= limit
          ? [
              {
                id,
                step,
                cost:
                  Math.abs(step) / leading + (0.35 * Math.abs(lines[id].bbox.x - line.bbox.x)) / em,
              },
            ]
          : []
      })
      .sort((a, b) => a.cost - b.cost || a.id - b.id)
    const down = choice.find((c) => c.step > 0)
    const up = choice.find((c) => c.step < 0)
    if (down) next.set(i, down.id)
    if (up) previous.set(i, up.id)
  }
  const links = [...next].filter(([i, j]) => previous.get(j) === i)
  const { blocks, gutters } = segment(lines, spacing)
  const repeated = gutters.some((gutter) => {
    const before = lines.filter(
      ({ bbox }) => interval(bbox, gutter, true) > 0 && right(bbox) <= gutter.x,
    )
    const after = lines.filter(
      ({ bbox }) => interval(bbox, gutter, true) > 0 && bbox.x >= right(gutter),
    )
    return (
      before.filter(({ bbox }) => after.some((b) => interval(bbox, b.bbox, true) > 0.25 * em))
        .length >= 2
    )
  })
  return {
    lines,
    xyBlocks: blocks,
    neighborBlocks: components(lines.length, links),
    gutters,
    alignments: local.map(({ a, b, gap }) => ({ from: items[a].index, to: items[b].index, gap })),
    spacing,
    confidence: items.length < 3 ? 'insufficient' : 'local',
    baselineSource: !supplied ? 'estimated' : supplied === items.length ? 'provided' : 'mixed',
    activation: repeated ? 'repeated-gutters' : 'off',
  }
}

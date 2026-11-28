import type { PageData, PageRegion, Rect, VectorPageObservation } from '../../../shared/types'
import type { AdaptiveLayout } from './adaptive-layout.ts'
import { locateRuledRegions, type Box, type Separator } from './closed-rules.ts'
import { area, bottom, contains, overlap, right } from './geometry.ts'
import type { GraphicSource } from './index.ts'

export interface GraphicCell {
  bbox: Rect
  fragmentIndices: number[]
  row: number
  column: number
  merged: boolean
}

export interface GraphicFrame {
  region: PageRegion
  kind: 'closed-rules' | 'horizontal-rules' | 'aligned-text'
  sources: GraphicSource[]
  rows: number[]
  columns: number[]
  cells: GraphicCell[]
  unresolvedCells: number
}

const box = (b: Rect): Box => [b.x, b.y, right(b), bottom(b)]
const rect = ([x, y, r, b]: Box): Rect => ({ x, y, width: r - x, height: b - y })

function supports(
  separators: readonly Separator[],
  orientation: 'h' | 'v',
  axis: number,
  begin: number,
  end: number,
  tolerance: number,
) {
  const start = orientation === 'h' ? 0 : 1
  const normal = 1 - start
  const fragments = separators
    .filter(
      (r) =>
        r.orientation === orientation &&
        Math.abs((r.box[normal] + r.box[normal + 2]) / 2 - axis) <= tolerance &&
        r.box[start + 2] >= begin - tolerance &&
        r.box[start] <= end + tolerance,
    )
    .sort((a, b) => a.box[start] - b.box[start])
  let cursor = begin
  for (const rule of fragments) {
    if (rule.box[start] > cursor + tolerance) return false
    cursor = Math.max(cursor, rule.box[start + 2])
    if (cursor >= end - tolerance) return true
  }
  return false
}

function inCell(page: PageData, cell: Rect) {
  const fragmentIndices: number[] = []
  let crossed = false
  for (const [id, fragment] of page.textItems.entries()) {
    if (!fragment.text.trim()) continue
    if (contains(cell, fragment.bbox)) fragmentIndices.push(id)
    else if (area(fragment.bbox) > 0 && overlap(cell, fragment.bbox) >= 0.2 * area(fragment.bbox))
      crossed = true
  }
  return { fragmentIndices, crossed }
}

export function observeGraphicFrames(
  page: PageData,
  layout: AdaptiveLayout,
  vectors?: VectorPageObservation,
  rasterRules: readonly Separator[] = [],
): GraphicFrame[] {
  const native =
    vectors?.pageIndex !== page.pageIndex
      ? []
      : (vectors.graphics?.rules ?? [])
          .filter((r) => r.visibility === 'paint-command' && r.region.pageIndex === page.pageIndex)
          .map<Separator>((r) => ({ orientation: r.orientation, box: box(r.region.bbox) }))
  const rules = [...native, ...rasterRules]
  const tolerance = 0.4 * layout.spacing.em
  const output: GraphicFrame[] = []
  function source(rectangle: Rect, observations: readonly Separator[]) {
    return observations.some((s) => overlap(rectangle, rect(s.box)) > 0)
  }
  for (const table of locateRuledRegions(rules, layout.spacing.em)) {
    const region = { pageIndex: page.pageIndex, bbox: rect(table.box) }
    const rows = table.horizontal
    const columns = table.vertical
    const cells: GraphicCell[] = []
    let unresolvedCells = 0
    // Layout hypotheses remain bounded for densely ruled graphs and malicious pages.
    if ((rows.length - 1) * (columns.length - 1) <= 240) {
      for (let row = 0; row < rows.length - 1; row++) {
        const [top, bottom] = [rows[row], rows[row + 1]]
        const boundaries = columns.map((x) => supports(rules, 'v', x, top, bottom, tolerance))
        for (let column = 0; column < columns.length - 1;) {
          const left = columns[column]
          let end = column + 1
          while (end < columns.length - 1 && !boundaries[end]) end++
          const right = columns[end]
          const bbox = rect([left, top, right, bottom])
          const text = inCell(page, bbox)
          if (
            !boundaries[column] ||
            !boundaries[end] ||
            text.crossed ||
            !supports(rules, 'h', top, left, right, tolerance) ||
            !supports(rules, 'h', bottom, left, right, tolerance)
          )
            unresolvedCells++
          else
            cells.push({
              bbox,
              row,
              column,
              merged: end > column + 1,
              fragmentIndices: text.fragmentIndices,
            })
          column = end
        }
      }
    } else unresolvedCells = (rows.length - 1) * (columns.length - 1)
    output.push({
      region,
      kind: 'closed-rules',
      rows,
      columns,
      cells,
      unresolvedCells,
      sources: [
        ...(source(region.bbox, native) ? ['native' as const] : []),
        ...(source(region.bbox, rasterRules) ? ['raster' as const] : []),
      ],
    })
  }

  // A repeated aligned span of horizontal rules and text gutters is an open structure hypothesis.
  // Borderless alignments are exposed but never alone authorize tabletop masks.
  const horizontals = rules
    .filter((r) => r.orientation === 'h')
    .slice()
    .sort((a, b) => a.box[1] - b.box[1])
  for (const gutter of layout.gutters) {
    const regionLines = layout.lines.filter(
      ({ bbox }) => bbox.y >= gutter.y - tolerance && bottom(bbox) <= bottom(gutter) + tolerance,
    )
    if (regionLines.length < 4) continue
    const candidate = {
      x: Math.min(...regionLines.map((l) => l.bbox.x)),
      y: gutter.y,
      width: 0,
      height: gutter.height,
    }
    candidate.width = Math.max(...regionLines.map((l) => right(l.bbox))) - candidate.x
    if (output.some(({ region }) => overlap(region.bbox, candidate) >= 0.4 * area(candidate)))
      continue
    const aligned = horizontals.filter(
      (r) =>
        r.box[1] >= gutter.y - 2 * layout.spacing.em &&
        r.box[1] <= bottom(gutter) + 2 * layout.spacing.em &&
        r.box[0] <= gutter.x &&
        r.box[2] >= right(gutter) &&
        r.box[2] - r.box[0] >= 0.65 * candidate.width,
    )
    const rows: number[] = []
    for (const r of aligned)
      if (r.box[1] - (rows.at(-1) ?? -Infinity) > tolerance) rows.push(r.box[1])
    const kind = rows.length >= 3 ? 'horizontal-rules' : 'aligned-text'
    const bbox =
      kind === 'horizontal-rules'
        ? rect([candidate.x, rows[0], right(candidate), rows.at(-1)!])
        : candidate
    output.push({
      region: { pageIndex: page.pageIndex, bbox },
      kind,
      rows,
      columns: [candidate.x, (gutter.x + right(gutter)) / 2, right(candidate)],
      cells: [],
      unresolvedCells: 1,
      sources:
        kind === 'aligned-text'
          ? []
          : [
              ...(source(bbox, native) ? ['native' as const] : []),
              ...(source(bbox, rasterRules) ? ['raster' as const] : []),
            ],
    })
  }
  return output
}

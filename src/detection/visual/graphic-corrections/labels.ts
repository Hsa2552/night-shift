import type { Rect } from '../../../shared/types'
import type { AdaptiveLayout } from './adaptive-layout.ts'
import { area, bottom, contains, overlap, right, valid } from './geometry.ts'
import type { GraphicObject, GraphicPageInput } from './index.ts'

function adjacent(a: Rect, b: Rect, em: number) {
  const dx = Math.max(0, a.x - right(b), b.x - right(a))
  const dy = Math.max(0, a.y - bottom(b), b.y - bottom(a))
  return (dx === 0 || dy === 0) && dx + dy <= em
}

/** Attach small legend/label lines only across one physically established figure edge. */
export function graphicLabels(
  input: GraphicPageInput,
  layout: AdaptiveLayout,
  objects: readonly GraphicObject[],
  viewport: Rect,
) {
  const { page } = input
  const scopes = input.anchors.flatMap(({ role, reliability, scope }) =>
    role === 'correction' &&
    reliability === 'confirmed' &&
    scope?.pageIndex === page.pageIndex &&
    valid(scope.bbox)
      ? [scope.bbox]
      : [],
  )
  if (!scopes.length) return []
  const em = layout.spacing.em
  const figures = objects.filter((object) => {
    const box = object.region.bbox
    return (
      (object.kind === 'figure' || object.kind === 'path') &&
      object.visibility === 'raster-ink' &&
      box.width >= 2 * em &&
      box.height >= 2 * em &&
      area(box) < 0.15 * area(viewport) &&
      scopes.some((scope) => contains(scope, box))
    )
  })
  return layout.lines.flatMap<GraphicObject>(({ bbox }) => {
    if (!valid(bbox) || bbox.width > 6 * em || bbox.height > 1.6 * em) return []
    const host = figures.some((figure) => {
      const box = figure.region.bbox
      return (
        adjacent(bbox, box, em) &&
        scopes.some((scope) => contains(scope, bbox) && contains(scope, box))
      )
    })
    if (
      !host ||
      input.mixedFigures?.some(
        ({ region }) => region.pageIndex === page.pageIndex && overlap(region.bbox, bbox) > 0,
      )
    )
      return []
    return [
      {
        region: { pageIndex: page.pageIndex, bbox },
        kind: 'label',
        sources: ['native', 'raster'],
        visibility: 'declared',
      },
    ]
  })
}

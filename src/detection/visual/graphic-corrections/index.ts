import type {
  CorrectionBlock,
  PageData,
  PageRegion,
  RasterData,
  Rect,
  VectorPageObservation,
} from '../../../shared/types'
import type { NativeRgb } from '../vector/text-colors'
import { intersect } from '../vector/geometry'
import { area, bottom, contains, expand, median, overlap, right, valid } from './geometry'

export interface GraphicAnchor {
  id: string
  role: 'question' | 'correction'
  reliability: 'confirmed' | 'tentative'
  region: PageRegion
  /** The caller has established ownership of this entire region, including illustrations. */
  scope?: PageRegion
  blockId?: string
}

export interface GraphicPageInput {
  page: PageData
  vectors?: VectorPageObservation
  raster?: RasterData
  anchors: readonly GraphicAnchor[]
  existingBlocks?: readonly CorrectionBlock[]
  protectedRegions?: readonly PageRegion[]
}

export type GraphicKind = 'figure' | 'path' | 'frame' | 'fill' | 'highlight' | 'table'
export type GraphicRole = 'correction' | 'statement' | 'mixed' | 'decorative' | 'unknown'
export type GraphicSource = 'native' | 'raster'

export interface GraphicObject {
  region: PageRegion
  kind: GraphicKind
  sources: GraphicSource[]
  visibility: 'declared' | 'raster-ink' | 'uncertain'
  rgb?: NativeRgb
}

export interface GraphicCandidate extends GraphicObject {
  role: GraphicRole
  confidence: 'supported' | 'tentative' | 'unresolved'
  anchorIds: string[]
  blockId?: string
  evidence: string[]
  contradictions: string[]
  masks: PageRegion[]
}

export interface GraphicPageResult {
  candidates: GraphicCandidate[]
  additions: { blockId: string; regions: PageRegion[] }[]
  newBlocks: CorrectionBlock[]
  /** Local review cues. The document-level fallback remains the caller's decision. */
  unresolved: GraphicCandidate[]
}

function recordObjects(input: GraphicPageInput, em: number, viewport: Rect): GraphicObject[] {
  const { page, vectors } = input
  if (vectors?.pageIndex !== page.pageIndex) return []
  const objects: GraphicObject[] = []
  const graphic = vectors.graphics
  function add(
    region: PageRegion,
    kind: GraphicKind,
    visibility: GraphicObject['visibility'],
    rgb?: NativeRgb,
  ) {
    if (region.pageIndex !== page.pageIndex || !valid(region.bbox)) return
    const bbox = intersect(viewport, region.bbox)
    if (!bbox || area(bbox) < em * em * (kind === 'highlight' ? 0.2 : 1.5)) return
    objects.push({
      region: { pageIndex: page.pageIndex, bbox },
      kind,
      sources: ['native'],
      visibility,
      rgb,
    })
  }
  for (const image of graphic?.images ?? []) {
    if (
      image.kind === 'image' &&
      image.visibility !== 'invisible' &&
      image.visibility !== 'clipped'
    )
      add(image.region, 'figure', image.visibility === 'paint-command' ? 'declared' : 'uncertain')
  }
  for (const path of graphic?.paths ?? []) {
    if (path.visibility === 'invisible' || path.visibility === 'clipped') continue
    const kind = path.outline === 'rectangles' ? (path.stroke ? 'frame' : 'fill') : 'path'
    add(
      path.region,
      kind,
      path.visibility === 'paint-command' ? 'declared' : 'uncertain',
      path.fill ?? path.stroke,
    )
  }
  for (const h of graphic?.highlights ?? []) add(h.region, 'highlight', 'uncertain', h.rgb)
  return objects
}

function authorizedOwners(input: GraphicPageInput, object: GraphicObject) {
  const { pageIndex, bbox } = object.region
  return input.anchors.filter(
    (a) =>
      a.reliability === 'confirmed' &&
      a.region.pageIndex === pageIndex &&
      a.scope?.pageIndex === pageIndex &&
      valid(a.scope.bbox) &&
      contains(a.scope.bbox, bbox),
  )
}

function plausibleAnchors(input: GraphicPageInput, object: GraphicObject, em: number) {
  const bbox = object.region.bbox
  return input.anchors.filter(({ region, scope }) => {
    if (region.pageIndex !== object.region.pageIndex || !valid(region.bbox)) return false
    if (scope?.pageIndex === region.pageIndex && overlap(scope.bbox, bbox) > 0) return true
    const horizontal = Math.max(
      0,
      Math.min(right(region.bbox), right(bbox)) - Math.max(region.bbox.x, bbox.x),
    )
    return (
      horizontal >= 0.35 * Math.min(region.bbox.width, bbox.width) &&
      Math.max(0, bbox.y - bottom(region.bbox), region.bbox.y - bottom(bbox)) <= 3 * em
    )
  })
}

function classify(
  input: GraphicPageInput,
  object: GraphicObject,
  em: number,
  viewport: Rect,
): GraphicCandidate {
  const { page, existingBlocks = [], protectedRegions = [] } = input
  const box = object.region.bbox
  const owners = authorizedOwners(input, object)
  const near = plausibleAnchors(input, object, em)
  const anchors = [...new Set([...owners, ...near])]
  const blocks = existingBlocks.filter((b) =>
    b.regions.some((r) => r.pageIndex === page.pageIndex && valid(r.bbox) && contains(r.bbox, box)),
  )
  const positive = owners.filter(({ role }) => role === 'correction')
  const negative = owners.some(({ role }) => role === 'question')
  const protectedBox = [
    ...protectedRegions,
    ...input.anchors
      .filter((anchor) => anchor.role === 'question' && anchor.reliability === 'confirmed')
      .map((anchor) => anchor.region),
  ].filter((r) => r.pageIndex === page.pageIndex && valid(r.bbox))
  const protectedInk = protectedBox.some((r) => overlap(r.bbox, box) > 0)
  const keys = new Set([
    ...positive.map(
      (a) =>
        a.blockId ?? (blocks.length === 1 ? blocks[0].id : `graphic:${page.pageIndex}:${a.id}`),
    ),
    ...blocks.map((b) => b.id),
  ])
  const candidate: GraphicCandidate = {
    ...object,
    role: 'unknown',
    confidence: 'unresolved',
    anchorIds: anchors.map((a) => a.id),
    evidence: [],
    contradictions: [],
    masks: [],
  }
  if (positive.length) candidate.evidence.push('confirmed-correction-scope')
  if (blocks.length) candidate.evidence.push('existing-block-contains')
  if (negative) candidate.evidence.push('confirmed-statement-scope')
  if (!owners.length && near.length) candidate.evidence.push('near-anchor-only')
  if (keys.size > 1) candidate.contradictions.push('competing-blocks')
  if (protectedInk) candidate.contradictions.push('protected-overlap')
  if (negative && keys.size) candidate.contradictions.push('statement-and-correction')
  if (negative || protectedInk) {
    candidate.role = keys.size ? 'mixed' : 'statement'
    candidate.confidence = keys.size ? 'unresolved' : 'supported'
    return candidate
  }
  if (area(box) >= area(viewport) * 0.45) {
    candidate.contradictions.push('page-scale-object')
    return candidate
  }
  if (keys.size !== 1) return candidate
  candidate.role = 'correction'
  candidate.blockId = [...keys][0]
  candidate.confidence = 'tentative'
  if (object.visibility === 'uncertain') {
    candidate.contradictions.push('visibility-unconfirmed')
    return candidate
  }
  const margin = Math.max(
    0.075 * em,
    input.raster && input.raster.width > 0 && input.raster.height > 0
      ? Math.max(page.width / input.raster.width, page.height / input.raster.height)
      : 0,
  )
  const padded = intersect(viewport, expand(box, margin))
  if (!padded || protectedBox.some(({ bbox }) => overlap(bbox, padded) > 0)) {
    candidate.contradictions.push('protective-margin-conflict')
    return candidate
  }
  // Padding is permitted only within at least one trusted ownership region.
  if (
    !positive.some((a) => a.scope && contains(a.scope.bbox, padded)) &&
    !blocks.some((b) =>
      b.regions.some((r) => r.pageIndex === page.pageIndex && contains(r.bbox, padded)),
    )
  ) {
    candidate.contradictions.push('ownership-margin-conflict')
    return candidate
  }
  candidate.confidence = 'supported'
  candidate.masks.push({ pageIndex: page.pageIndex, bbox: padded })
  return candidate
}

export function detectGraphicCorrections(input: GraphicPageInput): GraphicPageResult {
  const { page, existingBlocks = [] } = input
  const viewport = { x: 0, y: 0, width: page.width, height: page.height }
  const result: GraphicPageResult = { candidates: [], additions: [], newBlocks: [], unresolved: [] }
  if (!valid(viewport)) return result
  const em = median(
    page.textItems.flatMap(({ bbox }) => (valid(bbox) ? [bbox.height] : [])),
    Math.min(page.width, page.height) / 64,
  )
  const objects = recordObjects(input, em, viewport)
  const masks = new Map<string, PageRegion[]>()
  for (const object of objects) {
    const candidate = classify(input, object, em, viewport)
    result.candidates.push(candidate)
    if (candidate.blockId && candidate.masks.length) {
      const list = masks.get(candidate.blockId) ?? []
      for (const region of candidate.masks) {
        if (!list.some(({ bbox }) => contains(bbox, region.bbox))) list.push(region)
      }
      masks.set(candidate.blockId, list)
    } else if (candidate.role !== 'statement' && candidate.role !== 'decorative')
      result.unresolved.push(candidate)
  }
  const existing = new Set(existingBlocks.map(({ id }) => id))
  for (const [blockId, regions] of masks) {
    if (existing.has(blockId)) result.additions.push({ blockId, regions })
    else result.newBlocks.push({ id: blockId, regions })
  }
  return result
}

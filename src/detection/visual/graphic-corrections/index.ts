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
import { area, bottom, contains, expand, overlap, right, valid } from './geometry'
import { reconstructAdaptiveLayout, type AdaptiveLayout } from './adaptive-layout'
import { observeGraphicFrames, type GraphicFrame } from './frames'
import { matchesPaint, observeRasterGraphics, rasterIncrement } from './raster-objects'
import { parseRgb } from '../vector/text-colors'

export interface MixedFigure {
  region: PageRegion
  blockId: string
  /** A locally confirmed correction-specific paint. The reference graphic uses other paints. */
  correctionRgb: NativeRgb
}

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
  decorativeRegions?: readonly PageRegion[]
  mixedFigures?: readonly MixedFigure[]
  layout?: AdaptiveLayout
  /** Defaults to hybrid. The isolated diagnostic uses this to compare modalities. */
  modality?: 'native' | 'raster' | 'hybrid'
}

export type GraphicKind =
  'figure' | 'path' | 'frame' | 'fill' | 'highlight' | 'table' | 'table-cell'
export type GraphicRole = 'correction' | 'statement' | 'mixed' | 'decorative' | 'unknown'
export type GraphicSource = 'native' | 'raster'

export interface GraphicObject {
  region: PageRegion
  kind: GraphicKind
  sources: GraphicSource[]
  visibility: 'declared' | 'raster-ink' | 'uncertain'
  rgb?: NativeRgb
  paintVerified?: boolean
  paintScopeId?: string
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
  frames: GraphicFrame[]
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
  for (const paint of vectors.rectangles) {
    if (paint.visibility !== 'paint-command' || (paint.fillOpacity ?? 0) < 0.92) continue
    const rgb = parseRgb(paint.fill)
    if (!rgb || Math.max(...rgb) - Math.min(...rgb) < 14) continue
    if (
      !objects.some(
        (o) =>
          o.kind === 'fill' &&
          overlap(o.region.bbox, paint.region.bbox) >= 0.96 * area(paint.region.bbox),
      )
    )
      add(paint.region, 'fill', 'declared', rgb)
  }
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
  protectedBox: readonly Rect[],
  margin: number,
): GraphicCandidate {
  const { page, existingBlocks = [], decorativeRegions = [], mixedFigures = [] } = input
  const box = object.region.bbox
  const owners = authorizedOwners(input, object)
  const near = plausibleAnchors(input, object, em)
  const anchors = [...new Set([...owners, ...near])]
  const blocks = existingBlocks.filter((b) =>
    b.regions.some((r) => r.pageIndex === page.pageIndex && valid(r.bbox) && contains(r.bbox, box)),
  )
  const positive = owners.filter(({ role }) => role === 'correction')
  const negative = owners.some(({ role }) => role === 'question')
  const protectedInk = protectedBox.some((r) => overlap(r, box) > 0)
  const mixed = mixedFigures.filter(
    (figure) => figure.region.pageIndex === page.pageIndex && overlap(figure.region.bbox, box) > 0,
  )
  const supportedPaint =
    mixed.length === 1 &&
    contains(mixed[0].region.bbox, box) &&
    matchesPaint(object.rgb, mixed[0].correctionRgb) &&
    object.paintVerified === true
  const keys = new Set([
    ...positive.map(
      (a) =>
        a.blockId ?? (blocks.length === 1 ? blocks[0].id : `graphic:${page.pageIndex}:${a.id}`),
    ),
    ...blocks.map((b) => b.id),
    ...(supportedPaint ? [mixed[0].blockId] : []),
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
  if (
    decorativeRegions.some(
      ({ pageIndex, bbox }) => pageIndex === page.pageIndex && contains(bbox, box),
    )
  ) {
    if (keys.size) candidate.contradictions.push('decorative-and-correction')
    else {
      candidate.role = 'decorative'
      candidate.confidence = 'supported'
      candidate.evidence.push('known-decoration')
    }
    return candidate
  }
  if (mixed.length && !supportedPaint) {
    candidate.role = 'mixed'
    candidate.contradictions.push('inseparable-mixed-figure')
    return candidate
  }
  if (supportedPaint) candidate.evidence.push('declared-local-paint-confirmed-by-raster')
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
  const padded = intersect(viewport, expand(box, margin))
  if (!padded || protectedBox.some((bbox) => overlap(bbox, padded) > 0)) {
    candidate.contradictions.push('protective-margin-conflict')
    return candidate
  }
  // Padding is permitted only within at least one trusted ownership region.
  if (
    !(supportedPaint && contains(mixed[0].region.bbox, padded)) &&
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
  const result: GraphicPageResult = {
    candidates: [],
    additions: [],
    newBlocks: [],
    unresolved: [],
    frames: [],
  }
  if (!valid(viewport)) return result
  const layout = input.layout ?? reconstructAdaptiveLayout(page)
  const em = layout.lines.length ? layout.spacing.em : Math.min(page.width, page.height) / 64
  const native = input.modality === 'raster' ? undefined : input.vectors
  const raster = input.modality === 'native' ? undefined : input.raster
  const painted = raster && observeRasterGraphics(page, raster, em, input.mixedFigures ?? [])
  const objects = recordObjects({ ...input, vectors: native }, em, viewport)
  const rasterObjects = painted?.objects ?? []
  if (rasterObjects.length) {
    // Matching uses both extents. A tiny speck inside a broad vector envelope cannot confirm it.
    for (const item of objects) {
      if (
        rasterObjects.some(
          (other) =>
            overlap(item.region.bbox, other.region.bbox) >= 0.08 * area(item.region.bbox) &&
            overlap(item.region.bbox, other.region.bbox) >= 0.75 * area(other.region.bbox),
        )
      ) {
        item.sources.push('raster')
        item.visibility = 'raster-ink'
      }
    }
    objects.push(...rasterObjects)
  }
  result.frames = observeGraphicFrames(page, layout, native, painted?.separators ?? [])
  for (const frame of result.frames) {
    if (frame.kind !== 'closed-rules' || !frame.sources.length) continue
    const visibility = frame.sources.includes('raster') ? 'raster-ink' : 'declared'
    objects.push({
      region: frame.region,
      kind: frame.cells.length > 1 ? 'table' : 'frame',
      sources: frame.sources,
      visibility,
    })
    for (const cell of frame.cells) {
      if (!cell.fragmentIndices.length) continue
      objects.push({
        region: { pageIndex: page.pageIndex, bbox: cell.bbox },
        kind: 'table-cell',
        sources: frame.sources,
        visibility,
      })
    }
  }
  for (const figure of input.mixedFigures ?? []) {
    if (figure.region.pageIndex !== page.pageIndex || !valid(figure.region.bbox)) continue
    const bbox = intersect(viewport, figure.region.bbox)
    if (
      !bbox ||
      objects.some(
        (o) =>
          o.paintVerified &&
          contains(bbox, o.region.bbox) &&
          matchesPaint(o.rgb, figure.correctionRgb),
      )
    )
      continue
    result.unresolved.push({
      region: { pageIndex: page.pageIndex, bbox },
      kind: 'figure',
      sources: [],
      visibility: 'uncertain',
      role: 'mixed',
      confidence: 'unresolved',
      blockId: figure.blockId,
      anchorIds: [],
      evidence: ['declared-mixed-region'],
      contradictions: ['no-separable-paint'],
      masks: [],
    })
  }
  const protectedBox = [
    ...(input.protectedRegions ?? []),
    ...input.anchors
      .filter((a) => a.role === 'question' && a.reliability === 'confirmed')
      .flatMap((a) => (a.scope ? [a.region, a.scope] : [a.region])),
  ]
    .filter((r) => r.pageIndex === page.pageIndex && valid(r.bbox))
    .map((r) => r.bbox)
  const margin = Math.max(0.075 * em, rasterIncrement(page, raster))
  objects.sort((a, b) => area(b.region.bbox) - area(a.region.bbox))
  const candidates = objects.map((object) =>
    classify(input, object, em, viewport, protectedBox, margin),
  )
  const obstructedPaint = new Set(
    candidates.flatMap((c) => (c.paintScopeId && !c.masks.length ? [c.paintScopeId] : [])),
  )
  const masks = new Map<string, PageRegion[]>()
  for (const candidate of candidates) {
    if (
      candidate.paintScopeId &&
      obstructedPaint.has(candidate.paintScopeId) &&
      candidate.masks.length
    ) {
      candidate.masks = []
      candidate.confidence = 'unresolved'
      candidate.contradictions.push('mixed-paint-incomplete')
    }
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

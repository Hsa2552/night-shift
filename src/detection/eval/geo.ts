// Vérité terrain géométrique (format `unspoil-verite-geo/1`) : rectangles dans le repère C1,
// rôles et blocs attendus, provenance ; aucun texte des annales. Indépendante de la
// reconstruction des lignes : un changement de `layoutPage` ne l'invalide pas.

import { decideDetection, type PresentedDetection } from '../../viewer/detectionDecision.ts'
import type { PageDimensions } from '../../shared/types.ts'
import type { CorrectionBlock, DetectionResult, DocumentKind, Rect } from '../contract.ts'
import { coverage, LEAK_THRESHOLD, OVERMASK_THRESHOLD, type Role } from './metrics.ts'
import { scoreStrictGeometry } from './strict.ts'

export const GEO_METRICS_VERSION = 'unspoil-geo/2'

export function provenanceKind(provenance: string) {
  if (/^humaine\b/i.test(provenance)) return 'human-reviewed'
  if (/^automatique\b/i.test(provenance)) return 'automatic'
  return 'unspecified'
}

export type ElementCategory = 'text' | 'empty-box' | 'filled-box' | 'figure'

export interface GeoTruth {
  format: 'unspoil-verite-geo/1'
  /** « humaine … » ou « automatique … » : qui a produit cette vérité, et comment. */
  provenance: string
  kind: DocumentKind
  elements: {
    page: number
    role: Role
    bbox: [number, number, number, number]
    group?: string
    category?: ElementCategory
  }[]
}

interface RegionScore {
  corrections: { total: number; full: number; partial: number; none: number }
  statements: { total: number; masked: number }
  blocks: { total: number; fullyMasked: number; independent: number }
  strict: ReturnType<typeof scoreStrictGeometry>
}

export interface PresentedScore {
  mode: PresentedDetection['kind']
  reason?: 'uncertain' | 'invalid-masks'
  coverage: RegionScore | null
  success: boolean
}

export interface DocumentScore extends RegionScore {
  kindExpected: DocumentKind
  kindObtained: DocumentKind
  abstained: boolean
  measurable: boolean
  presentation: PresentedScore
  success: boolean
}

const rect = (b: [number, number, number, number]): Rect => ({
  x: b[0],
  y: b[1],
  width: b[2],
  height: b[3],
})

function scoreRegions(truth: GeoTruth, blocks: readonly CorrectionBlock[]): RegionScore {
  const regions = blocks.flatMap((b) => b.regions)
  const corrections = truth.elements.filter((e) => e.role === 'c')
  const statements = truth.elements.filter((e) => e.role === 'q')
  const correctionCover = corrections.map((e) => coverage(rect(e.bbox), e.page, regions))
  const full = correctionCover.filter((c) => c >= LEAK_THRESHOLD).length
  const none = correctionCover.filter((c) => c < OVERMASK_THRESHOLD).length
  const masked = statements.filter((e) => {
    const inside = corrections.filter((c) => c.page === e.page).map((c) => rect(c.bbox))
    return coverage(rect(e.bbox), e.page, regions, inside) > OVERMASK_THRESHOLD
  }).length

  // Blocs attendus.
  const names = [...new Set(corrections.map((e) => e.group).filter((g): g is string => !!g))]
  let fullyMasked = 0
  let independent = 0
  for (const name of names) {
    const members = corrections.filter((e) => e.group === name)
    if (members.every((e) => coverage(rect(e.bbox), e.page, regions) >= LEAK_THRESHOLD)) {
      fullyMasked++
    }
    const owners = blocks.filter((b) =>
      members.some((e) => coverage(rect(e.bbox), e.page, b.regions) > 0.5),
    )
    if (owners.length !== 1) continue
    const owner = owners[0]!
    const coversAll = members.every(
      (e) => coverage(rect(e.bbox), e.page, owner.regions) >= LEAK_THRESHOLD,
    )
    const touchesOthers = corrections.some(
      (e) => e.group && e.group !== name && coverage(rect(e.bbox), e.page, owner.regions) > 0.5,
    )
    if (coversAll && !touchesOthers) independent++
  }

  return {
    corrections: {
      total: corrections.length,
      full,
      partial: corrections.length - full - none,
      none,
    },
    statements: { total: statements.length, masked },
    blocks: { total: names.length, fullyMasked, independent },
    strict: scoreStrictGeometry(truth, blocks),
  }
}

export function scorePresentedGeo(truth: GeoTruth, decision: PresentedDetection): PresentedScore {
  if (decision.kind === 'progressive' || decision.kind === 'error') {
    return {
      mode: decision.kind,
      ...(decision.kind === 'progressive' ? { reason: decision.reason } : {}),
      coverage: null,
      success: false,
    }
  }
  const coverage = scoreRegions(truth, decision.kind === 'automatic' ? decision.blocks : [])
  const { corrections, statements } = coverage
  const expectedMode = truth.kind === 'statement_only' ? 'statement_only' : 'automatic'
  return {
    mode: decision.kind,
    coverage,
    success:
      truth.kind !== 'unknown' &&
      expectedMode === decision.kind &&
      corrections.total + statements.total > 0 &&
      corrections.full === corrections.total &&
      statements.masked <= statements.total * OVERMASK_THRESHOLD,
  }
}

export function scoreGeo(
  truth: GeoTruth,
  result: DetectionResult,
  pages: readonly PageDimensions[],
): DocumentScore {
  const raw = scoreRegions(truth, result.blocks)
  const presentation = scorePresentedGeo(truth, decideDetection(result, pages))
  return {
    ...raw,
    kindExpected: truth.kind,
    kindObtained: result.kind,
    abstained: presentation.mode === 'progressive',
    measurable: raw.corrections.total + raw.statements.total > 0,
    presentation,
    success: presentation.success,
  }
}

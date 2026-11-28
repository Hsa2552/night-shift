// Vérité terrain géométrique (format `unspoil-verite-geo/1`) : rectangles dans le repère C1,
// rôles et blocs attendus, provenance ; aucun texte des annales. Indépendante de la
// reconstruction des lignes : un changement de `layoutPage` ne l'invalide pas.

import type { DetectionResult, DocumentKind, Rect } from '../contract.ts'
import { coverage, LEAK_THRESHOLD, OVERMASK_THRESHOLD, type Role } from './metrics.ts'

export interface GeoTruth {
  format: 'unspoil-verite-geo/1'
  /** « humaine … » ou « automatique … » : qui a produit cette vérité, et comment. */
  provenance: string
  kind: DocumentKind
  elements: { page: number; role: Role; bbox: [number, number, number, number]; group?: string }[]
}

export interface DocumentScore {
  kindExpected: DocumentKind
  kindObtained: DocumentKind
  /** Document entièrement couvert par l'interface (révélation progressive) : abstention. */
  abstained: boolean
  corrections: { total: number; full: number; partial: number; none: number }
  statements: { total: number; masked: number }
  blocks: { total: number; fullyMasked: number; independent: number }
  /** Faux si aucune unité n'est annotée (zones exclues) : document non mesurable. */
  measurable: boolean
  /** Réussite automatique : pas d'abstention, aucune correction incomplètement masquée,
   * au plus 5 % des lignes d'énoncé masquées, et pas d'erreur de type « sujet seul ». */
  success: boolean
}

const rect = (b: [number, number, number, number]): Rect => ({
  x: b[0],
  y: b[1],
  width: b[2],
  height: b[3],
})

export function scoreGeo(truth: GeoTruth, result: DetectionResult): DocumentScore {
  const regions = result.blocks.flatMap((b) => b.regions)
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
    const owners = result.blocks.filter((b) =>
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

  const abstained = result.kind === 'unknown'
  const leaks = corrections.length - full
  const overmaskRate = statements.length === 0 ? 0 : masked / statements.length
  const wrongStatementOnly = result.kind === 'statement_only' && corrections.length > 0
  return {
    kindExpected: truth.kind,
    kindObtained: result.kind,
    abstained,
    corrections: { total: corrections.length, full, partial: leaks - none, none },
    statements: { total: statements.length, masked },
    blocks: { total: names.length, fullyMasked, independent },
    measurable: corrections.length + statements.length > 0,
    success:
      corrections.length + statements.length > 0 &&
      !abstained &&
      leaks === 0 &&
      overmaskRate <= 0.05 &&
      !wrongStatementOnly,
  }
}

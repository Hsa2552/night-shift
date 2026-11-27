// Mesures d'évaluation du détecteur à partir d'une vérité terrain annotée.
// Deux erreurs comptées séparément :
// - fuite : un élément de correction n'est pas entièrement couvert par un masque ;
// - sur-masquage : un élément d'énoncé est (même partiellement) couvert par un masque.

import type { DetectionResult, DocumentKind, PageRegion, Rect } from '../contract.ts'

export type Role = 'q' | 'c' | 't'

export interface TruthElement {
  pageIndex: number
  role: Role
  text?: string
  bbox: Rect
}

export interface Truth {
  kind: DocumentKind
  elements: TruthElement[]
}

export interface Evaluation {
  kindOk: boolean
  expectedKind: DocumentKind
  kind: DocumentKind
  corrections: number
  leaked: TruthElement[]
  questions: number
  overmasked: TruthElement[]
}

/** Part de la surface de `bbox` couverte par les régions de la même page (échantillonnage). */
export function coverage(bbox: Rect, pageIndex: number, regions: PageRegion[]): number {
  const onPage = regions.filter((r) => r.pageIndex === pageIndex).map((r) => r.bbox)
  if (onPage.length === 0 || bbox.width <= 0 || bbox.height <= 0) return 0
  const nx = Math.max(2, Math.ceil(bbox.width / 2))
  const ny = Math.max(2, Math.ceil(bbox.height / 2))
  let inside = 0
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const x = bbox.x + ((i + 0.5) * bbox.width) / nx
      const y = bbox.y + ((j + 0.5) * bbox.height) / ny
      if (onPage.some((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height)) {
        inside++
      }
    }
  }
  return inside / (nx * ny)
}

/** Seuils : une correction est cachée si au moins 95 % de sa surface est couverte ;
 * une question est masquée à tort si plus de 5 % de sa surface est couverte. */
export const LEAK_THRESHOLD = 0.95
export const OVERMASK_THRESHOLD = 0.05

/** Part du contour de `bbox` couverte : l'encre d'un cadre ou d'une figure est sur ses bords. */
export function edgeCoverage(bbox: Rect, pageIndex: number, regions: PageRegion[]): number {
  const onPage = regions.filter((r) => r.pageIndex === pageIndex).map((r) => r.bbox)
  const points: [number, number][] = []
  const n = 50
  for (let k = 0; k <= n; k++) {
    const fx = bbox.x + (k / n) * bbox.width
    const fy = bbox.y + (k / n) * bbox.height
    points.push([fx, bbox.y + 1], [fx, bbox.y + bbox.height - 1])
    points.push([bbox.x + 1, fy], [bbox.x + bbox.width - 1, fy])
  }
  const inside = points.filter(([x, y]) =>
    onPage.some((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height),
  ).length
  return inside / points.length
}

/** Figures : couverture du contour ; texte : couverture de la surface. */
const covered = (e: TruthElement, regions: PageRegion[]) =>
  e.text === '[figure]'
    ? edgeCoverage(e.bbox, e.pageIndex, regions)
    : coverage(e.bbox, e.pageIndex, regions)

export function evaluate(truth: Truth, result: DetectionResult): Evaluation {
  const regions = result.blocks.flatMap((b) => b.regions)
  const corrections = truth.elements.filter((e) => e.role === 'c')
  const questions = truth.elements.filter((e) => e.role === 'q')
  return {
    kindOk: truth.kind === result.kind,
    expectedKind: truth.kind,
    kind: result.kind,
    corrections: corrections.length,
    leaked: corrections.filter((e) => covered(e, regions) < LEAK_THRESHOLD),
    questions: questions.length,
    overmasked: questions.filter((e) => covered(e, regions) > OVERMASK_THRESHOLD),
  }
}

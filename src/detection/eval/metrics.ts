// Mesures d'évaluation du détecteur à partir d'une vérité terrain annotée.
// Deux erreurs comptées séparément :
// - fuite : un élément de correction n'est pas entièrement couvert par un masque ;
// - sur-masquage : un élément d'énoncé est (même partiellement) couvert par un masque.

import type { DetectionResult, DocumentKind, PageRegion, Rect } from '../contract.ts'

/** q : énoncé ; c : correction ; t : titre ou texte neutre ; m : ligne mêlant les deux (non comptée). */
export type Role = 'q' | 'c' | 't' | 'm'

export interface TruthElement {
  pageIndex: number
  role: Role
  text?: string
  bbox: Rect
  /** Bloc de correction attendu (révélation indépendante), si annoté. */
  group?: string
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
  /** Blocs attendus : total, entièrement masqués, révélables indépendamment. */
  blocks: { total: number; fullyMasked: number; independent: number }
}

/** Part de la surface de `bbox` couverte par les régions de la même page (échantillonnage). */
export function coverage(
  bbox: Rect,
  pageIndex: number,
  regions: PageRegion[],
  ignore: Rect[] = [],
): number {
  const onPage = regions.filter((r) => r.pageIndex === pageIndex).map((r) => r.bbox)
  if (onPage.length === 0 || bbox.width <= 0 || bbox.height <= 0) return 0
  const inRect = (x: number, y: number, r: Rect) =>
    x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height
  const nx = Math.max(2, Math.ceil(bbox.width / 2))
  const ny = Math.max(2, Math.ceil(bbox.height / 2))
  let inside = 0
  let total = 0
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const x = bbox.x + ((i + 0.5) * bbox.width) / nx
      const y = bbox.y + ((j + 0.5) * bbox.height) / ny
      // Les points qui tombent dans une correction annotée ne comptent pas.
      if (ignore.some((r) => inRect(x, y, r))) continue
      total++
      if (onPage.some((r) => inRect(x, y, r))) inside++
    }
  }
  return total === 0 ? 0 : inside / total
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
    // Sur-masquage : la partie d'un énoncé qui recouvre une correction annotée (lettre d'une
    // proposition imprimée dans sa case, par exemple) doit être masquée et ne compte pas.
    overmasked: questions.filter((e) => {
      const inside = corrections.filter((c) => c.pageIndex === e.pageIndex).map((c) => c.bbox)
      return coverage(e.bbox, e.pageIndex, regions, inside) > OVERMASK_THRESHOLD
    }),
    blocks: blockStats(truth, result),
  }
}

/**
 * Vérité terrain à partir d'une annotation par plages de lignes :
 *   kind: mixed
 *   default q
 *   c 12-30, 45
 *   t 0-2
 * Les numéros sont ceux du listing `x.lignes.txt` (ordre de lecture).
 */
export function truthFromRoles(
  spec: string,
  units: { pageIndex: number; text: string; bbox: Rect }[],
): Truth {
  let kind: DocumentKind = 'unknown'
  let fallback: Role = 'q'
  const roles = new Map<number, Role>()
  const groups = new Map<number, string>()
  for (const raw of spec.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim()
    if (!line) continue
    const k = /^kind\s*:\s*(\w+)$/.exec(line)
    if (k) {
      kind = k[1] as DocumentKind
      continue
    }
    const d = /^default\s+([qctm])$/.exec(line)
    if (d) {
      fallback = d[1] as Role
      continue
    }
    // « bloc <nom> <plages> » : lignes de correction formant un bloc attendu.
    const blk = /^bloc\s+(\S+)\s+(.+)$/.exec(line)
    const r = blk ? ['', 'c', blk[2]!] : /^([qctm])\s+(.+)$/.exec(line)
    if (!r) throw new Error(`Ligne d'annotation invalide : ${raw}`)
    for (const part of r[2]!.split(/[,\s]+/).filter(Boolean)) {
      const [a, b] = part.split('-').map(Number)
      if (!Number.isInteger(a) || (b !== undefined && !Number.isInteger(b))) {
        throw new Error(`Plage invalide : ${part}`)
      }
      for (let i = a!; i <= (b ?? a!); i++) {
        roles.set(i, r[1] as Role)
        if (blk) groups.set(i, blk[1]!)
      }
    }
  }
  return {
    kind,
    elements: units.map((u, i) => {
      const group = groups.get(i)
      return { ...u, role: roles.get(i) ?? fallback, ...(group ? { group } : {}) }
    }),
  }
}

/**
 * Blocs attendus : entièrement masqué si chacune de ses lignes est couverte à 95 % ;
 * révélable indépendamment si un seul bloc détecté couvre toutes ses lignes et que ce bloc
 * ne couvre (au-delà de 50 %) aucune ligne d'un autre bloc attendu.
 */
function blockStats(truth: Truth, result: DetectionResult) {
  const names = [...new Set(truth.elements.map((e) => e.group).filter((g): g is string => !!g))]
  let fullyMasked = 0
  let independent = 0
  for (const name of names) {
    const members = truth.elements.filter((e) => e.group === name)
    const all = result.blocks.flatMap((b) => b.regions)
    if (members.every((e) => coverage(e.bbox, e.pageIndex, all) >= LEAK_THRESHOLD)) fullyMasked++
    const owners = result.blocks.filter((b) =>
      members.some((e) => coverage(e.bbox, e.pageIndex, b.regions) > 0.5),
    )
    if (owners.length !== 1) continue
    const owner = owners[0]!
    const coversAll = members.every(
      (e) => coverage(e.bbox, e.pageIndex, owner.regions) >= LEAK_THRESHOLD,
    )
    const leaksOthers = truth.elements.some(
      (e) => e.group && e.group !== name && coverage(e.bbox, e.pageIndex, owner.regions) > 0.5,
    )
    if (coversAll && !leaksOthers) independent++
  }
  return { total: names.length, fullyMasked, independent }
}

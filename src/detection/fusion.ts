// Fusion avec des détecteurs visuels externes (détecteur colorimétrique de Wael, PR #13).
// Le moteur n'en dépend pas : un analyseur s'enregistre ici, de même forme que
// `analyzeColorPage(page, raster, convention?)`, et le moteur lui passe le raster déjà rendu.
// Pas d'union aveugle : la structure textuelle prévaut pour préserver les questions.

import type { CorrectionBlock, PageData, PageRegion, RasterData, Rect } from './contract.ts'

export interface ExternalColorCandidate {
  region: PageRegion
  hue: number
  evidence: 'supported' | 'ambiguous'
}

export interface ExternalColorResult {
  candidates: ExternalColorCandidate[]
  blocks: CorrectionBlock[]
  needsFallback: boolean
}

export type ExternalColorAnalyzer = (page: PageData, raster: RasterData) => ExternalColorResult

let colorAnalyzer: ExternalColorAnalyzer | null | 'default' = 'default'

/**
 * Analyseur colorimétrique externe : 'default' (détecteur visuel de Wael, src/detection/visual),
 * null (aucun), ou une fonction de même forme (tests, autre détecteur).
 */
export function registerColorAnalyzer(analyzer: ExternalColorAnalyzer | null | 'default') {
  colorAnalyzer = analyzer
}

export function registeredColorAnalyzer(): ExternalColorAnalyzer | null | 'default' {
  return colorAnalyzer
}

export interface FusionContext {
  /** Lignes à préserver : questions numérotées, ancres de questions (repère canonique). */
  protectedLines: PageRegion[]
  /** Régions déjà masquées par le moteur. */
  ownRegions: PageRegion[]
  /** Teinte réservée aux questions (ancres), si elle a été reconnue. */
  questionHue: number | null
  /** Première question numérotée du document (repère canonique), si elle existe : une encre
   * colorée placée avant elle (logo, titre) n'est pas un indice de correction. */
  firstQuestion?: { pageIndex: number; y: number } | null
  /** Fragments de texte dont la couleur native (opérateurs du PDF, état `matched`) est neutre.
   * Une couleur vue par le raster sur ce texte vient du fond ou d'un aplat, pas de l'encre. */
  neutralText?: PageRegion[]
  /** Libellé de la question qui précède un point, pour étiqueter un bloc ajouté. */
  labelAt: (pageIndex: number, y: number) => string | undefined
}

export interface FusionOutcome {
  added: CorrectionBlock[]
  rejected: number
  /** Repli externe sur une encre que rien n'explique (compatibilité : `unexplained.length > 0`
   * ou raster externe inexploitable). */
  externalFallback: boolean
  /** Bilan des candidats externes, pour le contrôle final de cohérence du moteur. */
  audit: {
    /** Candidats recouverts par un masque du moteur : indices convergents. */
    convergent: number
    /** Candidats appuyés qui contredisent la structure (question protégée, teinte des
     * questions) : rejetés, la structure prévaut. */
    contradicted: number
    /** Candidats expliqués sans masque (question, teinte des questions). */
    explained: number
    /** Candidats ambigus que rien n'explique ni ne couvre (pages concernées). */
    unexplained: PageRegion[]
  }
}

const overlapRatio = (a: Rect, b: Rect) => {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? (w * h) / Math.max(1e-6, b.width * b.height) : 0
}

/** Part de la surface de `region` couverte par l'union de `masks` (même page), échantillonnée. */
const coveredShare = (region: PageRegion, masks: PageRegion[]) => {
  const near = masks.filter((m) => m.pageIndex === region.pageIndex)
  if (near.length === 0) return 0
  const { x, y, width, height } = region.bbox
  const n = 8
  let hits = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const px = x + ((i + 0.5) / n) * width
      const py = y + ((j + 0.5) / n) * height
      if (
        near.some(
          (m) =>
            px >= m.bbox.x &&
            px <= m.bbox.x + m.bbox.width &&
            py >= m.bbox.y &&
            py <= m.bbox.y + m.bbox.height,
        )
      )
        hits++
    }
  }
  return hits / (n * n)
}

const hueDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/**
 * Règles :
 * 1. une région externe qui recouvre une ligne protégée (question) est rejetée ;
 * 2. la teinte des questions (ancres) est écartée ;
 * 3. une région déjà couverte par le moteur est ignorée ; seules les régions appuyées
 *    (« supported ») par un candidat de même zone sont ajoutées ;
 * 4. un signal de repli externe est remonté au moteur (abstention possible).
 */
export function fuseExternalColor(
  results: ExternalColorResult[],
  ctx: FusionContext,
): FusionOutcome {
  const added: CorrectionBlock[] = []
  let rejected = 0
  for (const result of results) {
    for (const block of result.blocks) {
      const kept: PageRegion[] = []
      for (const region of block.regions) {
        const support = result.candidates.filter(
          (c) =>
            c.region.pageIndex === region.pageIndex &&
            overlapRatio(region.bbox, c.region.bbox) > 0.5,
        )
        const onQuestionHue =
          ctx.questionHue !== null &&
          support.some((c) => hueDistance(c.hue, ctx.questionHue!) <= 20)
        const supported = support.some((c) => c.evidence === 'supported')
        const hitsQuestion = ctx.protectedLines.some(
          (l) => l.pageIndex === region.pageIndex && overlapRatio(region.bbox, l.bbox) > 0.3,
        )
        const alreadyMasked = ctx.ownRegions.some(
          (o) => o.pageIndex === region.pageIndex && overlapRatio(o.bbox, region.bbox) > 0.9,
        )
        const nativeNeutral = coveredShare(region, ctx.neutralText ?? []) >= 0.5
        if (onQuestionHue || hitsQuestion || !supported || nativeNeutral) {
          rejected++
          continue
        }
        if (!alreadyMasked) kept.push(region)
      }
      if (kept.length > 0) {
        const first = kept[0]!
        const label = ctx.labelAt(first.pageIndex, first.bbox.y)
        added.push({ id: block.id, ...(label ? { questionLabel: label } : {}), regions: kept })
      }
    }
  }
  // Bilan de chaque candidat : couvert par le moteur (convergent), contredit par la structure,
  // expliqué par elle (question, teinte des questions), ou ambigu et inexpliqué.
  const covering = [...ctx.ownRegions, ...added.flatMap((b) => b.regions)]
  const isQuestionHue = (c: ExternalColorCandidate) =>
    ctx.questionHue !== null && hueDistance(c.hue, ctx.questionHue) <= 20
  const onQuestion = (c: ExternalColorCandidate) =>
    ctx.protectedLines.some(
      (l) => l.pageIndex === c.region.pageIndex && overlapRatio(c.region.bbox, l.bbox) > 0.3,
    )
  const covered = (c: ExternalColorCandidate) => coveredShare(c.region, covering) >= 0.5
  // Mobilier de page : même rectangle (à 3 points près) sur au moins deux pages (logo, bandeau).
  const all = results.flatMap((r) => r.candidates)
  const same = (a: Rect, b: Rect) =>
    Math.abs(a.x - b.x) <= 3 &&
    Math.abs(a.y - b.y) <= 3 &&
    Math.abs(a.width - b.width) <= 3 &&
    Math.abs(a.height - b.height) <= 3
  const furniture = (c: ExternalColorCandidate) =>
    all.some((o) => o.region.pageIndex !== c.region.pageIndex && same(o.region.bbox, c.region.bbox))
  const beforeQuestions = (c: ExternalColorCandidate) => {
    const q = ctx.firstQuestion
    if (!q) return false
    if (c.region.pageIndex !== q.pageIndex) return c.region.pageIndex < q.pageIndex
    return c.region.bbox.y + c.region.bbox.height <= q.y
  }
  const audit: FusionOutcome['audit'] = {
    convergent: 0,
    contradicted: 0,
    explained: 0,
    unexplained: [],
  }
  for (const r of results) {
    for (const c of r.candidates) {
      const nativeNeutral = coveredShare(c.region, ctx.neutralText ?? []) >= 0.5
      if (covered(c)) audit.convergent++
      else if (
        isQuestionHue(c) ||
        onQuestion(c) ||
        furniture(c) ||
        beforeQuestions(c) ||
        nativeNeutral
      ) {
        if (c.evidence === 'supported') audit.contradicted++
        else audit.explained++
      } else if (r.needsFallback) audit.unexplained.push(c.region)
    }
  }
  // Repli externe : encre inexpliquée et non couverte, ou raster externe inexploitable.
  const externalFallback =
    audit.unexplained.length > 0 ||
    results.some((r) => r.needsFallback && r.candidates.length === 0)
  return { added, rejected, externalFallback, audit }
}

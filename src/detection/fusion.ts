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
  /** Libellé de la question qui précède un point, pour étiqueter un bloc ajouté. */
  labelAt: (pageIndex: number, y: number) => string | undefined
}

export interface FusionOutcome {
  added: CorrectionBlock[]
  rejected: number
  externalFallback: boolean
}

const overlapRatio = (a: Rect, b: Rect) => {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? (w * h) / Math.max(1e-6, b.width * b.height) : 0
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
        if (onQuestionHue || hitsQuestion || !supported) {
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
  // Signal de repli externe retenu seulement s'il porte sur une encre que la structure
  // n'explique pas (ni question, ni teinte des questions), ou si le raster était inexploitable.
  const explained = (c: ExternalColorCandidate) =>
    (ctx.questionHue !== null && hueDistance(c.hue, ctx.questionHue) <= 20) ||
    ctx.protectedLines.some(
      (l) => l.pageIndex === c.region.pageIndex && overlapRatio(c.region.bbox, l.bbox) > 0.3,
    )
  const externalFallback = results.some(
    (r) =>
      r.needsFallback && (r.candidates.length === 0 || r.candidates.some((c) => !explained(c))),
  )
  return { added, rejected, externalFallback }
}

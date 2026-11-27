// Copie locale du contrat PROPOSÉ (DEBUT_Hackaton.txt §11), en attendant sa
// validation et sa publication dans src/shared/ par Salif. Dès que le contrat
// officiel existe, ce fichier se contente de réexporter les types partagés.
// Ne pas diverger de la proposition sans le signaler à l'équipe.

/** Rectangle dans le repère canonique d'une page : origine en haut à gauche, y vers le bas, échelle 1. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface TextItem {
  text: string
  bbox: Rect
  fontSize?: number
  fontName?: string
  hasEOL?: boolean
}

export interface PageData {
  /** Indice de page, à partir de 0. */
  pageIndex: number
  width: number
  height: number
  textItems: TextItem[]
}

export interface RasterData {
  width: number
  height: number
  rgba: Uint8ClampedArray
}

export interface DetectionInput {
  pages: PageData[]
  getRaster?: (pageIndex: number) => Promise<RasterData>
}

export interface PageRegion {
  pageIndex: number
  bbox: Rect
}

export interface CorrectionBlock {
  id: string
  questionLabel?: string
  regions: PageRegion[]
}

export type DocumentKind = 'mixed' | 'statement_only' | 'correction_only' | 'unknown'

export interface DetectionResult {
  kind: DocumentKind
  blocks: CorrectionBlock[]
  warnings: string[]
  needsFallback: boolean
}

export type DetectCorrections = (input: DetectionInput) => Promise<DetectionResult>

import type { VectorPageObservation } from '../detection/visual/vector/index.ts'

export type { VectorPageObservation }

/** Rectangle in the page viewport at scale 1, with origin at the top left. */
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

export interface PageDimensions {
  /** Zero-based index in the PDF. */
  pageIndex: number
  width: number
  height: number
}

export interface PageData extends PageDimensions {
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
  getVectors?: (pageIndex: number) => Promise<VectorPageObservation | undefined>
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

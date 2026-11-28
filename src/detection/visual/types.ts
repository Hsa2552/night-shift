import type { CorrectionBlock, PageData, PageRegion, RasterData } from '../../shared/types'

export interface VisualPageResult<Candidate> {
  candidates: Candidate[]
  /** Only groups supported by the available evidence. IDs are prefixed by detector and page. */
  blocks: CorrectionBlock[]
  /** A plausible correction remains unresolved, or the raster could not be analyzed. */
  needsFallback: boolean
}

export interface ColorCandidate {
  region: PageRegion
  /** Hue in degrees in [0, 360), irrespective of raster scale. */
  hue: number
  ink: 'text' | 'graphic' | 'mixed'
  evidence: 'supported' | 'ambiguous'
}

/** A hue explicitly identified as the correction color in the document. */
export interface ColorConvention {
  hue: number
}

export interface HueInk {
  /** Hue in degrees in [0, 360), irrespective of raster scale. */
  hue: number
  pixels: number
}

export interface TextInkObservation {
  /** Index into the original PageData.textItems array. */
  textIndex: number
  region: PageRegion
  colors: HueInk[]
  neutralPixels: number
}

export interface ChromaticInkObservation extends HueInk {
  region: PageRegion
  /** Text fragments with matching raster ink intersecting this region. */
  textIndices: number[]
}

export interface PageInkObservation {
  text: TextInkObservation[]
  regions: ChromaticInkObservation[]
}

export interface ColorPageResult extends VisualPageResult<ColorCandidate> {
  /** Raw measurements from the same pass. Use these independently of any candidate's role. */
  ink: PageInkObservation | null
}

export type ColorPageDetector = (
  page: PageData,
  raster: RasterData,
  convention?: ColorConvention,
) => ColorPageResult

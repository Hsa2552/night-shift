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

export interface QcmCandidate {
  /** Every observed option marker, including empty ones, in canonical page coordinates. */
  regions: PageRegion[]
  layout: 'options' | 'grid'
  filled: number
  evidence: 'supported' | 'ambiguous'
}

export type ColorPageDetector = (
  page: PageData,
  raster: RasterData,
  convention?: ColorConvention,
) => VisualPageResult<ColorCandidate>

export type QcmPageDetector = (page: PageData, raster: RasterData) => VisualPageResult<QcmCandidate>

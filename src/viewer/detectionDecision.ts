import type { CorrectionBlock, DetectionResult, PageDimensions } from '../shared/types.ts'
import { clipCorrectionBlocks } from './correctionGeometry.ts'

export type PresentedDetection =
  | { kind: 'automatic'; blocks: CorrectionBlock[] }
  | { kind: 'statement_only' }
  | { kind: 'progressive'; reason: 'uncertain' | 'invalid-masks' }
  | { kind: 'error' }

export function decideDetection(
  result: DetectionResult,
  pages: readonly PageDimensions[],
): Exclude<PresentedDetection, { kind: 'error' }> {
  if (
    result.kind === 'unknown' ||
    result.needsFallback ||
    (result.kind === 'statement_only' && result.blocks.length > 0)
  ) {
    return { kind: 'progressive', reason: 'uncertain' }
  }
  if (result.kind === 'statement_only') return { kind: 'statement_only' }
  const blocks = clipCorrectionBlocks(result.blocks, pages)
  return blocks?.length
    ? { kind: 'automatic', blocks }
    : { kind: 'progressive', reason: 'invalid-masks' }
}

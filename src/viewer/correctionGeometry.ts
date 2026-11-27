import type { CorrectionBlock, PageDimensions, PageRegion } from '../shared/types'

export function clipCorrectionBlocks(
  blocks: readonly CorrectionBlock[],
  pages: readonly PageDimensions[],
): CorrectionBlock[] | null {
  const dimensions = new Map(pages.map((page) => [page.pageIndex, page]))
  const ids = new Set<string>()
  const clipped: CorrectionBlock[] = []

  for (const block of blocks) {
    if (ids.has(block.id) || block.regions.length === 0) return null
    ids.add(block.id)
    const regions: PageRegion[] = []

    for (const {
      pageIndex,
      bbox: { x, y, width, height },
    } of block.regions) {
      const page = dimensions.get(pageIndex)
      if (!page || ![x, y, width, height].every(Number.isFinite)) return null

      const left = Math.max(0, x)
      const top = Math.max(0, y)
      const right = Math.min(page.width, x + width)
      const bottom = Math.min(page.height, y + height)
      if (right <= left || bottom <= top) return null

      regions.push({
        pageIndex,
        bbox: { x: left, y: top, width: right - left, height: bottom - top },
      })
    }

    clipped.push({ ...block, regions })
  }

  return clipped
}

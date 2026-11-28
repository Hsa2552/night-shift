import type { CorrectionBlock, DetectionInput, PageRegion, RasterData } from '../../../shared/types'
import { contains } from './geometry'
import { detectGraphicCorrections, type GraphicAnchor } from './index'

/** Reuse the established owners. The engine has no confirmed scope for adjoining artwork. */
export async function fuseGraphicCorrections(
  { pages, getVectors }: DetectionInput,
  blocks: CorrectionBlock[],
  questions: GraphicAnchor[],
  protectedRegions: PageRegion[],
  customPages: ReadonlySet<number>,
  rasters: ReadonlyMap<number, Promise<RasterData | null>>,
) {
  if (!getVectors) return
  for (const page of pages) {
    const { pageIndex } = page
    if (customPages.has(pageIndex)) continue
    const existingBlocks = blocks.filter((block) =>
      block.regions.some((region) => region.pageIndex === pageIndex),
    )
    if (!existingBlocks.length) continue
    const vectors = await getVectors(pageIndex).catch(() => undefined)
    if (vectors?.pageIndex !== pageIndex) continue
    const graphic = vectors.graphics
    if (
      !graphic?.images.length &&
      !graphic?.paths.length &&
      !graphic?.rules.length &&
      !graphic?.highlights?.length
    )
      continue
    const result = detectGraphicCorrections({
      page,
      vectors,
      raster: (await rasters.get(pageIndex)) ?? undefined,
      anchors: questions.filter(({ region }) => region.pageIndex === pageIndex),
      existingBlocks,
      protectedRegions,
    })
    // No new blocks or fallback from an unowned graphic. Avoid duplicating masks that the
    // existing block already covers (including any already authorized padding).
    for (const { blockId, regions } of result.additions) {
      const owner = existingBlocks.find(({ id }) => id === blockId)
      owner?.regions.push(
        ...regions.filter(
          (region) =>
            !owner.regions.some(
              (known) => known.pageIndex === region.pageIndex && contains(known.bbox, region.bbox),
            ),
        ),
      )
    }
  }
}

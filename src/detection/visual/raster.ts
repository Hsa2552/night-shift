import type { PageData, PageRegion, RasterData, Rect } from '../../shared/types'

export interface PixelBox {
  left: number
  top: number
  right: number
  bottom: number
}

export function rasterScale(page: PageData, raster: RasterData) {
  const { width, height, rgba } = raster
  if (
    ![page.width, page.height].every((size) => Number.isFinite(size) && size > 0) ||
    ![width, height].every((size) => Number.isSafeInteger(size) && size > 0) ||
    width * height > 16_777_216 ||
    rgba.length !== width * height * 4
  ) {
    return null
  }
  return { x: width / page.width, y: height / page.height }
}

export function pixelBox(
  rect: Rect,
  raster: RasterData,
  scale: { x: number; y: number },
): PixelBox {
  return {
    left: Math.max(0, Math.min(raster.width, Math.floor(rect.x * scale.x))),
    top: Math.max(0, Math.min(raster.height, Math.floor(rect.y * scale.y))),
    right: Math.max(0, Math.min(raster.width, Math.ceil((rect.x + rect.width) * scale.x))),
    bottom: Math.max(0, Math.min(raster.height, Math.ceil((rect.y + rect.height) * scale.y))),
  }
}

export function pageRegion(
  pageIndex: number,
  box: PixelBox,
  raster: RasterData,
  scale: { x: number; y: number },
  pad = 0,
): PageRegion {
  const left = Math.max(0, box.left - pad)
  const top = Math.max(0, box.top - pad)
  const right = Math.min(raster.width, box.right + pad)
  const bottom = Math.min(raster.height, box.bottom + pad)
  return {
    pageIndex,
    bbox: {
      x: left / scale.x,
      y: top / scale.y,
      width: (right - left) / scale.x,
      height: (bottom - top) / scale.y,
    },
  }
}

export function bodyHeight(page: PageData): number {
  const sizes = page.textItems
    .filter(
      (item) => item.text.trim().length >= 3 && item.bbox.height >= 3 && item.bbox.height <= 30,
    )
    .map((item) => item.bbox.height)
    .sort((a, b) => a - b)
  return sizes[Math.floor(sizes.length / 2)] ?? 10
}

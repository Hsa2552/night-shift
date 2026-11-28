import type { PageRegion } from '../../../shared/types'
import type { VectorRectangle } from './index'

export interface NativeSquare {
  region: PageRegion
  nativeState: 'filled' | 'empty' | 'ambiguous'
  paint: VectorRectangle[]
  /** The paint stream alone cannot prove what survives later compositing. */
  needsVisibilityCheck: true
}

function tone(value: string | null | undefined) {
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) return
  const rgb = [1, 3, 5].map((index) => Number.parseInt(value.slice(index, index + 2), 16))
  if (Math.max(...rgb) <= 80) return 'dark'
  if (Math.min(...rgb) >= 216) return 'light'
}

export function nativeSquares(rectangles: readonly VectorRectangle[]): NativeSquare[] {
  const squares: NativeSquare[] = []
  for (const item of rectangles) {
    const { x, y, width, height } = item.region.bbox
    const side = Math.min(width, height)
    if (side < 3 || Math.max(width, height) > Math.min(32, side * 1.23)) continue
    if (item.visibility === 'clipped' || item.visibility === 'invisible') continue
    const candidate = squares.find(
      ({ region: { bbox: box, pageIndex } }) =>
        pageIndex === item.region.pageIndex &&
        Math.abs(x + width / 2 - box.x - box.width / 2) <= 1 &&
        Math.abs(y + height / 2 - box.y - box.height / 2) <= 1 &&
        Math.abs(width - box.width) <= 2.1 &&
        Math.abs(height - box.height) <= 2.1,
    )
    if (!candidate) {
      squares.push({
        region: item.region,
        nativeState: 'ambiguous',
        paint: [item],
        needsVisibilityCheck: true,
      })
      continue
    }
    candidate.paint.push(item)
    if (width * height < candidate.region.bbox.width * candidate.region.bbox.height) {
      candidate.region = item.region
    }
  }
  for (const square of squares) {
    const fill = square.paint.findLast(({ fillOpacity }) => (fillOpacity ?? 0) > 0)
    if (fill?.visibility !== 'unresolved' && (fill?.fillOpacity ?? 0) >= 0.85) {
      const shade = tone(fill?.fill)
      square.nativeState = shade === 'dark' ? 'filled' : shade === 'light' ? 'empty' : 'ambiguous'
    } else if (
      !fill &&
      square.paint.some(
        (item) =>
          item.visibility === 'paint-command' &&
          (item.strokeOpacity ?? 0) >= 0.85 &&
          tone(item.stroke) === 'dark',
      )
    ) {
      square.nativeState = 'empty'
    }
  }
  return squares
}

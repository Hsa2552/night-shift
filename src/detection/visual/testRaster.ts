import type { RasterData, TextItem } from '../../shared/types'

export function syntheticRaster(width: number, height: number, scale = 1) {
  const raster: RasterData = {
    width: width * scale,
    height: height * scale,
    rgba: new Uint8ClampedArray(width * height * scale ** 2 * 4).fill(255),
  }
  function fill(x: number, y: number, w: number, h: number, rgb: number[] = [0, 0, 0]) {
    for (let row = y * scale; row < (y + h) * scale; row += 1) {
      for (let col = x * scale; col < (x + w) * scale; col += 1) {
        raster.rgba.set(rgb, (row * raster.width + col) * 4)
      }
    }
  }
  function text(value: string, x: number, y: number, rgb?: number[]): TextItem {
    for (let i = 0; i < value.length; i += 1) {
      if (value[i] !== ' ') fill(x + i * 5, y + 2, 3, 6, rgb)
    }
    return { text: value, bbox: { x, y, width: value.length * 5, height: 10 } }
  }
  return { raster, fill, text }
}

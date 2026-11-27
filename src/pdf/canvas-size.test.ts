import { describe, expect, it } from 'vitest'
import { fitCanvas, MAX_DISPLAY_PIXELS, MAX_RASTER_PIXELS } from './canvas-size'

describe('PDF canvas sizing', () => {
  it('keeps the requested density for normal pages', () => {
    expect(fitCanvas(319.5, 159.75, 2, MAX_DISPLAY_PIXELS)).toEqual({ width: 639, height: 320 })
  })

  it('limits the longest axis of a wide or tall page', () => {
    expect(fitCanvas(20_000, 1000, 2, MAX_DISPLAY_PIXELS)).toEqual({ width: 4096, height: 205 })
    expect(fitCanvas(1000, 20_000, 2, MAX_DISPLAY_PIXELS)).toEqual({ width: 205, height: 4096 })
  })

  it('limits the analysis raster without changing its aspect ratio', () => {
    expect(fitCanvas(10_000, 10_000, 1, MAX_RASTER_PIXELS)).toEqual({ width: 2048, height: 2048 })
  })

  it('stays in budget when rounding a fractional canvas size', () => {
    const { width, height } = fitCanvas(4000, 3000, 2, MAX_DISPLAY_PIXELS)
    expect(width * height).toBeLessThanOrEqual(MAX_DISPLAY_PIXELS)
    expect(width / height).toBeCloseTo(4 / 3, 3)
  })
})

import type { PageData, RasterData } from '../../shared/types'
import { chromaMap, chromaticComponents, hueGroups, neutralInk } from './chroma'
import { bodyHeight, pageRegion, pixelBox, rasterScale } from './raster'
import type { PixelBox } from './raster'
import type { ChromaticInkObservation, PageInkObservation, TextInkObservation } from './types'

type RasterScale = NonNullable<ReturnType<typeof rasterScale>>

export function overlap(a: PixelBox, b: PixelBox) {
  return {
    x: Math.min(a.right, b.right) - Math.max(a.left, b.left),
    y: Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top),
  }
}

export function belongsToColor(a: PixelBox, b: PixelBox) {
  const intersection = overlap(a, b)
  return (
    intersection.x >= Math.min(5, (b.right - b.left) * 0.4) &&
    intersection.y >= Math.max(1, Math.min(a.bottom - a.top, b.bottom - b.top) * 0.32)
  )
}

function sampleText(
  page: PageData,
  raster: RasterData,
  scale: RasterScale,
  labels: Uint8Array,
  hues: number[],
) {
  const samples = []
  for (const [textIndex, item] of page.textItems.entries()) {
    if (!item.text.trim()) continue
    if (!Object.values(item.bbox).every(Number.isFinite)) continue
    const bounds = pixelBox(item.bbox, raster, scale)
    if (bounds.right <= bounds.left || bounds.bottom <= bounds.top) continue
    const counts = new Uint32Array(hues.length + 1)
    let neutralPixels = 0
    for (let y = bounds.top; y < bounds.bottom; y += 1) {
      for (let x = bounds.left; x < bounds.right; x += 1) {
        const group = labels[y * raster.width + x]
        if (group === neutralInk) neutralPixels += 1
        else if (group) counts[group] += 1
      }
    }
    const colors = hues.flatMap((hue, index) =>
      counts[index + 1] ? [{ hue, pixels: counts[index + 1] }] : [],
    )
    const ink: TextInkObservation = {
      textIndex,
      region: pageRegion(page.pageIndex, bounds, raster, scale),
      colors,
      neutralPixels,
    }
    samples.push({ bounds, ink })
  }
  return samples
}

export function collectPageInk(page: PageData, raster: RasterData) {
  const scale = rasterScale(page, raster)
  if (!scale) return null
  const body = bodyHeight(page)
  const line = Math.max(2, Math.min(65, body * scale.y))
  const { pixels, histogram } = chromaMap(raster)
  const { hues, groups } = hueGroups(histogram, Math.max(12, Math.round(line * line * 0.16)))
  for (let index = 0; index < pixels.length; index += 1) {
    if (pixels[index] !== neutralInk) pixels[index] = groups[pixels[index]]
  }
  const text = sampleText(page, raster, scale, pixels, hues)
  const minInk = Math.max(6, Math.round(line * line * 0.065))
  const byHue = hues.map((hue, index) => {
    const components = chromaticComponents(
      pixels,
      raster.width,
      raster.height,
      index + 1,
      Math.max(4, Math.min(38, Math.round(body * scale.x * 1.8))),
      Math.max(1, Math.min(5, Math.round(line * 0.28))),
    )
    const sameHue = text.filter(({ ink }) =>
      ink.colors.some((color) => color.hue === hue && color.pixels >= 3),
    )
    const regions = components
      .filter(({ pixels }) => pixels >= minInk)
      .map((bounds) => {
        const ink: ChromaticInkObservation = {
          hue,
          pixels: bounds.pixels,
          region: pageRegion(page.pageIndex, bounds, raster, scale),
          textIndices: sameHue
            .filter((sample) => belongsToColor(bounds, sample.bounds))
            .map(({ ink }) => ink.textIndex),
        }
        return { bounds, ink }
      })
    return { hue, regions }
  })
  const ink: PageInkObservation = {
    text: text.map((sample) => sample.ink),
    regions: byHue.flatMap(({ regions }) => regions.map((sample) => sample.ink)),
  }
  return { scale, body, line, text, byHue, ink }
}

export function observePageInk(page: PageData, raster: RasterData): PageInkObservation | null {
  return collectPageInk(page, raster)?.ink ?? null
}

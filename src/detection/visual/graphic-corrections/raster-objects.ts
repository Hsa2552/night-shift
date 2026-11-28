import type { PageData, RasterData } from '../../../shared/types'
import { buildPageInk } from '../../graphics.ts'
import { chromaticComponents } from '../chroma.ts'
import { pageRegion, pixelBox, rasterScale } from '../raster.ts'
import type { NativeRgb } from '../vector/text-colors.ts'
import type { GraphicObject, MixedFigure } from './index.ts'
import type { Separator } from './closed-rules.ts'

function foreground(ink: ReturnType<typeof buildPageInk>, pixel: number) {
  const at = 4 * pixel
  const { rgba } = ink.raster
  if (rgba[at + 3] < 128) return false
  const r = rgba[at],
    g = rgba[at + 1],
    b = rgba[at + 2]
  return (
    0.299 * r + 0.587 * g + 0.114 * b < ink.inkBelow || Math.max(r, g, b) - Math.min(r, g, b) >= 42
  )
}

export function matchesPaint(rgb: NativeRgb | undefined, expected: NativeRgb) {
  return rgb && rgb.every((channel, i) => Math.abs(channel - expected[i]) <= 12)
}

function antialiasedPaint(r: number, g: number, b: number, color: NativeRgb) {
  if (
    Math.max(r, g, b) - Math.min(r, g, b) <
    Math.max(8, 0.45 * (Math.max(...color) - Math.min(...color)))
  )
    return false
  const dr = 255 - color[0],
    dg = 255 - color[1],
    db = 255 - color[2]
  const rr = 255 - r,
    rg = 255 - g,
    rb = 255 - b
  const square = dr * dr + dg * dg + db * db
  if (square < 100) return false
  const strength = (rr * dr + rg * dg + rb * db) / square
  return (
    strength >= 0.18 &&
    strength <= 1.12 &&
    Math.max(
      Math.abs(rr - strength * dr),
      Math.abs(rg - strength * dg),
      Math.abs(rb - strength * db),
    ) <= 10
  )
}

export function observeRasterGraphics(
  page: PageData,
  raster: RasterData,
  em: number,
  mixed: readonly MixedFigure[],
) {
  const scale = rasterScale(page, raster)
  if (!scale) return undefined
  const ink = buildPageInk(raster, page)
  const pixels = new Uint8Array(raster.width * raster.height)
  const objects: GraphicObject[] = []
  for (let i = 0; i < pixels.length; i++) if (!ink.text[i] && foreground(ink, i)) pixels[i] = 1
  for (const component of chromaticComponents(pixels, raster.width, raster.height, 1, 1, 1)) {
    const region = pageRegion(page.pageIndex, component, raster, scale)
    if (
      component.pixels < Math.max(4, 0.1 * em * em * scale.x * scale.y) ||
      Math.max(region.bbox.width, region.bbox.height) < 0.65 * em
    )
      continue
    objects.push({ region, kind: 'path', visibility: 'raster-ink', sources: ['raster'] })
  }

  // A mixed figure permits extraction of the specific declared correction paint only.
  // Work in its local window and keep the exact observed component extents.
  for (const figure of mixed) {
    if (figure.region.pageIndex !== page.pageIndex) continue
    const paint = figure.correctionRgb
    if (Math.max(...paint) - Math.min(...paint) < 14) continue
    const window = pixelBox(figure.region.bbox, raster, scale)
    const w = window.right - window.left
    const h = window.bottom - window.top
    if (w <= 0 || h <= 0) continue
    const colored = new Uint8Array(w * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const at = 4 * ((y + window.top) * raster.width + window.left + x)
        const { rgba } = raster
        if (rgba[at + 3] >= 128 && antialiasedPaint(rgba[at], rgba[at + 1], rgba[at + 2], paint))
          colored[y * w + x] = 1
      }
    }
    const parts = exactRuns(colored, w, h)
    if (parts.length > 256) continue
    for (const c of parts) {
      const box = {
        left: c.left + window.left,
        right: c.right + window.left,
        top: c.top + window.top,
        bottom: c.bottom + window.top,
      }
      const region = pageRegion(page.pageIndex, box, raster, scale)
      objects.push({
        region,
        kind: 'path',
        visibility: 'raster-ink',
        sources: ['raster'],
        rgb: paint,
        paintVerified: true,
        paintScopeId: figure.blockId,
      })
    }
  }
  return { objects, separators: longTraces(raster, scale, em, ink.inkBelow) }
}

// Combine vertically identical runs. A diagonal stroke does not claim its entire envelope.
function exactRuns(pixels: Uint8Array, width: number, height: number) {
  type Run = { left: number; right: number; top: number; bottom: number }
  const out: Run[] = []
  let active = new Map<string, Run>()
  for (let y = 0; y < height; y++) {
    const next = new Map<string, Run>()
    for (let left = 0; left < width;) {
      if (!pixels[y * width + left]) {
        left++
        continue
      }
      let right = left + 1
      while (right < width && pixels[y * width + right]) right++
      const key = `${left}:${right}`
      const before = active.get(key)
      const run = before ?? { left, right, top: y, bottom: y + 1 }
      if (before) before.bottom = y + 1
      else out.push(run)
      next.set(key, run)
      left = right
    }
    active = next
    if (out.length > 256) return out
  }
  return out
}

// Maximal unbroken runs, with a minimum expressed in the local font height.
function longTraces(
  raster: RasterData,
  scale: { x: number; y: number },
  em: number,
  inkBelow: number,
) {
  const separators: Separator[] = []
  const limit = Math.min(242, inkBelow - 4)
  for (const orientation of ['h', 'v'] as const) {
    const horizontal = orientation === 'h'
    const along = horizontal ? raster.width : raster.height
    const across = horizontal ? raster.height : raster.width
    const minimum = Math.max(12, Math.round(5 * em * (horizontal ? scale.x : scale.y)))
    for (let i = 0; i < across; i++) {
      let start = -1
      for (let j = 0; j <= along; j++) {
        const at = 4 * (horizontal ? i * raster.width + j : j * raster.width + i)
        const on =
          j < along &&
          raster.rgba[at + 3] >= 128 &&
          0.299 * raster.rgba[at] + 0.587 * raster.rgba[at + 1] + 0.114 * raster.rgba[at + 2] <
            limit
        if (on && start < 0) start = j
        if (!on && start >= 0) {
          if (j - start >= minimum) {
            const box = horizontal
              ? ([start / scale.x, i / scale.y, j / scale.x, (i + 1) / scale.y] as const)
              : ([i / scale.x, start / scale.y, (i + 1) / scale.x, j / scale.y] as const)
            separators.push({ orientation, box })
          }
          start = -1
        }
      }
    }
  }
  return separators
}

export function rasterIncrement(page: PageData, raster?: RasterData) {
  const scale = raster && rasterScale(page, raster)
  return scale ? Math.max(1 / scale.x, 1 / scale.y) : 0
}

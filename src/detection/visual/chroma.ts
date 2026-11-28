import type { RasterData } from '../../shared/types'
import type { PixelBox } from './raster'

const bins = 36

export interface ChromaticComponent extends PixelBox {
  pixels: number
}

interface Run extends ChromaticComponent {
  parent?: Run
}

export function hueDistance(a: number, b: number): number {
  const distance = Math.abs(a - b) % 360
  return Math.min(distance, 360 - distance)
}

/** Returns one byte per pixel. Zero is achromatic, 1…36 identify ten-degree hue bins. */
export function chromaMap(raster: RasterData) {
  const pixels = new Uint8Array(raster.width * raster.height)
  const histogram = new Uint32Array(bins + 1)
  const { rgba } = raster
  for (let point = 0, offset = 0; point < pixels.length; point += 1, offset += 4) {
    if (rgba[offset + 3] < 100) continue
    const r = rgba[offset]
    const g = rgba[offset + 1]
    const b = rgba[offset + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const delta = max - min
    // Absolute chroma rejects very faint antialiasing noise. Relative chroma rejects tinted gray.
    if (delta < 34 || delta < max * 0.24 || min >= 216) continue
    const sector =
      max === r ? (g - b) / delta : max === g ? 2 + (b - r) / delta : 4 + (r - g) / delta
    const hue = (sector * 60 + 360) % 360
    const bin = Math.floor(hue / 10) + 1
    pixels[point] = bin
    histogram[bin] += 1
  }
  return { pixels, histogram }
}

export function hueGroups(histogram: Uint32Array, minInk: number) {
  const peaks = Array.from({ length: bins }, (_, index) => {
    const bin = index + 1
    const previous = ((index + bins - 1) % bins) + 1
    const next = ((index + 1) % bins) + 1
    return {
      hue: index * 10 + 5,
      count: histogram[previous] + histogram[bin] + histogram[next],
      center: histogram[bin],
    }
  }).sort((a, b) => b.count - a.count || b.center - a.center)

  const hues: number[] = []
  for (const peak of peaks) {
    if (peak.count < minInk || hues.length >= 6) break
    if (peak.center && hues.every((hue) => hueDistance(hue, peak.hue) > 38)) hues.push(peak.hue)
  }

  const groups = new Uint8Array(bins + 1)
  for (let bin = 1; bin <= bins; bin += 1) {
    let bestDistance = 24
    for (let group = 0; group < hues.length; group += 1) {
      const distance = hueDistance((bin - 1) * 10 + 5, hues[group])
      if (distance > bestDistance) continue
      bestDistance = distance
      groups[bin] = group + 1
    }
  }
  return { hues, groups }
}

function root(run: Run): Run {
  let head = run
  while (head.parent) head = head.parent
  while (run.parent && run.parent !== head) {
    const next = run.parent
    run.parent = head
    run = next
  }
  return head
}

function unite(current: Run, previous: Run) {
  const a = root(current)
  const b = root(previous)
  if (a === b) return
  a.parent = b
  b.left = Math.min(b.left, a.left)
  b.top = Math.min(b.top, a.top)
  b.right = Math.max(b.right, a.right)
  b.bottom = Math.max(b.bottom, a.bottom)
  b.pixels += a.pixels
}

export function chromaticComponents(
  pixels: Uint8Array,
  width: number,
  height: number,
  group: number,
  joinX: number,
  joinY: number,
) {
  const components: Run[] = []
  const recent: Array<{ left: number; right: number; y: number; run: Run }> = []
  const overlapTolerance = Math.max(1, Math.floor(joinX / 5))

  for (let y = 0; y < height; y += 1) {
    while (recent.length && y - recent[0].y > joinY) recent.shift()
    const line: typeof recent = []
    let left = -1
    let right = -1
    let count = 0
    for (let x = 0; x <= width; x += 1) {
      if (x < width && pixels[y * width + x] === group) {
        if (left < 0) left = x
        right = x + 1
        count += 1
      } else if (left >= 0 && (x === width || x - right >= joinX)) {
        const run = { left, right, top: y, bottom: y + 1, pixels: count }
        components.push(run)
        for (const previous of recent) {
          if (
            left <= previous.right + overlapTolerance &&
            right + overlapTolerance >= previous.left
          ) {
            unite(run, previous.run)
          }
        }
        line.push({ left, right, y, run })
        left = -1
        count = 0
      }
    }
    recent.push(...line)
  }

  return components.filter((run) => !run.parent)
}

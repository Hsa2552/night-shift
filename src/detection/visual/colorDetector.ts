import type { CorrectionBlock, PageData, RasterData } from '../../shared/types'
import { chromaMap, chromaticComponents, hueGroups } from './chroma'
import type { ChromaticComponent } from './chroma'
import { pageColorDeclarations } from './colorConvention'
import { bodyHeight, isDark, pageRegion, pixelBox, rasterScale } from './raster'
import type { PixelBox } from './raster'
import type { ColorCandidate, ColorPageDetector } from './types'

interface TextInk {
  bounds: PixelBox
  text: string
  group: number
  neutral: boolean
  body: boolean
}

interface ColorObservation {
  bounds: ChromaticComponent
  candidate: ColorCandidate
  line: boolean
  graphic: boolean
  marker: boolean
  question?: TextInk
}

const correctionLabel =
  /^(?:correction|corrig[ée]|solution|r[ée]ponse|answer)(?:\s+(?:de\s+l[’']?exercice|[n°\d]))?\s*(?:[:.–-]|$)/iu
const questionCue =
  /\?|^(?:question\s+\d+|exercice\s+\d+|\d+[.)]|[a-z]\)|calculer\b|d[ée]terminer\b|justifier\b|expliquer\b|montrer\b|quelle?s?\b)/iu

function overlap(a: PixelBox, b: PixelBox) {
  const x = Math.min(a.right, b.right) - Math.max(a.left, b.left)
  const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  return { x, y }
}

function readTextInk(
  page: PageData,
  raster: RasterData,
  scale: { x: number; y: number },
  labels: Uint8Array,
  count: number,
  body: number,
) {
  const items: TextInk[] = []
  for (const item of page.textItems) {
    const text = item.text.trim()
    if (!text) continue
    const bounds = pixelBox(item.bbox, raster, scale)
    const colors = new Uint32Array(count + 1)
    let dark = 0
    for (let y = bounds.top; y < bounds.bottom; y += 1) {
      for (let x = bounds.left; x < bounds.right; x += 1) {
        const index = y * raster.width + x
        const group = labels[index]
        if (group) colors[group] += 1
        else if (isDark(raster.rgba, index * 4)) dark += 1
      }
    }
    let group = 0
    for (let i = 1; i < colors.length; i += 1) {
      if (colors[i] > colors[group]) group = i
    }
    const colored = colors[group]
    if (colored < 3 || colored < dark * 0.6) group = 0
    if (!group && dark < 3 && !correctionLabel.test(text) && !questionCue.test(text)) continue
    items.push({
      bounds,
      text,
      group,
      neutral: !group && dark >= 3,
      body: item.bbox.height <= body * 1.35,
    })
  }
  return items
}

function belongsToColor(a: PixelBox, b: PixelBox) {
  const intersection = overlap(a, b)
  return (
    intersection.x >= Math.min(5, (b.right - b.left) * 0.4) &&
    intersection.y >= Math.max(1, Math.min(a.bottom - a.top, b.bottom - b.top) * 0.32)
  )
}

function aligned(a: PixelBox, b: PixelBox, line: number): boolean {
  return (
    overlap(a, b).x >= Math.min(12, (a.right - a.left) / 3) ||
    Math.abs(a.left - b.left) <= line * 2.8
  )
}

function preceding(
  items: TextInk[],
  bounds: PixelBox,
  line: number,
  accept: (item: TextInk) => boolean,
) {
  let nearest: TextInk | undefined
  for (const item of items) {
    const gap = bounds.top - item.bounds.bottom
    if (
      gap < -line * 0.35 ||
      gap > line * 5 ||
      !accept(item) ||
      !aligned(item.bounds, bounds, line)
    )
      continue
    if (!nearest || item.bounds.bottom > nearest.bounds.bottom) nearest = item
  }
  return nearest
}

function closeOnPage(a: PixelBox, b: PixelBox, line: number) {
  const gap = Math.max(a.top - b.bottom, b.top - a.bottom, 0)
  return gap <= line * 2.55 && aligned(a, b, line)
}

function between(a: PixelBox, b: PixelBox, line: number, neutral: TextInk[]) {
  const first = a.top <= b.top ? a : b
  const last = first === a ? b : a
  return neutral.some(
    ({ bounds }) =>
      bounds.top >= first.bottom - line * 0.2 &&
      bounds.bottom <= last.top + line * 0.2 &&
      aligned(bounds, first, line) &&
      aligned(bounds, last, line),
  )
}

function observe(
  components: ChromaticComponent[],
  items: TextInk[],
  page: PageData,
  raster: RasterData,
  scale: { x: number; y: number },
  hue: number,
  group: number,
  line: number,
  declared: boolean,
  legend: PixelBox[],
) {
  const own = items.filter((item) => item.group === group)
  const neutral = items.filter((item) => item.neutral)
  const observations: ColorObservation[] = []
  const minInk = Math.max(6, Math.round(line * line * 0.065))

  for (const bounds of components) {
    if (bounds.pixels < minInk || legend.some((box) => belongsToColor(bounds, box))) continue
    const matching = own.filter((item) => belongsToColor(bounds, item.bounds))
    const characters = matching.reduce((sum, item) => sum + (item.body ? item.text.length : 0), 0)
    const density = bounds.pixels / ((bounds.right - bounds.left) * (bounds.bottom - bounds.top))
    const solid =
      density > 0.55 &&
      (bounds.right - bounds.left) * (bounds.bottom - bounds.top) >
        raster.width * raster.height * 0.03
    const isLine = !solid && characters >= 8 && bounds.right - bounds.left >= line * 1.45
    const marker =
      !solid &&
      (matching.some((item) => correctionLabel.test(item.text)) ||
        Boolean(preceding(items, bounds, line * 0.64, (item) => correctionLabel.test(item.text))))
    const question = preceding(neutral, bounds, line, (item) => questionCue.test(item.text))
    const ink =
      matching.length === 0
        ? 'graphic'
        : isLine && bounds.bottom - bounds.top > line * 1.8
          ? 'mixed'
          : 'text'

    const graphic = !solid && matching.length === 0 && bounds.right - bounds.left >= line * 0.65
    observations.push({
      bounds,
      candidate: {
        region: pageRegion(page.pageIndex, bounds, raster, scale, 1),
        hue,
        ink,
        evidence:
          declared && !solid && (isLine || graphic || matching.some((item) => item.body))
            ? 'supported'
            : 'ambiguous',
      },
      line: isLine,
      graphic,
      marker,
      question,
    })
  }

  const lines = observations.filter((observation) => observation.line)
  const anchors = new Set(
    lines.flatMap((observation) => (observation.question ? [observation.question] : [])),
  )
  for (const observation of observations) {
    const hasNeighbor =
      observation.question &&
      lines.some(
        (other) =>
          observation !== other &&
          closeOnPage(observation.bounds, other.bounds, line) &&
          !between(observation.bounds, other.bounds, line, neutral),
      )
    if (
      observation.marker ||
      (observation.line && observation.question && (hasNeighbor || anchors.size >= 2))
    ) {
      observation.candidate.evidence = 'supported'
    }
  }

  const supportedLines = observations.filter(
    (observation) => observation.candidate.evidence === 'supported',
  )
  for (const observation of observations) {
    if (
      observation.candidate.evidence === 'supported' ||
      !(observation.line || observation.graphic)
    )
      continue
    if (
      supportedLines.some(
        (near) =>
          closeOnPage(near.bounds, observation.bounds, line) &&
          !between(near.bounds, observation.bounds, line, neutral),
      )
    ) {
      observation.candidate.evidence = 'supported'
    }
  }

  return { observations, neutral }
}

export const analyzeColorPage: ColorPageDetector = (page, raster, convention) => {
  const scale = rasterScale(page, raster)
  if (!scale) return { candidates: [], blocks: [], needsFallback: true }
  const { pixels, histogram } = chromaMap(raster)
  const body = bodyHeight(page)
  const line = Math.max(2, Math.min(65, body * scale.y))
  const { hues, groups } = hueGroups(histogram, Math.max(12, Math.round(line * line * 0.16)))
  if (!hues.length) return { candidates: [], blocks: [], needsFallback: false }
  for (let index = 0; index < pixels.length; index += 1) pixels[index] = groups[pixels[index]]

  const items = readTextInk(page, raster, scale, pixels, hues.length, body)
  const declarations = pageColorDeclarations(page)
  const localHues = new Set(declarations.map(({ hue }) => hue))
  const declaredHue = convention?.hue ?? (localHues.size === 1 ? [...localHues][0] : undefined)
  const legend = declarations.flatMap(({ items }) =>
    items.map((item) => pixelBox(item.bbox, raster, scale)),
  )
  const candidates: ColorCandidate[] = []
  const blocks: CorrectionBlock[] = []
  let needsFallback = false
  for (const [index, hue] of hues.entries()) {
    const difference = Math.abs(hue - (declaredHue ?? hue))
    const components = chromaticComponents(
      pixels,
      raster.width,
      raster.height,
      index + 1,
      Math.max(4, Math.min(38, Math.round(body * scale.x * 1.8))),
      Math.max(1, Math.min(5, Math.round(line * 0.28))),
    )
    const { observations, neutral } = observe(
      components,
      items,
      page,
      raster,
      scale,
      hue,
      index + 1,
      line,
      declaredHue !== undefined && Math.min(difference, 360 - difference) <= 27,
      legend,
    )
    const supported = observations.filter((item) => item.candidate.evidence === 'supported')
    candidates.push(...observations.map(({ candidate }) => candidate))

    const grouped: { last: PixelBox; regions: ColorCandidate['region'][] }[] = []
    for (const { bounds, candidate } of supported) {
      const group = grouped.findLast(
        (part) =>
          closeOnPage(part.last, bounds, line) && !between(part.last, bounds, line, neutral),
      )
      if (group) {
        group.last = bounds
        group.regions.push(candidate.region)
      } else grouped.push({ last: bounds, regions: [candidate.region] })
    }
    for (const { regions } of grouped)
      blocks.push({ id: `visual-color-${page.pageIndex}-${blocks.length}`, regions })

    const unresolved = observations.filter((item) => item.candidate.evidence === 'ambiguous')
    needsFallback ||= unresolved.some((item) => item.line && item.question !== undefined)
    needsFallback ||=
      neutral.length > 1 &&
      unresolved.some(
        (item, index) =>
          item.line &&
          unresolved
            .slice(index + 1)
            .some(
              (other) =>
                other.line &&
                closeOnPage(item.bounds, other.bounds, line) &&
                !between(item.bounds, other.bounds, line, neutral),
            ),
      )
    // Without text, a repeated compact chromatic structure is measurable, but its role is unknown.
    needsFallback ||=
      items.length === 0 &&
      unresolved.filter(
        ({ bounds }) =>
          bounds.right - bounds.left >= line * 2.5 && bounds.bottom - bounds.top <= line * 2.1,
      ).length >= 2
  }

  return { candidates, blocks, needsFallback }
}

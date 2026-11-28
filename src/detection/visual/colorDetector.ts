import type { CorrectionBlock, PageData, RasterData } from '../../shared/types'
import { hueDistance } from './chroma'
import { pageColorDeclarations } from './colorConvention'
import { belongsToColor, collectPageInk, overlap } from './inkObservation'
import { pageRegion, pixelBox } from './raster'
import type { PixelBox } from './raster'
import type { ColorCandidate, ColorPageDetector } from './types'

interface TextInk {
  index: number
  bounds: PixelBox
  text: string
  hue?: number
  neutral: boolean
  body: boolean
}

interface ColorObservation {
  bounds: PixelBox
  candidate: ColorCandidate
  line: boolean
  graphic: boolean
  marker: boolean
  heading: boolean
  question?: TextInk
}

const correctionLabel =
  /^(?:correction|corrig[ée]|solution|r[ée]ponse|answer)(?:\s+(?:de\s+l[’']?exercice|[n°\d]))?\s*(?:[:.–-]|$)/iu
const questionHeading = /^(?:(?:question|exercice)\s+\d+\b|\d+(?:\.\d+)*[.)]|[a-z]\))(?=\s|$)/iu
const questionCue = /\?|^(?:calculer|d[ée]terminer|justifier|expliquer|montrer|quelle?s?)\b/iu

type CollectedInk = NonNullable<ReturnType<typeof collectPageInk>>

function readTextInk(page: PageData, { body, text: samples }: CollectedInk) {
  const items: TextInk[] = []
  for (const { bounds, ink } of samples) {
    const item = page.textItems[ink.textIndex]
    const text = item.text.trim()
    const dominant = ink.colors.reduce<(typeof ink.colors)[number] | undefined>(
      (best, color) => (!best || color.pixels > best.pixels ? color : best),
      undefined,
    )
    const hue =
      dominant && dominant.pixels >= 3 && dominant.pixels >= ink.neutralPixels * 0.6
        ? dominant.hue
        : undefined
    if (hue === undefined && ink.neutralPixels < 3 && !correctionLabel.test(text)) continue
    items.push({
      index: ink.textIndex,
      bounds,
      text,
      hue,
      neutral: hue === undefined && ink.neutralPixels >= 3,
      body: item.bbox.height <= body * 1.35,
    })
  }
  return items
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

function classify(
  { hue, regions }: CollectedInk['byHue'][number],
  items: TextInk[],
  page: PageData,
  raster: RasterData,
  { scale, line }: CollectedInk,
  declared: boolean,
  legend: PixelBox[],
) {
  const own = new Map(items.filter((item) => item.hue === hue).map((item) => [item.index, item]))
  const neutral = items.filter((item) => item.neutral)
  const observations: ColorObservation[] = []

  for (const { bounds, ink: measured } of regions) {
    if (legend.some((box) => belongsToColor(bounds, box))) continue
    const matching = measured.textIndices.flatMap((index) => {
      const item = own.get(index)
      return item ? [item] : []
    })
    const characters = matching.reduce((sum, item) => sum + (item.body ? item.text.length : 0), 0)
    const density = measured.pixels / ((bounds.right - bounds.left) * (bounds.bottom - bounds.top))
    const solid =
      density > 0.55 &&
      (bounds.right - bounds.left) * (bounds.bottom - bounds.top) >
        raster.width * raster.height * 0.03
    const isLine = !solid && characters >= 8 && bounds.right - bounds.left >= line * 1.45
    const marker =
      !solid &&
      (matching.some((item) => correctionLabel.test(item.text)) ||
        Boolean(preceding(items, bounds, line * 0.64, (item) => correctionLabel.test(item.text))))
    const question = preceding(
      neutral,
      bounds,
      line,
      ({ text }) => questionHeading.test(text) || questionCue.test(text),
    )
    const heading = matching.some(
      ({ bounds: textBounds, text }) =>
        textBounds.left <= bounds.left + line * 1.25 && questionHeading.test(text),
    )
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
      heading,
      question,
    })
  }

  const lines = observations.filter((observation) => observation.line)
  // An implicit color convention is unsafe when the same ink labels multiple questions.
  const questionHue = lines.filter(({ heading }) => heading).length >= 2
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
      (!questionHue &&
        !observation.heading &&
        observation.line &&
        observation.question &&
        (hasNeighbor || anchors.size >= 2))
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
      (!declared && observation.heading) ||
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
  const collected = collectPageInk(page, raster)
  if (!collected) return { candidates: [], blocks: [], needsFallback: true, ink: null }
  const { scale, line, ink, byHue } = collected
  if (!byHue.length) return { candidates: [], blocks: [], needsFallback: false, ink }
  const items = readTextInk(page, collected)
  const declarations = pageColorDeclarations(page)
  const localHues = new Set(declarations.map(({ hue }) => hue))
  const declaredHue = convention?.hue ?? (localHues.size === 1 ? [...localHues][0] : undefined)
  const legend = declarations.flatMap(({ items }) =>
    items.map((item) => pixelBox(item.bbox, raster, scale)),
  )
  const candidates: ColorCandidate[] = []
  const blocks: CorrectionBlock[] = []
  let needsFallback = false
  for (const group of byHue) {
    const { observations, neutral } = classify(
      group,
      items,
      page,
      raster,
      collected,
      declaredHue !== undefined && hueDistance(group.hue, declaredHue) <= 27,
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

  return { candidates, blocks, needsFallback, ink }
}

import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import worker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { detectCorrections } from '../../src/detection/index.ts'
import { layoutPage } from '../../src/detection/layout.ts'
import { readPageText } from '../../src/pdf/read-text'
import { observeNativePage } from '../../src/detection/visual/vector/native-page'
import {
  detectGraphicCorrections,
  type GraphicAnchor,
  type GraphicPageInput,
} from '../../src/detection/visual/graphic-corrections'
import { reconstructAdaptiveLayout } from '../../src/detection/visual/graphic-corrections/adaptive-layout'
import { area, overlap } from '../../src/detection/visual/graphic-corrections/geometry'
import type {
  CorrectionBlock,
  PageData,
  RasterData,
  Rect,
  VectorPageObservation,
} from '../../src/shared/types'
import type { NativeRgb } from '../../src/detection/visual/vector/text-colors'

GlobalWorkerOptions.workerSrc = worker
type Box = [number, number, number, number]
interface PageSpec {
  pageIndex: number
  anchors?: (Omit<GraphicAnchor, 'region' | 'scope'> & { region: Box; scope?: Box })[]
  protected?: Box[]
  mixed?: { region: Box; blockId: string; correctionRgb: NativeRgb }[]
  targets: {
    kind: 'figure' | 'table' | 'fill'
    role: 'correction' | 'statement'
    box: Box
    blockId?: string
    rgb?: NativeRgb
  }[]
}
interface Spec {
  label: string
  pages: PageSpec[]
  renderScale?: number
}
const box = ([x, y, width, height]: Box): Rect => ({ x, y, width, height })
const asset = (name: string) =>
  new URL('/node_modules/pdfjs-dist/' + name + '/', location.href).href

function score(
  page: PageData,
  raster: RasterData,
  items: PageSpec['targets'],
  blocks: CorrectionBlock[],
) {
  const records = []
  const sx = raster.width / page.width,
    sy = raster.height / page.height
  const { rgba } = raster
  const masks = blocks.flatMap((block) =>
    block.regions
      .filter((r) => r.pageIndex === page.pageIndex)
      .map(({ bbox }) => ({ bbox, id: block.id })),
  )
  for (const item of items) {
    const [x, y, w, h] = item.box
    let ink = 0,
      masked = 0,
      associated = 0
    for (
      let py = Math.max(0, Math.floor(y * sy));
      py < Math.min(raster.height, Math.ceil((y + h) * sy));
      py++
    ) {
      for (
        let px = Math.max(0, Math.floor(x * sx));
        px < Math.min(raster.width, Math.ceil((x + w) * sx));
        px++
      ) {
        const cx = (px + 0.5) / sx,
          cy = (py + 0.5) / sy
        if (cx < x || cx >= x + w || cy < y || cy >= y + h) continue
        const at = (py * raster.width + px) * 4
        const r = rgba[at],
          g = rgba[at + 1],
          b = rgba[at + 2]
        const color = item.rgb
        const active = color
          ? [r, g, b].every((v, n) => Math.abs(v - color[n]) <= 18)
          : Math.min(r, g, b) < 232
        if (!active || rgba[at + 3] < 128) continue
        ink++
        let covered = false,
          assigned = false
        for (const { bbox, id } of masks) {
          if (cx < bbox.x || cx >= bbox.x + bbox.width || cy < bbox.y || cy >= bbox.y + bbox.height)
            continue
          covered = true
          if (id === item.blockId) assigned = true
        }
        masked += Number(covered)
        associated += Number(assigned)
      }
    }
    records.push({
      role: item.role,
      kind: item.kind,
      ink,
      masked,
      associated,
      strict: ink > 0 && masked === (item.role === 'correction' ? ink : 0),
    })
  }
  return records
}

function perception(
  result: ReturnType<typeof detectGraphicCorrections>,
  targets: PageSpec['targets'],
) {
  const pairs = targets
    .flatMap((target, i) =>
      result.candidates.flatMap((candidate, j) => {
        const a = box(target.box),
          b = candidate.region.bbox
        const intersection = overlap(a, b)
        const iou = intersection / (area(a) + area(b) - intersection)
        return iou >= 0.5 ? [{ i, j, iou }] : []
      }),
    )
    .sort((a, b) => b.iou - a.iou)
  const ref = new Set<number>(),
    picked = new Set<number>()
  const matches = []
  for (const { i, j, iou } of pairs) {
    if (ref.has(i) || picked.has(j)) continue
    ref.add(i)
    picked.add(j)
    matches.push(iou)
  }
  return {
    targets: targets.length,
    matched: ref.size,
    candidatesOnPage: result.candidates.length,
    iou: matches,
  }
}

export async function evaluate(bytes: Uint8Array<ArrayBuffer>, spec: Spec) {
  const task = getDocument({
    data: bytes,
    cMapUrl: asset('cmaps'),
    cMapPacked: true,
    standardFontDataUrl: asset('standard_fonts'),
    wasmUrl: asset('wasm'),
    iccUrl: asset('iccs'),
  })
  try {
    const document = await task.promise
    const pages: PageData[] = []
    const cache = new Map<number, RasterData>()
    const vectorCache = new Map<number, VectorPageObservation>()
    for (let i = 0; i < document.numPages; i++) {
      const page = await document.getPage(i + 1)
      const viewport = page.getViewport({ scale: 1 })
      pages.push({
        pageIndex: i,
        width: viewport.width,
        height: viewport.height,
        textItems: await readPageText(page, viewport.transform, document.isPureXfa),
      })
    }
    const getRaster = async (i: number) => {
      const previous = cache.get(i)
      if (previous) return previous
      const page = await document.getPage(i + 1)
      const { width, height } = pages[i]
      const scale = Math.min(spec.renderScale ?? 1.5, Math.sqrt(5_000_000 / (width * height)))
      const viewport = page.getViewport({ scale })
      const canvas = globalThis.document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      await page.render({ canvas, canvasContext: ctx, viewport }).promise
      const raster = {
        width: canvas.width,
        height: canvas.height,
        rgba: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
      }
      canvas.width = canvas.height = 0
      cache.set(i, raster)
      return raster
    }
    const getVectors = async (i: number) => {
      const previous = vectorCache.get(i)
      if (previous) return previous
      const observation = await observeNativePage(await document.getPage(i + 1), pages[i].textItems)
      vectorCache.set(i, observation)
      return observation
    }
    const historic = await detectCorrections({ pages, getRaster, getVectors })
    const historicBlocks =
      historic.needsFallback || historic.kind === 'unknown' ? [] : historic.blocks
    const results = []
    for (const p of spec.pages) {
      const page = pages[p.pageIndex]
      const raster = await getRaster(p.pageIndex)
      const vectors = await getVectors(p.pageIndex)
      const region = (b: Box) => ({ pageIndex: p.pageIndex, bbox: box(b) })
      const anchors =
        p.anchors?.map((a) => ({
          ...a,
          region: region(a.region),
          scope: a.scope ? region(a.scope) : undefined,
        })) ?? []
      const input: GraphicPageInput = {
        page,
        raster,
        vectors,
        anchors,
        protectedRegions: p.protected?.map(region),
        mixedFigures: p.mixed?.map((m) => ({ ...m, region: region(m.region) })),
      }
      const known = [
        ['native', { ...input, modality: 'native' }],
        ['raster', { ...input, modality: 'raster' }],
        ['context', { ...input, mixedFigures: [], protectedRegions: [] }],
        ['hybrid', input],
        ['perception-only', { ...input, anchors: [], mixedFigures: [] }],
        [
          'historical-blocks-only',
          { ...input, anchors: [], mixedFigures: [], existingBlocks: historicBlocks },
        ],
      ] as const
      const methods = []
      for (const [name, options] of known) {
        const start = performance.now()
        const result = detectGraphicCorrections(options)
        const ms = performance.now() - start
        const blocks =
          name === 'historical-blocks-only'
            ? historicBlocks.map((b) => ({
                ...b,
                regions: [
                  ...b.regions,
                  ...(result.additions.find((a) => a.blockId === b.id)?.regions ?? []),
                ],
              }))
            : result.newBlocks
        methods.push({
          name,
          ms,
          blocks: blocks.length,
          masks: blocks.reduce((a, b) => a + b.regions.length, 0),
          ambiguity: result.unresolved.length,
          contradictions: result.unresolved.filter((x) => x.contradictions.length).length,
          perception: perception(result, p.targets),
          results: score(page, raster, p.targets, blocks),
        })
      }
      const adaptive = reconstructAdaptiveLayout(page)
      results.push({
        pageIndex: p.pageIndex,
        historic: score(page, raster, p.targets, historicBlocks),
        methods,
        geometry: {
          baseline: layoutPage(page).lines.length,
          local: adaptive.lines.length,
          xyBlocks: adaptive.xyBlocks.length,
          activation: adaptive.activation,
        },
      })
    }
    return {
      label: spec.label,
      historicFallback: historic.needsFallback,
      historicKind: historic.kind,
      pages: results,
    }
  } finally {
    await task.destroy()
  }
}

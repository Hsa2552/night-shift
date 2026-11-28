import { GlobalWorkerOptions, getDocument, Util } from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { layoutPage } from '../../src/detection/layout.ts'
import { mapTextItem } from '../../src/pdf/text-geometry'
import { observeNativePage } from '../../src/detection/visual/vector/native-page'
import type { PageData, Rect } from '../../src/shared/types'

GlobalWorkerOptions.workerSrc = workerUrl

const xyxy = ({ x, y, width, height }: Rect) => [x, y, x + width, y + height]
const rect = ([x, y, right, bottom]: number[]): Rect => ({
  x,
  y,
  width: right - x,
  height: bottom - y,
})
const asset = (name: string) =>
  new URL('/node_modules/pdfjs-dist/' + name + '/', location.href).href

function baseline(page: PageData) {
  const start = performance.now()
  const result = layoutPage(page)
  const ms = performance.now() - start
  return {
    ms,
    columns: result.columns,
    lines: result.lines.map(({ bbox, area }) => ({ box: xyxy(bbox), area: area.id })),
  }
}

interface FixtureFragment {
  box: number[]
  chars: number
  axis: number[]
  font?: string
  baseline?: number[]
}
interface FixturePage {
  key: string
  width: number
  height: number
  fragments: FixtureFragment[]
}

export function simulate(pages: FixturePage[]) {
  return {
    synthetic: true,
    pages: pages.map((page, pageIndex) => ({
      ...page,
      baseline: baseline({
        ...page,
        pageIndex,
        textItems: page.fragments.map(({ box, chars, font }) => ({
          bbox: rect(box),
          text: 'x'.repeat(chars),
          fontName: font,
        })),
      }),
    })),
  }
}

function countTree(node: { role?: string; type?: string; children?: unknown[] } | null): number {
  if (!node) return 0
  return (
    1 +
    (node.children ?? []).reduce<number>(
      (count, child) => count + countTree(child as Parameters<typeof countTree>[0]),
      0,
    )
  )
}

export async function extract(bytes: Uint8Array<ArrayBuffer>) {
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
    const pages = []
    const outline = await document.getOutline().catch(() => null)
    const form = await document.getFieldObjects().catch(() => null)
    const layers = await document
      .getOptionalContentConfig()
      .then((config) => config.getOrder())
      .catch(() => null)
    for (let pageIndex = 0; pageIndex < document.numPages; pageIndex++) {
      const page = await document.getPage(pageIndex + 1)
      const viewport = page.getViewport({ scale: 1 })
      const content = await page.getTextContent({ includeMarkedContent: true })
      const items = content.items.filter(
        (item) => 'str' in item && item.str.trim() && item.width >= 0,
      )
      const textItems = items.map((item) =>
        mapTextItem(item, content.styles[item.fontName], viewport.transform),
      )
      const fragments = items.map((item, index) => {
        const [a, b, c, d, x, y] = Util.transform(viewport.transform, item.transform)
        return {
          box: xyxy(textItems[index].bbox),
          chars: [...item.str.replace(/\s/gu, '')].length,
          axis: content.styles[item.fontName]?.vertical ? [-c, -d] : [a, b],
          baseline: [x, y],
          font: item.fontName,
        }
      })
      const built = baseline({
        pageIndex,
        width: viewport.width,
        height: viewport.height,
        textItems,
      })
      const native = await observeNativePage(page, textItems)
      const graphics = native.graphics
      const objects = [
        ...(graphics?.images ?? [])
          .filter((image) => image.kind === 'image' && image.visibility === 'paint-command')
          .map((image) => ({ box: xyxy(image.region.bbox), kind: 'image' })),
        ...(graphics?.paths ?? [])
          .filter(
            (path) =>
              path.outline === 'rectangles' &&
              path.visibility === 'paint-command' &&
              path.stroke &&
              path.region.bbox.width >= 24 &&
              path.region.bbox.height >= 24,
          )
          .map((path) => ({ box: xyxy(path.region.bbox), kind: 'frame' })),
        ...(graphics?.rules ?? [])
          .filter((rule) => rule.visibility === 'paint-command')
          .map((rule) => ({
            box: xyxy(rule.region.bbox),
            kind: 'rule',
            orientation: rule.orientation,
          })),
        ...(native.glyphSymbols ?? [])
          .filter((glyph) => glyph.visibility === 'paint-command')
          .map((glyph) => ({ box: xyxy(glyph.region.bbox), kind: 'symbol' })),
      ]
      const marked = content.items.filter(
        (item) => 'type' in item && item.type === 'beginMarkedContentProps',
      )
      const tree = await page.getStructTree().catch(() => null)
      pages.push({
        key: String(pageIndex + 1),
        width: viewport.width,
        height: viewport.height,
        fragments,
        objects,
        baseline: built,
        marked: marked.length,
        markedIds: marked.filter((item) => 'id' in item && typeof item.id === 'string').length,
        structureNodes: countTree(tree),
      })
      page.cleanup()
    }
    return {
      pages,
      outline: outline?.length ?? 0,
      fields: Object.keys(form ?? {}).length,
      layers: layers?.length ?? 0,
    }
  } finally {
    await task.destroy()
  }
}

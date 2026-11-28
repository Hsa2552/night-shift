// Reconstruction de la mise en page à partir des fragments de texte :
// lignes, segments séparés par de grands espaces, colonnes, bandes horizontales
// et ordre de lecture. Aucune interprétation sémantique ici.

import type { PageData, Rect, TextItem } from './contract.ts'
import { isPageFurniture } from './markers.ts'

/** Zone rectangulaire d'une page dans laquelle le texte se lit de haut en bas. */
export interface Area {
  id: string
  pageIndex: number
  x0: number
  x1: number
  y0: number
  y1: number
}

export interface Line {
  pageIndex: number
  text: string
  bbox: Rect
  fontSize: number
  fontNames: string[]
  /** Abscisse (repère canonique) de chaque unité UTF-16 de `text`. */
  charX: number[]
  area: Area
}

export interface PageLayout {
  pageIndex: number
  width: number
  height: number
  /** Lignes dans l'ordre de lecture. */
  lines: Line[]
  /** Faux si la page ne contient aucun texte extractible. */
  hasText: boolean
  columns: 1 | 2
}

const top = (r: Rect) => r.y
const bottom = (r: Rect) => r.y + r.height
const right = (r: Rect) => r.x + r.width

function itemHeight(item: TextItem): number {
  if (item.bbox.height > 0) return item.bbox.height
  return item.fontSize && item.fontSize > 0 ? item.fontSize : 10
}

interface Row {
  top: number
  bottom: number
  items: TextItem[]
}

/** Regroupe les fragments qui se chevauchent verticalement en rangées. */
function groupRows(items: TextItem[]): Row[] {
  const sorted = [...items].sort((a, b) => top(a.bbox) - top(b.bbox) || a.bbox.x - b.bbox.x)
  const rows: Row[] = []
  for (const item of sorted) {
    const h = itemHeight(item)
    const t = item.bbox.y
    const b = t + h
    let target: Row | undefined
    for (let i = rows.length - 1; i >= Math.max(0, rows.length - 3); i--) {
      const row = rows[i]!
      const overlap = Math.min(b, row.bottom) - Math.max(t, row.top)
      if (overlap >= 0.5 * Math.min(h, row.bottom - row.top)) {
        target = row
        break
      }
    }
    if (target) {
      target.items.push(item)
      target.top = Math.min(target.top, t)
      target.bottom = Math.max(target.bottom, b)
    } else {
      rows.push({ top: t, bottom: b, items: [item] })
    }
  }
  return rows
}

type Segment = Omit<Line, 'area'>

/** Découpe une rangée en segments séparés par de grands espaces horizontaux. */
function rowToSegments(row: Row, pageIndex: number, pageWidth: number): Segment[] {
  const items = [...row.items].sort((a, b) => a.bbox.x - b.bbox.x)
  const rowHeight = row.bottom - row.top
  const splitGap = Math.max(3 * rowHeight, 0.05 * pageWidth)
  const groups: TextItem[][] = []
  let current: TextItem[] = []
  let lastRight = -Infinity
  for (const item of items) {
    if (current.length > 0 && item.bbox.x - lastRight > splitGap) {
      groups.push(current)
      current = []
    }
    current.push(item)
    lastRight = Math.max(lastRight, right(item.bbox))
  }
  if (current.length > 0) groups.push(current)
  return groups.map((group) => buildSegment(group, pageIndex))
}

function buildSegment(items: TextItem[], pageIndex: number): Segment {
  let text = ''
  const charX: number[] = []
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const fontNames = new Set<string>()
  let fontSizeSum = 0
  let prev: TextItem | undefined
  for (const item of items) {
    const h = itemHeight(item)
    if (prev) {
      const gap = item.bbox.x - right(prev.bbox)
      if (gap > 0.1 * h && !text.endsWith(' ') && !item.text.startsWith(' ')) {
        text += ' '
        charX.push(right(prev.bbox))
      }
    }
    const n = item.text.length
    for (let i = 0; i < n; i++) charX.push(item.bbox.x + (item.bbox.width * i) / Math.max(1, n))
    text += item.text
    x0 = Math.min(x0, item.bbox.x)
    y0 = Math.min(y0, item.bbox.y)
    x1 = Math.max(x1, right(item.bbox))
    y1 = Math.max(y1, item.bbox.y + h)
    if (item.fontName) fontNames.add(item.fontName)
    fontSizeSum += item.fontSize && item.fontSize > 0 ? item.fontSize : h
    prev = item
  }
  // Accents détachés (PDF produits par LaTeX avec d'anciennes polices : « Corrig´e »,
  // « Contrˆole ») : retirés quand ils touchent une lettre, pour que les mots se lisent.
  const clean = stripDetachedAccents(text, charX)
  // Supprime les espaces de début et de fin en gardant l'alignement des abscisses.
  const lead = clean.text.length - clean.text.trimStart().length
  const trimmed = clean.text.trim()
  return {
    pageIndex,
    text: trimmed,
    charX: clean.charX.slice(lead, lead + trimmed.length),
    bbox: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
    fontSize: fontSizeSum / items.length,
    fontNames: [...fontNames],
  }
}

/** Cherche une gouttière verticale séparant deux colonnes. Renvoie son abscisse ou null. */
function findGutter(segments: Segment[], width: number): number | null {
  if (segments.length < 5) return null
  const narrow = segments.filter((s) => s.bbox.width < 0.6 * width)
  const from = Math.floor(0.2 * width)
  const to = Math.ceil(0.8 * width)
  const allowed = Math.floor(0.1 * narrow.length)
  const minRun = Math.max(8, 0.02 * width)
  let best: { start: number; end: number } | null = null
  let runStart: number | null = null
  for (let x = from; x <= to + 1; x++) {
    const covered =
      x > to ? Infinity : narrow.filter((s) => s.bbox.x < x + 1 && right(s.bbox) > x).length
    if (covered <= allowed) {
      if (runStart === null) runStart = x
    } else if (runStart !== null) {
      if (x - runStart >= minRun && (!best || x - runStart > best.end - best.start)) {
        best = { start: runStart, end: x }
      }
      runStart = null
    }
  }
  if (!best) return null
  const gutter = (best.start + best.end) / 2
  const left = segments.filter((s) => right(s.bbox) <= gutter)
  const rightSide = segments.filter((s) => s.bbox.x >= gutter)
  const straddle = segments.length - left.length - rightSide.length
  if (left.length < 2 || rightSide.length < 2 || straddle > 0.4 * segments.length) return null
  return gutter
}

/** Construit la mise en page d'une page : lignes dans l'ordre de lecture et zones. */
export function layoutPage(page: PageData): PageLayout {
  const { pageIndex, width, height } = page
  const items = page.textItems.filter((item) => item.text.trim() !== '' && item.bbox.width >= 0)
  let segments = groupRows(items).flatMap((row) => rowToSegments(row, pageIndex, width))
  // En-têtes et pieds de page réduits à un numéro : hors du flux.
  segments = segments.filter(
    (s) =>
      !((bottom(s.bbox) < 0.08 * height || top(s.bbox) > 0.92 * height) && isPageFurniture(s.text)),
  )
  const hasText = segments.length > 0
  const gutter = findGutter(segments, width)
  const sorted = [...segments].sort((a, b) => top(a.bbox) - top(b.bbox) || a.bbox.x - b.bbox.x)

  // Bandes : suites de segments en colonnes, interrompues par des segments pleine largeur.
  interface Band {
    full: boolean
    segments: Segment[]
  }
  const bands: Band[] = []
  for (const seg of sorted) {
    const full = gutter === null || (seg.bbox.x < gutter && right(seg.bbox) > gutter)
    const last = bands[bands.length - 1]
    if (last && last.full === full) last.segments.push(seg)
    else bands.push({ full, segments: [seg] })
  }

  const lines: Line[] = []
  bands.forEach((band, b) => {
    const prev = bands[b - 1]
    const next = bands[b + 1]
    const y0 = prev ? Math.max(...prev.segments.map((s) => bottom(s.bbox))) : 0
    const y1 = next ? Math.min(...next.segments.map((s) => top(s.bbox))) : height
    const makeArea = (col: number, x0: number, x1: number): Area => ({
      id: `${pageIndex}:${b}:${col}`,
      pageIndex,
      x0,
      x1,
      y0,
      y1,
    })
    if (band.full || gutter === null) {
      const area = makeArea(0, 0, width)
      for (const seg of band.segments) lines.push({ ...seg, area })
    } else {
      const leftArea = makeArea(0, 0, gutter)
      const rightArea = makeArea(1, gutter, width)
      for (const seg of band.segments) {
        if (right(seg.bbox) <= gutter) lines.push({ ...seg, area: leftArea })
      }
      for (const seg of band.segments) {
        if (right(seg.bbox) > gutter) lines.push({ ...seg, area: rightArea })
      }
    }
  })

  return { pageIndex, width, height, lines, hasText, columns: gutter === null ? 1 : 2 }
}

const DETACHED_ACCENTS = new Set([
  '\u00b4',
  '\u0060',
  '\u02c6',
  '\u00a8',
  '\u02dc',
  '\u00b8',
  '\u02da',
])
const isLetter = (ch: string | undefined) => ch !== undefined && /\p{L}/u.test(ch)

/** Retire les accents isolés adjacents à une lettre, en gardant les abscisses alignées. */
export function stripDetachedAccents(text: string, charX: number[]) {
  let out = ''
  const xs: number[] = []
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (DETACHED_ACCENTS.has(ch) && (isLetter(text[i - 1]) || isLetter(text[i + 1]))) continue
    out += ch
    xs.push(charX[i] ?? charX[charX.length - 1] ?? 0)
  }
  return { text: out, charX: xs }
}

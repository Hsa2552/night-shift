// Moteur de détection : parcourt les lignes dans l'ordre de lecture avec un automate
// « énoncé / correction », produit les blocs de correction, leurs rectangles et le
// type probable du document. Déterministe, sans dépendance à React.

import type {
  CorrectionBlock,
  DetectionInput,
  DetectionResult,
  DocumentKind,
  PageRegion,
  Rect,
} from './contract.ts'
import { hueDistance, inkOf, type Ink } from './color.ts'
import { layoutPage, type Line, type PageLayout } from './layout.ts'
import {
  findInlineCorrection,
  isCorrectionTitle,
  nextValue,
  parseCorrectionStart,
  parseOption,
  parseQuestion,
  type CorrectionMarker,
  type OptionLine,
  type QuestionMarker,
} from './markers.ts'

export const WARNINGS = {
  noText: 'Aucun texte extractible : la détection automatique est impossible sur ce document.',
  unknown: 'Structure non reconnue : la détection automatique est incertaine.',
  textlessPages: (pages: number[]) =>
    `Pages sans texte extractible, masquées entièrement par prudence : ${pages.join(', ')}.`,
  textlessPagesNoMask: (pages: number[]) =>
    `Pages sans texte extractible, non analysées : ${pages.join(', ')}.`,
  unsegmented: 'Corrigé détecté, mais son découpage par question est impossible.',
  uncovered: "Certaines questions n'ont pas de corrigé détecté.",
  color: 'Corrigés repérés uniquement par leur couleur : vérifiez le résultat.',
  suspicious:
    'Aucun marqueur de corrigé, mais certaines lignes pourraient être des réponses : détection incertaine.',
} as const

// --- Contexte de numérotation -------------------------------------------------

/** Valeurs courantes par niveau : partie, exercice, question, sous-question, lettre. */
type Ctx = (string | undefined)[]
const LEVELS = 5

function applyMarker(ctx: Ctx, m: QuestionMarker): Ctx {
  const next = ctx.slice(0, m.level)
  while (next.length < m.level) next.push(undefined)
  next[m.level] = m.kind === 'letter' ? m.value : `${m.kind}:${m.value}`
  return next
}

const keyOf = (ctx: Ctx) => Array.from({ length: LEVELS }, (_, i) => ctx[i] ?? '').join('|')

function labelOf(ctx: Ctx, displays: Map<string, string>): string | undefined {
  const parts: string[] = []
  ctx.forEach((v, level) => {
    if (v === undefined) return
    parts.push(displays.get(`${level}#${v}`) ?? v)
  })
  if (parts.length === 0) return undefined
  const label = parts.join(', ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function markerDisplay(m: QuestionMarker): string {
  if (m.kind === 'numeric' || m.kind === 'question') return `question ${m.value}`
  if (m.kind === 'letter') return `${m.value})`
  return m.display
}

// --- Analyse ligne par ligne ---------------------------------------------------

interface Parsed {
  q: QuestionMarker | null
  /** Marqueur de correction en début de ligne, éventuellement après un libellé (« Exercice 2 : corrigé »). */
  c: CorrectionMarker | null
  /** Indice d'un marqueur de correction en cours de ligne. */
  inline: number | null
  option: OptionLine | null
}

function parseLine(line: Line): Parsed {
  const q = parseQuestion(line.text)
  let c = parseCorrectionStart(line.text)
  if (!c && q) c = parseCorrectionStart(q.rest)
  const inline = c ? null : findInlineCorrection(line.text)
  return { q, c, inline, option: parseOption(line.text) }
}

interface Draft {
  start: number
  end: number
  label?: string
  /** Abscisse de début du masque sur la première ligne (marqueur en cours de ligne). */
  inlineX?: number
  /** Bloc ouvert par un titre de section (« Corrigé ») : les libellés répétés y découpent. */
  grouped: boolean
  /** Rectangles explicites (QCM) au lieu des lignes start..end. */
  custom?: PageRegion[]
  /** Question associée par la géométrie (correction dans une colonne voisine). */
  questionIndex?: number
}

// --- Moteur principal -----------------------------------------------------------

export async function detect(input: DetectionInput): Promise<DetectionResult> {
  const layouts = input.pages.map(layoutPage)
  const flow = layouts.flatMap((p) => p.lines)
  const textlessPages = layouts.filter((p) => !p.hasText).map((p) => p.pageIndex)

  if (flow.length === 0) {
    return { kind: 'unknown', blocks: [], warnings: [WARNINGS.noText], needsFallback: true }
  }

  const parsed = flow.map(parseLine)
  const isC = (i: number) => parsed[i]!.c !== null
  const isPureQ = (i: number) => parsed[i]!.q !== null && parsed[i]!.c === null
  const firstQ = parsed.findIndex((_, i) => isPureQ(i))
  const preambleEnd = firstQ === -1 ? flow.length : firstQ

  // Préambule (avant la première question) : titre annonçant un corrigé, ou marqueur explicite.
  let lastPreambleMarker = -1
  for (let i = 0; i < preambleEnd; i++) {
    const titleZone = flow[i]!.pageIndex === 0 && i < 6
    if (isC(i) || (titleZone && isCorrectionTitle(flow[i]!.text))) lastPreambleMarker = i
  }
  const laterMarkers = parsed.some((p, i) => i > preambleEnd && (p.c !== null || p.inline !== null))
  const correctionFromStart = lastPreambleMarker >= 0 && !laterMarkers

  const drafts: Draft[] = []
  const modeAt: ('statement' | 'correction' | 'title')[] = []
  const labelAt: (string | undefined)[] = []
  const displays = new Map<string, string>()
  const seen = new Set<string>()
  const lastInSeq = new Map<string, string>()
  const statementQ: { index: number; level: number }[] = []
  let ctx: Ctx = []
  // Objet d'état (et non variables `let`) : modifié dans des fermetures.
  const st = { mode: 'statement' as 'statement' | 'correction', current: null as Draft | null }
  let lastQRelX: number | undefined
  let segmentBaseline: number | undefined
  let continuityEvents = 0
  let qCount = 0

  const relX = (i: number) => flow[i]!.bbox.x - flow[i]!.area.x0
  const tol = (i: number) => Math.max(6, flow[i]!.fontSize)
  const seqKey = (c: Ctx, m: QuestionMarker) =>
    `${keyOf(c.slice(0, m.level))}#${m.level}#${m.style}`

  const remember = (m: QuestionMarker) => {
    displays.set(
      `${m.level}#${m.kind === 'letter' ? m.value : `${m.kind}:${m.value}`}`,
      markerDisplay(m),
    )
  }
  const close = (end: number) => {
    if (st.current) {
      st.current.end = end
      drafts.push(st.current)
      st.current = null
    }
  }
  const open = (start: number, grouped: boolean, inlineX?: number) => {
    st.current = { start, end: start, label: labelOf(ctx, displays), grouped, inlineX }
    st.mode = 'correction'
  }
  /** Commence un nouveau bloc à la ligne i (ou renomme le bloc courant s'il commence en i). */
  const split = (i: number, grouped: boolean) => {
    if (st.current && st.current.start === i) {
      st.current.label = labelOf(ctx, displays)
      st.current.grouped = grouped
    } else {
      close(i - 1)
      open(i, grouped)
    }
  }

  /** Une question nouvelle qui continue la numérotation de l'énoncé termine la correction. */
  const endsCorrection = (m: QuestionMarker, i: number): boolean => {
    if (lastQRelX !== undefined && relX(i) > lastQRelX + tol(i)) return false
    if (m.kind === 'part' || m.kind === 'exercise' || m.kind === 'question') return true
    const expected = nextValue(lastInSeq.get(seqKey(ctx, m)) ?? '')
    return expected === m.value
  }

  const statementQuestion = (i: number, m: QuestionMarker) => {
    const key = seqKey(ctx, m)
    const expected = nextValue(lastInSeq.get(key) ?? '')
    if (expected === m.value) continuityEvents++
    lastInSeq.set(key, m.value)
    remember(m)
    ctx = applyMarker(ctx, m)
    seen.add(keyOf(ctx))
    lastQRelX = relX(i)
    qCount++
    statementQ.push({ index: i, level: m.level })
  }

  let startIndex = 0
  if (correctionFromStart) {
    for (let i = 0; i <= lastPreambleMarker; i++) {
      modeAt.push('title')
      labelAt.push(undefined)
    }
    startIndex = lastPreambleMarker + 1
    if (startIndex < flow.length) open(startIndex, true)
  }

  for (let i = startIndex; i < flow.length; i++) {
    const { q, c, inline } = parsed[i]!
    const line = flow[i]!

    if (st.mode === 'correction' && st.current) {
      const cur = st.current
      if (c) {
        if (q) {
          remember(q)
          ctx = applyMarker(ctx, q)
        }
        split(i, c.headerOnly)
      } else if (q) {
        const after = applyMarker(ctx, q)
        if (correctionFromStart) {
          segmentBaseline ??= relX(i)
          if (q.kind !== 'letter' && relX(i) <= segmentBaseline + tol(i)) {
            remember(q)
            ctx = after
            qCount++
            split(i, true)
          }
        } else if (seen.has(keyOf(after)) && cur.grouped) {
          remember(q)
          ctx = after
          split(i, true)
        } else if (!seen.has(keyOf(after)) && endsCorrection(q, i)) {
          close(i - 1)
          st.mode = 'statement'
        }
      }
      if (st.mode === 'correction') {
        modeAt.push('correction')
        labelAt.push(labelOf(ctx, displays))
        continue
      }
    }

    // Mode énoncé.
    if (c) {
      if (q) {
        remember(q)
        ctx = applyMarker(ctx, q)
      }
      open(i, c.headerOnly)
      modeAt.push('correction')
    } else {
      if (q) statementQuestion(i, q)
      if (inline !== null) {
        open(i, false, line.charX[inline])
        modeAt.push('correction')
      } else {
        modeAt.push('statement')
      }
    }
    labelAt.push(labelOf(ctx, displays))
  }
  close(flow.length - 1)

  labelSideBySide(drafts, flow, statementQ, labelAt)
  mergeLabelOnlyBlocks(drafts, flow, parsed)
  drafts.push(...qcmDrafts(flow, parsed, modeAt, labelAt))

  // Sans aucun marqueur textuel : les corrigés se distinguent-ils par leur couleur ?
  let byColor = false
  if (drafts.length === 0 && input.getRaster) {
    const inks = await lineInks(layouts, input.getRaster)
    const colorBlocks = colorDrafts(flow, parsed, inks, modeAt, labelAt)
    if (colorBlocks.length > 0) {
      byColor = true
      drafts.push(...colorBlocks)
      for (const d of colorBlocks) for (let i = d.start; i <= d.end; i++) modeAt[i] = 'correction'
    }
  }
  drafts.sort((a, b) => a.start - b.start)

  // --- Classification -----------------------------------------------------------
  const warnings: string[] = []
  let needsFallback = false
  let kind: DocumentKind

  if (drafts.length > 0) {
    let statementChars = 0
    let correctionChars = 0
    flow.forEach((line, i) => {
      const chars = line.text.length
      const inline = parsed[i]!.inline
      if (modeAt[i] === 'correction' && inline !== null) {
        statementChars += inline
        correctionChars += chars - inline
      } else if (modeAt[i] === 'correction') correctionChars += chars
      else if (modeAt[i] === 'statement') {
        const q = parsed[i]!.q
        statementChars += q ? q.rest.trim().length : chars
      }
    })
    // Énoncé quasi absent (seulement des libellés) : corrigé seul.
    const noStatement = statementChars < Math.max(20, 0.05 * correctionChars)
    kind = correctionFromStart || noStatement ? 'correction_only' : 'mixed'
    if (byColor) warnings.push(WARNINGS.color)
    if (kind === 'correction_only' && drafts.length === 1 && !drafts[0]!.label) {
      warnings.push(WARNINGS.unsegmented)
      needsFallback = true
    }
    if (
      kind === 'mixed' &&
      !drafts.some((d) => d.grouped) &&
      hasUncoveredLeaf(statementQ, drafts)
    ) {
      warnings.push(WARNINGS.uncovered)
    }
  } else if (qCount >= 2 && continuityEvents >= 1 && !suspiciousFont(flow, parsed)) {
    kind = 'statement_only'
  } else if (qCount >= 2 && continuityEvents >= 1) {
    kind = 'unknown'
    warnings.push(WARNINGS.suspicious)
    needsFallback = true
  } else {
    kind = 'unknown'
    warnings.push(WARNINGS.unknown)
    needsFallback = true
  }

  const blocks: CorrectionBlock[] = drafts
    .map((d) => ({ label: d.label, regions: d.custom ?? lineRegions(d, flow) }))
    .filter((b) => b.regions.length > 0)
    .map((b, n) => ({
      id: `c${n + 1}`,
      ...(b.label ? { questionLabel: b.label } : {}),
      regions: b.regions,
    }))

  if (textlessPages.length > 0) {
    const human = textlessPages.map((p) => p + 1)
    needsFallback = true
    if (kind === 'mixed' || kind === 'correction_only') {
      warnings.push(WARNINGS.textlessPages(human))
      for (const pageIndex of textlessPages) {
        const page = input.pages.find((p) => p.pageIndex === pageIndex)!
        blocks.push({
          id: `c${blocks.length + 1}`,
          questionLabel: `page ${pageIndex + 1}`,
          regions: [{ pageIndex, bbox: { x: 0, y: 0, width: page.width, height: page.height } }],
        })
      }
    } else {
      warnings.push(WARNINGS.textlessPagesNoMask(human))
    }
  }

  return { kind, blocks, warnings, needsFallback }
}

// --- Post-traitements -------------------------------------------------------------

/**
 * Correction dans une colonne voisine de sa question (« Réponse » à droite) : le libellé
 * est celui de la question de l'autre colonne située à la même hauteur, ou juste au-dessus.
 */
function labelSideBySide(
  drafts: Draft[],
  flow: Line[],
  statementQ: { index: number }[],
  labelAt: (string | undefined)[],
) {
  for (const d of drafts) {
    const first = flow[d.start]!
    const [page, band] = first.area.id.split(':')
    let best: number | undefined
    for (const { index } of statementQ) {
      const q = flow[index]!
      const [qPage, qBand] = q.area.id.split(':')
      if (qPage !== page || qBand !== band || q.area.id === first.area.id) continue
      if (q.bbox.y > first.bbox.y + 0.5 * first.fontSize) continue
      if (best === undefined || q.bbox.y > flow[best]!.bbox.y) best = index
    }
    if (best !== undefined) {
      d.label = labelAt[best]
      d.questionIndex = best
    }
  }
}

/** Un bloc réduit à un titre (« Corrigé », « Exercice 1 ») est fusionné avec le suivant. */
function mergeLabelOnlyBlocks(drafts: Draft[], flow: Line[], parsed: Parsed[]) {
  for (let k = drafts.length - 2; k >= 0; k--) {
    const d = drafts[k]!
    const next = drafts[k + 1]!
    if (d.start !== d.end || next.start !== d.end + 1 || d.inlineX !== undefined) continue
    const p = parsed[d.start]!
    const bareLabel = p.q !== null && p.q.rest.replace(/[\s:.\-–]/g, '').length === 0
    const header = p.c?.headerOnly === true
    if (!bareLabel && !header) continue
    if (flow[d.start]!.pageIndex !== flow[next.start]!.pageIndex && !header) continue
    next.start = d.start
    next.grouped = next.grouped || d.grouped
    drafts.splice(k, 1)
  }
}

/** QCM : cases cochées ou coches après les options, masquées pour toutes les options du groupe. */
function qcmDrafts(
  flow: Line[],
  parsed: Parsed[],
  modeAt: string[],
  labelAt: (string | undefined)[],
): Draft[] {
  const drafts: Draft[] = []
  let i = 0
  while (i < flow.length) {
    if (modeAt[i] !== 'statement' || !parsed[i]!.option) {
      i++
      continue
    }
    let j = i
    while (j + 1 < flow.length && modeAt[j + 1] === 'statement' && parsed[j + 1]!.option) j++
    const run = Array.from({ length: j - i + 1 }, (_, k) => i + k)
    const options = run.map((k) => parsed[k]!.option!)
    const hasCheckedBox = options.some((o) => o.box?.checked)
    const hasTrailing = options.some((o) => o.trailingCheck !== undefined)
    if (run.length >= 2 && (hasCheckedBox || hasTrailing)) {
      const regions: PageRegion[] = []
      for (const k of run) {
        const line = flow[k]!
        const o = parsed[k]!.option!
        const pad = 0.3 * line.fontSize
        const y = line.bbox.y - pad
        const height = line.bbox.height + 2 * pad
        if (o.box) {
          const x0 = line.charX[o.box.start] ?? line.bbox.x
          const x1 = line.charX[o.box.end] ?? x0 + line.fontSize
          regions.push(region(line, x0 - pad, y, x1 - x0 + 2 * pad, height))
        }
        if (hasTrailing) {
          const x0 =
            o.trailingCheck !== undefined
              ? (line.charX[o.trailingCheck] ?? line.bbox.x + line.bbox.width)
              : line.bbox.x + line.bbox.width + 0.5 * line.fontSize
          regions.push(region(line, x0 - pad, y, 1.5 * line.fontSize + 2 * pad, height))
        }
      }
      drafts.push({ start: i, end: j, label: labelAt[i], grouped: false, custom: regions })
    }
    i = j + 1
  }
  return drafts
}

function region(line: Line, x: number, y: number, width: number, height: number): PageRegion {
  return { pageIndex: line.pageIndex, bbox: clip({ x, y, width, height }, line) }
}

function clip(r: Rect, line: Line): Rect {
  const x0 = Math.max(line.area.x0, r.x)
  const x1 = Math.min(line.area.x1, r.x + r.width)
  const y0 = Math.max(0, r.y)
  const y1 = Math.max(y0, r.y + r.height)
  return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: y1 - y0 }
}

/**
 * Rectangles d'un bloc de lignes : pleine largeur de la zone (colonne) pour couvrir aussi
 * les figures et équations, du haut de la première ligne jusqu'à la ligne suivante hors bloc.
 */
function lineRegions(d: Draft, flow: Line[]): PageRegion[] {
  const regions: PageRegion[] = []
  let i = d.start
  while (i <= d.end) {
    const area = flow[i]!.area
    let j = i
    while (j + 1 <= d.end && flow[j + 1]!.area.id === area.id) j++
    const first = flow[i]!
    const last = flow[j]!
    const pad = 0.3 * first.fontSize
    const prev = flow[i - 1]
    const next = flow[j + 1]
    let y0: number
    if (i !== d.start) {
      y0 = area.y0 // suite du bloc dans une nouvelle colonne ou page
    } else {
      y0 = first.bbox.y - pad
      if (prev && prev.area.id === area.id)
        y0 = Math.max(y0, Math.min(first.bbox.y, bottomOf(prev)))
      y0 = Math.max(area.y0, y0)
    }
    let y1: number
    if (j === d.end && next && next.area.id === area.id) {
      const gap = next.bbox.y - bottomOf(last)
      y1 = gap >= 0 ? next.bbox.y - Math.min(pad, gap / 2) : bottomOf(last)
    } else {
      y1 = area.y1
    }
    if (i === d.start && d.inlineX !== undefined) {
      // Première ligne : seulement la partie à droite du marqueur.
      const x = Math.max(area.x0, d.inlineX - pad)
      regions.push({
        pageIndex: first.pageIndex,
        bbox: { x, y: y0, width: area.x1 - x, height: (j > i ? bottomOf(first) : y1) - y0 },
      })
      if (j > i) {
        regions.push({
          pageIndex: first.pageIndex,
          bbox: {
            x: area.x0,
            y: bottomOf(first),
            width: area.x1 - area.x0,
            height: y1 - bottomOf(first),
          },
        })
      }
    } else {
      regions.push({
        pageIndex: first.pageIndex,
        bbox: { x: area.x0, y: y0, width: area.x1 - area.x0, height: y1 - y0 },
      })
    }
    i = j + 1
  }
  return regions.filter((r) => r.bbox.width > 0 && r.bbox.height > 0)
}

const bottomOf = (line: Line) => line.bbox.y + line.bbox.height

/** Vrai si une question « feuille » de l'énoncé n'est suivie d'aucun bloc avant la suivante. */
function hasUncoveredLeaf(
  statementQ: { index: number; level: number }[],
  drafts: Draft[],
): boolean {
  return statementQ.some((q, k) => {
    const next = statementQ[k + 1]
    if (next && next.level > q.level) return false // la question a des sous-questions
    const limit = next ? next.index : Infinity
    return !drafts.some(
      (d) => d.questionIndex === q.index || (d.start >= q.index && d.start < limit),
    )
  })
}

// --- Analyse par couleur ------------------------------------------------------------

/** Encre de chaque ligne du flux, en demandant le rendu de chaque page une seule fois. */
async function lineInks(
  layouts: PageLayout[],
  getRaster: NonNullable<DetectionInput['getRaster']>,
): Promise<Ink[]> {
  const inks: Ink[] = []
  for (const layout of layouts) {
    if (layout.lines.length === 0) continue
    let raster
    try {
      raster = await getRaster(layout.pageIndex)
    } catch {
      raster = null
    }
    for (const line of layout.lines) {
      inks.push(raster ? inkOf(raster, layout.width, layout.height, line.bbox) : { kind: 'none' })
    }
  }
  return inks
}

/**
 * Corrigés sans marqueur, écrits dans une couleur réservée. Une teinte est retenue si :
 * au moins deux lignes de corps de texte l'utilisent, presque aucune n'est une question
 * ou un titre, et une question de l'énoncé (dans une autre encre) la précède.
 */
function colorDrafts(
  flow: Line[],
  parsed: Parsed[],
  inks: Ink[],
  modeAt: string[],
  labelAt: (string | undefined)[],
): Draft[] {
  const sizes = flow.map((l) => l.fontSize).sort((a, b) => a - b)
  const bodySize = sizes[Math.floor(sizes.length / 2)]!
  const isHeading = (i: number) => flow[i]!.fontSize > 1.2 * bodySize

  // Regroupement des lignes colorées par teinte proche.
  const clusters: { hue: number; lines: number[] }[] = []
  inks.forEach((ink, i) => {
    if (ink.kind !== 'color' || modeAt[i] !== 'statement' || isHeading(i)) return
    const cluster = clusters.find((c) => hueDistance(c.hue, ink.hue) <= 20)
    if (cluster) cluster.lines.push(i)
    else clusters.push({ hue: ink.hue, lines: [i] })
  })

  const firstQuestion = flow.findIndex((_, i) => parsed[i]!.q !== null && inks[i]?.kind !== 'color')
  const answerLines = new Set<number>()
  for (const cluster of clusters) {
    const questions = cluster.lines.filter((i) => parsed[i]!.q !== null).length
    if (cluster.lines.length < 2 || questions > 0.2 * cluster.lines.length) continue
    if (firstQuestion === -1 || cluster.lines[0]! < firstQuestion) continue
    for (const i of cluster.lines) if (parsed[i]!.q === null) answerLines.add(i)
  }

  // Suites de lignes consécutives (les lignes sans encre mesurable ne coupent pas une suite).
  const drafts: Draft[] = []
  let i = 0
  while (i < flow.length) {
    if (!answerLines.has(i)) {
      i++
      continue
    }
    let j = i
    let k = i + 1
    while (k < flow.length && (answerLines.has(k) || inks[k]?.kind === 'none')) {
      if (answerLines.has(k)) j = k
      k++
    }
    drafts.push({ start: i, end: j, label: labelAt[i], grouped: false })
    i = j + 1
  }
  return drafts
}

// --- Prudence avant d'annoncer « aucun corrigé » -------------------------------------

/**
 * Vrai si des lignes de texte, placées après des questions dans au moins deux questions
 * différentes, utilisent une police qu'aucune ligne de question n'utilise (réponses en
 * italique, par exemple). On ne masque rien sur ce seul indice : on renonce seulement
 * à affirmer qu'il n'y a pas de corrigé.
 */
function suspiciousFont(flow: Line[], parsed: Parsed[]): boolean {
  const questionFonts = new Set<string>()
  flow.forEach((line, i) => {
    if (parsed[i]!.q) for (const f of line.fontNames) questionFonts.add(f)
  })
  if (questionFonts.size === 0) return false
  const spansByFont = new Map<string, Set<number>>()
  let span = -1
  flow.forEach((line, i) => {
    if (parsed[i]!.q) {
      span = i
      return
    }
    if (span < 0 || line.fontNames.length !== 1) return
    const font = line.fontNames[0]!
    if (questionFonts.has(font)) return
    const letters = (line.text.match(/\p{L}/gu) ?? []).length
    if (letters < 0.5 * line.text.length || line.text.split(/\s+/).length < 3) return // formule
    const spans = spansByFont.get(font) ?? new Set<number>()
    spans.add(span)
    spansByFont.set(font, spans)
  })
  return [...spansByFont.values()].some((spans) => spans.size >= 2)
}

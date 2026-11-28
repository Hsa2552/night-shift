// Moteur de détection : parcourt les lignes dans l'ordre de lecture avec un automate
// « énoncé / correction », produit les blocs de correction, leurs rectangles et le
// type probable du document. Déterministe, sans dépendance à React.

import type {
  CorrectionBlock,
  DetectionInput,
  DetectionResult,
  DocumentKind,
  PageRegion,
  RasterData,
  Rect,
  PageData,
} from './contract.ts'
import { hueDistance, inkOf, type Ink } from './color.ts'
import { answerBoxes, findBoxes, locateSquare, type Box } from './boxes.ts'
import {
  fuseExternalColor,
  registeredColorAnalyzer,
  type ExternalColorAnalyzer,
  type ExternalColorResult,
} from './fusion.ts'
import { analyzeColorPage, readColorConvention } from './visual/index.ts'
import { buildPageInk, graphicBottom, graphicTop, type PageInk } from './graphics.ts'
import { layoutPage, type Line, type PageLayout } from './layout.ts'
import {
  findInlineCorrection,
  fold,
  isCorrectionTitle,
  leadingGlyph,
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
  questionInk: 'Corrigés repérés par la couleur des questions : vérifiez le résultat.',
  externalColor: 'Corrigés colorés ajoutés par le détecteur visuel : vérifiez le résultat.',
  correctionHint:
    'Le document semble contenir des corrigés qui n’ont pas pu être localisés : détection incertaine.',
  unplaced: "Une partie du texte n'a pas pu être localisée : des corrigés peuvent rester visibles.",
  noVisualCheck:
    "Aucun marqueur de corrigé, mais l'analyse visuelle de la page a échoué : détection incertaine.",
  suspicious:
    'Aucun marqueur de corrigé, mais certaines lignes pourraient être des réponses : détection incertaine.',
  ambiguousColor: (pages: number[]) =>
    `Encre colorée inexpliquée (page${pages.length > 1 ? 's' : ''} ${pages.join(', ')}) : des corrigés peuvent rester visibles, document couvert par prudence.`,
} as const

// --- Contexte de numérotation -------------------------------------------------

/** Valeurs courantes par niveau : partie, exercice, question, sous-question, lettre. */
type Ctx = (string | undefined)[]
const LEVELS = 5

function applyMarker(ctx: Ctx, m: QuestionMarker): Ctx {
  const next = ctx.slice(0, m.level)
  while (next.length < m.level) next.push(undefined)
  next[m.level] = m.value
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
  glyph: string | null
}

function parseLine(line: Line): Parsed {
  const q = parseQuestion(line.text)
  let c = parseCorrectionStart(line.text)
  if (!c && q) c = parseCorrectionStart(q.rest)
  const inline = c ? null : findInlineCorrection(line.text)
  return { q, c, inline, option: parseOption(line.text), glyph: leadingGlyph(line.text) }
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
  // En-têtes et pieds de page répétés (« Correction » en tête de chaque page) : hors du flux.
  const furniture = runningHeaders(layouts)
  const flow = layouts.flatMap((p) => p.lines.filter((l) => !furniture.has(l)))
  const textlessPages = layouts.filter((p) => !p.hasText).map((p) => p.pageIndex)

  if (flow.length === 0) {
    return { kind: 'unknown', blocks: [], warnings: [WARNINGS.noText], needsFallback: true }
  }

  // Rendus raster demandés au plus une fois par page ; un échec de rendu vaut « pas de raster ».
  const rasters = new Map<number, Promise<RasterData | null>>()
  let rasterFailed = false
  const rasterOf = (pageIndex: number): Promise<RasterData | null> => {
    if (!input.getRaster) return Promise.resolve(null)
    let raster = rasters.get(pageIndex)
    if (!raster) {
      raster = input.getRaster(pageIndex).catch(() => {
        rasterFailed = true
        return null
      })
      rasters.set(pageIndex, raster)
    }
    return raster
  }

  const parsed = flow.map(parseLine)
  // Un mot-clé de correction en minuscule qui continue une phrase non terminée de la ligne
  // précédente (« … plusieurs bonnes ⏎ réponses. Les autres … ») n'est pas un marqueur.
  parsed.forEach((p, i) => {
    if (!p.c || p.q) return
    const prev = flow[i - 1]
    const startsLower = /^\p{Ll}/u.test(flow[i]!.text)
    // Ligne précédente juste au-dessus sur la même page (indépendamment des zones : un
    // en-tête court peut faire croire à une colonne), phrase non terminée.
    const line = flow[i]!
    const continues =
      prev !== undefined &&
      prev.pageIndex === line.pageIndex &&
      line.bbox.y - (prev.bbox.y + prev.bbox.height) < line.bbox.height &&
      line.bbox.y > prev.bbox.y &&
      !/[.:;!?]\s*$/.test(prev.text)
    if (startsLower && continues) p.c = null
  })
  const isC = (i: number) => parsed[i]!.c !== null
  const isPureQ = (i: number) => parsed[i]!.q !== null && parsed[i]!.c === null
  const firstQ = parsed.findIndex((_, i) => isPureQ(i))
  const preambleEnd = firstQ === -1 ? flow.length : firstQ

  // Préambule (avant la première question) : titre annonçant un corrigé, ou marqueur explicite.
  // Premier marqueur du préambule. Un titre pur (« Corrigé du TD 5 ») reste visible et la
  // correction commence après lui ; une ligne de correction avec contenu est masquée.
  let firstPreambleMarker = -1
  for (let i = 0; i < preambleEnd && firstPreambleMarker < 0; i++) {
    const titleZone = flow[i]!.pageIndex === 0 && i < 6
    if (isC(i) || (titleZone && isCorrectionTitle(flow[i]!.text))) firstPreambleMarker = i
  }
  const markerIsTitle = (i: number) => {
    const c = parsed[i]!.c
    if (!c) return true
    if (c.headerOnly) return true
    if (c.target !== undefined && c.target.rest.replace(/[\s:.\-–]/g, '').length === 0) return true
    // « Corrigé de l'examen 2025 » en tête de document : titre, pas contenu
    // (contrairement à « Solution 1. On factorise... »).
    const titleZone = flow[i]!.pageIndex === 0 && i < 6
    return titleZone && !/[:.]\s+\S/.test(flow[i]!.text)
  }
  const correctionStart =
    firstPreambleMarker < 0
      ? -1
      : markerIsTitle(firstPreambleMarker)
        ? firstPreambleMarker + 1
        : firstPreambleMarker
  const laterMarkers = parsed.some((p, i) => i > preambleEnd && (p.c !== null || p.inline !== null))
  const correctionFromStart = firstPreambleMarker >= 0 && !laterMarkers

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
  let lastHier: string | null = null
  let qCount = 0

  const relX = (i: number) => flow[i]!.bbox.x - flow[i]!.area.x0
  const tol = (i: number) => Math.max(6, flow[i]!.fontSize)
  const seqKey = (c: Ctx, m: QuestionMarker) =>
    `${keyOf(c.slice(0, m.level))}#${m.level}#${m.style}`

  const remember = (m: QuestionMarker) => {
    displays.set(`${m.level}#${m.value}`, markerDisplay(m))
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

  /**
   * Titre de correction : applique le libellé qu'il porte (« Exercice 2 : corrigé »,
   * « Correction de l'exercice 2 ») et indique si le bloc ouvre une section découpable.
   */
  const labelFromCorrection = (q: QuestionMarker | null, c: CorrectionMarker): boolean => {
    for (const m of [q, c.target]) {
      if (!m) continue
      remember(m)
      ctx = applyMarker(ctx, m)
    }
    const level = c.target?.level ?? q?.level
    return c.headerOnly || (level !== undefined && level <= 1)
  }

  /** Une question nouvelle qui continue la numérotation de l'énoncé termine la correction. */
  const endsCorrection = (m: QuestionMarker, i: number): boolean => {
    if (lastQRelX !== undefined && relX(i) > lastQRelX + tol(i)) return false
    if (m.kind === 'part' || m.kind === 'exercise' || m.kind === 'question') return true
    // Étiquette hiérarchique : termine la correction seulement si elle succède à la dernière
    // question hiérarchique de l'énoncé (A.1 → A.2, A.5 → B.1) ; une question recopiée
    // dans une section de corrigés (« II.a » à nouveau) ne la termine pas.
    if (m.style === 'hier') return lastHier !== null && isHierSuccessor(lastHier, m.value)
    const expected = nextValue(lastInSeq.get(seqKey(ctx, m)) ?? '')
    return expected === m.value
  }

  const statementQuestion = (i: number, m: QuestionMarker) => {
    if (m.style === 'hier') lastHier = m.value
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
    for (let i = 0; i < correctionStart; i++) {
      modeAt.push('title')
      labelAt.push(undefined)
    }
    startIndex = correctionStart
    if (startIndex < flow.length) open(startIndex, true)
  }

  for (let i = startIndex; i < flow.length; i++) {
    const { q, c, inline } = parsed[i]!
    const line = flow[i]!

    if (st.mode === 'correction' && st.current) {
      const cur = st.current
      if (c) {
        split(i, labelFromCorrection(q, c))
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
      open(i, labelFromCorrection(q, c))
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

  splitTableRows(drafts, flow, statementQ, labelAt)
  labelSideBySide(drafts, flow, statementQ, labelAt)
  mergeLabelOnlyBlocks(drafts, flow, parsed)
  drafts.push(...qcmDrafts(flow, parsed, modeAt, labelAt))

  // QCM corrigés par noircissement de cases dessinées (raster) : un bloc par question,
  // toutes les cases masquées à l'identique. Les blocs textuels ouverts par un simple titre
  // (« Réponses : ») ou par une numérotation répétée, et qui contiennent des cases, sont
  // remplacés par ces blocs ; une correction textuelle avec contenu est conservée.
  const boxes = input.getRaster
    ? await boxDrafts(input, flow, parsed, labelAt, rasterOf)
    : { drafts: [], lines: new Set<number>() }
  if (boxes.drafts.length > 0) {
    for (let k = drafts.length - 1; k >= 0; k--) {
      const d = drafts[k]!
      if (d.custom || d.inlineX !== undefined) continue
      const c = parsed[d.start]!.c
      const contentBearing = c !== null && !c.headerOnly
      let hostsBox = false
      for (let i = d.start; i <= d.end && !hostsBox; i++) hostsBox = boxes.lines.has(i)
      if (contentBearing || !hostsBox) continue
      for (let i = d.start; i <= d.end; i++) modeAt[i] = 'statement'
      drafts.splice(k, 1)
    }
    // Bloc de consignes sous un simple titre (« Réponses : ») : pas d'étiquette de question.
    for (const d of drafts) if (parsed[d.start]!.c?.headerOnly) d.label = undefined
    drafts.push(...boxes.drafts)
  }

  // Couleurs : encre de chaque ligne, dès que le rendu raster est disponible.
  const inks = input.getRaster ? await lineInks(flow, layouts, rasterOf) : null

  // Questions colorées servant d'ancres : si une teinte porte les questions numérotées, la
  // correction de chaque question est ce qui suit sa question jusqu'à la question suivante.
  // Cette structure, plus précise, remplace la segmentation textuelle (titre « Corrigé »,
  // titres seuls) ; les blocs de cases de QCM sont conservés.
  let byQuestionInk = false
  let questionHue: number | null = null
  if (inks) {
    const anchoring = questionInkDrafts(flow, parsed, inks, labelAt)
    const anchored = anchoring.drafts
    questionHue = anchoring.hue
    if (anchored.length > 0) {
      byQuestionInk = true
      for (let k = drafts.length - 1; k >= 0; k--) {
        if (drafts[k]!.custom) continue
        const d = drafts.splice(k, 1)[0]!
        for (let i = d.start; i <= d.end; i++) modeAt[i] = 'statement'
      }
      for (const d of anchored) {
        drafts.push(d)
        for (let i = d.start; i <= d.end; i++) modeAt[i] = 'correction'
      }
    }
  }

  // Sans aucun marqueur textuel : les corrigés se distinguent-ils par leur couleur ?
  let byColor = false
  let visualCheckFailed = false
  if (drafts.length === 0 && inks) {
    for (const layout of layouts) {
      if (layout.lines.length > 0 && !(await rasterOf(layout.pageIndex))) visualCheckFailed = true
    }
  }
  // Conventions locales : l'inférence par couleur porte sur les unités (section × page) que
  // les autres détecteurs n'expliquent pas, et non sur tout le document. Un document hybride
  // (QCM à cases + exercices rédigés en couleur) n'est pas réglé par la seule présence des
  // cases. Sans aucun bloc, toutes les lignes d'énoncé sont éligibles, comme auparavant.
  const eligible = drafts.length === 0 ? null : unexplainedLines(flow, parsed, drafts, labelAt)
  if (inks && !byQuestionInk && (eligible === null || eligible.size > 0)) {
    const colorBlocks = colorDrafts(flow, parsed, inks, modeAt, labelAt, eligible)
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
    // Le document est mixte dès qu'une question visible a un énoncé, ou qu'une ligne
    // d'énoncé contient une phrase. Le texte après « Exercice N » ou « Partie N » est un
    // titre (« Exercice 2 : Probabilités ») et ne compte pas.
    const hasStatement = flow.some((line, i) => {
      const p = parsed[i]!
      if (modeAt[i] === 'statement') {
        if (!p.q) return isSentence(line.text)
        if (p.q.kind === 'part' || p.q.kind === 'exercise') return false
        return hasWord(p.q.rest)
      }
      if (modeAt[i] === 'correction' && p.inline !== null) {
        const before = line.text.slice(0, p.inline)
        return p.q ? hasWord(before.slice(before.length - p.q.rest.length)) : isSentence(before)
      }
      return false
    })
    kind = (correctionFromStart && !byQuestionInk) || !hasStatement ? 'correction_only' : 'mixed'
    if (byColor) warnings.push(WARNINGS.color)
    if (byQuestionInk) warnings.push(WARNINGS.questionInk)
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
  } else if (
    qCount >= 2 &&
    continuityEvents >= 1 &&
    !suspiciousFont(flow, parsed) &&
    !visualCheckFailed &&
    !correctionHint(layouts, flow, parsed)
  ) {
    kind = 'statement_only'
  } else if (qCount >= 2 && continuityEvents >= 1) {
    // Indices de corrigés non localisés (police, titre, tournures de réponse) ou pas de
    // vérification visuelle : on n'affirme pas « aucun corrigé », on s'abstient.
    kind = 'unknown'
    warnings.push(
      visualCheckFailed
        ? WARNINGS.noVisualCheck
        : correctionHint(layouts, flow, parsed)
          ? WARNINGS.correctionHint
          : WARNINGS.suspicious,
    )
    needsFallback = true
  } else {
    kind = 'unknown'
    warnings.push(WARNINGS.unknown)
    needsFallback = true
  }

  const pageInks = new Map<number, PageInk | null>()
  const pageInk = async (pageIndex: number): Promise<PageInk | null> => {
    if (!pageInks.has(pageIndex)) {
      const raster = await rasterOf(pageIndex)
      const page = input.pages.find((p) => p.pageIndex === pageIndex)
      pageInks.set(pageIndex, raster && page ? buildPageInk(raster, page) : null)
    }
    return pageInks.get(pageIndex)!
  }
  const built: { label?: string; regions: PageRegion[] }[] = []
  for (const d of drafts) {
    if (d.custom) {
      built.push({ label: d.label, regions: d.custom })
      continue
    }
    const regions: PageRegion[] = []
    for (const { region, next, prev } of lineRegions(d, flow)) {
      // Une figure de la correction qui déborde sous la limite, ou un cadre qui l'entoure,
      // reste masqué en entier, sans dépasser la moitié de la ligne visible voisine.
      const ink = (next || prev) && input.getRaster ? await pageInk(region.pageIndex) : null
      if (ink && next) {
        const limit = next.bbox.y + 0.5 * next.bbox.height
        const bottom = graphicBottom(ink, region.bbox, limit)
        region.bbox.height = bottom - region.bbox.y
      }
      if (ink && prev) {
        const top = graphicTop(ink, region.bbox, prev.bbox.y + 0.5 * prev.bbox.height)
        region.bbox.height += region.bbox.y - top
        region.bbox.y = top
      }
      regions.push(region)
    }
    built.push({ label: d.label, regions })
  }
  // Régions bornées à la page ; les rectangles vides ou non finis sont retirés (l'interface
  // rejette tout le résultat si une seule région est invalide).
  const pageSize = new Map(input.pages.map((p) => [p.pageIndex, p]))
  for (const b of built)
    b.regions = b.regions.flatMap((r) => sanitize(r, pageSize.get(r.pageIndex)))
  const blocks: CorrectionBlock[] = built
    .filter((b) => b.regions.length > 0)
    .map((b, n) => ({
      id: `c${n + 1}`,
      ...(b.label ? { questionLabel: b.label } : {}),
      regions: b.regions,
    }))

  // Détecteur colorimétrique externe (s'il est enregistré) : fusion sans union aveugle.
  const registered = registeredColorAnalyzer()
  const analyzer = registered === 'default' ? defaultColorAnalyzer(input.pages) : registered
  if (analyzer && input.getRaster) {
    const results: ExternalColorResult[] = []
    for (const page of input.pages) {
      if (!flow.some((l) => l.pageIndex === page.pageIndex)) continue
      const raster = await rasterOf(page.pageIndex)
      if (!raster) continue
      try {
        results.push(analyzer(page, raster))
      } catch {
        results.push({ candidates: [], blocks: [], needsFallback: true })
      }
    }
    const protectedLines = flow
      .filter((_, i) => parsed[i]!.q !== null && modeAt[i] !== 'correction')
      .map((l) => ({ pageIndex: l.pageIndex, bbox: l.bbox }))
    const outcome = fuseExternalColor(results, {
      protectedLines,
      ownRegions: blocks.flatMap((b) => b.regions),
      questionHue,
      firstQuestion: (() => {
        const i = flow.findIndex((_, k) => {
          const q = parsed[k]!.q
          return q !== null && q.kind !== 'part' && q.kind !== 'exercise'
        })
        return i < 0 ? null : { pageIndex: flow[i]!.pageIndex, y: flow[i]!.bbox.y }
      })(),
      labelAt: (pageIndex, y) => {
        let found: string | undefined
        flow.forEach((l, i) => {
          if (l.pageIndex === pageIndex && l.bbox.y <= y) found = labelAt[i] ?? found
        })
        return found
      },
    })
    for (const b of outcome.added) {
      blocks.push({ ...b, id: `c${blocks.length + 1}` })
    }
    if (outcome.added.length > 0) {
      warnings.push(WARNINGS.externalColor)
      if (kind === 'statement_only' || kind === 'unknown') kind = 'mixed'
    }
    // Contrôle final : un signal colorimétrique que ni les masques du moteur, ni les questions,
    // ni la teinte des questions n'expliquent rend le document ambigu, quel que soit son type :
    // « mixte » ne prouve pas que toutes les corrections ont été trouvées (document hybride).
    if (outcome.externalFallback && kind !== 'unknown') {
      const pages = [...new Set(outcome.audit.unexplained.map((r) => r.pageIndex + 1))]
      kind = 'unknown'
      needsFallback = true
      warnings.push(pages.length > 0 ? WARNINGS.ambiguousColor(pages) : WARNINGS.suspicious)
    }
  }

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

  // Fragments de texte sans position exploitable (métriques de police invalides) : une
  // correction peut s'y trouver. On le signale et on ne promet pas « aucun corrigé ».
  const unplaced = input.pages.some((p) =>
    p.textItems.some(
      (t) =>
        t.text.trim() !== '' &&
        ![t.bbox.x, t.bbox.y, t.bbox.width, t.bbox.height].every(Number.isFinite),
    ),
  )
  if (unplaced) {
    warnings.push(WARNINGS.unplaced)
    needsFallback = true
    if (kind === 'statement_only') kind = 'unknown'
  }

  // Rendu raster demandé mais en échec : cases noircies, couleurs et figures sont invisibles
  // au détecteur. Pas de masquage partiel trompeur : document entièrement couvert (repli).
  if (rasterFailed && kind !== 'unknown') {
    kind = 'unknown'
    needsFallback = true
    if (!warnings.includes(WARNINGS.noVisualCheck)) warnings.push(WARNINGS.noVisualCheck)
  }

  return { kind, blocks, warnings, needsFallback }
}

// --- Post-traitements -------------------------------------------------------------

/**
 * Tableau question / réponse : une colonne de réponses dont les lignes sont, pour la plupart,
 * exactement à la hauteur d'une question de la colonne voisine. Le bloc est découpé en un
 * bloc par question. Dans une mise en page en deux colonnes d'article, les lignes de
 * correction ne s'alignent que rarement sur des questions : la règle ne s'applique pas.
 */
function splitTableRows(
  drafts: Draft[],
  flow: Line[],
  statementQ: { index: number }[],
  labelAt: (string | undefined)[],
) {
  for (let k = drafts.length - 1; k >= 0; k--) {
    const d = drafts[k]!
    if (d.custom || d.inlineX !== undefined) continue
    const area = flow[d.start]!.area
    const indices = Array.from({ length: d.end - d.start + 1 }, (_, n) => d.start + n)
    if (indices.some((i) => flow[i]!.area.id !== area.id)) continue
    const [page, band] = area.id.split(':')
    const sibling = statementQ
      .map(({ index }) => index)
      .filter((index) => {
        const [p, b] = flow[index]!.area.id.split(':')
        return p === page && b === band && flow[index]!.area.id !== area.id
      })
    const alignedWith = (i: number) =>
      sibling.find((q) => Math.abs(flow[q]!.bbox.y - flow[i]!.bbox.y) < 0.3 * flow[i]!.fontSize)
    const aligned = indices.filter((i) => alignedWith(i) !== undefined)
    if (aligned.length < 2 || aligned.length < 0.5 * indices.length) continue
    // Un sous-bloc par question alignée ; les lignes avant la première vont avec elle.
    const parts: Draft[] = []
    for (const i of indices) {
      const q = alignedWith(i)
      if (q !== undefined || parts.length === 0) {
        parts.push({
          start: i,
          end: i,
          label: q !== undefined ? labelAt[q] : d.label,
          grouped: false,
          questionIndex: q,
        })
      } else {
        parts[parts.length - 1]!.end = i
      }
    }
    // Lignes de tête (« Réponse ») rattachées au premier vrai sous-bloc.
    if (parts.length > 1 && parts[0]!.questionIndex === undefined) {
      parts[1]!.start = parts[0]!.start
      parts.shift()
    }
    drafts.splice(k, 1, ...parts)
  }
}

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
    const bareTarget = p.c?.target?.rest.replace(/[\s:.\-–]/g, '').length === 0
    const header = p.c?.headerOnly === true || bareTarget
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
  drafts.push(...glyphBoxDrafts(flow, parsed, modeAt, labelAt))
  return drafts
}

/**
 * Cases de QCM dessinées avec une police de symboles : lignes consécutives commençant
 * toutes par un caractère isolé, à la même abscisse, avec exactement deux valeurs
 * (case cochée, case vide). Une liste numérotée (une valeur par ligne) ne passe pas.
 */
function glyphBoxDrafts(
  flow: Line[],
  parsed: Parsed[],
  modeAt: string[],
  labelAt: (string | undefined)[],
): Draft[] {
  const drafts: Draft[] = []
  const eligible = (k: number) =>
    modeAt[k] === 'statement' && parsed[k]!.glyph !== null && !parsed[k]!.option && !parsed[k]!.q
  let i = 0
  while (i < flow.length) {
    if (!eligible(i)) {
      i++
      continue
    }
    let j = i
    while (
      j + 1 < flow.length &&
      eligible(j + 1) &&
      Math.abs(flow[j + 1]!.bbox.x - flow[i]!.bbox.x) <= 2
    ) {
      j++
    }
    const run = Array.from({ length: j - i + 1 }, (_, k) => i + k)
    const values = new Set(run.map((k) => parsed[k]!.glyph))
    const symbolic = [...values].every((v) => !/[\p{L}\p{N}]/u.test(v!))
    if (values.size === 2 && (run.length >= 3 || symbolic)) {
      const regions = run.map((k) => {
        const line = flow[k]!
        const pad = 0.3 * line.fontSize
        const x0 = line.charX[0] ?? line.bbox.x
        const x1 = line.charX[1] ?? x0 + line.fontSize
        return region(
          line,
          x0 - pad,
          line.bbox.y - pad,
          x1 - x0 + 2 * pad,
          line.bbox.height + 2 * pad,
        )
      })
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
interface BoundedRegion {
  region: PageRegion
  /** Ligne visible juste en dessous qui limite la région (bas ajustable par les graphiques). */
  next?: Line
  /** Ligne visible juste au-dessus de la première région (haut ajustable par les cadres). */
  prev?: Line
}

function lineRegions(d: Draft, flow: Line[]): BoundedRegion[] {
  const regions: BoundedRegion[] = []
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
    const above = i === d.start && prev && prev.area.id === area.id ? prev : undefined
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
    const bounded = j === d.end && next && next.area.id === area.id ? next : undefined
    if (bounded) {
      const gap = next.bbox.y - bottomOf(last)
      y1 = gap >= 0 ? next.bbox.y - Math.min(pad, gap / 2) : bottomOf(last)
    } else {
      y1 = area.y1
    }
    // Garantie : la région couvre au moins les lignes du groupe, même si la zone calculée
    // par la mise en page est plus étroite (faux colonnage dû à des formules éclatées).
    let gx0 = area.x0
    let gx1 = area.x1
    for (let k = i; k <= j; k++) {
      y0 = Math.min(y0, flow[k]!.bbox.y)
      y1 = Math.max(y1, bottomOf(flow[k]!))
      gx0 = Math.min(gx0, flow[k]!.bbox.x)
      gx1 = Math.max(gx1, flow[k]!.bbox.x + flow[k]!.bbox.width)
    }
    if (i === d.start && d.inlineX !== undefined) {
      // Première ligne : seulement la partie à droite du marqueur.
      const x = Math.max(area.x0, d.inlineX - pad)
      regions.push({
        region: {
          pageIndex: first.pageIndex,
          bbox: { x, y: y0, width: area.x1 - x, height: (j > i ? bottomOf(first) : y1) - y0 },
        },
        next: j > i ? undefined : bounded,
        prev: above,
      })
      if (j > i) {
        regions.push({
          region: {
            pageIndex: first.pageIndex,
            bbox: {
              x: area.x0,
              y: bottomOf(first),
              width: area.x1 - area.x0,
              height: y1 - bottomOf(first),
            },
          },
          next: bounded,
        })
      }
    } else {
      regions.push({
        region: {
          pageIndex: first.pageIndex,
          bbox: { x: gx0, y: y0, width: gx1 - gx0, height: y1 - y0 },
        },
        next: bounded,
        prev: above,
      })
    }
    i = j + 1
  }
  return regions.filter((r) => r.region.bbox.width > 0 && r.region.bbox.height > 0)
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
  flow: Line[],
  layouts: PageLayout[],
  rasterOf: (pageIndex: number) => Promise<RasterData | null>,
): Promise<Ink[]> {
  const inks: Ink[] = []
  for (const line of flow) {
    const layout = layouts.find((l) => l.pageIndex === line.pageIndex)!
    const raster = await rasterOf(line.pageIndex)
    inks.push(raster ? inkOf(raster, layout.width, layout.height, line.bbox) : { kind: 'none' })
  }
  return inks
}

/**
 * Lignes répétées à l'identique (chiffres ignorés), au même endroit, en haut ou en bas d'au
 * moins deux pages et de 40 % des pages : en-têtes et pieds de page. Jamais un numéro de question.
 */
function runningHeaders(layouts: PageLayout[]): Set<Line> {
  const pages = layouts.filter((p) => p.lines.length > 0)
  const out = new Set<Line>()
  if (pages.length < 2) return out
  const groups = new Map<string, { line: Line; rel: number }[]>()
  for (const p of pages) {
    for (const line of p.lines) {
      const top = line.bbox.y / p.height
      const bottom = (line.bbox.y + line.bbox.height) / p.height
      if (top > 0.15 && bottom < 0.9) continue
      if (parseQuestion(line.text)) continue
      const key = fold(line.text).replace(/\d+/g, '#').replace(/\s+/g, ' ').trim()
      if (key.length === 0) continue
      const list = groups.get(key) ?? []
      list.push({ line, rel: top })
      groups.set(key, list)
    }
  }
  for (const list of groups.values()) {
    const distinctPages = new Set(list.map((e) => e.line.pageIndex)).size
    const rels = list.map((e) => e.rel)
    const sameSpot = Math.max(...rels) - Math.min(...rels) <= 0.02
    if (distinctPages >= 2 && distinctPages >= 0.4 * pages.length && sameSpot) {
      for (const e of list) out.add(e.line)
    }
  }
  return out
}

/** Blocs de cases de QCM (voir boxes.ts), regroupées par question et par session. */
async function boxDrafts(
  input: DetectionInput,
  flow: Line[],
  parsed: Parsed[],
  labelAt: (string | undefined)[],
  rasterOf: (pageIndex: number) => Promise<RasterData | null>,
): Promise<{ drafts: Draft[]; lines: Set<number> }> {
  const all: Box[] = []
  for (const page of input.pages) {
    if (!flow.some((l) => l.pageIndex === page.pageIndex)) continue
    const raster = await rasterOf(page.pageIndex)
    if (raster) all.push(...findBoxes(raster, page))
  }
  const kept = answerBoxes(all)
  if (kept.length === 0) return { drafts: [], lines: new Set() }

  // Ligne de chaque case : même hauteur (ou, à défaut, la ligne juste au-dessus).
  const lineOfBox = kept.map((box) => {
    const cy = box.bbox.y + box.bbox.height / 2
    let best = -1
    let bestScore = Infinity
    flow.forEach((l, i) => {
      if (l.pageIndex !== box.pageIndex) return
      const ly = l.bbox.y + l.bbox.height / 2
      const dy = Math.abs(ly - cy)
      if (dy > Math.max(l.bbox.height, box.bbox.height) * 0.75) return
      const dx = Math.max(
        0,
        l.bbox.x - (box.bbox.x + box.bbox.width),
        box.bbox.x - (l.bbox.x + l.bbox.width),
      )
      const score = dy + dx
      if (score < bestScore) {
        bestScore = score
        best = i
      }
    })
    if (best < 0) {
      flow.forEach((l, i) => {
        if (l.pageIndex !== box.pageIndex || l.bbox.y >= cy) return
        if (best < 0 || l.bbox.y > flow[best]!.bbox.y) best = i
      })
    }
    return best
  })
  const hosting = new Set(lineOfBox.filter((i) => i >= 0))

  // Emplacements de cases déduits du texte : la lettre d'une proposition reste extractible,
  // même sous une case noire. Une case que le raster n'a pas reconnue (contour trop pâle
  // selon le moteur de rendu) est ainsi masquée comme les autres, sans indice par élimination.
  const slots: { line: number; cx: number; cy: number }[] = []
  const letterAt = (line: Line, idx: number) => {
    const x0 = line.charX[idx] ?? line.bbox.x
    const next = line.charX[idx + 1] ?? x0 + 0.6 * line.fontSize
    return {
      cx: (x0 + Math.min(next, x0 + 0.8 * line.fontSize)) / 2,
      cy: line.bbox.y + line.bbox.height / 2,
    }
  }
  // 1. Suites verticales A, B, C… en début de ligne, dont une ligne au moins porte une case.
  const leading = (i: number) => /^([A-Z])(?=\s)/.exec(flow[i]!.text)?.[1]
  for (let i = 0; i < flow.length;) {
    if (!leading(i)) {
      i++
      continue
    }
    let j = i
    while (
      j + 1 < flow.length &&
      flow[j + 1]!.pageIndex === flow[i]!.pageIndex &&
      leading(j + 1)?.charCodeAt(0) === leading(j)!.charCodeAt(0) + 1
    ) {
      j++
    }
    let hostsBox = false
    for (let k = i; k <= j; k++) hostsBox ||= hosting.has(k)
    if (j > i && hostsBox)
      for (let k = i; k <= j; k++) slots.push({ line: k, ...letterAt(flow[k]!, 0) })
    i = j + 1
  }
  // 2. Lignes portant des cases (grilles, propositions horizontales) : lettres isolées qui
  //    forment la suite A, B, C… (une variable « X » ou « Y » ne prolonge pas la suite).
  for (const li of [...hosting]) {
    const line = flow[li]!
    let expected = 65
    for (const m of line.text.matchAll(/(?<=^|\s)([A-Z])(?=\s|$)/g)) {
      if (m[1]!.charCodeAt(0) !== expected) continue
      slots.push({ line: li, ...letterAt(line, m.index) })
      expected++
    }
  }
  for (const slot of slots) hosting.add(slot.line)

  // Instance de question de chaque ligne ; une ligne de grille « Question k : A B C »
  // (numéro et cases sur la même ligne) rejoint la question k de la session en cours.
  const instanceOf: number[] = []
  const lastByLabel = new Map<string, number>()
  let current = -1
  flow.forEach((_, i) => {
    const q = parsed[i]!.q
    if (q && q.kind !== 'letter') {
      const label = labelAt[i] ?? ''
      if (hosting.has(i) && lastByLabel.has(label)) current = lastByLabel.get(label)!
      else {
        current = i
        lastByLabel.set(label, i)
      }
    }
    instanceOf[i] = current
  })

  // Masques identiques : même carré pour toutes les cases, quel que soit leur état.
  // Taille commune par classe de taille (cases de taille voisine, à 1,5 point près) : une case
  // pleine et une case vide d'une même série reçoivent exactement le même carré.
  const sizeOf = (b: Box) => Math.max(b.bbox.width, b.bbox.height)
  const sideOf = (b: Box) =>
    Math.max(...kept.filter((o) => Math.abs(sizeOf(o) - sizeOf(b)) <= 1.5).map(sizeOf)) + 3
  const groups = new Map<number, PageRegion[]>()
  kept.forEach((box, k) => {
    const line = lineOfBox[k]!
    const instance = line >= 0 ? (instanceOf[line] ?? -1) : -1
    const cx = box.bbox.x + box.bbox.width / 2
    const cy = box.bbox.y + box.bbox.height / 2
    const side = sideOf(box)
    const list = groups.get(instance) ?? []
    list.push({
      pageIndex: box.pageIndex,
      bbox: { x: cx - side / 2, y: cy - side / 2, width: side, height: side },
    })
    groups.set(instance, list)
  })
  // Emplacements sans case reconnue : même carré que la case la plus proche de la page.
  for (const slot of slots) {
    const page = flow[slot.line]!.pageIndex
    const onPage = kept.filter((b) => b.pageIndex === page)
    if (onPage.length === 0) continue
    const dist = (b: Box) =>
      Math.hypot(b.bbox.x + b.bbox.width / 2 - slot.cx, b.bbox.y + b.bbox.height / 2 - slot.cy)
    const nearest = onPage.reduce((a, b) => (dist(b) < dist(a) ? b : a))
    const side = sideOf(nearest)
    if (dist(nearest) < side / 2) continue // case déjà reconnue
    // Recentrage sur la case dessinée (le centre de la ligne de texte peut être décalé).
    const raster = await rasterOf(page)
    const pageData = input.pages.find((pd) => pd.pageIndex === page)
    const located =
      raster && pageData ? locateSquare(raster, pageData, slot.cx, slot.cy, sizeOf(nearest)) : null
    const at = located ?? slot
    if (
      located &&
      kept.some(
        (b) =>
          b.pageIndex === page &&
          Math.hypot(b.bbox.x + b.bbox.width / 2 - at.cx, b.bbox.y + b.bbox.height / 2 - at.cy) <
            side / 2,
      )
    )
      continue
    const instance = instanceOf[slot.line] ?? -1
    const list = groups.get(instance) ?? []
    list.push({
      pageIndex: page,
      bbox: { x: at.cx - side / 2, y: at.cy - side / 2, width: side, height: side },
    })
    groups.set(instance, list)
  }
  const drafts: Draft[] = [...groups.entries()].map(([instance, regions]) => {
    const anchor = instance >= 0 ? instance : Math.max(0, lineOfBox[0]!)
    return { start: anchor, end: anchor, label: labelAt[anchor], grouped: false, custom: regions }
  })
  return { drafts, lines: hosting }
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
  eligible: Set<number> | null = null,
): Draft[] {
  const sizes = flow.map((l) => l.fontSize).sort((a, b) => a - b)
  const bodySize = sizes[Math.floor(sizes.length / 2)]!
  const isHeading = (i: number) => flow[i]!.fontSize > 1.2 * bodySize

  // Regroupement des lignes colorées par teinte proche.
  const clusters: { hue: number; lines: number[] }[] = []
  inks.forEach((ink, i) => {
    if (ink.kind !== 'color' || modeAt[i] !== 'statement' || isHeading(i)) return
    if (eligible && !eligible.has(i)) return
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

  // QCM : si la bonne option est colorée, toutes les options du groupe sont masquées,
  // sinon la forme du masque désignerait la bonne réponse.
  const isOption = (i: number) => parsed[i]?.option != null && parsed[i]!.q === null
  for (const i of [...answerLines]) {
    if (!isOption(i)) continue
    for (let k = i - 1; k >= 0 && isOption(k); k--) answerLines.add(k)
    for (let k = i + 1; k < flow.length && isOption(k); k++) answerLines.add(k)
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

/**
 * Lignes des unités (suite de lignes entre deux titres de section, sur une même page) qu'aucun
 * bloc n'explique : aucune ligne de l'unité n'est masquée, aucune case de QCM n'est sur la
 * page, et au moins une question de l'unité n'a de correction nulle part (son libellé n'est
 * celui d'aucun bloc ; une question corrigée en fin de document est donc expliquée).
 */
function unexplainedLines(
  flow: Line[],
  parsed: Parsed[],
  drafts: Draft[],
  labelAt: (string | undefined)[],
): Set<number> {
  const sectionOf: number[] = []
  let section = 0
  flow.forEach((_, i) => {
    const q = parsed[i]!.q
    if (q && (q.kind === 'part' || q.kind === 'exercise')) section++
    sectionOf.push(section)
  })
  const unit = (i: number) => `${sectionOf[i]}:${flow[i]!.pageIndex}`
  const explained = new Set<string>()
  const boxPages = new Set<number>()
  const answered = new Set<string>()
  for (const d of drafts) {
    // Une case de QCM répond à la question de sa page (déjà exclue) : seul un bloc de texte
    // corrige une question ailleurs (corrigé en fin de document).
    if (d.custom) for (const r of d.custom) boxPages.add(r.pageIndex)
    else {
      if (d.label) answered.add(d.label)
      for (let i = d.start; i <= d.end; i++) explained.add(unit(i))
    }
  }
  const open = new Set<string>()
  flow.forEach((line, i) => {
    const q = parsed[i]!.q
    if (!q || q.kind === 'part' || q.kind === 'exercise') return
    if (explained.has(unit(i)) || boxPages.has(line.pageIndex)) return
    const label = labelAt[i]
    if (!label || !answered.has(label)) open.add(unit(i))
  })
  const lines = new Set<number>()
  flow.forEach((_, i) => {
    if (open.has(unit(i))) lines.add(i)
  })
  return lines
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

/** Au moins deux mots et huit lettres : une phrase, pas un simple libellé. */
function isSentence(text: string): boolean {
  const words = text.split(/\s+/).filter((w) => /\p{L}/u.test(w))
  const letters = (text.match(/\p{L}/gu) ?? []).length
  return words.length >= 2 && letters >= 8
}

/** Au moins un mot de quatre lettres. */
function hasWord(text: string): boolean {
  return /\p{L}{4,}/u.test(text)
}

/** Borne une région à sa page ; renvoie [] si elle est vide, hors page ou non finie. */
function sanitize(
  r: PageRegion,
  page: { width: number; height: number } | undefined,
): PageRegion[] {
  const { x, y, width, height } = r.bbox
  if (!page || ![x, y, width, height].every(Number.isFinite)) return []
  const left = Math.max(0, x)
  const top = Math.max(0, y)
  const right = Math.min(page.width, x + width)
  const bottom = Math.min(page.height, y + height)
  if (right - left < 0.5 || bottom - top < 0.5) return []
  return [
    {
      pageIndex: r.pageIndex,
      bbox: { x: left, y: top, width: right - left, height: bottom - top },
    },
  ]
}

// --- Questions colorées servant d'ancres ------------------------------------------------

/**
 * Une teinte est l'encre des questions si elle porte la plupart des questions numérotées
 * (au moins 2 et 60 %) et presque uniquement des questions et leurs lignes de suite. Aucune
 * couleur n'est supposée a priori : le rôle est déduit de la numérotation et de la géométrie.
 * Chaque question (ligne numérotée et suite de même teinte) ouvre un bloc qui court jusqu'à
 * la question suivante, un intitulé d'exercice ou une ligne de séparation. Les données qui
 * précèdent la première question restent visibles.
 */
function questionInkDrafts(
  flow: Line[],
  parsed: Parsed[],
  inks: Ink[],
  labelAt: (string | undefined)[],
): { drafts: Draft[]; hue: number | null } {
  const isQuestion = (i: number) => {
    const q = parsed[i]!.q
    return q !== null && q.kind !== 'part' && q.kind !== 'exercise'
  }
  const hueOf = (i: number) => {
    const ink = inks[i]
    return ink && ink.kind === 'color' ? ink.hue : null
  }
  const questions = flow.map((_, i) => i).filter(isQuestion)
  if (questions.length < 2) return { drafts: [], hue: null }
  // Teinte majoritaire des questions numérotées.
  let best: { hue: number; count: number } | null = null
  for (const i of questions) {
    const h = hueOf(i)
    if (h === null) continue
    const count = questions.filter((k) => {
      const hk = hueOf(k)
      return hk !== null && hueDistance(hk, h) <= 20
    }).length
    if (!best || count > best.count) best = { hue: h, count }
  }
  if (!best || best.count < 2 || best.count < 0.6 * questions.length)
    return { drafts: [], hue: null }
  const inHue = (i: number) => {
    const h = hueOf(i)
    return h !== null && hueDistance(h, best!.hue) <= 20
  }
  // Presque toutes les lignes de cette teinte sont des questions ou leur suite immédiate.
  const hueLines = flow.map((_, i) => i).filter(inHue)
  const explained = hueLines.filter((i) => isQuestion(i) || (i > 0 && inHue(i - 1))).length
  if (explained < 0.9 * hueLines.length) return { drafts: [], hue: null }

  // Ligne de séparation décorative (« ***** °°° ***** », « ------ ») ; un symbole isolé
  // d'une formule (« √ », une accolade) n'en est pas une.
  const isSeparator = (i: number) => /^[\s*°·•_=~\-–—]{5,}$/u.test(flow[i]!.text)
  const isHeading = (i: number) => {
    const q = parsed[i]!.q
    return q !== null && (q.kind === 'part' || q.kind === 'exercise')
  }
  const drafts: Draft[] = []
  for (let k = 0; k < flow.length; k++) {
    if (!(isQuestion(k) && inHue(k))) continue
    // Fin de la question : lignes suivantes de la même teinte, jusqu'à la ligne qui clôt la
    // question par « ? » ; un intertitre coloré qui suit (« Comparaison de deux moyennes : »)
    // appartient à la correction. En cas de doute, masquer plutôt que laisser fuir.
    let i = k
    while (
      i + 1 < flow.length &&
      inHue(i + 1) &&
      !isQuestion(i + 1) &&
      !/\?\s*:?\s*$/u.test(flow[i]!.text)
    )
      i++
    const start = i + 1
    let end = start - 1
    for (let j = start; j < flow.length; j++) {
      if ((isQuestion(j) && inHue(j)) || isHeading(j) || isSeparator(j)) break
      end = j
    }
    if (end >= start) drafts.push({ start, end, label: labelAt[k], grouped: false })
    k = i
  }
  return drafts.length >= 2 ? { drafts, hue: best.hue } : { drafts: [], hue: null }
}

// --- Indices de corrigés non localisés ----------------------------------------------------

/** Tournures qui ouvrent typiquement une réponse rédigée (français et anglais). */
const ANSWER_CUE =
  /^(?:on a\b|donc\b|d['’]où\b|ainsi\b|par conséquent\b|la réponse\b|réponse\b|il suffit\b|c['’]est\b|therefore\b|hence\b|thus\b|we have\b|we get\b|the answer\b)/iu

/**
 * Vrai si le document annonce un corrigé (titre, en-tête ou pied de page, y compris les
 * lignes répétées retirées du flux) ou si des tournures de réponse suivent au moins deux
 * questions différentes (trois lignes au moins). Sert à refuser « sujet seul ».
 */
function correctionHint(layouts: PageLayout[], flow: Line[], parsed: Parsed[]): boolean {
  // Titre (avant la première question de la première page), en-tête ou pied de page.
  const firstQuestion = flow.findIndex((_, i) => parsed[i]!.q !== null)
  const titleZone = flow.slice(0, firstQuestion < 0 ? 5 : firstQuestion)
  const bands = layouts.flatMap((p) =>
    p.lines.filter((l) => l.bbox.y < 0.08 * p.height || l.bbox.y > 0.9 * p.height),
  )
  const announces = [...titleZone, ...bands].some((l) => isCorrectionTitle(l.text))
  if (announces) return true
  let span = -1
  let cues = 0
  const spans = new Set<number>()
  flow.forEach((line, i) => {
    if (parsed[i]!.q) {
      span = i
      return
    }
    if (span >= 0 && ANSWER_CUE.test(line.text.trim())) {
      cues++
      spans.add(span)
    }
  })
  return cues >= 3 && spans.size >= 2
}

/** Détecteur colorimétrique de Wael, avec la convention de couleur annoncée dans le document. */
function defaultColorAnalyzer(pages: PageData[]): ExternalColorAnalyzer {
  const convention = readColorConvention(pages)
  return (page, raster) => analyzeColorPage(page, raster, convention)
}

/**
 * Successeur hiérarchique : au premier composant différent, la valeur est la suivante
 * (1 → 2, b → c, ii → iii, a → b) et les composants suivants repartent au début (1, a, i).
 */
function isHierSuccessor(previous: string, value: string): boolean {
  const a = previous.split('.')
  const b = value.split('.')
  const k = b.findIndex((part, i) => part !== a[i])
  if (k < 0) return false
  if (a[k] === undefined || nextValue(a[k]!) !== b[k]) return false
  return b.slice(k + 1).every((part) => part === '1' || part === 'a' || part === 'i')
}

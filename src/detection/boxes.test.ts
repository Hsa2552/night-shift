// QCM corrigés par noircissement de cases dessinées : pages et rendus raster SYNTHÉTIQUES
// (rectangles peints dans un raster à l'échelle 1, aucun vrai PDF).

import { afterEach, describe, expect, it } from 'vitest'
import { answerBoxes, findBoxes } from './boxes.ts'
import type { DetectionResult, PageData, RasterData, Rect, TextItem } from './contract.ts'
import { A4, fakeItem, fakePage, fakeRaster } from './fixtures.ts'
import { detectCorrections } from './index.ts'
import { registerColorAnalyzer } from './fusion.ts'

const GREY: [number, number, number] = [170, 170, 170] // lettres et chiffres imprimés dans les cases

function paint(raster: RasterData, x0: number, y0: number, x1: number, y1: number, v = 0) {
  for (let y = Math.max(0, Math.round(y0)); y < Math.min(raster.height, Math.round(y1)); y++) {
    for (let x = Math.max(0, Math.round(x0)); x < Math.min(raster.width, Math.round(x1)); x++) {
      const i = (y * raster.width + x) * 4
      raster.rgba[i] = v
      raster.rgba[i + 1] = v
      raster.rgba[i + 2] = v
    }
  }
}

/** Case carrée : pleine (bonne réponse) ou contour de 1 pixel. */
function box(raster: RasterData, x: number, y: number, side: number, filled: boolean) {
  if (filled) return paint(raster, x, y, x + side, y + side)
  paint(raster, x, y, x + side, y + 1)
  paint(raster, x, y + side - 1, x + side, y + side)
  paint(raster, x, y, x + 1, y + side)
  paint(raster, x + side - 1, y, x + side, y + side)
}

interface Option {
  letter: string
  text: string
  correct: boolean
}

/** Construit une page de QCM : texte (TextItem) + rendu raster avec les cases. */
class QcmPage {
  items: TextItem[] = []
  shapes: { x: number; y: number; side: number; filled: boolean }[] = []
  y = 60
  readonly pageIndex: number
  readonly side: number
  constructor(pageIndex: number, side = 12) {
    this.pageIndex = pageIndex
    this.side = side
  }
  /** Lettre imprimée au centre de la case, à sa taille. */
  letter(l: string, x: number, y: number) {
    const size = this.side * 0.6
    this.items.push(fakeItem(l, x + (this.side - size * 0.5) / 2, y + (this.side - size) / 2, size))
  }
  text(text: string, x = 72, size = 11) {
    this.items.push(fakeItem(text, x, this.y, size))
    this.y += size * 1.6
  }
  /** Propositions verticales : case (avec sa lettre dedans) puis texte. */
  options(options: Option[]) {
    for (const o of options) {
      const top = this.y - (this.side - 11) / 2
      this.shapes.push({ x: 90, y: top, side: this.side, filled: o.correct })
      this.letter(o.letter, 90, top)
      this.items.push(fakeItem(o.text, 90 + this.side + 6, this.y))
      this.y += Math.max(16, this.side + 4)
    }
  }
  /** Propositions horizontales sur une seule ligne. */
  inline(options: Option[]) {
    let x = 90
    for (const o of options) {
      const top = this.y - (this.side - 11) / 2
      this.shapes.push({ x, y: top, side: this.side, filled: o.correct })
      this.letter(o.letter, x, top)
      this.items.push(fakeItem(o.text, x + this.side + 4, this.y))
      x += this.side + 4 + o.text.length * 5.5 + 20
    }
    this.y += 20
  }
  /** Ligne de grille récapitulative « Question k : A B C ». */
  gridRow(k: number, letters: string, correct: string) {
    this.items.push(fakeItem(`Question ${k} :`, 90, this.y))
    letters.split('').forEach((l, n) => {
      const x = 170 + n * 18
      this.shapes.push({ x, y: this.y - 1, side: 13, filled: correct.includes(l) })
      this.items.push(fakeItem(l, x + 4, this.y))
    })
    this.y += 17
  }
  /** Grille d'identification : 10 lignes de chiffres, cases vides (ou une case cochée). */
  idGrid(filledDigit?: number) {
    for (let d = 0; d < 10; d++) {
      for (let c = 0; c < 3; c++) {
        const x = 140 + c * 18
        this.shapes.push({ x, y: this.y, side: 12, filled: c === 0 && d === filledDigit })
        this.items.push(fakeItem(String(d), x + 3, this.y))
      }
      this.y += 17
    }
  }
  build(): { page: PageData; raster: RasterData } {
    const page: PageData = { pageIndex: this.pageIndex, ...A4, textItems: this.items }
    // Lettres et chiffres dans les cases en gris : ils ne doivent pas noircir une case vide.
    const inBox = (it: TextItem) =>
      it.text.length === 1 &&
      this.shapes.some(
        (s) => it.bbox.x >= s.x && it.bbox.x <= s.x + s.side && Math.abs(it.bbox.y - s.y) < s.side,
      )
    const raster = fakeRaster(page, (it) => (inBox(it) ? GREY : undefined))
    // Le texte d'une case pleine est dessous : on peint la case par-dessus.
    for (const s of this.shapes) box(raster, s.x, s.y, s.side, s.filled)
    return { page, raster }
  }
}

const correctAnswers: Record<number, string> = { 1: 'BD', 2: 'A', 3: 'C' }
const OPTS = (k: number, letters = 'ABCD'): Option[] =>
  letters.split('').map((l) => ({
    letter: l,
    text: `proposition ${l} de la question ${k}`,
    correct: correctAnswers[k]!.includes(l),
  }))

async function run(pages: { page: PageData; raster: RasterData }[], failRaster = false) {
  return detectCorrections({
    pages: pages.map((p) => p.page),
    getRaster: async (i) => {
      if (failRaster) throw new Error('rendu impossible')
      return pages[i]!.raster
    },
  })
}

const regions = (r: DetectionResult) => r.blocks.flatMap((b) => b.regions)
const inside = (rect: Rect, x: number, y: number) =>
  x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height

/** Examen type : en-tête « Correction » sur chaque page, 3 questions, grille d'identification, grille de réponses. */
function exam(pageOffset: number, session: string, side = 12) {
  const p1 = new QcmPage(pageOffset, side)
  p1.text('Correction', 268)
  p1.text(`QCM de statistique, session ${session}`)
  p1.text('Aucun document n’est autorisé. Il y a 3 questions.')
  for (const k of [1, 2]) {
    p1.text(`Question ${k} Que peut-on conclure dans la situation ${k} ?`)
    p1.options(OPTS(k))
  }
  const p2 = new QcmPage(pageOffset + 1, side)
  p2.text('Correction', 268)
  p2.text('Question 3 Quelle affirmation est exacte ?')
  p2.options(OPTS(3))
  p2.text('Identifiants :')
  p2.idGrid()
  p2.text('Réponses :')
  p2.text('Les cases doivent être noircies et non simplement cochées.')
  p2.gridRow(1, 'ABCD', correctAnswers[1]!)
  p2.gridRow(2, 'ABCD', correctAnswers[2]!)
  p2.gridRow(3, 'ABCD', correctAnswers[3]!)
  return [p1, p2]
}

describe('findBoxes et answerBoxes', () => {
  it('distingue cases pleines et vides, exclut la grille d’identification', () => {
    const [, p2] = exam(0, 'A')
    const { page, raster } = p2!.build()
    const all = findBoxes(raster, page)
    const kept = answerBoxes(all)
    // Page 2 : 4 propositions + 12 cases de grille = 16 cases de réponse ; 30 cases d'identification.
    expect(kept).toHaveLength(16)
    expect(kept.filter((b) => b.filled)).toHaveLength(1 + 4) // C, puis BD + A + C dans la grille
    expect(all.filter((b) => /\d/.test(b.char ?? ''))).toHaveLength(30)
  })

  it('aucune case pleine : pas un QCM corrigé', () => {
    const p = new QcmPage(0)
    p.text('Question 1 Que vaut 2 + 2 ?')
    p.options(OPTS(1).map((o) => ({ ...o, correct: false })))
    const { page, raster } = p.build()
    expect(answerBoxes(findBoxes(raster, page))).toEqual([])
  })
})

describe('QCM corrigé par noircissement de cases', () => {
  it('convention de type ENSAI : toutes les cases masquées à l’identique, textes visibles', async () => {
    const pages = exam(0, 'A').map((p) => p.build())
    const result = await run(pages)
    expect(result.kind).toBe('mixed')
    // Un bloc par question (propositions + ligne de la grille), plus éventuellement les consignes.
    const labels = result.blocks.map((b) => b.questionLabel).filter(Boolean)
    expect(labels).toEqual(['Question 1', 'Question 2', 'Question 3'])
    const q1 = result.blocks.find((b) => b.questionLabel === 'Question 1')!
    expect(q1.regions.map((r) => r.pageIndex).sort()).toEqual([0, 0, 0, 0, 1, 1, 1, 1])

    // Chaque case de réponse est couverte, pleine ou vide, par un carré de même taille.
    const masks = regions(result).filter((r) => r.bbox.width < 30)
    for (const { page, raster } of pages) {
      for (const b of answerBoxes(findBoxes(raster, page))) {
        const cx = b.bbox.x + b.bbox.width / 2
        const cy = b.bbox.y + b.bbox.height / 2
        expect(masks.some((m) => m.pageIndex === page.pageIndex && inside(m.bbox, cx, cy))).toBe(
          true,
        )
      }
    }
    const optionMasks = masks.filter((m) => m.bbox.x < 120)
    expect(new Set(optionMasks.map((m) => m.bbox.width.toFixed(2))).size).toBe(1)

    // Les textes des propositions et des énoncés restent visibles.
    for (const { page } of pages) {
      for (const it of page.textItems.filter((t) => t.text.length > 3)) {
        const mid = { x: it.bbox.x + it.bbox.width / 2, y: it.bbox.y + it.bbox.height / 2 }
        const hidden = regions(result).some(
          (m) =>
            m.pageIndex === page.pageIndex && m.bbox.width < 30 && inside(m.bbox, mid.x, mid.y),
        )
        expect(hidden, it.text).toBe(false)
      }
    }
    // La grille d'identification n'est pas masquée.
    const idDigit = pages[1]!.page.textItems.find((t) => t.text === '7')!
    expect(
      regions(result).some(
        (m) => m.pageIndex === 1 && inside(m.bbox, idDigit.bbox.x + 2, idDigit.bbox.y + 5),
      ),
    ).toBe(false)
  })

  it('deux examens successifs : les blocs ne mélangent pas les sessions', async () => {
    const pages = [...exam(0, 'matin'), ...exam(2, 'après-midi')].map((p) => p.build())
    const result = await run(pages)
    const byLabel = result.blocks.filter((b) => b.questionLabel === 'Question 1')
    expect(byLabel).toHaveLength(2)
    expect(new Set(byLabel[0]!.regions.map((r) => r.pageIndex))).toEqual(new Set([0, 1]))
    expect(new Set(byLabel[1]!.regions.map((r) => r.pageIndex))).toEqual(new Set([2, 3]))
  })

  it('propositions horizontales et cases plus petites (8 points)', async () => {
    const p = new QcmPage(0, 8)
    const short = (k: number) => OPTS(k).map((o) => ({ ...o, text: `valeur ${o.letter}` }))
    p.text('Question 1 Quelle est la bonne valeur ?')
    p.inline(short(1))
    p.text('Question 2 Et ici ?')
    p.inline(short(2))
    const result = await run([p.build()])
    expect(result.blocks.map((b) => b.questionLabel)).toEqual(['Question 1', 'Question 2'])
    expect(result.blocks[0]!.regions).toHaveLength(4)
    expect(new Set(regions(result).map((r) => r.bbox.width.toFixed(2))).size).toBe(1)
  })

  it('sujet vierge (cases toutes vides) : aucun masque de case', async () => {
    const p = new QcmPage(0)
    p.text('Question 1 Que vaut 2 + 2 ?')
    p.options(OPTS(1).map((o) => ({ ...o, correct: false })))
    p.text('Question 2 Que vaut 3 + 3 ?')
    p.options(OPTS(2).map((o) => ({ ...o, correct: false })))
    const result = await run([p.build()])
    expect(regions(result).filter((r) => r.bbox.width < 30)).toEqual([])
  })

  it('rendu raster en échec sur un QCM : document entièrement couvert (repli)', async () => {
    const pages = exam(0, 'A').map((p) => p.build())
    const result = await run(pages, true)
    expect(result.kind).toBe('unknown')
    expect(result.needsFallback).toBe(true)
  })
})

describe('document hybride : exercices rédigés corrigés en couleur + QCM à cases', () => {
  const RED: [number, number, number] = [210, 30, 30]
  const written = [
    'Exercice 1 : estimation',
    'On observe un échantillon de taille 50 de moyenne 12.',
    '1) Donner un estimateur sans biais de la moyenne.',
    'La moyenne empirique est sans biais, elle vaut 12.',
    'Son écart type estimé vaut 1,4 sur cet échantillon.',
    '2) Construire un intervalle de confiance à 95 %.',
    'On obtient l’intervalle [9,3 ; 14,7] par la loi normale.',
  ]
  const isAnswer = (t: string) => /^(La moyenne|Son écart|On obtient)/.test(t)

  afterEach(() => registerColorAnalyzer('default'))

  it.each([
    ['moteur seul', null],
    ['moteur et détecteur colorimétrique', 'default'],
  ] as const)(
    'réponses colorées de la partie rédigée masquées malgré les cases (%s)',
    async (_, analyzer) => {
      registerColorAnalyzer(analyzer)
      const page0 = fakePage(0, written)
      const pages = [
        { page: page0, raster: fakeRaster(page0, (it) => (isAnswer(it.text) ? RED : undefined)) },
        ...exam(1, 'A').map((p) => p.build()),
      ]
      const result = await run(pages)
      expect(result.kind).not.toBe('statement_only')
      const covered = (n: number) =>
        regions(result).some((r) => r.pageIndex === 0 && inside(r.bbox, 100, 72 + n * 16.5 + 5))
      // Réponses (3, 4, 6) masquées ; données et questions (1, 2, 5) visibles.
      expect([3, 4, 6].map(covered)).toEqual([true, true, true])
      expect([0, 1, 2, 5].map(covered)).toEqual([false, false, false, false])
      // Les blocs de QCM sont toujours présents (cases masquées sur les pages 2 et 3).
      const boxMasks = regions(result).filter((r) => r.pageIndex > 0 && r.bbox.width < 30)
      expect(new Set(boxMasks.map((r) => r.pageIndex))).toEqual(new Set([1, 2]))
    },
  )
})

describe('cohérence géométrique des groupes de cases', () => {
  it('case absente du raster au milieu d’une colonne régulière : masquée quand même', async () => {
    const p = new QcmPage(0)
    p.text('Correction', 268)
    p.text('Question 1 Quelle affirmation est exacte ?')
    p.options(OPTS(1).map((o) => ({ ...o, correct: o.letter === 'A' })))
    p.text('Question 2 Que peut-on conclure ?')
    p.options(OPTS(2))
    // Aucune lettre extractible dans les cases (pas de complétion par le texte).
    p.items = p.items.filter((it) => it.text.length > 1)
    const missing = p.shapes[2]! // proposition C de la question 1, case vide
    const built = p.build()
    // La case C n'est pas dessinée (contour trop pâle pour le moteur de rendu).
    paint(
      built.raster,
      missing.x - 1,
      missing.y - 1,
      missing.x + missing.side + 1,
      missing.y + missing.side + 1,
      255,
    )
    const result = await run([built])
    const cx = missing.x + missing.side / 2
    const cy = missing.y + missing.side / 2
    expect(regions(result).some((r) => r.pageIndex === 0 && inside(r.bbox, cx, cy))).toBe(true)
    // Même carré que les autres cases du groupe.
    const sides = new Set(
      regions(result)
        .filter((r) => r.bbox.width < 30)
        .map((r) => r.bbox.width.toFixed(1)),
    )
    expect(sides.size).toBe(1)
  })
})

describe('glyphes rendus comme des carrés (rendu des polices du navigateur) : pas des cases', () => {
  /** Texte extrait présent mais non peint : seules les formes carrées sont dans le raster. */
  const shapesOnly = (p: QcmPage) => {
    const page: PageData = { pageIndex: p.pageIndex, ...A4, textItems: p.items }
    const raster = fakeRaster(page, () => [255, 255, 255])
    for (const s of p.shapes) box(raster, s.x, s.y, s.side, s.filled)
    return { page, raster }
  }
  /** Carré peint sur le k-ième caractère d'un fragment (estimation proportionnelle). */
  const over = (item: TextItem, k: number, side: number, filled: boolean) => {
    const cw = item.bbox.width / item.text.length
    return {
      x: item.bbox.x + (k + 0.5) * cw - side / 2,
      y: item.bbox.y + item.bbox.height / 2 - side / 2,
      side,
      filled,
    }
  }

  it('lettres à l’intérieur des mots et puces : aucune case retenue', () => {
    const p = new QcmPage(0)
    p.text('Montrer que la fonction est continue sur cet intervalle.')
    p.text('•')
    p.text('Calculer la limite de la suite quand n tend vers l’infini.')
    const [l1, bullet, l2] = p.items
    // Formes plus grandes que le texte (rapport 1,3) : seule la règle « dans un mot » joue.
    p.shapes.push(over(l1!, 3, 14, true), over(l1!, 20, 14, false), over(l2!, 5, 14, true))
    p.shapes.push(over(l2!, 30, 14, false), over(bullet!, 0, 14, true))
    const { page, raster } = shapesOnly(p)
    const all = findBoxes(raster, page)
    expect(all.length).toBeGreaterThanOrEqual(4)
    expect(answerBoxes(all)).toEqual([])
  })

  it('lettre isolée de titre, pas plus grande que son texte : pas une case', () => {
    const p = new QcmPage(0)
    p.text('A', 72, 16)
    p.text('B', 72, 16)
    p.text('C', 72, 16)
    const items = [...p.items]
    p.shapes.push(
      over(items[0]!, 0, 14, true),
      over(items[1]!, 0, 14, false),
      over(items[2]!, 0, 14, false),
    )
    const { page, raster } = p.build()
    expect(answerBoxes(findBoxes(raster, page))).toEqual([])
  })

  it('formes isolées sans voisine alignée (symboles mathématiques) : pas un QCM', () => {
    const p = new QcmPage(0)
    // Lettres isolées petites (rapport > 1,1), dispersées : ni même rangée ni même colonne.
    const spots = [
      [80, 100, true],
      [300, 260, true],
      [150, 420, false],
      [420, 600, false],
    ] as const
    for (const [x, y, filled] of spots) {
      p.items.push(fakeItem('R', x + 3, y + 3, 6))
      p.shapes.push({ x, y, side: 12, filled })
    }
    const { page, raster } = shapesOnly(p)
    expect(findBoxes(raster, page).length).toBe(4)
    expect(answerBoxes(findBoxes(raster, page))).toEqual([])
  })
})

describe('lettre sombre imprimée dans une case vide (rendu des polices du navigateur)', () => {
  it('la case reste reconnue comme vide : le centre est jugé sur le contour seul', () => {
    const p = new QcmPage(0)
    p.text('Question 1 Quelle affirmation est exacte ?')
    p.options(OPTS(1))
    // Lettres peintes en noir (et non en gris) : elles remplissent le centre des cases vides.
    const page: PageData = { pageIndex: 0, ...A4, textItems: p.items }
    const raster = fakeRaster(page)
    for (const s of p.shapes) box(raster, s.x, s.y, s.side, s.filled)
    const found = findBoxes(raster, page)
    const empty = p.shapes.filter((s) => !s.filled)
    for (const s of empty) {
      const hit = found.find(
        (b) => Math.abs(b.bbox.x - s.x) < 2 && Math.abs(b.bbox.y - s.y) < 2 && !b.filled,
      )
      expect(hit).toBeDefined()
    }
  })
})

describe('cases natives (opérateurs du PDF, C1 v1.1) confirmées par le raster', () => {
  /** Rectangle vectoriel tracé (contour) d'une case, tel que l'observe la couche vectorielle. */
  const strokeRect = (
    pageIndex: number,
    s: { x: number; y: number; side: number; filled: boolean },
  ) => ({
    region: { pageIndex, bbox: { x: s.x, y: s.y, width: s.side, height: s.side } },
    operatorIndex: 0,
    fill: s.filled ? '#000000' : null,
    fillOpacity: s.filled ? 1 : 0,
    stroke: '#000000',
    strokeOpacity: 1,
    lineWidth: 0.5,
    visibility: 'paint-command' as const,
  })

  it('case vide au contour pâle, invisible pour findBoxes : masquée grâce aux opérateurs', async () => {
    const p = new QcmPage(0)
    p.text('Correction', 268)
    p.text('Question 1 Quelle affirmation est exacte ?')
    p.options(OPTS(1).map((o) => ({ ...o, correct: o.letter === 'B' })))
    p.text('Question 2 Que peut-on conclure ?')
    p.options(OPTS(2))
    p.items = p.items.filter((it) => it.text.length > 1) // pas de complétion par les lettres
    const pale = p.shapes[3]! // proposition D de la question 1, vide, en fin de colonne
    const { page, raster } = p.build()
    // Contour gris clair (luminance 230) : visible à l'œil, sous le seuil d'encre du raster.
    paint(raster, pale.x - 1, pale.y - 1, pale.x + pale.side + 1, pale.y + pale.side + 1, 255)
    for (const [x0, y0, x1, y1] of [
      [pale.x, pale.y, pale.x + pale.side, pale.y + 1],
      [pale.x, pale.y + pale.side - 1, pale.x + pale.side, pale.y + pale.side],
      [pale.x, pale.y, pale.x + 1, pale.y + pale.side],
      [pale.x + pale.side - 1, pale.y, pale.x + pale.side, pale.y + pale.side],
    ] as const)
      paint(raster, x0, y0, x1, y1, 230)
    const vectors = {
      pageIndex: 0,
      width: page.width,
      height: page.height,
      rectangles: p.shapes.map((s) => strokeRect(0, s)),
      textPaint: [],
      unresolvedPaths: 0,
      unsupportedPathEncoding: 0,
      images: 0,
    }
    const cx = pale.x + pale.side / 2
    const cy = pale.y + pale.side / 2
    const covered = (r: DetectionResult) =>
      regions(r).some((g) => g.pageIndex === 0 && inside(g.bbox, cx, cy))
    const rasterOnly = await detectCorrections({ pages: [page], getRaster: async () => raster })
    expect(covered(rasterOnly)).toBe(false) // la case pâle resterait visible (indice)
    const withVectors = await detectCorrections({
      pages: [page],
      getRaster: async () => raster,
      getVectors: async () => vectors as never,
    })
    expect(covered(withVectors)).toBe(true)
  })

  it('case native absente du rendu (masquée ou blanche) : ignorée', async () => {
    const p = new QcmPage(0)
    p.text('Question 1 Quelle affirmation est exacte ?')
    p.options(OPTS(1))
    const { page, raster } = p.build()
    const ghost = { x: 400, y: 600, side: 12, filled: false } // rien n'est peint à cet endroit
    const vectors = {
      pageIndex: 0,
      width: page.width,
      height: page.height,
      rectangles: [...p.shapes, ghost].map((s) => strokeRect(0, s)),
      textPaint: [],
      unresolvedPaths: 0,
      unsupportedPathEncoding: 0,
      images: 0,
    }
    const result = await detectCorrections({
      pages: [page],
      getRaster: async () => raster,
      getVectors: async () => vectors as never,
    })
    expect(regions(result).some((g) => inside(g.bbox, 406, 606))).toBe(false)
  })
})

describe('QCM marqués par des relations natives (coches, aplats)', () => {
  const vec = (page: PageData, extra: object) => ({
    pageIndex: 0,
    width: page.width,
    height: page.height,
    rectangles: [],
    textPaint: [],
    unresolvedPaths: 0,
    unsupportedPathEncoding: 0,
    images: 0,
    ...extra,
  })

  it('coche superposée à une case : réponse marquée, masques identiques pour toutes les cases', async () => {
    const p = new QcmPage(0)
    p.text('Question 1 Quelle affirmation est exacte ?')
    p.options(OPTS(1).map((o) => ({ ...o, correct: false }))) // le raster ne montre que des cases vides
    p.text('Question 2 Que peut-on conclure ?')
    p.options(OPTS(2).map((o) => ({ ...o, correct: false })))
    const { page, raster } = p.build()
    const ticked = [p.shapes[1]!, p.shapes[4]!] // B pour Q1, A pour Q2
    const glyphSymbols = ticked.map((s) => ({
      region: {
        pageIndex: 0,
        bbox: { x: s.x + 1, y: s.y - 2, width: s.side + 2, height: s.side + 3 },
      },
      kind: 'tick',
      visibility: 'paint-command',
    }))
    const markRelations = ticked.map((s, markIndex) => ({
      frame: {
        kind: 'drawn',
        region: { pageIndex: 0, bbox: { x: s.x, y: s.y, width: s.side, height: s.side } },
      },
      markIndex,
      kind: 'overlap',
      overlap: 0.8,
      distance: 0,
    }))
    const rasterOnly = await detectCorrections({ pages: [page], getRaster: async () => raster })
    expect(rasterOnly.blocks).toEqual([]) // aucune case pleine : pas un QCM corrigé
    const result = await detectCorrections({
      pages: [page],
      getRaster: async () => raster,
      getVectors: async () => vec(page, { glyphSymbols, markRelations }) as never,
    })
    // Chaque case reçoit le même profil de masque (carré + gabarit de coche), quel que soit l'état.
    const profile = (s: { x: number; y: number; side: number }) =>
      regions(result)
        .filter((g) => inside(g.bbox, s.x + s.side / 2, s.y + s.side / 2))
        .map((g) =>
          // Arrondi au point (le benchmark quantifie à 2 points) : l'arrondi aux pixels du rendu
          // décale certaines rangées de quelques dixièmes, indépendamment de l'état de la case.
          [g.bbox.x - s.x, g.bbox.y - s.y, g.bbox.width, g.bbox.height]
            .map((v) => Math.round(v))
            .join(','),
        )
        .sort()
        .join(';')
    // Un seul profil par question (4 propositions), case cochée comprise.
    for (const group of [p.shapes.slice(0, 4), p.shapes.slice(4, 8)]) {
      const profiles = new Set(group.map(profile))
      expect(profiles.size).toBe(1)
      expect([...profiles][0]!.split(';').length).toBe(2) // carré + gabarit de la coche
    }
  })

  it('aplat derrière la proposition marquée : masqué hors des lignes de texte, propositions lisibles', async () => {
    const p = new QcmPage(0)
    p.text('Question 1 Quelle affirmation est exacte ?')
    p.options(OPTS(1).map((o) => ({ ...o, correct: false })))
    const { page, raster } = p.build()
    const marked = p.shapes[2]!
    const fill = { x: marked.x - 2, y: marked.y - 3, width: 300, height: marked.side + 6 }
    const backgroundRelations = [
      {
        frame: {
          kind: 'drawn',
          region: {
            pageIndex: 0,
            bbox: { x: marked.x, y: marked.y, width: marked.side, height: marked.side },
          },
        },
        region: { pageIndex: 0, bbox: fill },
        operatorIndex: 0,
        rgb: [217, 234, 211],
      },
    ]
    const result = await detectCorrections({
      pages: [page],
      getRaster: async () => raster,
      getVectors: async () => vec(page, { backgroundRelations }) as never,
    })
    // L'aplat est couvert au-dessus de la ligne de la proposition, pour toutes les propositions.
    for (const s of p.shapes) {
      expect(regions(result).some((g) => inside(g.bbox, s.x + 150, s.y - 2))).toBe(true)
    }
    // Le texte des propositions reste lisible.
    const optionText = page.textItems.filter((t) => t.text.startsWith('proposition'))
    for (const t of optionText) {
      expect(
        regions(result).some((g) => inside(g.bbox, t.bbox.x + 60, t.bbox.y + t.bbox.height / 2)),
      ).toBe(false)
    }
  })
})

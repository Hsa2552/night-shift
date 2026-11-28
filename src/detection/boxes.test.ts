// QCM corrigés par noircissement de cases dessinées : pages et rendus raster SYNTHÉTIQUES
// (rectangles peints dans un raster à l'échelle 1, aucun vrai PDF).

import { describe, expect, it } from 'vitest'
import { answerBoxes, findBoxes } from './boxes.ts'
import type { DetectionResult, PageData, RasterData, Rect, TextItem } from './contract.ts'
import { A4, fakeItem, fakeRaster } from './fixtures.ts'
import { detectCorrections } from './index.ts'

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

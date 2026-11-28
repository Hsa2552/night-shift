// Analyse par couleur sur rendus raster SYNTHÉTIQUES (rectangles pleins, pas de vrai PDF).

import { describe, expect, it } from 'vitest'
import { hueDistance, inkOf } from './color.ts'
import type { PageData } from './contract.ts'
import { fakePage, fakeRaster, type RGB } from './fixtures.ts'
import { detectCorrections, WARNINGS } from './index.ts'

const BLUE: RGB = [30, 50, 200]
const RED: RGB = [200, 30, 30]

/** Colorie les lignes dont le texte commence par l'un des préfixes. */
const paint =
  (color: RGB, ...prefixes: string[]) =>
  (item: { text: string }) =>
    prefixes.some((p) => item.text.startsWith(p)) ? color : undefined

const withRaster = (page: PageData, colorOf: ReturnType<typeof paint>) =>
  detectCorrections({ pages: [page], getRaster: async () => fakeRaster(page, colorOf) })

describe('inkOf', () => {
  const page = fakePage(0, ['Texte noir', 'Texte bleu'])
  const raster = fakeRaster(page, paint(BLUE, 'Texte bleu'))
  const [black, blue] = page.textItems

  it('distingue encre sombre, encre colorée et absence d’encre', () => {
    expect(inkOf(raster, page.width, page.height, black!.bbox)).toEqual({ kind: 'dark' })
    const ink = inkOf(raster, page.width, page.height, blue!.bbox)
    expect(ink.kind).toBe('color')
    expect(ink.kind === 'color' && hueDistance(ink.hue, 232)).toBeLessThan(10)
    expect(
      inkOf(raster, page.width, page.height, { x: 300, y: 500, width: 50, height: 10 }),
    ).toEqual({
      kind: 'none',
    })
  })

  it('hueDistance est circulaire', () => {
    expect(hueDistance(350, 10)).toBe(20)
  })
})

describe('détection par couleur', () => {
  const lines = [
    'Exercice 1',
    '1. Montrer que la suite u est croissante.',
    'u(n+1) - u(n) > 0 donc u est croissante.',
    'Le résultat vaut pour tout n.',
    '2. Montrer que u est majorée.',
    'On a u(n) < 2 par récurrence.',
    '3. Conclure.',
  ]
  const page = fakePage(0, lines)

  it('corrigés en bleu sans marqueur : masqués, questions visibles, avertissement', async () => {
    const result = await withRaster(page, paint(BLUE, 'u(n+1)', 'Le résultat', 'On a'))
    expect(result.kind).toBe('mixed')
    expect(result.warnings).toContain(WARNINGS.color)
    expect(result.blocks.map((b) => b.questionLabel)).toEqual([
      'Exercice 1, question 1',
      'Exercice 1, question 2',
    ])
    const [b1, b2] = result.blocks
    // Bloc 1 : lignes 2 et 3 ; bloc 2 : ligne 5. Les questions restent hors des masques.
    const top = (n: number) => 72 + n * 16.5
    expect(b1!.regions[0]!.bbox.y).toBeLessThanOrEqual(top(2))
    expect(b1!.regions[0]!.bbox.y).toBeGreaterThanOrEqual(top(1) + 11)
    expect(b1!.regions[0]!.bbox.y + b1!.regions[0]!.bbox.height).toBeLessThanOrEqual(top(4))
    expect(b2!.regions[0]!.bbox.y + b2!.regions[0]!.bbox.height).toBeLessThanOrEqual(top(6))
  })

  it('QCM à bonne option colorée : toutes les options du groupe sont masquées', async () => {
    const qcm = fakePage(0, [
      'Question 1 : Capitale de la France ?',
      'A. Lyon',
      'B. Paris',
      'C. Marseille',
      'Question 2 : Combien font 2 + 2 ?',
      'A. 3',
      'B. 4',
      'C. 5',
    ])
    const green: RGB = [20, 150, 40]
    const result = await withRaster(qcm, paint(green, 'B. Paris', 'B. 4'))
    expect(result.kind).toBe('mixed')
    expect(result.blocks).toHaveLength(2)
    const top = (n: number) => 72 + n * 16.5
    const [b1, b2] = result.blocks.map((b) => b.regions[0]!.bbox)
    // Bloc 1 : lignes 1 à 3 (A, B, C), la question 1 reste visible.
    expect(b1!.y).toBeLessThanOrEqual(top(1))
    expect(b1!.y).toBeGreaterThanOrEqual(top(0) + 11)
    expect(b1!.y + b1!.height).toBeGreaterThanOrEqual(top(3) + 11)
    expect(b1!.y + b1!.height).toBeLessThanOrEqual(top(4))
    expect(b2!.y).toBeLessThanOrEqual(top(5))
    expect(b2!.y + b2!.height).toBeGreaterThanOrEqual(top(7) + 11)
  })

  it('titres colorés (questions en couleur) : pas pris pour des corrigés', async () => {
    const result = await withRaster(page, paint(RED, 'Exercice', '1.', '2.', '3.'))
    expect(result.kind).toBe('statement_only')
    expect(result.blocks).toEqual([])
  })

  it('une seule ligne colorée hors question : pas de masque, mais abstention', async () => {
    // Une ligne seule ne suffit pas à masquer ; le détecteur visuel la signale comme correction
    // plausible non localisée : on n'affirme pas « aucun corrigé » (document couvert).
    const result = await withRaster(page, paint(BLUE, 'On a'))
    expect(result.blocks).toEqual([])
    expect(result.kind).toBe('unknown')
    expect(result.needsFallback).toBe(true)
  })

  it('un échec du rendu raster : pas de promesse « aucun corrigé », repli', async () => {
    const result = await detectCorrections({
      pages: [page],
      getRaster: async () => {
        throw new Error('rendu impossible')
      },
    })
    expect(result.kind).toBe('unknown')
    expect(result.needsFallback).toBe(true)
    expect(result.warnings).toContain(WARNINGS.noVisualCheck)
  })

  it('les marqueurs textuels restent prioritaires : pas d’analyse de couleur', async () => {
    const marked = fakePage(0, ['1. Calculer 2 + 2.', 'Correction : 4.', '2. Calculer 3 + 3.'])
    let calls = 0
    const result = await detectCorrections({
      pages: [marked],
      getRaster: async () => {
        calls++
        return fakeRaster(marked)
      },
    })
    expect(result.kind).toBe('mixed')
    expect(result.warnings).not.toContain(WARNINGS.color)
    // Rendu demandé au plus une fois par page (vérification des graphiques).
    expect(calls).toBeLessThanOrEqual(1)
  })
})

describe('questions colorées servant d’ancres (couleur des questions, corrections neutres)', () => {
  const GREEN: RGB = [20, 140, 60]
  const ex = [
    'Exercice 1 : probabilités',
    'Données : P(A) = 0,3 et P(B) = 0,5.',
    '1) Calculer la probabilité de A ou B',
    'lorsque A et B sont indépendants :',
    'P(A ∪ B) = 0,3 + 0,5 − 0,15 = 0,65.',
    '2) Calculer la probabilité de A sachant B :',
    'P(A/B) = P(A) = 0,3 par indépendance.',
    'On vérifie que la somme vaut 1.',
  ]
  const isQuestion = (t: string) => /^\d\)|^lorsque/.test(t)

  it('un bloc par question, données et questions visibles, ancres de n’importe quelle teinte', async () => {
    const page = fakePage(0, ex)
    const result = await withRaster(page, (item) => (isQuestion(item.text) ? GREEN : undefined))
    expect(result.kind).toBe('mixed')
    expect(result.blocks.map((b) => b.questionLabel)).toEqual([
      'Exercice 1, question 1',
      'Exercice 1, question 2',
    ])
    const top = (n: number) => 72 + n * 16.5
    const covered = (n: number) =>
      result.blocks.some((b) =>
        b.regions.some((r) => r.bbox.y <= top(n) + 2 && r.bbox.y + r.bbox.height >= top(n) + 9),
      )
    expect([0, 1, 2, 3, 5].map(covered)).toEqual([false, false, false, false, false])
    expect([4, 6, 7].map(covered)).toEqual([true, true, true])
  })

  it('correction sur deux pages : un seul bloc, deux régions', async () => {
    const p0 = fakePage(0, ['Exercice 1', '1) Démontrer le résultat :', 'Première étape.'])
    const p1 = fakePage(1, ['Deuxième étape.', '2) Conclure :', 'Conclusion.'])
    const paintQ = (item: { text: string }) => (/^\d\)/.test(item.text) ? GREEN : undefined)
    const rasters = [fakeRaster(p0, paintQ), fakeRaster(p1, paintQ)]
    const result = await detectCorrections({
      pages: [p0, p1],
      getRaster: async (i) => rasters[i]!,
    })
    const q1 = result.blocks.find((b) => b.questionLabel === 'Exercice 1, question 1')!
    expect(new Set(q1.regions.map((r) => r.pageIndex))).toEqual(new Set([0, 1]))
    expect(result.blocks).toHaveLength(2)
  })

  it('seuls les titres d’exercice sont colorés : pas d’ancres', async () => {
    const page = fakePage(0, ex)
    const result = await withRaster(page, (item) =>
      /^Exercice/.test(item.text) ? GREEN : undefined,
    )
    expect(result.warnings).not.toContain(WARNINGS.questionInk)
  })

  it('convention inverse (corrections colorées) : traitée par la couleur des corrections', async () => {
    const page = fakePage(0, ex)
    const answers = (t: string) => /^(P\(|On vérifie)/.test(t)
    const result = await withRaster(page, (item) => (answers(item.text) ? GREEN : undefined))
    expect(result.warnings).not.toContain(WARNINGS.questionInk)
    expect(result.warnings).toContain(WARNINGS.color)
  })
})

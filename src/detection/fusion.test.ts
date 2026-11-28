// Fusion avec un détecteur colorimétrique externe SIMULÉ (même forme que analyzeColorPage).

import { afterEach, describe, expect, it } from 'vitest'
import type { PageData, Rect } from './contract.ts'
import { fakePage, fakeRaster, type RGB } from './fixtures.ts'
import { registerColorAnalyzer, type ExternalColorResult } from './fusion.ts'
import { detectCorrections, WARNINGS } from './index.ts'

afterEach(() => registerColorAnalyzer('default'))

const top = (n: number) => 72 + n * 16.5
const lineRect = (n: number): Rect => ({ x: 72, y: top(n), width: 300, height: 11 })

/** Analyseur simulé : renvoie les blocs et candidats donnés, pour toutes les pages. */
function fakeAnalyzer(result: ExternalColorResult) {
  registerColorAnalyzer(() => result)
}

const supported = (n: number, hue: number) => ({
  region: { pageIndex: 0, bbox: lineRect(n) },
  hue,
  evidence: 'supported' as const,
})

const covered = (blocks: { regions: { pageIndex: number; bbox: Rect }[] }[], n: number) =>
  blocks.some((b) =>
    b.regions.some((r) => r.bbox.y <= top(n) + 2 && r.bbox.y + r.bbox.height >= top(n) + 9),
  )

async function run(page: PageData, colorOf?: (item: { text: string }) => RGB | undefined) {
  return detectCorrections({ pages: [page], getRaster: async () => fakeRaster(page, colorOf) })
}

describe('fusion avec le détecteur colorimétrique externe', () => {
  const lines = [
    '1. Calculer la dérivée de f.',
    'f′(x) vaut deux fois x.',
    '2. Calculer la primitive de f.',
    'Une primitive est x au cube sur trois.',
  ]

  it('ajoute une correction appuyée que le moteur n’avait pas vue', async () => {
    fakeAnalyzer({
      candidates: [supported(1, 0), supported(3, 0)],
      blocks: [{ id: 'visual-color-0-0', regions: [{ pageIndex: 0, bbox: lineRect(1) }] }],
      needsFallback: false,
    })
    const result = await run(fakePage(0, lines))
    expect(result.warnings).toContain(WARNINGS.externalColor)
    expect(covered(result.blocks, 1)).toBe(true)
    expect(result.kind).toBe('mixed')
  })

  it('rejette une région externe qui recouvre une question numérotée', async () => {
    fakeAnalyzer({
      candidates: [supported(0, 0)],
      blocks: [{ id: 'visual-color-0-0', regions: [{ pageIndex: 0, bbox: lineRect(0) }] }],
      needsFallback: false,
    })
    const result = await run(fakePage(0, lines))
    expect(covered(result.blocks, 0)).toBe(false)
  })

  it('ignore un candidat ambigu', async () => {
    fakeAnalyzer({
      candidates: [{ ...supported(1, 0), evidence: 'ambiguous' }],
      blocks: [{ id: 'visual-color-0-0', regions: [{ pageIndex: 0, bbox: lineRect(1) }] }],
      needsFallback: false,
    })
    const result = await run(fakePage(0, lines))
    expect(covered(result.blocks, 1)).toBe(false)
  })

  it('écarte la teinte des questions colorées (ancres)', async () => {
    const BLUE: RGB = [30, 60, 200]
    const page = fakePage(0, ['Exercice 1', ...lines])
    // Le détecteur externe propose la question bleue 2 comme « correction » bleue.
    fakeAnalyzer({
      candidates: [
        { region: { pageIndex: 0, bbox: lineRect(3) }, hue: 232, evidence: 'supported' },
      ],
      blocks: [{ id: 'visual-color-0-0', regions: [{ pageIndex: 0, bbox: lineRect(3) }] }],
      needsFallback: false,
    })
    const result = await run(page, (item) => (/^\d\./.test(item.text) ? BLUE : undefined))
    expect(result.warnings).toContain(WARNINGS.questionInk)
    expect(covered(result.blocks, 3)).toBe(false)
    expect(covered(result.blocks, 2)).toBe(true)
    expect(covered(result.blocks, 4)).toBe(true)
  })

  it('repli externe : pas de « aucun corrigé »', async () => {
    fakeAnalyzer({ candidates: [], blocks: [], needsFallback: true })
    const result = await run(
      fakePage(0, ['1. Calculer f(1).', '2. Calculer f(2).', '3. Calculer f(3).']),
    )
    expect(result.kind).toBe('unknown')
    expect(result.needsFallback).toBe(true)
  })
})

describe('contrôle final de cohérence (document déjà « mixte »)', () => {
  // Exercice 1 corrigé par marqueur ; exercice 2 : une réponse en couleur que le moteur ne
  // localise pas (une seule ligne), signalée ambiguë par le détecteur externe.
  const lines = [
    'Exercice 1',
    '1. Calculer la dérivée de f.',
    'Correction : f′(x) vaut deux fois x.',
    'Exercice 2',
    '1. Donner la limite de g en zéro.',
    'La limite de g en zéro vaut un.',
  ]
  const ambiguous = (n: number) => ({
    region: { pageIndex: 0, bbox: lineRect(n) },
    hue: 0,
    evidence: 'ambiguous' as const,
  })

  it('encre ambiguë inexpliquée : document couvert, même s’il est mixte', async () => {
    fakeAnalyzer({ candidates: [ambiguous(5)], blocks: [], needsFallback: true })
    const result = await run(fakePage(0, lines))
    expect(result.kind).toBe('unknown')
    expect(result.needsFallback).toBe(true)
    expect(result.warnings.some((w) => w.startsWith('Encre colorée inexpliquée'))).toBe(true)
  })

  it('encre ambiguë déjà couverte par un masque du moteur : indices convergents, pas de repli', async () => {
    fakeAnalyzer({ candidates: [ambiguous(2)], blocks: [], needsFallback: true })
    const result = await run(fakePage(0, lines))
    expect(result.kind).toBe('mixed')
    expect(result.needsFallback).toBe(false)
  })

  it('logo répété au même endroit sur deux pages, ou placé avant les questions : pas de repli', async () => {
    const logo = (pageIndex: number) => ({
      region: { pageIndex, bbox: { x: 480, y: 40, width: 60, height: 20 } },
      hue: 200,
      evidence: 'ambiguous' as const,
    })
    registerColorAnalyzer((page) => ({
      candidates: [logo(page.pageIndex)],
      blocks: [],
      needsFallback: true,
    }))
    const pages = [fakePage(0, lines), fakePage(1, ['2. Montrer que g est continue.'])]
    const result = await detectCorrections({
      pages,
      getRaster: async (i) => fakeRaster(pages[i]!),
    })
    expect(result.kind).toBe('mixed')
    expect(result.needsFallback).toBe(false)
  })
})

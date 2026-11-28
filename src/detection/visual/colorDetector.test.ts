import { describe, expect, it } from 'vitest'
import type { PageData } from '../../shared/types'
import { analyzeColorPage, readColorConvention } from './index'
import { syntheticRaster } from './testRaster'

const red = [206, 20, 38]
const orangeRed = [198, 39, 20]
const width = 320
const height = 400

function fixture(scale = 1) {
  const { raster, text, fill } = syntheticRaster(width, height, scale)
  const page: PageData = { pageIndex: 1, width, height, textItems: [] }
  return { raster, page, text, fill }
}

describe('visual color detector', () => {
  it.each([1, 2])('covers aligned red lines and raster-only ink at scale %d', (scale) => {
    const { raster, page, text, fill } = fixture(scale)
    page.textItems = [
      text('1. Calculer le coefficient.', 30, 70),
      text('Le coefficient vaut', 30, 90, red),
      text('On vérifie le résultat.', 31, 106, orangeRed),
      text('2. Question suivante ?', 30, 160),
    ]
    fill(38, 125, 64, 2, red)
    fill(66, 129, 16, 3, orangeRed)

    const result = analyzeColorPage(page, raster)
    expect(result.needsFallback).toBe(false)
    expect(result.blocks).toHaveLength(1)
    expect(result.candidates).toHaveLength(3)
    expect(result.candidates.at(-1)).toMatchObject({ ink: 'graphic', evidence: 'supported' })
    for (const { bbox, pageIndex } of result.blocks[0].regions) {
      expect(pageIndex).toBe(1)
      expect(bbox.x).toBeGreaterThanOrEqual(28)
      expect(bbox.x).toBeLessThan(40)
      expect(bbox.y).toBeGreaterThan(80)
      expect(bbox.y + bbox.height).toBeLessThan(160)
    }
  })

  it('separates a color measurement from the role of a title or decorative chart', () => {
    const { raster, page, text, fill } = fixture()
    page.textItems = [
      text('Statistiques', 40, 30, red),
      text('Décrire le diagramme ?', 30, 98),
      text('Échantillon mensuel', 30, 275),
    ]
    page.textItems[0].bbox.height = 22
    fill(58, 137, 104, 94, red)
    const result = analyzeColorPage(page, raster)
    expect(result.candidates).toHaveLength(2)
    expect(result.candidates.every(({ evidence }) => evidence === 'ambiguous')).toBe(true)
    expect(result.blocks).toEqual([])
    expect(result.needsFallback).toBe(false)
  })

  it('leaves an unclassified colored paragraph to progressive reading', () => {
    const { raster, page, text } = fixture()
    page.textItems = [
      text('Texte principal.', 20, 40),
      text('Une variante de procédure.', 20, 60),
      text('Une première annotation.', 20, 140, red),
      text('Puis une deuxième ligne.', 20, 155, red),
    ]
    const result = analyzeColorPage(page, raster)
    expect(result).toMatchObject({ needsFallback: true, blocks: [] })
    expect(result.candidates).toHaveLength(2)
  })

  it('uses an explicitly declared convention across pages while keeping the legend visible', () => {
    const cover = fixture()
    cover.page.textItems = [
      cover.text('Solutions are in', 20, 40),
      cover.text('red.', 105, 40, red),
    ]
    const { raster, page, text, fill } = fixture()
    page.textItems = [text('Solution retenue', 60, 280, red)]
    fill(62, 300, 40, 2, red)
    const convention = readColorConvention([cover.page, page])
    expect(convention).toEqual({ hue: 0 })
    expect(analyzeColorPage(cover.page, cover.raster).candidates).toEqual([])
    expect(analyzeColorPage(page, raster).blocks).toEqual([])
    expect(analyzeColorPage(page, raster, convention).blocks[0]?.regions).toHaveLength(2)
  })

  it('does not infer a global convention from conflicting declarations', () => {
    const { page, text } = fixture()
    page.textItems = [
      text('Les réponses sont en rouge.', 20, 40),
      text('Answers are in blue.', 20, 60),
    ]
    expect(readColorConvention([page])).toBeUndefined()
  })

  it('returns no evidence on a black-and-white raster and flags malformed input', () => {
    const { raster, page, fill } = fixture()
    fill(20, 40, 100, 18)
    expect(analyzeColorPage(page, raster)).toEqual({
      candidates: [],
      blocks: [],
      needsFallback: false,
    })
    expect(analyzeColorPage(page, { ...raster, width: 2 })).toEqual({
      candidates: [],
      blocks: [],
      needsFallback: true,
    })
  })
})

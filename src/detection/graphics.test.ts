// Figures et traits sur rendus raster SYNTHÉTIQUES (pas de vrai PDF).

import { describe, expect, it } from 'vitest'
import type { PageData, RasterData } from './contract.ts'
import { fakePage, fakeRaster } from './fixtures.ts'
import { buildPageInk, graphicBottom, graphicTop } from './graphics.ts'
import { detectCorrections } from './index.ts'

/** Dessine le contour d'un rectangle noir (épaisseur 1 pixel) dans un raster à l'échelle 1. */
function strokeRect(raster: RasterData, x: number, y: number, w: number, h: number) {
  const set = (px: number, py: number) => {
    const i = (py * raster.width + px) * 4
    raster.rgba[i] = 0
    raster.rgba[i + 1] = 0
    raster.rgba[i + 2] = 0
  }
  for (let px = x; px <= x + w; px++) {
    set(px, y)
    set(px, y + h)
  }
  for (let py = y; py <= y + h; py++) {
    set(x, py)
    set(x + w, py)
  }
}

const LINE = 16.5
const top = (n: number) => 72 + n * LINE

describe('graphicBottom', () => {
  const page: PageData = fakePage(0, ['Texte'])

  it('suit une figure qui traverse la limite jusqu’à son bord inférieur', () => {
    const raster = fakeRaster(page)
    strokeRect(raster, 100, 200, 150, 60) // bord inférieur à y = 260
    const ink = buildPageInk(raster, page)
    const bottom = graphicBottom(ink, { x: 0, y: 150, width: 595, height: 100 }, 400)
    expect(bottom).toBeGreaterThanOrEqual(261)
    expect(bottom).toBeLessThan(263)
  })

  it('ne bouge pas sans graphique qui traverse la limite', () => {
    const raster = fakeRaster(page)
    strokeRect(raster, 100, 300, 150, 60) // entièrement sous la limite
    const ink = buildPageInk(raster, page)
    expect(graphicBottom(ink, { x: 0, y: 150, width: 595, height: 100 }, 400)).toBe(250)
  })

  it('respecte la limite imposée', () => {
    const raster = fakeRaster(page)
    strokeRect(raster, 100, 200, 150, 300)
    const ink = buildPageInk(raster, page)
    const bottom = graphicBottom(ink, { x: 0, y: 150, width: 595, height: 100 }, 280)
    expect(bottom).toBeLessThanOrEqual(281.5)
  })
})

describe('graphicTop', () => {
  const page: PageData = fakePage(0, ['Texte'])
  const box = { x: 0, y: 200, width: 595, height: 100 }

  it('cadre qui entoure la correction et dépasse au-dessus : remonte jusqu’à son bord', () => {
    const raster = fakeRaster(page)
    strokeRect(raster, 60, 190, 400, 105)
    const top = graphicTop(buildPageInk(raster, page), box, 150)
    expect(top).toBeLessThanOrEqual(190)
    expect(top).toBeGreaterThanOrEqual(189)
  })

  it('figure de l’énoncé qui effleure le haut du masque : pas de remontée', () => {
    const raster = fakeRaster(page)
    strokeRect(raster, 60, 120, 200, 85) // finit 5 points sous le haut du masque
    expect(graphicTop(buildPageInk(raster, page), box, 100)).toBe(200)
  })
})

describe('figure de correction qui touche la question suivante', () => {
  it('le bord de la figure est masqué, la question suivante reste lisible', async () => {
    // Ligne 0 : question ; 1-2 : correction ; figure de la correction entre 2 et 6,
    // dont le bord inférieur est à 1 point sous le haut de la question 2 (ligne 6).
    const page = fakePage(0, [
      '1. Tracer le graphe.',
      'Correction : voici le graphe.',
      'Le graphe est ci-dessous.',
      '',
      '',
      '',
      '2. Calculer la pente.',
    ])
    const raster = fakeRaster(page)
    strokeRect(raster, 120, Math.round(top(3)), 200, Math.round(top(6) + 1 - top(3)))
    const result = await detectCorrections({ pages: [page], getRaster: async () => raster })
    expect(result.kind).toBe('mixed')
    const region = result.blocks[0]!.regions[0]!.bbox
    const regionBottom = region.y + region.height
    expect(regionBottom).toBeGreaterThan(top(6) + 1)
    // La question 2 n'est pas recouverte au-delà de la moitié de sa hauteur.
    expect(regionBottom).toBeLessThanOrEqual(top(6) + 5.5)
  })

  it('sans raster, la région s’arrête avant la question suivante (comportement textuel)', async () => {
    const page = fakePage(0, ['1. Tracer.', 'Correction : graphe.', '2. Calculer la pente.'])
    const result = await detectCorrections({ pages: [page] })
    const region = result.blocks[0]!.regions[0]!.bbox
    expect(region.y + region.height).toBeLessThanOrEqual(top(2))
  })
})

// @vitest-environment node
import { expect, it } from 'vitest'
import { makeLargeTestPdf, makeTestPdf } from '../../pdf/test-pdf.ts'
import { loadPdf } from './loader.ts'

it('garde le repère du PDF et plafonne le raster de benchmark comme dans le lecteur', async () => {
  const input = await loadPdf(makeLargeTestPdf(1))
  try {
    expect(input.pages[0]).toMatchObject({ width: 15000, height: 8000 })
    const raster = await input.getRaster?.(0)
    if (!raster) throw new Error('La recette Node exige le canvas installé avec PDF.js.')
    expect(raster.width * raster.height).toBeLessThanOrEqual(4 * 1024 * 1024)
    expect(raster.width / raster.height).toBeCloseTo(15000 / 8000, 2)
    expect(raster.rgba.length).toBe(raster.width * raster.height * 4)
  } finally {
    await input.close()
  }
})

it('uses the same rotated page and text indexes for native observations', async () => {
  const input = await loadPdf(makeTestPdf(), { raster: false })
  try {
    const observation = await input.getVectors?.(1)
    expect(observation).toMatchObject({ pageIndex: 1, width: 160, height: 300 })
    expect(observation?.graphics).toBeDefined()
    expect(observation?.glyphSymbols).toBeDefined()
    expect(observation?.textColors).toBeDefined()
    expect(
      observation?.textColors?.every(
        ({ textIndex }) => textIndex < input.pages[1]!.textItems.length,
      ),
    ).toBe(true)
  } finally {
    await input.close()
  }
  await expect(input.getVectors?.(1)).resolves.toBeUndefined()
})

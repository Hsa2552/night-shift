// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { openPdf } from './index'
import { makeLargeTestPdf, makeTestPdf } from './test-pdf'

describe('openPdf with a synthetic PDF', () => {
  it('extracts text and geometry from two pages with different sizes and orientations', async () => {
    const pdf = await openPdf(new Blob([makeTestPdf()]))
    try {
      expect(pdf.pageCount).toBe(2)
      await expect(pdf.getPageDimensions(1)).resolves.toEqual({
        pageIndex: 1,
        width: 160,
        height: 300,
      })
      const page = await pdf.getPageData(0)
      expect(page).toMatchObject({ pageIndex: 0, width: 200, height: 100 })
      expect(page.textItems).toHaveLength(1)
      const question = page.textItems[0]
      expect(question).toMatchObject({ text: 'Question', fontSize: 12 })
      expect(question.fontName).toBeTruthy()
      expect(question.bbox.x).toBeCloseTo(20)
      expect(question.bbox.y).toBeLessThan(40)
      expect(question.bbox.width).toBeGreaterThan(40)
      expect(question.bbox.height).toBeCloseTo(11.1)

      const rotated = await pdf.getPageData(1)
      expect(rotated).toMatchObject({ pageIndex: 1, width: 160, height: 300 })
      expect(rotated.textItems).toHaveLength(1)
      const correction = rotated.textItems[0]
      expect(correction.text).toBe('Correction')
      expect(correction.bbox.x).toBeLessThan(60)
      expect(correction.bbox.y).toBeCloseTo(20)
      expect(correction.bbox.width).toBeCloseTo(11.1)
      expect(correction.bbox.height).toBeGreaterThan(40)
    } finally {
      await pdf.close()
    }
    await expect(pdf.getPageData(0)).rejects.toThrow('Le PDF est fermé.')
    await expect(pdf.close()).resolves.toBeUndefined()
  })

  it('rejects invalid documents', async () => {
    await expect(openPdf(new Blob(['Pas un PDF']))).rejects.toMatchObject({
      name: 'InvalidPDFException',
    })
  })

  it('reads the crop box and reaches the end of a multipage document', async () => {
    const pdf = await openPdf(new Blob([makeLargeTestPdf(80)]))
    try {
      expect(pdf.pageCount).toBe(80)
      const first = await pdf.getPageData(0)
      expect(first).toMatchObject({ pageIndex: 0, width: 15_000, height: 8000 })
      expect(first.textItems[0].bbox.x).toBeCloseTo(5000)
      await expect(pdf.getPageData(79)).resolves.toEqual({
        pageIndex: 79,
        width: 595,
        height: 842,
        textItems: [],
      })
    } finally {
      await pdf.close()
    }
  })

  it('rejects invalid page indices', async () => {
    const pdf = await openPdf(new Blob([makeTestPdf()]))
    try {
      for (const index of [-1, 0.5, 2, NaN]) {
        await expect(pdf.getPageData(index)).rejects.toBeInstanceOf(RangeError)
      }
    } finally {
      await pdf.close()
    }
  })
})

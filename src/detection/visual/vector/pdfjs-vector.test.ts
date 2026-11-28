// @vitest-environment node
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { expect, it } from 'vitest'
import { makeGraphicsOnlyTestPdf } from '../../../pdf/test-pdf'
import { observeVectorPage } from './index'

it('decodes the installed PDF.js operator list for an actual PDF', async () => {
  const task = getDocument({ data: makeGraphicsOnlyTestPdf() })
  try {
    const document = await task.promise
    const result = await observeVectorPage(await document.getPage(1))
    expect(result.unsupportedPathEncoding).toBe(0)
    expect(result.rectangles).toHaveLength(1)
    expect(result.rectangles[0]).toMatchObject({
      region: { pageIndex: 0, bbox: { x: 20, y: 45, width: 60, height: 35 } },
      fill: '#3366cc',
      visibility: 'paint-command',
    })
    expect(result.textPaint).toEqual([])
  } finally {
    await task.destroy()
  }
})

function nestedFormsPdf() {
  const stream = (header: string, body: string) =>
    `<< ${header} /Length ${body.length} >>\nstream\n${body}\nendstream`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /CropBox [5 10 295 190] /Rotate 90 /Resources << /XObject << /Outer 5 0 R >> >> /Contents 4 0 R >>',
    stream('', 'q 1 0 0 1 30 40 cm /Outer Do Q'),
    stream(
      '/Type /XObject /Subtype /Form /BBox [0 0 100 100] /Matrix [2 0 0 2 5 7] /Resources << /XObject << /Inner 6 0 R >> >>',
      '/Inner Do',
    ),
    stream(
      '/Type /XObject /Subtype /Form /BBox [0 0 30 30] /Matrix [1 0 0 1 3 4]',
      '1 0 0 rg 0 0 6 6 re f',
    ),
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = objects.map((object, index) => {
    const start = pdf.length
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
    return start
  })
  const startXref = pdf.length
  const offsetsText = offsets
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('')
  pdf += `xref\n0 7\n0000000000 65535 f \n${offsetsText}trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`
  return new TextEncoder().encode(pdf)
}

it('follows nested Form XObjects on an actual rotated and cropped PDF page', async () => {
  const task = getDocument({ data: nestedFormsPdf() })
  try {
    const document = await task.promise
    const result = await observeVectorPage(await document.getPage(1))
    expect(result).toMatchObject({ width: 180, height: 290 })
    expect(result.rectangles).toHaveLength(1)
    expect(result.rectangles[0]).toMatchObject({
      region: { pageIndex: 0, bbox: { x: 45, y: 36, width: 12, height: 12 } },
      fill: '#ff0000',
      visibility: 'paint-command',
    })
  } finally {
    await task.destroy()
  }
})

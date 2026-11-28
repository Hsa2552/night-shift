// Synthetic PDF fixture with known geometry, including a rotated page.
export function makeTestPdf(): Uint8Array<ArrayBuffer> {
  const stream = (text: string) => {
    const content = `BT /F1 12 Tf 20 60 Td (${text}) Tj ET`
    return `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
  }
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 160] /Rotate 90 /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    stream('Question'),
    stream('Correction'),
  ]

  return encodePdf(objects)
}

// Synthetic document with a wide cropped first page, then ordinary pages sharing a font.
export function makeLargeTestPdf(pageCount: number): Uint8Array<ArrayBuffer> {
  const content = 'BT /F1 36 Tf 5100 50 Td (Premiere page de test) Tj ET'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${Array.from({ length: pageCount }, (_, i) => `${i + 5} 0 R`).join(' ')}] /Count ${pageCount} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    ...Array.from({ length: pageCount }, (_, i) =>
      i === 0
        ? '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 20000 10000] /CropBox [100 0 15100 8000] /Resources << /Font << /F1 3 0 R >> >> /Contents 4 0 R >>'
        : '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>',
    ),
  ]
  return encodePdf(objects)
}

// Produce enough real text items to cross PDF.js streaming chunk boundaries.
export function makeDenseTestPdf(): Uint8Array<ArrayBuffer> {
  const lines = Array.from(
    { length: 250 },
    (_, index) => `(Ligne ${index + 1} : r\\351vision) Tj T*`,
  )
  lines[125] = '/F2 12 Tf\n' + lines[125]
  lines[126] = '/F1 12 Tf\n' + lines[126]
  const content = `BT /F1 12 Tf 20 3950 Td 15 TL\n${lines.join('\n')}\nET`
  return encodePdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 4000] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ])
}

// A two-page document with drawn content and no text layer.
export function makeGraphicsOnlyTestPdf(): Uint8Array<ArrayBuffer> {
  const content = '0.2 0.4 0.8 rg 20 20 60 35 re f'
  return encodePdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Contents 5 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Contents 5 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ])
}

function encodePdf(objects: string[]): Uint8Array<ArrayBuffer> {
  let pdf = '%PDF-1.4\n'
  const offsets = objects.map((object, index) => {
    const offset = pdf.length
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
    return offset
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(pdf)
}

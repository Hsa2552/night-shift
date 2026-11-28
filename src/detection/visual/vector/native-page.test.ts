// @vitest-environment node
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { expect, it } from 'vitest'
import { readPageText } from '../../../pdf/read-text'
import { observeNativePage } from './native-page'

interface FixtureOptions {
  rotation?: number
  annotation?: boolean
  reverseItems?: boolean
}

function textFixture(content: string, rotation: number, annotation: boolean) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Rotate ${rotation} /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R ${annotation ? '/Annots [6 0 R]' : ''} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ]
  if (annotation)
    objects.push(
      '<< /Type /Annot /Subtype /Highlight /Rect [20 150 60 163] /QuadPoints [20 163 60 163 20 150 60 150] /C [1 1 0] /F 4 >>',
    )
  let source = '%PDF-1.4\n'
  const offsets = objects.map((object, index) => {
    const at = source.length
    source += `${index + 1} 0 obj\n${object}\nendobj\n`
    return `${String(at).padStart(10, '0')} 00000 n \n`
  })
  const xref = source.length
  const count = objects.length + 1
  source += `xref\n0 ${count}\n0000000000 65535 f \n${offsets.join('')}trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(source)
}

async function observe(
  content: string,
  { rotation = 0, annotation = false, reverseItems = false }: FixtureOptions = {},
) {
  const task = getDocument({ data: textFixture(content, rotation, annotation) })
  try {
    const page = await (await task.promise).getPage(1)
    const transform = page.getViewport({ scale: 1 }).transform
    const items = await readPageText(page, transform, false)
    if (reverseItems) items.reverse()
    const observations = await observeNativePage(page, items)
    return { items, observations }
  } finally {
    await task.destroy()
  }
}

it('retains two native colors across successive showText operators in one C1 fragment', async () => {
  const result = await observe(
    'BT /F1 12 Tf 0.1 Tc 1 Tw 95 Tz 20 160 Td 0 g (Noir ) Tj 1 0 0 rg [(Rou) 10 (ge)] TJ ET',
    { rotation: 90 },
  )
  const index = result.items.findIndex(({ text }) => text === 'Noir Rouge')
  expect(index, JSON.stringify(result.items.map(({ text }) => text))).toBeGreaterThanOrEqual(0)
  expect(result.observations.textColors[index]).toMatchObject({
    status: 'matched',
    ranges: [
      {
        start: 0,
        end: 4,
        rgb: [0, 0, 0],
        operatorIndices: expect.arrayContaining([expect.any(Number)]),
      },
      {
        start: 5,
        end: 10,
        rgb: [255, 0, 0],
        operatorIndices: expect.arrayContaining([expect.any(Number)]),
      },
    ],
  })
})

it('associates one operator to two C1 fragments without following their index order', async () => {
  const { items, observations } = await observe(
    'BT /F1 12 Tf 1 0 0 1 20 160 Tm 0 0 1 rg [(gauche) -3500 (droite)] TJ ET',
    { reverseItems: true },
  )
  const associated = observations.textColors.filter(({ textIndex }) => items[textIndex].text.trim())
  expect(associated.map(({ textIndex }) => items[textIndex].text)).toEqual(['droite', 'gauche'])
  expect(associated.map(({ status }) => status)).toEqual(['matched', 'matched'])
  expect(associated[0].ranges[0].operatorIndices).toEqual(associated[1].ranges[0].operatorIndices)
  expect(associated[1].ranges[0].rgb).toEqual([0, 0, 255])
})

it('keeps a color unresolved on a fragment that is present as invisible text', async () => {
  const { items, observations } = await observe(
    'BT /F1 12 Tf 1 0 0 1 20 160 Tm 0 0 1 rg 3 Tr (Invisible) Tj 0 Tr 1 0 0 1 20 100 Tm (Visible) Tj ET',
  )
  const hidden = items.findIndex(({ text }) => text === 'Invisible')
  const visible = items.findIndex(({ text }) => text === 'Visible')
  expect(observations.textColors[hidden]).toEqual({
    textIndex: hidden,
    status: 'ambiguous',
    ranges: [],
  })
  expect(observations.textColors[visible].ranges[0].rgb).toEqual([0, 0, 255])
})

it('records the C1 geometry of an actual rotated PDF highlight', async () => {
  const { observations } = await observe('BT /F1 12 Tf 20 155 Td (Mark) Tj ET', {
    rotation: 90,
    annotation: true,
  })
  expect(observations.graphics?.highlights).toEqual([
    {
      region: { pageIndex: 0, bbox: { x: 150, y: 20, width: 13, height: 40 } },
      geometry: 'annotation-quad',
      rgb: [255, 255, 0],
    },
  ])
})

it('distinguishes the same phrase at different positions and abstains on contradictory overprints', async () => {
  const { items, observations } = await observe(
    'BT /F1 12 Tf 1 0 0 1 20 160 Tm 0 0 1 rg (item) Tj 1 0 0 1 120 160 Tm 1 0 0 rg (item) Tj 1 0 0 1 40 100 Tm (hidden) Tj 1 0 0 1 40 100 Tm 0 g (hidden) Tj ET',
  )
  const colors = observations.textColors.filter(({ textIndex }) => items[textIndex].text === 'item')
  expect(colors.map(({ ranges }) => ranges[0]?.rgb)).toEqual([
    [0, 0, 255],
    [255, 0, 0],
  ])
  const overlapped = observations.textColors.filter(
    ({ textIndex }) => items[textIndex].text === 'hidden',
  )
  expect(overlapped.length).toBeGreaterThan(0)
  expect(overlapped.every(({ status, ranges }) => status === 'ambiguous' && !ranges.length)).toBe(
    true,
  )
})

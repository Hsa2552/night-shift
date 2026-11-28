import { expect, it } from 'vitest'
import { reconstructAdaptiveLayout } from './adaptive-layout'
import type { PageData } from '../../../shared/types'

function twoColumns(scale = 1, margin = 0): PageData {
  return {
    pageIndex: 0,
    width: 200 * scale + 2 * margin,
    height: 220 * scale + 2 * margin,
    textItems: Array.from({ length: 6 }, (_, i) =>
      [20, 47, 88, 115].map((x) => ({
        text: 'abcde',
        bbox: {
          x: x * scale + margin,
          y: (30 + i * 15) * scale + margin,
          width: 24 * scale,
          height: 10 * scale,
        },
      })),
    ).flat(),
  }
}

it('preserves indices, repeated gutters and line membership under scale and margin changes', () => {
  const base = reconstructAdaptiveLayout(twoColumns())
  const changed = reconstructAdaptiveLayout(twoColumns(0.6, 80))
  expect(base.activation).toBe('repeated-gutters')
  expect(changed.activation).toBe(base.activation)
  expect(base.lines[0].indices).toEqual([0, 1])
  expect(changed.lines.map((l) => l.indices)).toEqual(base.lines.map((l) => l.indices))
})

it('gives no activation recommendation for ordinary one-column text and skips empty fragments', () => {
  const page = twoColumns()
  page.textItems = page.textItems.filter((_, i) => i % 4 < 2)
  page.textItems.unshift({ text: ' ', bbox: { x: 5, y: 0, width: 1, height: 10 } })
  const result = reconstructAdaptiveLayout(page, new Map([[1, 38]]))
  expect(result.lines).toHaveLength(6)
  expect(result.lines[0].indices).toEqual([1, 2])
  expect(result.activation).toBe('off')
  expect(result.baselineSource).toBe('mixed')
})

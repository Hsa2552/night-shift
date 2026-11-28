import { expect, it } from 'vitest'
import type { PageRegion } from '../../../shared/types'
import { relateSymbols, type NativeSymbol } from './symbol-relations'

const region = (x: number, y: number, width = 8, height = 8): PageRegion => ({
  pageIndex: 0,
  bbox: { x, y, width, height },
})

function symbol(kind: NativeSymbol['kind'], x: number, y: number): NativeSymbol {
  return {
    region: region(x, y),
    operatorIndex: 6,
    kind,
    visibility: 'paint-command',
    geometry: 'font-cell',
  }
}

it('keeps overlapping and adjacent glyph observations and their provenance separate', () => {
  const symbols = [
    symbol('empty-square', 20, 20),
    symbol('tick', 20, 19),
    symbol('empty-circle', 40, 20),
    symbol('cross', 49, 20),
    symbol('cross', 200, 20),
  ]
  const result = relateSymbols(
    {
      pageIndex: 0,
      width: 240,
      height: 240,
      images: 0,
      unresolvedPaths: 0,
      unsupportedPathEncoding: 0,
      rectangles: [],
      textPaint: [],
    },
    symbols,
  )
  expect(
    result.markRelations.map(({ frame, markIndex, kind }) => [
      frame.kind === 'glyph' && frame.symbolIndex,
      markIndex,
      kind,
    ]),
  ).toEqual([
    [0, 1, 'overlap'],
    [2, 3, 'nearby'],
  ])
})

it('reports a local chromatic fill behind a drawn frame and excludes later paint', () => {
  const result = relateSymbols(
    {
      pageIndex: 0,
      width: 200,
      height: 100,
      images: 0,
      unresolvedPaths: 0,
      unsupportedPathEncoding: 0,
      textPaint: [],
      rectangles: [
        {
          region: region(12, 15, 80, 16),
          operatorIndex: 1,
          visibility: 'paint-command',
          fill: '#d9ead3',
          fillOpacity: 1,
        },
        {
          region: region(20, 20),
          operatorIndex: 2,
          visibility: 'unresolved',
          fill: '#595959',
          fillOpacity: 1,
        },
        {
          region: region(12, 15, 80, 16),
          operatorIndex: 3,
          visibility: 'paint-command',
          fill: '#ffaaaa',
          fillOpacity: 1,
        },
      ],
    },
    [],
  )
  expect(result.backgroundRelations).toEqual([
    {
      frame: { kind: 'drawn', region: region(20, 20), operatorIndices: [2] },
      region: region(12, 15, 80, 16),
      operatorIndex: 1,
      rgb: [217, 234, 211],
    },
  ])
})

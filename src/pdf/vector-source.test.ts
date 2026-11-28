import { expect, it, vi } from 'vitest'
import type { PDFPageProxy } from 'pdfjs-dist'
import { createVectorSource } from './vector-source.ts'
import { observeNativePage } from '../detection/visual/vector/native-page.ts'

vi.mock('../detection/visual/vector/native-page.ts', () => ({ observeNativePage: vi.fn() }))

const observe = vi.mocked(observeNativePage)
const getItems = async () => []
const page = (pageNumber: number) => ({
  pageNumber,
  getViewport: vi.fn(),
  getOperatorList: vi.fn(),
  cleanup: vi.fn(),
  getAnnotations: vi.fn(),
  commonObjs: {} as PDFPageProxy['commonObjs'],
})
const observation: Awaited<ReturnType<typeof observeNativePage>> = {
  pageIndex: 0,
  width: 595,
  height: 842,
  rectangles: [],
  textPaint: [],
  images: 0,
  unresolvedPaths: 0,
  unsupportedPathEncoding: 0,
  textColors: [],
  glyphSymbols: [],
  markRelations: [],
  backgroundRelations: [],
}

it('reads on demand, shares only the in-flight observation and releases operator data', async () => {
  observe.mockReset().mockResolvedValue(observation)
  const first = page(1)
  const lookup = vi.fn().mockResolvedValue(first)
  const source = createVectorSource(1, lookup, getItems)
  expect(lookup).not.toHaveBeenCalled()
  const values = await Promise.all([source.getVectors(0), source.getVectors(0)])
  expect(values).toEqual([observation, observation])
  expect(observe).toHaveBeenCalledOnce()
  expect(first.cleanup).toHaveBeenCalledOnce()
  await source.getVectors(0)
  expect(lookup).toHaveBeenCalledTimes(2)
  await expect(source.getVectors(1)).rejects.toThrow(RangeError)
})

it('drops an in-flight result when its document closes and isolates the next document', async () => {
  let finish!: (value: typeof observation) => void
  let enter!: () => void
  const started = new Promise<void>((resolve) => {
    enter = resolve
  })
  const first = page(1)
  const replacement = page(1)
  const source = createVectorSource(1, async () => first, getItems)
  const other = createVectorSource(1, async () => replacement, getItems)
  const replacementObservation = { ...observation, width: 200 }
  observe
    .mockReset()
    .mockImplementationOnce(() => {
      enter()
      return new Promise((resolve) => {
        finish = resolve
      })
    })
    .mockResolvedValueOnce(replacementObservation)
  const old = source.getVectors(0)
  await started
  source.close()
  await expect(other.getVectors(0)).resolves.toEqual(replacementObservation)
  finish(observation)
  await expect(old).resolves.toBeUndefined()
  await expect(source.getVectors(0)).resolves.toBeUndefined()
  expect(first.cleanup).toHaveBeenCalledOnce()
})

it('reports unavailable operations as a fallback and can retry the page', async () => {
  const first = page(1)
  const source = createVectorSource(1, async () => first, getItems)
  observe
    .mockReset()
    .mockRejectedValueOnce(new Error('operator list unavailable'))
    .mockResolvedValueOnce(observation)
  await expect(source.getVectors(0)).resolves.toBeUndefined()
  await expect(source.getVectors(0)).resolves.toEqual(observation)
  expect(first.cleanup).toHaveBeenCalledTimes(2)
})

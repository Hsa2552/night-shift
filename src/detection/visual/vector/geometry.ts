import type { Rect } from '../../../shared/types'

export type Matrix = readonly [number, number, number, number, number, number]
export type Point = readonly [number, number]

export const identity: Matrix = [1, 0, 0, 1, 0, 0]

export function numbers(value: unknown): ArrayLike<number> | undefined {
  if (Array.isArray(value)) return value
  if (value instanceof Float32Array || value instanceof Float64Array) return value
}

export function matrix(value: unknown): Matrix | undefined {
  const values = numbers(value)
  if (!values || values.length !== 6) return
  const [a, b, c, d, e, f] = Array.from(values)
  if ([a, b, c, d, e, f].every(Number.isFinite)) return [a, b, c, d, e, f]
}

export function compose(left: Matrix, right: Matrix): Matrix {
  const [a, b, c, d, e, f] = left
  const [g, h, i, j, k, l] = right
  return [
    a * g + c * h,
    b * g + d * h,
    a * i + c * j,
    b * i + d * j,
    a * k + c * l + e,
    b * k + d * l + f,
  ]
}

export function point([a, b, c, d, e, f]: Matrix, x: number, y: number): Point {
  return [a * x + c * y + e, b * x + d * y + f]
}

export function extent(points: Point[]): Rect {
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

export function formBounds(value: unknown, transform: Matrix): Rect | undefined {
  const coords = numbers(value)
  if (!coords || coords.length !== 4) return
  const [x, y, right, bottom] = Array.from(coords)
  if (![x, y, right, bottom].every(Number.isFinite)) return
  return extent([
    point(transform, x, y),
    point(transform, right, y),
    point(transform, right, bottom),
    point(transform, x, bottom),
  ])
}

export function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const width = Math.min(a.x + a.width, b.x + b.width) - x
  const height = Math.min(a.y + a.height, b.y + b.height) - y
  return width > 0 && height > 0 ? { x, y, width, height } : null
}

const nearly = (a: number, b: number) => Math.abs(a - b) < 0.03

function rectangle(contour: Point[]): Rect | undefined {
  if (
    contour.length === 5 &&
    nearly(contour[0][0], contour[4][0]) &&
    nearly(contour[0][1], contour[4][1])
  ) {
    contour = contour.slice(0, -1)
  }
  if (contour.length !== 4) return
  const box = extent(contour)
  if (box.width <= 0.06 || box.height <= 0.06 || !Object.values(box).every(Number.isFinite)) return
  const corners = new Set<number>()
  for (const [x, y] of contour) {
    const left = nearly(x, box.x)
    const upper = nearly(y, box.y)
    if (!(left || nearly(x, box.x + box.width)) || !(upper || nearly(y, box.y + box.height))) return
    corners.add(Number(left) + 2 * Number(upper))
  }
  if (corners.size !== 4) return
  if (
    !contour.every(([x, y], i) => {
      const [nextX, nextY] = contour[(i + 1) % 4]
      return nearly(x, nextX) || nearly(y, nextY)
    })
  )
    return
  return box
}

// PDF.js 6.5 packs paths as DrawOPS and coordinates in data[0]. DrawOPS is internal.
export function rectanglesFromPath(data: unknown, transform: Matrix, implicitClose: boolean) {
  const packed = Array.isArray(data) ? numbers(data[0]) : undefined
  if (!packed) return { rectangles: [], complete: false }
  const rectangles: Rect[] = []
  let contour: Point[] = []
  let curved = false
  let closed = false
  let complete = true

  function finish() {
    if (!contour.length) return
    const [firstX, firstY] = contour[0]
    const [lastX, lastY] = contour.at(-1)!
    const closes = closed || implicitClose || (nearly(firstX, lastX) && nearly(firstY, lastY))
    const box = !curved && closes ? rectangle(contour) : undefined
    if (box) rectangles.push(box)
    else complete = false
    contour = []
    curved = closed = false
  }

  for (let i = 0; i < packed.length;) {
    const op = packed[i++]
    switch (op) {
      case 0:
        finish()
        if (i + 2 > packed.length) return { rectangles, complete: false }
        contour.push(point(transform, packed[i], packed[i + 1]))
        i += 2
        break
      case 1:
        if (i + 2 > packed.length) return { rectangles, complete: false }
        contour.push(point(transform, packed[i], packed[i + 1]))
        i += 2
        break
      case 2:
      case 3:
        curved = true
        i += op === 2 ? 6 : 4
        break
      case 4:
        closed = true
        break
      default:
        return { rectangles, complete: false }
    }
  }
  finish()
  return { rectangles, complete }
}

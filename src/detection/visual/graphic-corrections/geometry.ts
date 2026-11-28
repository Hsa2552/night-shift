import type { Rect } from '../../../shared/types'
import { intersect } from '../vector/geometry'

export const right = (box: Rect) => box.x + box.width
export const bottom = (box: Rect) => box.y + box.height
export const area = (box: Rect) => box.width * box.height
export const overlap = (a: Rect, b: Rect) => {
  const box = intersect(a, b)
  return box ? area(box) : 0
}
export const contains = (outer: Rect, box: Rect) =>
  outer.x <= box.x && outer.y <= box.y && right(outer) >= right(box) && bottom(outer) >= bottom(box)
export const valid = (box: Rect) =>
  [box.x, box.y, box.width, box.height, right(box), bottom(box)].every(Number.isFinite) &&
  box.width > 0 &&
  box.height > 0
export const expand = (box: Rect, amount: number): Rect => ({
  x: box.x - amount,
  y: box.y - amount,
  width: box.width + 2 * amount,
  height: box.height + 2 * amount,
})
export function bounds(boxes: readonly Rect[]): Rect {
  const x = Math.min(...boxes.map((box) => box.x))
  const y = Math.min(...boxes.map((box) => box.y))
  return {
    x,
    y,
    width: Math.max(...boxes.map(right)) - x,
    height: Math.max(...boxes.map(bottom)) - y,
  }
}
export function median(values: number[], fallback: number) {
  if (!values.length) return fallback
  values.sort((a, b) => a - b)
  const at = Math.floor(values.length / 2)
  return values.length % 2 ? values[at] : (values[at - 1] + values[at]) / 2
}

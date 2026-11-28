import type { CorrectionBlock, PageDimensions, RasterData, Rect } from '../../shared/types.ts'
import type { GeoTruth } from './geo.ts'

type Element = GeoTruth['elements'][number]

function overlap([x, y, width, height]: Element['bbox'], masks: Rect[]) {
  return masks
    .map((mask) => ({
      left: Math.max(x, mask.x),
      top: Math.max(y, mask.y),
      right: Math.min(x + width, mask.x + mask.width),
      bottom: Math.min(y + height, mask.y + mask.height),
    }))
    .filter(({ left, top, right, bottom }) => right > left && bottom > top)
}

function fullCoverage(box: Element['bbox'], masks: Rect[]): boolean {
  const [x, y, width, height] = box
  if (!(width > 0 && height > 0)) return false
  const intersections = overlap(box, masks)
  if (!intersections.length) return false
  const edges = [...new Set([x, x + width, ...intersections.flatMap((m) => [m.left, m.right])])]
  edges.sort((a, b) => a - b)
  const epsilon = 1e-7
  for (let i = 0; i < edges.length - 1; i++) {
    const left = edges[i]!
    const right = edges[i + 1]!
    if (right - left <= epsilon) continue
    const intervals = intersections
      .filter((m) => m.left <= left && m.right >= right)
      .sort((a, b) => a.top - b.top)
    let coveredUntil = y
    for (const { top, bottom } of intervals) {
      if (top > coveredUntil + epsilon) break
      coveredUntil = Math.max(coveredUntil, bottom)
    }
    if (coveredUntil < y + height - epsilon) return false
  }
  return true
}

function masksByPage(blocks: readonly CorrectionBlock[]) {
  const byPage = new Map<number, Rect[]>()
  for (const { regions } of blocks) {
    for (const { pageIndex, bbox } of regions) {
      if (![bbox.x, bbox.y, bbox.width, bbox.height].every(Number.isFinite)) continue
      const masks = byPage.get(pageIndex) ?? []
      masks.push(bbox)
      byPage.set(pageIndex, masks)
    }
  }
  return byPage
}

function distinguishesCaseState(group: Element[], masks: Map<number, Rect[]>): boolean {
  const profiles = (category: Element['category']) =>
    new Set(
      group
        .filter((unit) => unit.category === category)
        .map((unit) => {
          const [x, y, width, height] = unit.bbox
          const own = (masks.get(unit.page) ?? []).filter(
            (mask) =>
              group.filter(
                (other) => other.page === unit.page && overlap(other.bbox, [mask]).length,
              ).length === 1 && overlap(unit.bbox, [mask]).length,
          )
          return own
            .map((mask) =>
              [mask.x - x, mask.y - y, mask.width - width, mask.height - height]
                .map((value) => Math.round(value / 2))
                .join(','),
            )
            .sort()
            .join(';')
        }),
    )
  const filled = profiles('filled-box')
  const empty = profiles('empty-box')
  return filled.size > 0 && empty.size > 0 && [...filled].every((profile) => !empty.has(profile))
}

export function scoreStrictGeometry(truth: GeoTruth, blocks: readonly CorrectionBlock[]) {
  const byPage = masksByPage(blocks)
  const corrections: Record<string, { total: number; full: number }> = {}
  const questionGroups = new Map<string, Element[]>()
  const groupsAtRisk = new Set<string>()
  let total = 0
  let preserved = 0
  for (const unit of truth.elements) {
    const masks = byPage.get(unit.page) ?? []
    if (unit.role === 'q') {
      total++
      if (!overlap(unit.bbox, masks).length) preserved++
    }
    if (unit.role !== 'c') continue
    const category = unit.category ?? 'unspecified'
    const score = (corrections[category] ??= { total: 0, full: 0 })
    const full = fullCoverage(unit.bbox, masks)
    score.total++
    if (full) score.full++
    if (unit.group && (category === 'empty-box' || category === 'filled-box')) {
      const units = questionGroups.get(unit.group) ?? []
      units.push(unit)
      questionGroups.set(unit.group, units)
      if (!full) groupsAtRisk.add(unit.group)
    }
  }
  let groupsWithGeometryCue = 0
  for (const [name, group] of questionGroups) {
    if (groupsAtRisk.has(name) || !distinguishesCaseState(group, byPage)) continue
    groupsWithGeometryCue++
    groupsAtRisk.add(name)
  }
  return {
    corrections,
    statements: { total, preserved },
    indirect: {
      qcmGroupsAnnotated: questionGroups.size,
      groupsAtRisk: groupsAtRisk.size,
      groupsWithGeometryCue,
    },
  }
}

export async function scoreVisibleInk(
  truth: GeoTruth,
  blocks: readonly CorrectionBlock[],
  pages: readonly PageDimensions[],
  getRaster: (index: number) => Promise<RasterData>,
) {
  const masks = masksByPage(blocks)
  const corrections: Record<string, { withInk: number; withVisibleInk: number; noInk: number }> = {}
  const statements = { withInk: 0, withMaskedInk: 0, noInk: 0 }
  for (const page of pages) {
    const units = truth.elements.filter((u) => u.page === page.pageIndex && /[cq]/.test(u.role))
    if (!units.length) continue
    const raster = await getRaster(page.pageIndex)
    const sx = page.width / raster.width
    const sy = page.height / raster.height
    for (const unit of units) {
      const [x, y, w, h] = unit.bbox
      const localMasks = overlap(unit.bbox, masks.get(unit.page) ?? [])
      let visible = false
      let covered = false
      for (let row = Math.max(0, Math.ceil(y / sy - 0.5)); row < raster.height; row++) {
        const py = (row + 0.5) * sy
        if (py >= y + h || (visible && covered)) break
        for (let col = Math.max(0, Math.ceil(x / sx - 0.5)); col < raster.width; col++) {
          const px = (col + 0.5) * sx
          if (px >= x + w || (visible && covered)) break
          const offset = 4 * (row * raster.width + col)
          if (
            raster.rgba[offset + 3] === 0 ||
            [0, 1, 2].every((d) => raster.rgba[offset + d]! >= 239)
          ) {
            continue
          }
          if (
            localMasks.some((m) => m.left <= px && px <= m.right && m.top <= py && py <= m.bottom)
          ) {
            covered = true
          } else {
            visible = true
          }
        }
      }
      if (unit.role === 'c') {
        const score = (corrections[unit.category ?? 'unspecified'] ??= {
          withInk: 0,
          withVisibleInk: 0,
          noInk: 0,
        })
        if (visible || covered) score.withInk++
        else score.noInk++
        if (visible) score.withVisibleInk++
      } else {
        if (visible || covered) statements.withInk++
        else statements.noInk++
        if (covered) statements.withMaskedInk++
      }
    }
  }
  return { corrections, statements }
}

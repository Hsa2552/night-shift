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

type MaskProfile = [number, number, number, number][]

function relativeMasks(unit: Element, group: Element[], masks: Map<number, Rect[]>): MaskProfile {
  const [x, y, width, height] = unit.bbox
  return (masks.get(unit.page) ?? [])
    .filter(
      (mask) =>
        group.filter((other) => other.page === unit.page && overlap(other.bbox, [mask]).length)
          .length === 1 && overlap(unit.bbox, [mask]).length,
    )
    .map((mask) => [mask.x - x, mask.y - y, mask.width - width, mask.height - height])
}

function distinguishesCaseState(group: Element[], masks: Map<number, Rect[]>): boolean {
  const profiles = (category: Element['category']) =>
    new Set(
      group
        .filter((unit) => unit.category === category)
        .map((unit) =>
          relativeMasks(unit, group, masks)
            .map((offsets) => offsets.map((value) => Math.round(value / 2)).join(','))
            .sort()
            .join(';'),
        ),
    )
  const filled = profiles('filled-box')
  const empty = profiles('empty-box')
  return filled.size > 0 && empty.size > 0 && [...filled].every((profile) => !empty.has(profile))
}

function sameProfile(left: MaskProfile, right: MaskProfile) {
  if (left.length !== right.length) return false
  const remaining = [...right]
  const tolerancePt = 1
  for (const mask of left) {
    const index = remaining.findIndex((other) =>
      mask.every((coordinate, axis) => Math.abs(coordinate - other[axis]!) <= tolerancePt),
    )
    if (index < 0) return false
    remaining.splice(index, 1)
  }
  return true
}

/**
 * Additional QCM audit. Frame boxes come from the original PDF, independently of the masks.
 * Their keys refer to the element indexes of the exact annotated truth. Coverage still uses
 * the original rectangles, including any marks protruding beyond a frame.
 */
export function scoreQcmFrameGeometry(
  truth: GeoTruth,
  blocks: readonly CorrectionBlock[],
  frames: ReadonlyMap<number, Element['bbox']>,
) {
  const byPage = masksByPage(blocks)
  const groups = new Map<string, { element: Element; frame?: Element['bbox'] }[]>()
  truth.elements.forEach((element, index) => {
    if (
      element.role !== 'c' ||
      !element.group ||
      (element.category !== 'filled-box' && element.category !== 'empty-box')
    ) {
      return
    }
    const cases = groups.get(element.group) ?? []
    cases.push({ element, frame: frames.get(index) })
    groups.set(element.group, cases)
  })

  let groupsWithFrameData = 0
  let groupsWithIncompleteCoverage = 0
  let groupsWithFrameGeometryCue = 0
  for (const cases of groups.values()) {
    if (
      !cases.every(
        ({ element, frame }) =>
          frame &&
          frame.every(Number.isFinite) &&
          frame[2] > 0 &&
          frame[3] > 0 &&
          overlap(element.bbox, [{ x: frame[0], y: frame[1], width: frame[2], height: frame[3] }])
            .length,
      )
    ) {
      continue
    }
    const physical = cases.map(({ element, frame }) => ({ ...element, bbox: frame! }))
    if (
      !physical.some((unit) => unit.category === 'filled-box') ||
      !physical.some((unit) => unit.category === 'empty-box')
    )
      continue

    groupsWithFrameData++
    if (cases.some(({ element }) => !fullCoverage(element.bbox, byPage.get(element.page) ?? []))) {
      groupsWithIncompleteCoverage++
      continue
    }

    const profiles = (category: Element['category']) =>
      physical
        .filter((unit) => unit.category === category)
        .map((unit) => relativeMasks(unit, physical, byPage))
    const filled = profiles('filled-box')
    const empty = profiles('empty-box')
    if (filled.every((profile) => empty.every((other) => !sameProfile(profile, other)))) {
      groupsWithFrameGeometryCue++
    }
  }
  return {
    qcmGroupsAnnotated: groups.size,
    groupsWithFrameData,
    groupsWithIncompleteCoverage,
    groupsWithFrameGeometryCue,
  }
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

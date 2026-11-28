import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { reconstructAdaptiveLayout } from '../../src/detection/visual/graphic-corrections/adaptive-layout.ts'

const [tracePath, experimentPath, productionPath] = process.argv.slice(2)
if (!tracePath || !experimentPath)
  throw new Error('Usage: node check-adaptive-production.mjs <trace> <intermédiaire>')
function load(path) {
  const data = readFileSync(path)
  return JSON.parse(
    data.toString(data[0] === 255 && data[1] === 254 ? 'utf16le' : 'utf8').replace(/^\uFEFF/u, ''),
  )
}
const trace = load(tracePath)
const experiment = load(experimentPath)
const signature = (lists) =>
  lists
    .map((ids) =>
      ids
        .slice()
        .sort((a, b) => a - b)
        .join('/'),
    )
    .sort()
let checked = 0
for (const { sha256, key, model, predictions } of experiment) {
  // The module C1 does not receive the quarter-turn metadata of the Python experiment.
  const document = trace.docs.find((d) => d.sha256 === sha256)
  const page = document.pages.find((p) => p.key === key)
  const ids = new Map()
  const textItems = page.fragments.map((f, i) => {
    if (f.baseline) ids.set(i, f.baseline[1])
    const [x, y, r, b] = f.box
    return { text: 'x'.repeat(Math.max(f.chars, 1)), bbox: { x, y, width: r - x, height: b - y } }
  })
  const data = { ...page, pageIndex: 0, textItems }
  if (model.quarter_normalized === 0) {
    const result = reconstructAdaptiveLayout(data, ids)
    assert.deepEqual(
      signature(result.lines.map((l) => l.indices)),
      signature(predictions.xy_margin.parts),
      key,
    )
    checked++
  }
  if (productionPath) {
    const result = reconstructAdaptiveLayout(data)
    const serialize = (lines) => ({
      lines: lines.map(({ bbox: { x, y, width, height } }) => [x, y, x + width, y + height]),
      parts: lines.map(({ indices }) => indices),
    })
    const xy = serialize(result.xyBlocks.flatMap((ids) => ids.map((i) => result.lines[i])))
    page.production = {
      local: serialize(result.lines),
      xy,
      activation: result.activation,
      conditional:
        result.activation === 'off' ? { lines: page.baseline.lines.map((l) => l.box) } : xy,
    }
  }
}
console.log(`Parité des groupes de fragments TypeScript/Python sur ${checked} cas horizontaux.`)
if (productionPath) writeFileSync(productionPath, JSON.stringify(trace))

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { reconstructAdaptiveLayout } from '../../src/detection/visual/graphic-corrections/adaptive-layout.ts'

const [tracePath, experimentPath] = process.argv.slice(2)
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
  if (model.quarter_normalized !== 0) continue
  const document = trace.docs.find((d) => d.sha256 === sha256)
  const page = document.pages.find((p) => p.key === key)
  const ids = new Map()
  const textItems = page.fragments.map((f, i) => {
    if (f.baseline) ids.set(i, f.baseline[1])
    const [x, y, r, b] = f.box
    return { text: 'x'.repeat(Math.max(f.chars, 1)), bbox: { x, y, width: r - x, height: b - y } }
  })
  const result = reconstructAdaptiveLayout({ ...page, pageIndex: 0, textItems }, ids)
  assert.deepEqual(
    signature(result.lines.map((l) => l.indices)),
    signature(predictions.xy_margin.parts),
    key,
  )
  checked++
}
console.log(`Parité des groupes de fragments TypeScript/Python sur ${checked} cas horizontaux.`)

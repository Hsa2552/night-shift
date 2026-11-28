import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { locateRuledRegions } from './closed-rules.ts'

const frame = [
  { orientation: 'h', box: [0, 0, 13, 0.2] },
  { orientation: 'h', box: [15, 0, 40, 0.2] },
  { orientation: 'h', box: [0, 10, 40, 10.2] },
  { orientation: 'v', box: [0, 0, 0.2, 10] },
  { orientation: 'v', box: [40, 0, 40.2, 10] },
  { orientation: 'v', box: [20, 10, 20.2, 30] },
]
assert.equal(locateRuledRegions(frame, 10)[0].crossings, 4)
assert.deepEqual(
  locateRuledRegions(
    frame.filter((line) => line.orientation === 'h'),
    10,
  ),
  [],
)
assert.deepEqual(locateRuledRegions(frame, Number.NaN), [])

const [tracePath, experimentPath] = process.argv.slice(2)
if (tracePath && experimentPath) {
  function load(path) {
    const bytes = readFileSync(path)
    const encoding = bytes[0] === 255 && bytes[1] === 254 ? 'utf16le' : 'utf8'
    return JSON.parse(bytes.toString(encoding).replace(/^﻿/u, ''))
  }
  const trace = load(tracePath)
  const expected = load(experimentPath)
  for (const { sha256, key, model, predictions } of expected) {
    const document = trace.docs.find((doc) => doc.sha256 === sha256)
    const page = document.pages.find((page) => page.key === key)
    const actual = locateRuledRegions(page.objects ?? [], model.spacing.em)
    const byBox = (a, b) => a.box[1] - b.box[1] || a.box[0] - b.box[0]
    assert.deepEqual(actual.sort(byBox), predictions.rulings.sort(byBox), key)
  }
  console.log(`Parité Python/TypeScript sur ${expected.length} pages évaluées.`)
}

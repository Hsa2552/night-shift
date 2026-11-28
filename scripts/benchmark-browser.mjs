import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { decideDetection } from '../src/viewer/detectionDecision.ts'
import {
  GEO_METRICS_VERSION,
  provenanceKind,
  scoreGeo,
  scorePresentedGeo,
} from '../src/detection/eval/geo.ts'
import { scoreVisibleInk } from '../src/detection/eval/strict.ts'
import { browserRaster, gotoBuild, hash, openBrowserProbe, openBuild } from './pdf-parity.mjs'
import { displayedBlocks, masksOf } from './browser-masks.mjs'

const [checkout, split, cache, out] = process.argv.slice(2)
assert.ok(
  checkout && split && cache && out,
  'Usage: node scripts/benchmark-browser.mjs <checkout construit avec --manifest> <partition> <cache> <rapport.json hors dépôt>',
)
for (const directory of [process.cwd(), resolve(checkout)]) {
  for (const path of [cache, out]) {
    const fromRoot = relative(directory, resolve(path))
    assert.ok(
      isAbsolute(fromRoot) || fromRoot.startsWith('..' + sep),
      'Cache et rapport hors du dépôt',
    )
  }
}

const evaluation = resolve('src/detection/eval')
const manifest = await readFile(resolve(evaluation, 'corpus.tsv'))
const rows = manifest
  .toString('utf8')
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => line.split('\t'))
  .filter(([partition]) => split === 'all' || split === partition)
assert.ok(rows.length, 'Partition inconnue ou vide')
const documents = []
const release = await openBuild(resolve(checkout))
const origin = new URL(release.url).origin

async function fetchLocal(path) {
  return readFile(path).catch((error) => {
    if (error.code === 'ENOENT') return null
    throw error
  })
}

async function presented(page, file) {
  const reader = page.locator('.reader')
  const analyze = reader.getByRole('button', { name: 'Masquer les corrigés', exact: true })
  const alert = page.getByRole('alert')
  await page.locator('input[type=file]').setInputFiles(file)
  await analyze.or(alert).first().waitFor()
  if (await alert.count()) return { kind: 'error' }
  await analyze.click()
  const active = reader.locator('.reader-modes [aria-pressed=true]')
  await active.or(alert).first().waitFor()
  if (await alert.count()) return { kind: 'error' }
  if (await reader.getByTestId('progressive-mask').count()) {
    assert.equal(
      await reader.getByTestId('progressive-mask').count(),
      await reader.locator('[data-reader-page]').count(),
    )
    return {
      kind: 'progressive',
      reason: (await reader.getByText(/Les masques ne peuvent pas/).count())
        ? 'invalid-masks'
        : 'uncertain',
    }
  }
  const masks = await masksOf(page)
  if (!masks.length) {
    assert.equal(
      await reader.getByText('Aucun corrigé n’a été détecté.', { exact: true }).count(),
      1,
    )
    return { kind: 'statement_only' }
  }
  return { kind: 'automatic', blocks: await displayedBlocks(page, masks) }
}

function samePresentation(actual, expected) {
  if (actual.kind !== expected.kind) return false
  if (actual.kind === 'progressive') return actual.reason === expected.reason
  if (actual.kind !== 'automatic') return true
  if (actual.blocks.length !== expected.blocks.length) return false
  const byId = new Map(expected.blocks.map(({ id, regions }) => [id, regions]))
  return actual.blocks.every(({ id, regions }) => {
    const target = [...(byId.get(id) ?? [])]
    if (target.length !== regions.length) return false
    for (const { pageIndex, bbox } of regions) {
      const match = target.findIndex(
        (candidate) =>
          candidate.pageIndex === pageIndex &&
          ['x', 'y', 'width', 'height'].every(
            (key) => Math.abs(candidate.bbox[key] - bbox[key]) <= 0.01,
          ),
      )
      if (match === -1) return false
      target.splice(match, 1)
    }
    return true
  })
}

try {
  const context = await release.browser.newContext({
    serviceWorkers: 'block',
    viewport: { width: 1440, height: 900 },
  })
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
  )
  const stamp = await context.newPage()
  await gotoBuild(stamp, release)
  const userAgent = await stamp.evaluate(() => navigator.userAgent)
  await stamp.close()
  for (const [partition, name, family, url, expectedHash] of rows) {
    const doc = { partition, name, family }
    const file = resolve(cache, partition, `${name}.pdf`)
    const bytes = await fetchLocal(file)
    if (!bytes) {
      documents.push({
        ...doc,
        status: 'absent',
        detail: url === 'local' ? 'document local' : 'non téléchargé',
      })
      continue
    }
    doc.pdfSha256 = hash(bytes)
    if (doc.pdfSha256 !== expectedHash) {
      documents.push({ ...doc, status: 'empreinte différente' })
      continue
    }
    const annotation =
      (await fetchLocal(resolve(evaluation, 'annotations', partition, `${name}.geo.json`))) ??
      (await fetchLocal(resolve(cache, partition, `${name}.geo.json`)))
    if (!annotation) {
      documents.push({ ...doc, status: 'sans vérité' })
      continue
    }
    const page = await context.newPage()
    page.setDefaultTimeout(30000)
    try {
      const truth = JSON.parse(annotation)
      doc.truthSha256 = hash(annotation)
      doc.truthVersion = truth.format
      doc.provenance = truth.provenance
      doc.annotationSource = provenanceKind(truth.provenance)
      await gotoBuild(page, release)
      const start = performance.now()
      const actual = await presented(page, file)
      const durationMs = Math.round(performance.now() - start)
      if (actual.kind === 'error') {
        documents.push({
          ...doc,
          status: 'erreur',
          detail: await page.getByRole('alert').first().textContent(),
          presentation: scorePresentedGeo(truth, actual),
          durationMs,
        })
        continue
      }
      const probe = await openBrowserProbe(page, release, file)
      const raw = scoreGeo(truth, probe.result, probe.pages)
      const oracleMatches = samePresentation(actual, decideDetection(probe.result, probe.pages))
      const presentation = scorePresentedGeo(truth, actual)
      let ink
      if (process.env.UNSPOIL_BENCH_INK === '1') {
        const rasters = new Map()
        const getRaster = (index) => {
          if (!rasters.has(index)) rasters.set(index, browserRaster(page, index))
          return rasters.get(index)
        }
        ink = await scoreVisibleInk(truth, probe.result.blocks, probe.pages, getRaster)
        if (presentation.coverage) {
          presentation.ink = await scoreVisibleInk(
            truth,
            actual.blocks ?? [],
            probe.pages,
            getRaster,
          )
        }
      }
      await page.evaluate(() => window.parityPdf.close())
      documents.push({
        ...doc,
        ...raw,
        status: 'évalué',
        detail: raw.measurable ? undefined : 'aucune annotation c ou q',
        raster: true,
        durationMs,
        oracleMatches,
        ink,
        presentation,
        abstained: actual.kind === 'progressive',
        success: presentation.success,
      })
    } catch (error) {
      documents.push({ ...doc, status: 'erreur', detail: error.message })
    } finally {
      await page.close()
    }
  }
  const evaluated = documents.filter((d) => d.status === 'évalué' && d.measurable)
  const report = {
    format: 'unspoil-benchmark/2',
    metricsVersion: GEO_METRICS_VERSION,
    date: new Date().toISOString(),
    split,
    git: release.git,
    runtime: { environment: 'browser', version: release.browser.version(), userAgent },
    corpusVersion: hash(manifest).slice(0, 12),
    summary: {
      documents: documents.length,
      evaluated: evaluated.length,
      abstentions: evaluated.filter((doc) => doc.abstained).length,
      successes: evaluated.filter((doc) => doc.success).length,
      presentationMismatches: documents.filter((doc) => doc.oracleMatches === false).length,
      errors: documents.filter((doc) => doc.status === 'erreur').length,
    },
    documents,
  }
  await writeFile(out, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report.summary))
  if (report.summary.errors || report.summary.presentationMismatches) process.exitCode = 1
} finally {
  await release.close()
}

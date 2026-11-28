// @vitest-environment node
/// <reference types="node" />
//
// Benchmark du détecteur sur le corpus d'annales (manifeste corpus.tsv). Lancé par
// `npm run benchmark:dev` / `npm run benchmark:test` (scripts/benchmark.mjs), qui télécharge
// les PDF publics absents dans le cache et vérifie leurs empreintes. Désactivé sans
// UNSPOIL_BENCH_SPLIT. Rapports JSON et Markdown, comparaison avec l'exécution précédente.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { detectCorrections } from '../index.ts'
import { scoreGeo, type DocumentScore, type GeoTruth } from './geo.ts'
import { loadPdf } from './loader.ts'

const split = process.env.UNSPOIL_BENCH_SPLIT
const cacheDir = process.env.UNSPOIL_BENCH_CACHE ?? ''
const outDir = process.env.UNSPOIL_BENCH_OUT ?? join(cacheDir, 'rapports')
const here = join(process.cwd(), 'src/detection/eval')

interface Row {
  partition: string
  name: string
  family: string
  url: string
  sha256: string
}

interface DocReport extends Partial<DocumentScore> {
  partition: string
  name: string
  family: string
  status: 'évalué' | 'absent' | 'empreinte différente' | 'sans vérité' | 'erreur'
  detail?: string
  provenance?: string
  durationMs?: number
  raster?: boolean
}

const pct = (n: number, d: number) => (d === 0 ? '—' : `${((100 * n) / d).toFixed(1)} %`)

function readManifest(): Row[] {
  const lines = readFileSync(join(here, 'corpus.tsv'), 'utf8').trim().split(/\r?\n/)
  return lines.slice(1).map((l) => {
    const [partition, name, family, url, sha256] = l.split('\t')
    return { partition: partition!, name: name!, family: family!, url: url!, sha256: sha256! }
  })
}

function aggregate(docs: DocReport[]) {
  const done = docs.filter((d) => d.status === 'évalué' && d.measurable !== false)
  const sum = (f: (d: DocReport) => number) => done.reduce((a, d) => a + f(d), 0)
  const corr = sum((d) => d.corrections?.total ?? 0)
  const full = sum((d) => d.corrections?.full ?? 0)
  const stmts = sum((d) => d.statements?.total ?? 0)
  const masked = sum((d) => d.statements?.masked ?? 0)
  return {
    documents: docs.length,
    evaluated: done.length,
    notMeasurable: docs.filter((d) => d.status === 'évalué' && d.measurable === false).length,
    errors: docs.filter((d) => d.status !== 'évalué').length,
    kindCorrect: done.filter((d) => d.kindExpected === d.kindObtained).length,
    corrections: {
      total: corr,
      full,
      partial: sum((d) => d.corrections?.partial ?? 0),
      none: sum((d) => d.corrections?.none ?? 0),
    },
    leakRate: corr === 0 ? 0 : (corr - full) / corr,
    statements: { total: stmts, masked },
    overmaskRate: stmts === 0 ? 0 : masked / stmts,
    abstentions: done.filter((d) => d.abstained).length,
    successes: done.filter((d) => d.success).length,
    documentsWithLeak: done.filter((d) => (d.corrections?.total ?? 0) > (d.corrections?.full ?? 0))
      .length,
    meanDurationMs: done.length === 0 ? 0 : Math.round(sum((d) => d.durationMs ?? 0) / done.length),
  }
}

describe.skipIf(!split)('benchmark du détecteur', () => {
  it('évalue le corpus et écrit les rapports', { timeout: 3_600_000 }, async () => {
    const rows = readManifest().filter((r) => split === 'all' || r.partition === split)
    const fontsDir = join(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts/')
      .split('\\')
      .join('/')
    const docs: DocReport[] = []
    for (const row of rows) {
      const base: DocReport = {
        partition: row.partition,
        name: row.name,
        family: row.family,
        status: 'absent',
      }
      const pdfPath = join(cacheDir, row.partition, `${row.name}.pdf`)
      if (!existsSync(pdfPath)) {
        docs.push({
          ...base,
          detail: row.url === 'local' ? 'document local non public' : 'non téléchargé',
        })
        continue
      }
      const bytes = new Uint8Array(readFileSync(pdfPath))
      if (createHash('sha256').update(bytes).digest('hex') !== row.sha256) {
        docs.push({ ...base, status: 'empreinte différente' })
        continue
      }
      const repoTruth = join(here, 'annotations', row.partition, `${row.name}.geo.json`)
      const localTruth = join(cacheDir, row.partition, `${row.name}.geo.json`)
      const truthPath = existsSync(repoTruth)
        ? repoTruth
        : existsSync(localTruth)
          ? localTruth
          : null
      if (!truthPath) {
        docs.push({ ...base, status: 'sans vérité' })
        continue
      }
      const truth = JSON.parse(readFileSync(truthPath, 'utf8')) as GeoTruth
      try {
        const input = await loadPdf(bytes, {
          standardFontDataUrl: fontsDir,
          raster: process.env.UNSPOIL_BENCH_RASTER !== '0',
        })
        const t0 = performance.now()
        const result = await detectCorrections(input)
        const durationMs = Math.round(performance.now() - t0)
        await input.close()
        docs.push({
          ...base,
          status: 'évalué',
          provenance: truth.provenance,
          durationMs,
          raster: input.raster,
          ...scoreGeo(truth, result),
        })
      } catch (error) {
        docs.push({ ...base, status: 'erreur', detail: String(error) })
      }
    }

    // Erreurs de téléchargement transmises par le lanceur.
    const dlPath = join(outDir, `telechargements-${split}.json`)
    const downloads = existsSync(dlPath)
      ? (JSON.parse(readFileSync(dlPath, 'utf8')) as string[])
      : []

    const families = [...new Set(docs.map((d) => d.family))].sort()
    const report = {
      format: 'unspoil-benchmark/1',
      date: new Date().toISOString(),
      split,
      git: {
        sha: process.env.UNSPOIL_BENCH_GIT_SHA ?? 'inconnu',
        dirty: process.env.UNSPOIL_BENCH_GIT_DIRTY === '1',
      },
      corpusVersion: createHash('sha256')
        .update(readFileSync(join(here, 'corpus.tsv')))
        .digest('hex')
        .slice(0, 12),
      downloadErrors: downloads,
      summary: aggregate(docs),
      families: Object.fromEntries(
        families.map((f) => [f, aggregate(docs.filter((d) => d.family === f))]),
      ),
      documents: docs,
    }

    // Comparaison avec l'exécution précédente de la même partition.
    mkdirSync(outDir, { recursive: true })
    const latestPath = join(outDir, `${split}-dernier.json`)
    const previous = existsSync(latestPath)
      ? (JSON.parse(readFileSync(latestPath, 'utf8')) as typeof report)
      : null
    const regressions: string[] = []
    const resolved: string[] = []
    if (previous) {
      for (const d of docs.filter((x) => x.status === 'évalué')) {
        const p = previous.documents.find((x) => x.name === d.name && x.status === 'évalué')
        if (!p) continue
        const leaks = (x: DocReport) => (x.corrections?.total ?? 0) - (x.corrections?.full ?? 0)
        if (p.success && !d.success) regressions.push(`${d.name} : réussite perdue`)
        else if (leaks(d) > leaks(p))
          regressions.push(`${d.name} : fuites ${leaks(p)} → ${leaks(d)}`)
        else if ((d.statements?.masked ?? 0) > (p.statements?.masked ?? 0) + 2)
          regressions.push(
            `${d.name} : énoncés masqués ${p.statements?.masked} → ${d.statements?.masked}`,
          )
        if (!p.success && d.success) resolved.push(`${d.name} : réussite obtenue`)
        else if (leaks(d) < leaks(p)) resolved.push(`${d.name} : fuites ${leaks(p)} → ${leaks(d)}`)
      }
    }
    const comparison = previous
      ? { previousSha: previous.git.sha, previousDate: previous.date, regressions, resolved }
      : null
    const full = { ...report, comparison }
    const stamp = full.date.replace(/[:.]/g, '-')
    writeFileSync(join(outDir, `${split}-${stamp}.json`), JSON.stringify(full, null, 1))
    writeFileSync(latestPath, JSON.stringify(full, null, 1))
    const md = markdown(full)
    writeFileSync(join(outDir, `${split}-${stamp}.md`), md)
    writeFileSync(join(outDir, `${split}-dernier.md`), md)
    console.log(md)
    expect(docs.length).toBe(rows.length)
  })
})

function markdown(r: {
  date: string
  split?: string
  git: { sha: string; dirty: boolean }
  corpusVersion: string
  downloadErrors: string[]
  summary: ReturnType<typeof aggregate>
  families: Record<string, ReturnType<typeof aggregate>>
  documents: DocReport[]
  comparison: {
    previousSha: string
    previousDate: string
    regressions: string[]
    resolved: string[]
  } | null
}) {
  const s = r.summary
  const row = (name: string, a: ReturnType<typeof aggregate>) =>
    `| ${name} | ${a.evaluated}/${a.documents} | ${a.successes} (${pct(a.successes, a.evaluated)}) | ` +
    `${a.abstentions} (${pct(a.abstentions, a.evaluated)}) | ${a.documentsWithLeak} | ` +
    `${a.corrections.full}/${a.corrections.total} | ${a.corrections.partial} | ${a.corrections.none} | ` +
    `${pct(a.corrections.total - a.corrections.full, a.corrections.total)} | ` +
    `${a.statements.masked}/${a.statements.total} (${pct(a.statements.masked, a.statements.total)}) | ${a.meanDurationMs} ms |`
  const head =
    '| | Documents évalués | Réussite automatique | Abstention | Documents avec fuite | Corrections entièrement masquées | Partiellement | Non masquées | Taux de fuite (unités) | Lignes d’énoncé masquées | Temps moyen |\n' +
    '|---|---|---|---|---|---|---|---|---|---|---|'
  const lines = [
    `# Benchmark Unspoil, partition « ${r.split} »`,
    '',
    `- Date : ${r.date}`,
    `- Commit : \`${r.git.sha}\`${r.git.dirty ? ' (modifications locales non commitées)' : ''}`,
    `- Version du corpus (empreinte de corpus.tsv) : \`${r.corpusVersion}\``,
    `- Documents : ${s.documents}, évalués : ${s.evaluated}, non mesurables (aucune unité annotée) : ${s.notMeasurable}, non évalués : ${s.errors}`,
    `- Unités : lignes reconstruites ou cases annotées (corrections c, énoncés q) ; une correction est entièrement masquée si 95 % de sa surface est couverte, non masquée sous 5 %.`,
    '',
    '## Synthèse',
    '',
    head,
    row('Total', s),
    '',
    '## Par famille',
    '',
    head,
    ...Object.entries(r.families).map(([f, a]) => row(f, a)),
    '',
    '## Par document',
    '',
    '| Document | Famille | Statut | Type attendu → obtenu | Corrections entières / partielles / absentes | Énoncés masqués | Blocs (masqués, indépendants) | Réussite | Temps |',
    '|---|---|---|---|---|---|---|---|---|',
    ...r.documents.map((d) =>
      d.status !== 'évalué'
        ? `| ${d.name} | ${d.family} | ${d.status}${d.detail ? ` (${d.detail})` : ''} | | | | | | |`
        : `| ${d.name} | ${d.family} | évalué${d.raster ? '' : ' (texte seul)'}${d.measurable === false ? ', non mesurable' : ''} | ${d.kindExpected} → ${d.kindObtained}${d.abstained ? ' (abstention)' : ''} | ` +
          `${d.corrections!.full} / ${d.corrections!.partial} / ${d.corrections!.none} sur ${d.corrections!.total} | ` +
          `${d.statements!.masked}/${d.statements!.total} | ` +
          `${d.blocks!.total ? `${d.blocks!.fullyMasked}, ${d.blocks!.independent} sur ${d.blocks!.total}` : '—'} | ${d.success ? 'oui' : 'non'} | ${d.durationMs} ms |`,
    ),
    '',
    '## Comparaison avec l’exécution précédente',
    '',
    r.comparison
      ? [
          `Précédente : \`${r.comparison.previousSha}\` (${r.comparison.previousDate})`,
          '',
          `Régressions (${r.comparison.regressions.length}) :`,
          ...r.comparison.regressions.map((x) => `- ${x}`),
          '',
          `Résolus (${r.comparison.resolved.length}) :`,
          ...r.comparison.resolved.map((x) => `- ${x}`),
        ].join('\n')
      : 'Aucune exécution précédente pour cette partition.',
    '',
    '## Erreurs de téléchargement',
    '',
    r.downloadErrors.length ? r.downloadErrors.map((e) => `- ${e}`).join('\n') : 'Aucune.',
    '',
  ]
  return lines.join('\n')
}

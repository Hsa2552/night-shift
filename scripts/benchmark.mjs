#!/usr/bin/env node
// Lanceur du benchmark (Windows et Linux) : `npm run benchmark:dev`, `npm run benchmark:test`.
// 1. lit src/detection/eval/corpus.tsv ;
// 2. télécharge dans le cache les PDF publics absents et vérifie leur SHA-256 ;
// 3. lance le benchmark (vitest, environnement Node) avec le vrai lecteur et détecteur.
// Options : <partition> (dev, test, ensai-dev, ensai-test, all), --cache <dossier>,
// --out <dossier>, --hors-ligne (aucun téléchargement), --texte-seul (sans raster).
// Cache par défaut : UNSPOIL_CORPUS_DIR, sinon ~/.cache/unspoil-corpus. Aucun PDF n'est
// écrit dans le dépôt.
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const option = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const valued = new Set(['--cache', '--out'])
const positional = args.filter((a, i) => !a.startsWith('--') && !valued.has(args[i - 1]))
const split = positional[0] ?? 'dev'
const cache = resolve(
  option('--cache') ??
    process.env.UNSPOIL_CORPUS_DIR ??
    join(homedir(), '.cache', 'unspoil-corpus'),
)
const out = resolve(option('--out') ?? join(cache, 'rapports'))
const offline = args.includes('--hors-ligne')

if (cache.startsWith(root)) {
  console.error(
    `Refus : le cache (${cache}) doit être hors du dépôt, les PDF n'y sont pas publiés.`,
  )
  process.exit(2)
}

const manifest = readFileSync(join(root, 'src/detection/eval/corpus.tsv'), 'utf8')
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((l) => {
    const [partition, name, family, url, sha256] = l.split('\t')
    return { partition, name, family, url, sha256 }
  })
  .filter((r) => split === 'all' || r.partition === split)
if (manifest.length === 0) {
  console.error(`Partition inconnue ou vide : ${split}`)
  process.exit(2)
}

const errors = []
for (const row of manifest) {
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(row.name)) {
    errors.push(`${row.name} : nom invalide`)
    continue
  }
  const dir = join(cache, row.partition)
  const target = join(dir, `${row.name}.pdf`)
  if (existsSync(target)) continue
  if (row.url === 'local' || offline) continue
  try {
    const res = await fetch(row.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (unspoil-benchmark)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(60_000),
    })
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.subarray(0, 4).toString('latin1') !== '%PDF') {
      errors.push(`${row.name} : la réponse n'est pas un PDF (HTTP ${res.status})`)
      continue
    }
    const sha = createHash('sha256').update(bytes).digest('hex')
    if (sha !== row.sha256) {
      errors.push(
        `${row.name} : empreinte différente de celle du manifeste (document modifié en ligne ?)`,
      )
      continue
    }
    mkdirSync(dir, { recursive: true })
    writeFileSync(target, bytes, { flag: 'wx' })
    console.log(`téléchargé : ${row.partition}/${row.name}`)
  } catch (error) {
    errors.push(`${row.name} : ${error instanceof Error ? error.message : String(error)}`)
  }
}
mkdirSync(out, { recursive: true })
writeFileSync(join(out, `telechargements-${split}.json`), JSON.stringify(errors, null, 1))

const git = (...a) => {
  try {
    return execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}
let canvas = true
try {
  await import('@napi-rs/canvas')
} catch {
  canvas = false
  console.warn(
    'Rendu raster indisponible (@napi-rs/canvas absent) : évaluation texte seul. ' +
      'Pour l’activer : npm install --no-save @napi-rs/canvas',
  )
}

const result = spawnSync(
  process.execPath,
  [join(root, 'node_modules/vitest/vitest.mjs'), 'run', 'src/detection/eval/benchmark.test.ts'],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      UNSPOIL_BENCH_SPLIT: split,
      UNSPOIL_BENCH_CACHE: cache,
      UNSPOIL_BENCH_OUT: out,
      UNSPOIL_BENCH_GIT_SHA: git('rev-parse', 'HEAD') || 'inconnu',
      UNSPOIL_BENCH_GIT_DIRTY: git('status', '--porcelain') ? '1' : '0',
      UNSPOIL_BENCH_RASTER: args.includes('--texte-seul') || !canvas ? '0' : '1',
    },
  },
)
console.log(
  `\nRapports : ${join(out, `${split}-dernier.md`)} et ${join(out, `${split}-dernier.json`)}`,
)
process.exit(result.status ?? 1)

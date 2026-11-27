// @vitest-environment node
/// <reference types="node" />
//
// Évaluation du détecteur sur un dossier de PDF locaux (jamais envoyés ailleurs).
// Désactivée par défaut. Usage :
//   UNSPOIL_EVAL_DIR=chemin/vers/pdf npx vitest run src/detection/eval
// (UNSPOIL_EVAL_RASTER=0 pour évaluer le texte seul, UNSPOIL_EVAL_VERBOSE=1 pour les régions.)
// Pour chaque `x.pdf`, la vérité terrain est lue dans `x.verite.json` (voir metrics.ts).
// Sans vérité, le test écrit `x.a-annoter.json` : les lignes du document avec le rôle
// deviné par le détecteur, à corriger à la main (q, c ou t) puis à renommer en `x.verite.json`.
// Le rendu raster (couleurs, figures) n'est utilisé que si `@napi-rs/canvas` est installé
// localement (`npm install --no-save @napi-rs/canvas`) ; ce paquet n'est volontairement pas
// une dépendance du projet.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { describe, expect, it } from 'vitest'
import { readPageText } from '../../pdf/read-text.ts'
import type { DetectionInput, PageData, RasterData } from '../contract.ts'
import { detectCorrections } from '../index.ts'
import { layoutPage } from '../layout.ts'
import { coverage, evaluate, type Truth, type TruthElement } from './metrics.ts'

const dir = process.env.UNSPOIL_EVAL_DIR

async function load(file: string): Promise<DetectionInput & { raster: boolean }> {
  const fontsDir = join(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts/')
    .split('\\')
    .join('/')
  const doc = await getDocument({
    data: new Uint8Array(readFileSync(file)),
    standardFontDataUrl: fontsDir,
    useSystemFonts: false,
  }).promise
  const pages: PageData[] = []
  for (let p = 0; p < doc.numPages; p++) {
    const page = await doc.getPage(p + 1)
    const { width, height, transform } = page.getViewport({ scale: 1 })
    // Même lecture que le module PDF (readPageText), sans contournement : on mesure l'application réelle.
    const textItems = await readPageText(page, transform, false)
    pages.push({ pageIndex: p, width, height, textItems })
  }
  // Même principe que getRaster du module PDF : échelle 1, fond blanc. La fabrique de
  // canvas de pdf.js sous Node exige @napi-rs/canvas : sans lui, pas de raster.
  const factory = doc.canvasFactory as {
    create(w: number, h: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }
  }
  let raster = process.env.UNSPOIL_EVAL_RASTER !== '0'
  if (raster)
    try {
      factory.create(1, 1)
    } catch {
      raster = false
    }
  const getRaster = raster
    ? async (pageIndex: number): Promise<RasterData> => {
        const page = await doc.getPage(pageIndex + 1)
        const viewport = page.getViewport({ scale: 1 })
        const { canvas, context } = factory.create(
          Math.round(viewport.width),
          Math.round(viewport.height),
        )
        await page.render({ canvasContext: context, canvas, viewport, background: '#fff' }).promise
        const { width, height } = canvas
        return { width, height, rgba: context.getImageData(0, 0, width, height).data }
      }
    : undefined
  return { pages, getRaster, raster }
}

const short = (e: TruthElement) => `p${e.pageIndex + 1} « ${(e.text ?? '').slice(0, 50)} »`

describe.skipIf(!dir)('évaluation sur PDF locaux', () => {
  it('mesure fuites et sur-masquage', { timeout: 600_000 }, async () => {
    const files = readdirSync(dir!)
      .filter((f) => f.toLowerCase().endsWith('.pdf'))
      .sort()
    const lines: string[] = []
    let corrections = 0
    let leaked = 0
    let questions = 0
    let overmasked = 0
    let kindOk = 0
    let evaluated = 0
    for (const f of files) {
      const path = join(dir!, f)
      const input = await load(path)
      if (lines.length === 0) lines.push(`Raster : ${input.raster ? 'oui' : 'non (texte seul)'}`)
      const result = await detectCorrections(input)
      const truthPath = path.replace(/\.pdf$/i, '.verite.json')
      if (!existsSync(truthPath)) {
        // Fichier à annoter : une entrée par ligne reconstruite, rôle deviné.
        const regions = result.blocks.flatMap((b) => b.regions)
        const elements = input.pages.flatMap((page) =>
          layoutPage(page).lines.map((l) => ({
            pageIndex: page.pageIndex,
            role: coverage(l.bbox, page.pageIndex, regions) > 0.5 ? 'c' : 'q',
            text: l.text,
            bbox: l.bbox,
          })),
        )
        writeFileSync(
          path.replace(/\.pdf$/i, '.a-annoter.json'),
          JSON.stringify({ kind: result.kind, elements }, null, 1),
        )
        lines.push(
          `${f} : ${result.kind}, ${result.blocks.length} blocs (sans vérité, fichier à annoter écrit)`,
        )
        continue
      }
      if (process.env.UNSPOIL_EVAL_VERBOSE) {
        for (const b of result.blocks) {
          const r = b.regions.map(({ pageIndex, bbox }) =>
            [pageIndex, bbox.x, bbox.y, bbox.width, bbox.height].map((v) => +v.toFixed(1)),
          )
          lines.push(`   ${f} ${b.id} [${b.questionLabel ?? '-'}] ${JSON.stringify(r)}`)
        }
      }
      const truth = JSON.parse(readFileSync(truthPath, 'utf8')) as Truth
      const ev = evaluate(truth, result)
      evaluated++
      corrections += ev.corrections
      leaked += ev.leaked.length
      questions += ev.questions
      overmasked += ev.overmasked.length
      if (ev.kindOk) kindOk++
      lines.push(
        `${ev.kindOk ? 'OK ' : 'KO '} ${f} : attendu ${ev.expectedKind}, obtenu ${ev.kind} ; ` +
          `corrections visibles ${ev.leaked.length}/${ev.corrections} ; ` +
          `énoncés masqués ${ev.overmasked.length}/${ev.questions}`,
      )
      for (const e of ev.leaked) lines.push(`     visible : ${short(e)}`)
      for (const e of ev.overmasked) lines.push(`     masqué  : ${short(e)}`)
    }
    lines.push(
      `TOTAL ${evaluated} documents évalués : type correct ${kindOk}/${evaluated} ; ` +
        `corrections visibles ${leaked}/${corrections} ; énoncés masqués ${overmasked}/${questions}`,
    )
    const report = lines.join('\n')
    writeFileSync(join(dir!, 'rapport-evaluation.txt'), report)
    console.log(report)
    expect(evaluated + files.length).toBeGreaterThan(0)
  })
})

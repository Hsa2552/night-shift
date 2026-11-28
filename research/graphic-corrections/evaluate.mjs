import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const [server, ...pairs] = process.argv.slice(2)
if (!server || !pairs.length || pairs.length % 2)
  throw new Error('Usage: node evaluate.mjs <Vite local> <fiche JSON> <PDF> ...')
const url = new URL(server)
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
  throw new Error('Le diagnostic utilise uniquement Vite local')
const playwright = process.env.UNSPOIL_PLAYWRIGHT_MODULE
const { chromium } = await import(playwright ? pathToFileURL(playwright).href : 'playwright-core')
const browser = await chromium.launch({ channel: 'msedge' })
try {
  const tab = await browser.newPage()
  await tab.route('**/*', (route) =>
    new URL(route.request().url()).origin === url.origin ? route.continue() : route.abort(),
  )
  const lab = new URL('/__unspoil_graphics_lab__', url).href
  await tab.route(lab, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Unspoil graphic diagnostic</title>' }),
  )
  await tab.goto(lab)
  const reports = []
  for (let i = 0; i < pairs.length; i += 2) {
    const spec = JSON.parse(await readFile(pairs[i], 'utf8'))
    const bytes = await readFile(pairs[i + 1])
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    if (sha256 !== spec.sha256) throw new Error('Les annotations ne correspondent pas au PDF')
    const data = await tab.evaluate(
      async ({ encoded, spec }) => {
        const { evaluate } = await import('/research/graphic-corrections/evaluate-browser.ts')
        return evaluate(
          Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)),
          spec,
        )
      },
      { encoded: bytes.toString('base64'), spec },
    )
    reports.push({ sha256, ...data })
  }
  console.log(JSON.stringify(reports, null, 2))
} finally {
  await browser.close()
}

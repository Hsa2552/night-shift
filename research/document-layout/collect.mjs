import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const [server, ...inputs] = process.argv.slice(2)
if (!server || !inputs.length)
  throw new Error('Usage: node collect.mjs <Vite local> <PDF ou JSON synthétique>...')
const url = new URL(server)
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  throw new Error('Le laboratoire requiert un serveur local')

const playwright = process.env.UNSPOIL_PLAYWRIGHT_MODULE
const { chromium } = await import(playwright ? pathToFileURL(playwright).href : 'playwright-core')
const browser = await chromium.launch({ channel: process.env.UNSPOIL_CHANNEL ?? 'msedge' })
try {
  const tab = await browser.newPage()
  await tab.route('**/*', (route) =>
    new URL(route.request().url()).origin === url.origin ? route.continue() : route.abort(),
  )
  const lab = new URL('/__unspoil_layout_lab__', url).href
  await tab.route(lab, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Unspoil layout lab</title>' }),
  )
  await tab.goto(lab)
  const sources = {}
  for (const path of ['/src/detection/layout.ts', '/research/document-layout/pdf-browser.ts']) {
    const text = await tab.evaluate(async (path) => (await import(path + '?raw')).default, path)
    sources[path] = createHash('sha256').update(text).digest('hex')
  }
  const docs = []
  for (const file of inputs) {
    const bytes = await readFile(file)
    const pdf = !file.endsWith('.json')
    const payload = pdf ? bytes.toString('base64') : JSON.parse(bytes.toString('utf8'))
    const document = await tab.evaluate(
      async ({ payload, pdf }) => {
        const { extract, simulate } = await import('/research/document-layout/pdf-browser.ts')
        if (!pdf) return simulate(payload)
        return extract(Uint8Array.from(atob(payload), (char) => char.charCodeAt(0)))
      },
      { payload, pdf },
    )
    docs.push({ sha256: createHash('sha256').update(bytes).digest('hex'), ...document })
  }
  console.log(JSON.stringify({ format: 'unspoil-layout-research/1', sources, docs }))
} finally {
  await browser.close()
}

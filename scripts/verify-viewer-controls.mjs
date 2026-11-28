import assert from 'node:assert/strict'
import { basename, resolve } from 'node:path'
import { chromium } from 'playwright-core'

const [url, scenario, ...inputs] = process.argv.slice(2)
assert.ok(
  url && ['observe', 'assert'].includes(scenario) && inputs.length > 1,
  'Usage: node scripts/verify-viewer-controls.mjs <URL> <observe|assert> <PDF> <PDF>…',
)
const address = new URL(url)
const browser = await chromium.launch({ channel: process.env.UNSPOIL_CHANNEL || 'msedge' })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
page.setDefaultTimeout(20000)
const reader = page.locator('.reader')
const maskButton = reader.getByRole('button', { name: 'Masquer les corrigés', exact: true })
const remask = reader.getByRole('button', { name: 'Tout remasquer', exact: true })
const progressive = reader.getByRole('button', { name: 'Révélation progressive', exact: true })
const masks = reader.getByTestId('correction-mask')
const actions = reader.locator('[data-block-action]')

async function open(file) {
  await page.locator('input[type=file]').setInputFiles(resolve(file))
  await page.getByRole('heading', { name: basename(file), exact: true }).waitFor()
  await reader.getByTestId('page-cover').first().waitFor()
  assert.equal(
    await reader.getByTestId('page-cover').count(),
    await reader.locator('[data-reader-page]').count(),
  )
}

async function analyze() {
  await maskButton.click()
  await reader
    .locator('.reader-modes [aria-pressed=true]')
    .or(reader.getByRole('alert'))
    .first()
    .waitFor()
  assert.equal(await reader.getByRole('alert').count(), 0)
}

async function actionLocations() {
  return actions.evaluateAll((buttons) =>
    buttons
      .map((button) => ({
        id: button.dataset.blockAction,
        mount: button.closest('.pdf-viewer-actions') ? 'rail' : 'inline',
        visible:
          button.getClientRects().length > 0 && getComputedStyle(button).visibility === 'visible',
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  )
}

async function assertToolbar() {
  for (const button of [maskButton.or(remask), progressive]) {
    const rect = await button.boundingBox()
    assert.ok(
      rect && rect.y >= 0 && rect.y + rect.height <= page.viewportSize().height,
      'Une commande globale doit rester dans la fenêtre',
    )
  }
}

try {
  await page.goto(address.href)
  await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 60000 })
  const published = await page.locator('script[type=module][src]').first().getAttribute('src')
  if (process.env.UNSPOIL_EXPECT_ENTRY) assert.equal(published, process.env.UNSPOIL_EXPECT_ENTRY)
  console.log(
    JSON.stringify({
      entry: published,
      scope: await page.evaluate(
        async () => (await navigator.serviceWorker.getRegistration())?.scope,
      ),
    }),
  )
  let automatic = 0
  for (const file of inputs) {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(file)
    await analyze()
    const total = await masks.count()
    if (!total) {
      console.log(
        JSON.stringify({
          file: basename(file),
          masks: 0,
          progressive: (await progressive.getAttribute('aria-pressed')) === 'true',
        }),
      )
      continue
    }
    automatic++
    const desktop = await actionLocations()
    assert.ok(desktop.length > 0)
    assert.equal(new Set(desktop.map(({ id }) => id)).size, desktop.length)
    const initialNodes = await actions.elementHandles()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(120)
    const mobile = await actionLocations()
    const last = reader.locator('[data-reader-page]').last()
    const firstPage = reader.locator('[data-reader-page]').first()
    await last.evaluate((sheet) => sheet.scrollIntoView())
    await firstPage.evaluate((sheet) => sheet.scrollIntoView())
    await last.evaluate((sheet) => sheet.scrollIntoView())
    await assertToolbar()
    await reader.getByRole('button', { name: 'Zoom avant' }).click()
    await reader.getByRole('button', { name: 'Zoom avant' }).click()
    await page.waitForTimeout(120)
    const zoom = await actionLocations()
    await last.evaluate((sheet) => sheet.scrollIntoView())
    await assertToolbar()
    const replacedNodes = (
      await Promise.all(initialNodes.map((handle) => handle.evaluate((el) => !el.isConnected)))
    ).filter(Boolean).length
    const first = actions.first()
    const id = await first.getAttribute('data-block-action')
    const individual = reader.locator('[data-block-action=' + JSON.stringify(id) + ']')
    await individual.click()
    await individual.and(reader.locator('[data-revealed]')).waitFor()
    const exposed = total - (await masks.count())
    assert.ok(exposed > 0)
    const globalRemask = await remask.isEnabled()
    if (scenario === 'assert') {
      const direct = reader.locator('[data-block-region=' + JSON.stringify(id) + ']').first()
      await direct.click()
      assert.equal(await masks.count(), total)
      await direct.click()
      assert.equal(await masks.count(), total - exposed)
      assert.deepEqual(mobile, desktop)
      assert.deepEqual(zoom, desktop)
      assert.equal(replacedNodes, 0)
      assert.ok(desktop.every(({ visible }) => visible))
      assert.ok(globalRemask, 'La commande globale doit être actionnable après une révélation')
      await remask.click()
      await page.waitForFunction(
        (count) =>
          document.querySelectorAll('.reader [data-testid=correction-mask]').length === count,
        total,
      )
      assert.equal(await remask.isEnabled(), false)
    } else {
      await individual.click()
    }
    await progressive.click()
    await reader.getByTestId('progressive-mask').first().waitFor()
    assert.equal(await actions.count(), 0)
    assert.equal(
      await reader.getByTestId('progressive-mask').count(),
      await reader.locator('[data-reader-page]').count(),
    )
    await analyze()
    assert.equal(await masks.count(), total)
    console.log(
      JSON.stringify({
        file: basename(file),
        pages: await reader.locator('[data-reader-page]').count(),
        blocks: desktop.length,
        masks: total,
        groupedMasks: await masks.and(reader.locator('[data-grouped-mask]')).count(),
        inline: [desktop, mobile, zoom].map(
          (locations) => locations.filter(({ mount }) => mount === 'inline').length,
        ),
        replacedNodes,
        exposed,
        globalRemask,
      }),
    )
  }
  assert.ok(automatic >= 2, 'La recette exige au moins deux documents avec des blocs automatiques.')
  await context.setOffline(true)
  await page.reload()
  await open(inputs[0])
  await analyze()
  assert.ok(await masks.count())
  await assertToolbar()
  console.log(JSON.stringify({ offline: true, automatic }))
} finally {
  await browser.close()
}

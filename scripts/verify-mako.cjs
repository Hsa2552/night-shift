const assert = require('node:assert/strict')
const { mkdirSync, readFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { basename, join, resolve } = require('node:path')
const { chromium } = require(process.env.UNSPOIL_PLAYWRIGHT || 'playwright')

const url = process.env.UNSPOIL_URL || 'http://127.0.0.1:4173/'
const captureDir = process.env.UNSPOIL_CAPTURES || join(tmpdir(), 'unspoil-mako-captures')
const fixture = (name) => resolve('src/detection/samples', name)
const dimensions = [
  [1440, 900],
  [1280, 800],
  [768, 1024],
  [390, 844],
  [360, 800],
  [844, 390],
]
const revealName = /Révéler la correction|Afficher le corrigé/
const fileField = (page) => page.locator('input[type=file]')
const reader = (page) => page.locator('.reader')

async function open(page, filename) {
  await fileField(page).setInputFiles(filename)
  const name = typeof filename === 'string' ? basename(filename) : filename.name
  await page.getByRole('heading', { name, exact: true }).waitFor()
  await reader(page).getByTestId('page-cover').first().waitFor()
  assert.equal(
    await reader(page)
      .locator('canvas')
      .first()
      .evaluate((canvas) => getComputedStyle(canvas).visibility),
    'hidden',
  )
}

async function checkGeometry(page) {
  const state = await reader(page)
    .getByTestId('correction-mask')
    .evaluateAll((masks) =>
      masks.map((mask) => {
        const parent = mask.parentElement.getBoundingClientRect()
        const rect = mask.getBoundingClientRect()
        const style = getComputedStyle(mask)
        return {
          white: style.backgroundColor === 'rgb(255, 255, 255)' && style.opacity === '1',
          errors: [
            rect.left - parent.left - (parseFloat(mask.style.left) * parent.width) / 100,
            rect.top - parent.top - (parseFloat(mask.style.top) * parent.height) / 100,
            rect.width - (parseFloat(mask.style.width) * parent.width) / 100,
            rect.height - (parseFloat(mask.style.height) * parent.height) / 100,
          ],
        }
      }),
    )
  assert.ok(state.length > 0)
  for (const mask of state) {
    assert.ok(mask.white)
    assert.ok(
      mask.errors.every((error) => Math.abs(error) < 1.1),
      JSON.stringify(mask.errors),
    )
  }
}

async function analyze(page) {
  await page.getByRole('button', { name: 'Masquer les corrigés', exact: true }).click()
  await reader(page)
    .getByText(/blocs? de corrigé détectés?/)
    .waitFor()
}

async function assertNoOverflow(page) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
}

async function readyHome(page) {
  await page.goto(url)
  await page.locator('.demo-preview canvas').waitFor()
  await page.waitForFunction(() => document.querySelector('.demo-preview canvas')?.width > 0)
  assert.ok(
    await page.evaluate(async () => {
      await document.fonts.ready
      return [...document.fonts].some((font) => font.family === 'Geist' && font.status === 'loaded')
    }),
  )
  await page.locator('.brand img:visible').evaluate((img) => img.decode())
}

function graphicPdf(pageCount) {
  const graphics = '0.1 0.25 0.8 rg 36 370 300 55 re f\n'
  const pages = Array.from({ length: pageCount }, (_, i) => i + 3 + ' 0 R')
  const stream = 3 + pageCount
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [' + pages.join(' ') + '] /Count ' + pageCount + ' >>',
    ...pages.map(
      () => '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 540] /Contents ' + stream + ' 0 R >>',
    ),
    '<< /Length ' + Buffer.byteLength(graphics) + ' >>\nstream\n' + graphics + 'endstream',
  ]
  let text = '%PDF-1.4\n'
  const offsets = objects.map((object, index) => {
    const offset = Buffer.byteLength(text)
    text += index + 1 + ' 0 obj\n' + object + '\nendobj\n'
    return offset
  })
  const xref = Buffer.byteLength(text)
  text += 'xref\n0 ' + (offsets.length + 1) + '\n0000000000 65535 f \n'
  text += offsets.map((offset) => String(offset).padStart(10, '0') + ' 00000 n \n').join('')
  text +=
    'trailer\n<< /Root 1 0 R /Size ' +
    (offsets.length + 1) +
    ' >>\nstartxref\n' +
    xref +
    '\n%%EOF\n'
  return {
    name: 'pages-graphiques-synthetiques.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(text),
  }
}

async function capture(browser) {
  for (const [width, height] of dimensions) {
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({
        viewport: { width, height },
        colorScheme: theme,
        reducedMotion: 'reduce',
      })
      await readyHome(page)
      await assertNoOverflow(page)
      await page.screenshot({
        path: join(captureDir, 'accueil-' + width + 'x' + height + '-' + theme + '.jpg'),
        type: 'jpeg',
        quality: 86,
      })
      await open(page, fixture('mixte.pdf'))
      await analyze(page)
      await checkGeometry(page)
      await page.waitForFunction(() => document.querySelector('.reader canvas')?.width > 0)
      await assertNoOverflow(page)
      await page.screenshot({
        path: join(captureDir, 'lecteur-' + width + 'x' + height + '-' + theme + '.jpg'),
        type: 'jpeg',
        quality: 86,
      })
      await page.close()
    }
  }
  const logos = await browser.newPage({ viewport: { width: 680, height: 432 } })
  await logos.goto(url)
  const variants = [
    ['Fond clair', '#F8FAFC', '#0F172A', 'brand/unspoil-clair.svg'],
    ['Fond sombre', '#0B1020', '#E8EEF8', 'brand/unspoil-sombre.svg'],
  ]
  await logos.setContent(
    '<style>body{margin:0;font:14px system-ui}.row{padding:20px 28px 26px}.word{width:210px;display:block;margin:12px 0 18px}.icons{display:flex;align-items:end;gap:22px}.icons span{display:grid;gap:6px;justify-items:center}</style>' +
      variants
        .map(
          ([label, bg, color, image]) =>
            '<div class="row" style="background:' +
            bg +
            ';color:' +
            color +
            '">' +
            label +
            '<img class="word" src="' +
            new URL(image, url) +
            '"><div class="icons">' +
            [16, 24, 32]
              .map(
                (size) =>
                  '<span><img width="' +
                  size +
                  '" height="' +
                  size +
                  '" src="' +
                  new URL('favicon.svg', url) +
                  '">' +
                  size +
                  ' px</span>',
              )
              .join('') +
            '</div></div>',
        )
        .join(''),
  )
  await logos
    .locator('img')
    .evaluateAll((images) => Promise.all(images.map((image) => image.decode())))
  await logos.screenshot({ path: join(captureDir, 'logo-echelles.jpg'), type: 'jpeg', quality: 90 })
  await logos.close()
  console.log('24 captures accueil/lecteur, 6 résolutions, deux thèmes, et planche logo.')
}

async function desktop(browser) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'reduce',
  })
  await readyHome(page)
  const demo = page.locator('.demo-preview')
  const demoMasks = await demo.getByTestId('correction-mask').count()
  await demo.getByRole('button', { name: /Révéler la correction.*Lancer un dé/ }).click()
  await demo.getByRole('button', { name: /Remasquer.*Lancer un dé/ }).waitFor()
  assert.equal(await demo.getByTestId('correction-mask').count(), demoMasks - 1)
  await demo.getByRole('button', { name: /Remasquer.*Lancer un dé/ }).click()
  await demo.getByRole('button', { name: /Révéler la correction.*Lancer un dé/ }).waitFor()
  assert.equal(await demo.getByTestId('correction-mask').count(), demoMasks)

  const transfer = await page.evaluateHandle(
    (data) => {
      const transfer = new DataTransfer()
      const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0))
      transfer.items.add(new File([bytes], 'mixte-déposé.pdf', { type: 'application/pdf' }))
      return transfer
    },
    readFileSync(fixture('mixte.pdf')).toString('base64'),
  )
  await page.locator('.file-drop').dispatchEvent('dragover', { dataTransfer: transfer })
  await page.getByText('Dépose ton PDF ici').waitFor()
  await page.locator('.file-drop').dispatchEvent('drop', { dataTransfer: transfer })
  await page.getByRole('heading', { name: 'mixte-déposé.pdf' }).waitFor()
  await reader(page).getByTestId('page-cover').first().waitFor()
  await analyze(page)

  const total = await reader(page)
    .locator('progress')
    .evaluate((progress) => progress.max)
  await reader(page).getByRole('button', { name: revealName }).first().click()
  await page.waitForFunction(() => document.querySelector('.reader progress')?.value === 1)
  assert.equal(
    await reader(page)
      .locator('progress')
      .evaluate((progress) => progress.value),
    1,
  )
  const scrollBefore = await page.evaluate(() => window.scrollY)
  await page.getByRole('button', { name: 'Passer au thème sombre' }).click()
  assert.equal(
    await reader(page)
      .locator('progress')
      .evaluate((progress) => progress.value),
    1,
  )
  assert.equal(await page.evaluate(() => window.scrollY), scrollBefore)
  assert.equal(await page.evaluate(() => localStorage.getItem('unspoil-theme')), 'dark')
  await reader(page)
    .getByRole('button', { name: /Remasquer le corrigé/ })
    .first()
    .click()
  await page.waitForFunction(() => document.querySelector('.reader progress')?.value === 0)
  assert.equal(
    await reader(page)
      .locator('progress')
      .evaluate((progress) => progress.value),
    0,
  )
  assert.ok(total > 1)

  const navigation = page.getByRole('navigation', { name: 'Pages du PDF' })
  assert.equal(await navigation.locator('canvas, img').count(), 0)
  await navigation.getByRole('button', { name: 'Aller à la page 2' }).click()
  await navigation.locator('[aria-current=page][aria-label="Aller à la page 2"]').waitFor()
  await page.getByRole('button', { name: 'Zoom avant' }).click()
  await page.getByText('125 %', { exact: true }).waitFor()
  await checkGeometry(page)
  await assertNoOverflow(page)
  await page.getByRole('button', { name: 'Ajuster à la largeur' }).click()
  await page.getByText('100 %', { exact: true }).waitFor()

  await open(page, fixture('qcm-cases.pdf'))
  await analyze(page)
  const grouped = reader(page).locator('[data-neutral-marker]')
  await grouped.first().waitFor()
  const before = await grouped.count()
  assert.ok(before >= 2)
  assert.equal(await grouped.locator('button').count(), 0)
  assert.ok(
    await grouped.evaluateAll((masks) =>
      masks.every((mask) => getComputedStyle(mask).backgroundColor === 'rgb(255, 255, 255)'),
    ),
  )
  await reader(page)
    .getByRole('button', { name: /Afficher le corrigé/ })
    .first()
    .click()
  await reader(page)
    .getByRole('button', { name: /Remasquer le corrigé/ })
    .first()
    .waitFor()
  assert.ok((await grouped.count()) < before)
  await reader(page)
    .getByRole('button', { name: /Remasquer le corrigé/ })
    .first()
    .click()
  await reader(page)
    .getByRole('button', { name: /Remasquer le corrigé/ })
    .first()
    .waitFor({ state: 'hidden' })
  assert.equal(await grouped.count(), before)

  await open(page, graphicPdf(80))
  assert.equal(await reader(page).getByTestId('page-cover').count(), 80)
  await page.waitForFunction(() => document.querySelector('.reader canvas')?.width > 0)
  await reader(page).locator('[data-reader-page]').last().scrollIntoViewIfNeeded()
  await page.waitForFunction(() => {
    const canvases = document.querySelectorAll('.reader canvas')
    return canvases[0]?.width === 0 && canvases[79]?.width > 0
  })
  assert.equal(await reader(page).getByTestId('page-cover').count(), 80)

  const historical = process.env.UNSPOIL_AUTHORIZED_PDF
  if (historical) {
    await open(page, historical)
    const pages = await reader(page).getByTestId('page-cover').count()
    await page.getByRole('button', { name: 'Masquer les corrigés' }).click()
    await page.getByRole('button', { name: 'Annuler l’analyse' }).waitFor({ state: 'hidden' })
    const state = await reader(page).getByRole('status').textContent()
    assert.ok(state?.trim())
    assert.equal(await reader(page).getByRole('alert').count(), 0)
    console.log('Annale locale autorisée, ' + pages + ' pages : ' + state)
  }

  await fileField(page).setInputFiles({
    name: 'corrompu.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('synthétique, PDF invalide'),
  })
  await page.getByRole('alert').filter({ hasText: 'Impossible d’ouvrir ce PDF' }).waitFor()
  console.log(
    'Bureau : dépôt, couverture, thème, progression, géométrie, QCM, 80 pages, remplacement et erreur.',
  )
  await page.close()
}

async function mobile(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  await page.goto(url)
  await open(page, graphicPdf(2))
  await page.getByRole('button', { name: 'Navigation par page' }).tap()
  const navigation = page.getByRole('navigation', { name: 'Pages du PDF' })
  await navigation.getByRole('button', { name: 'Aller à la page 2' }).tap()
  await page.getByLabel('Page 2 sur 2').waitFor()
  await page.getByRole('button', { name: 'Révélation progressive' }).tap()
  const slider = page.getByRole('slider')
  const bounds = await slider.boundingBox()
  assert.ok(bounds && bounds.y > 130 && bounds.y + 60 < 844)
  const x = Math.round(bounds.x + bounds.width / 2)
  const y = Math.round(bounds.y + bounds.height / 2)
  const session = await context.newCDPSession(page)
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x, y: y + 125 }],
  })
  await page.waitForFunction(
    () => Number(document.querySelector('[role=slider]')?.getAttribute('aria-valuenow')) > 0,
  )
  assert.equal(
    await reader(page)
      .getByTestId('progressive-mask')
      .last()
      .evaluate((mask) => mask.style.top),
    '0%',
  )
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] })
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForFunction(
    () => document.querySelector('[role=slider]')?.getAttribute('aria-valuenow') === '0',
  )
  await slider.press('ArrowDown')
  assert.ok(Number(await slider.getAttribute('aria-valuenow')) > 0)
  await page.setViewportSize({ width: 844, height: 390 })
  await assertNoOverflow(page)
  assert.equal(
    await reader(page)
      .getByTestId('progressive-mask')
      .last()
      .evaluate((mask) => mask.style.top),
    '0%',
  )
  console.log('Tactile émulé : navigation, retour au trait, glissement, clavier et paysage.')
  await context.close()
}

async function offline(browser) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(url)
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  await context.setOffline(true)
  await readyHome(page)
  await open(page, fixture('mixte.pdf'))
  await analyze(page)
  await checkGeometry(page)
  console.log('Hors ligne : police, exemple, nouvel import et analyse.')
  await context.close()
}

async function main() {
  mkdirSync(captureDir, { recursive: true })
  const browser = await chromium.launch({ channel: process.env.UNSPOIL_CHROMIUM || 'msedge' })
  try {
    if (process.env.UNSPOIL_SKIP_CAPTURES !== '1') await capture(browser)
    await desktop(browser)
    await mobile(browser)
    if (process.env.UNSPOIL_TEST_OFFLINE === '1') await offline(browser)
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

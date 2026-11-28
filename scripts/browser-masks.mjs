import assert from 'node:assert/strict'

export const masksOf = (page) =>
  page
    .locator('.reader')
    .getByTestId('correction-mask')
    .evaluateAll((masks) =>
      masks.map((mask) => {
        const parent = mask.parentElement
        const [w, h] = parent.style.aspectRatio.split('/').map(Number)
        const style = getComputedStyle(mask)
        return {
          pageIndex: Number(parent.closest('[data-reader-page]').dataset.readerPage),
          bbox: {
            x: (parseFloat(mask.style.left) * w) / 100,
            y: (parseFloat(mask.style.top) * h) / 100,
            width: (parseFloat(mask.style.width) * w) / 100,
            height: (parseFloat(mask.style.height) * h) / 100,
          },
          opaque: style.backgroundColor === 'rgb(255, 255, 255)' && style.opacity === '1',
        }
      }),
    )

export async function displayedBlocks(page, masks) {
  assert.ok(
    masks.every(({ opaque }) => opaque),
    'Un masque de correction laisse passer le fond',
  )
  const blocks = []
  const reader = page.locator('.reader')
  const actions = await reader
    .locator('[data-block-action]')
    .evaluateAll((buttons) => buttons.map((b) => b.dataset.blockAction))
  for (const id of new Set(actions)) {
    const selector = '[data-block-action=' + JSON.stringify(id) + ']'
    await reader.locator(selector).evaluate((el) => el.click())
    await reader.locator('[data-revealed]' + selector).waitFor({ state: 'attached' })
    const remaining = (await masksOf(page)).map((mask) => JSON.stringify(mask))
    const exposed = masks.filter((mask) => {
      const index = remaining.indexOf(JSON.stringify(mask))
      if (index === -1) return true
      remaining.splice(index, 1)
      return false
    })
    assert.ok(exposed.length > 0 && remaining.length === 0)
    await reader.locator(selector).evaluate((el) => el.click())
    await reader.locator('[data-revealed]' + selector).waitFor({ state: 'detached' })
    blocks.push({ id, regions: exposed.map(({ pageIndex, bbox }) => ({ pageIndex, bbox })) })
  }
  assert.equal(blocks.flatMap((block) => block.regions).length, masks.length)
  return blocks
}

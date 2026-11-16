import { expect, test } from '@playwright/test';

/**
 * The vector nameplate of the header (approved V6.7 `#vectorHeader`): the
 * mark is one SVG with the reference's own geometry and colours, it takes no
 * room from what lies under the header, and the toolbar still works.
 */

for (const [width, height] of [[1440, 900], [1366, 768], [1280, 720], [1024, 768]] as const) {
  test(`${width}×${height}: the nameplate keeps the reference's geometry and covers nothing below the header`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/?debug=1');
    const logo = page.getByTestId('studio-logo');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('viewBox', '0 0 635 85');
    await expect(page.getByTestId('brand')).toContainText('Guitar Theory Lab');
    // Vector parts, in the reference's colours; the label is live text.
    expect(await logo.locator('[data-part="stripe"]').evaluateAll((paths) => paths.map((p) => `${p.getAttribute('stroke')}/${p.getAttribute('stroke-width')}`))).toEqual(['#e5bd80/19', '#76100d/7', '#f6d9a8/13', '#e53b13/7']);
    await expect(logo.locator('[data-part="wordmark"]')).toHaveAttribute('fill', '#750b09');
    await expect(logo.locator('[data-part="edition"]')).toHaveText('STUDIO · VER. 6.0');
    expect(await logo.locator('image').count()).toBe(0);
    // Uniform scale: the mark is never squeezed.
    const box = await logo.boundingBox();
    if (!box) throw new Error('no logo');
    expect(box.width / box.height).toBeCloseTo(635 / 85, 1);
    // The plate ends above the rail and the console; the toolbar is clear of it.
    const plate = await logo.locator('[data-part="plate"]').boundingBox();
    const [rail, deck, tools] = [await page.getByTestId('studio-rail').boundingBox(), await page.getByTestId('console').boundingBox(), await page.getByTestId('preset-library-open').boundingBox()];
    if (!plate || !rail || !deck || !tools) throw new Error('missing box');
    expect(plate.y + plate.height).toBeLessThanOrEqual(Math.min(rail.y, deck.y) + 0.5);
    expect(plate.x + plate.width).toBeLessThan(tools.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('the stripes run on, unbroken, to the right edge above the toolbar, and the toolbar still answers', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  // A row of pixels through the lower stripe, right of the nameplate: red all the way.
  const shot = await page.screenshot({ clip: { x: 430, y: 9, width: 1000, height: 1 } });
  const reds = await page.evaluate(async (data) => {
    const image = new Image();
    await new Promise((done) => { image.onload = done; image.src = `data:image/png;base64,${data}`; });
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;
    ctx.drawImage(image, 0, 0);
    const px = ctx.getImageData(0, 0, canvas.width, 1).data;
    let red = 0;
    for (let i = 0; i < px.length; i += 4) if ((px[i] ?? 0) > 150 && (px[i + 1] ?? 0) < 110 && (px[i + 2] ?? 0) < 80) red += 1;
    return red / canvas.width;
  }, shot.toString('base64'));
  expect(reds).toBeGreaterThan(0.98);
  await page.getByTestId('metronome-toggle').click();
  await expect(page.getByTestId('metronome-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByTestId('preset-library-open').click();
  await expect(page.getByRole('dialog', { name: /Preset/ })).toBeVisible();
});

for (const [width, height, bar] of [[1440, 900, 48], [1366, 768, 38], [1280, 720, 38], [1024, 768, 38]] as const) {
  test(`${width}×${height}: the header is ${bar} px tall and its tools sit clear of the stripes`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/?debug=1');
    const head = await page.getByTestId('studio-header').boundingBox();
    const logo = await page.getByTestId('studio-logo').boundingBox();
    if (!head || !logo) throw new Error('missing box');
    expect(head.height).toBe(bar);
    // Lower edge of the lower stripe where it runs along the top: 15 + 13 / 2 of the mark's 85 units.
    const stripes = logo.y + (logo.height * 21.5) / 85;
    for (const id of ['preset-library-open', 'metronome-toggle', 'device-tuner', 'rack-toggle']) {
      const tool = await page.getByTestId(id).boundingBox();
      if (!tool) throw new Error(id);
      expect(tool.y, id).toBeGreaterThanOrEqual(stripes + 2);
      expect(tool.y + tool.height, id).toBeLessThanOrEqual(head.y + head.height);
    }
    // Room between the tools.
    const [a, b] = [await page.getByTestId('preset-library-open').boundingBox(), await page.getByTestId('metronome-toggle').boundingBox()];
    expect((b?.x ?? 0) - ((a?.x ?? 0) + (a?.width ?? 0))).toBeGreaterThanOrEqual(6);
  });
}

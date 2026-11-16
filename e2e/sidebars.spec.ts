import { expect, test } from '@playwright/test';

/**
 * Two permanent sidebars (navigation on the left, Audio & Rig on the right),
 * each compact or expanded from its own key at the ends of the header.
 */

const width = (page: import('@playwright/test').Page, id: string) => page.getByTestId(id).evaluate((el) => Math.round(el.getBoundingClientRect().width));

for (const [w, h] of [[1440, 900], [1366, 768], [1280, 720], [1024, 768]] as const) {
  test(`${w}×${h}: both sidebars are always there; every combination of compact and expanded keeps the page whole`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/?debug=1');
    const [left, right] = [page.getByTestId('rail-toggle'), page.getByTestId('rack-toggle')];
    // The keys sit at the two ends of the header, outside the tools.
    const [head, lb, rb, tools] = [await page.getByTestId('studio-header').boundingBox(), await left.boundingBox(), await right.boundingBox(), await page.getByRole('toolbar', { name: 'Strumenti globali' }).boundingBox()];
    if (!head || !lb || !rb || !tools) throw new Error('missing box');
    expect(lb.x - head.x).toBeLessThan(12);
    expect(head.x + head.width - (rb.x + rb.width)).toBeLessThan(12);
    expect(rb.x).toBeGreaterThanOrEqual(tools.x + tools.width + 4);
    // Narrow windows use a slimmer compact bar, the same on both sides.
    const slim = w <= 1250 ? 54 : 60;
    for (const railOpen of [false, true]) {
      for (const rackOpen of [false, true]) {
        if ((await left.getAttribute('aria-expanded')) !== String(railOpen)) await left.click();
        if ((await right.getAttribute('aria-expanded')) !== String(rackOpen)) await right.click();
        await expect(page.getByTestId('studio-rail')).toHaveAttribute('data-x', railOpen ? '1' : '0');
        await expect(page.getByTestId('rack')).toHaveAttribute('data-mode', rackOpen ? 'expanded' : 'compact');
        await expect.poll(() => width(page, 'studio-rail')).toBe(railOpen ? 196 : slim);
        await expect.poll(() => width(page, 'rack')).toBe(rackOpen ? 336 : slim);
        await expect(page.getByTestId('rack')).toBeVisible();
        await expect(page.getByTestId('fretboard-panel')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${railOpen}/${rackOpen}`).toBe(true);
        await expect(page.locator('.v57-board .fretboard .fret')).toHaveCount(24);
      }
    }
  });
}

test('the choices are saved; a rack saved as hidden by an older version comes back as the compact bar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await page.getByTestId('rail-toggle').click();
  await page.getByTestId('rack-toggle').click();
  await page.reload();
  await expect(page.getByTestId('studio-rail')).toHaveAttribute('data-x', '1');
  await expect(page.getByTestId('rack')).toHaveAttribute('data-mode', 'compact');
  await page.evaluate(() => window.localStorage.setItem('gtl.v6.rack', '"hidden"'));
  await page.reload();
  await expect(page.getByTestId('rack')).toBeVisible();
  await expect(page.getByTestId('rack')).toHaveAttribute('data-mode', 'compact');
  await expect(page.getByTestId('rack-toggle')).toHaveAttribute('aria-expanded', 'false');
  // No other control resizes a sidebar.
  await expect(page.getByRole('button', { name: /Comprimi barra|Espandi barra|Nascondi il rack|Compatta il rack/ })).toHaveCount(0);
});

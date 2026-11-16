import { expect, test } from '@playwright/test';

/**
 * The foot of the case: one bar under the two sidebars and the work column,
 * with the key that opens and closes the mixer. No sidebar can cover it.
 */

for (const [width, height] of [[1440, 900], [1366, 768], [1280, 720], [1024, 768]] as const) {
  test(`${width}×${height}: the mixer bar lies under all three columns and stays reachable with both sidebars expanded`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/?debug=1');
    for (const id of ['rail-toggle', 'rack-toggle']) if ((await page.getByTestId(id).getAttribute('aria-expanded')) !== 'true') await page.getByTestId(id).click();
    const box = async (id: string) => { const b = await page.getByTestId(id).boundingBox(); if (!b) throw new Error(id); return b; };
    const [foot, rail, rack, work, handle] = [await box('case-foot'), await box('studio-rail'), await box('rack'), await box('notebook-zone'), await box('device-mixer')];
    // Under everything, as wide as the case.
    expect(foot.x).toBeLessThanOrEqual(rail.x);
    expect(foot.x + foot.width).toBeGreaterThanOrEqual(rack.x + rack.width);
    for (const column of [rail, rack, work]) expect(column.y + column.height).toBeLessThanOrEqual(foot.y + 7);
    expect(foot.y + foot.height).toBeLessThanOrEqual(height);
    // The key is inside the bar, centred, and nothing lies over it.
    expect(handle.x).toBeGreaterThanOrEqual(foot.x);
    expect(handle.y + handle.height).toBeLessThanOrEqual(foot.y + foot.height);
    expect(Math.abs(handle.x + handle.width / 2 - (foot.x + foot.width / 2))).toBeLessThan(2);
    const onTop = await page.evaluate(([x, y]) => document.elementFromPoint(x ?? 0, y ?? 0)?.closest('[data-testid]')?.getAttribute('data-testid'), [handle.x + handle.width / 2, handle.y + handle.height / 2]);
    expect(onTop).toBe('device-mixer');
    // Rounded lower corners; a modest bar.
    expect(parseFloat(await page.getByTestId('case-foot').evaluate((e) => getComputedStyle(e).borderBottomLeftRadius))).toBeGreaterThanOrEqual(12);
    expect(foot.height).toBeLessThanOrEqual(38);
    // It only opens and closes the drawer.
    await page.getByTestId('device-mixer').click();
    await expect(page.getByTestId('v57-mixer')).toBeVisible();
    await expect(page.getByTestId('case-foot').getByRole('radio')).toHaveCount(0);
    await page.getByTestId('device-mixer').click();
    await expect(page.getByTestId('v57-mixer')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight && document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

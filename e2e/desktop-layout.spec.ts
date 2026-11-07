import { expect, test, type Page } from '@playwright/test';

/**
 * P0-14 desktop layout (D-24): from 1200 × 720 up, transport and neck stay in
 * view while the panels scroll on their own, and nothing moves while playing,
 * switching workspace or scrolling. Smaller windows scroll the page instead.
 */

const SIZES: readonly (readonly [number, number])[] = [[1920, 1080], [1440, 900], [1366, 768], [1280, 720]];
const FIXED = ['[data-testid="play"]', '[data-testid="lcd"]', '.fretboard', '[data-testid="legend"]'];

const open = async (page: Page, look: 'Studio' | 'Semplificata', width: number, height: number) => {
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await page.getByTestId('appearance').getByRole('button', { name: look, exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', look === 'Studio' ? 'studio' : 'simple');
};
const boxes = (page: Page) => page.evaluate((selectors) => selectors.map((sel) => {
  const r = document.querySelector(sel)?.getBoundingClientRect();
  return r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null;
}), FIXED);
const inView = (page: Page, sel: string) => page.evaluate((s) => {
  const r = document.querySelector(s)?.getBoundingClientRect();
  return !!r && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
}, sel);

for (const look of ['Semplificata', 'Studio'] as const) {
  for (const [width, height] of SIZES) {
    test(`${look} ${width}×${height}: transport and neck stay, panels scroll`, async ({ page }) => {
      await open(page, look, width, height);
      // The page itself does not scroll; transport and the whole neck are on screen.
      expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(0);
      for (const sel of ['[data-testid="play"]', '.fretboard']) expect(await inView(page, sel), sel).toBe(true);
      const panels = page.getByTestId('scroll-panels');
      const room = await panels.evaluate((el) => ({ overflow: getComputedStyle(el).overflowY, height: el.clientHeight }));
      expect(room.overflow).toBe('auto');
      expect(room.height).toBeGreaterThanOrEqual(140);
      // Every transport control sits inside the transport, uncovered.
      const spill = await page.evaluate(() => {
        const bar = document.querySelector('.cs-transport, .ws-transport')?.getBoundingClientRect();
        if (!bar) return ['no transport'];
        return [...document.querySelectorAll('.cs-transport button, .ws-transport button, .cs-transport select, .ws-transport select, .ws-transport [role="slider"], .cs-transport [role="slider"]')]
          .filter((el) => (el as HTMLElement).offsetParent !== null && !el.closest('.accent-pop'))
          .filter((el) => {
            const r = el.getBoundingClientRect();
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return r.right > bar.right + 1 || r.left < bar.left - 1 || !(hit === el || el.contains(hit));
          })
          .map((el) => el.getAttribute('aria-label') ?? el.textContent);
      });
      expect(spill).toEqual([]);

      // Scrolling the panels to the end moves nothing that stays.
      const before = await boxes(page);
      const scrolled = await panels.evaluate((el) => { el.scrollTop = el.scrollHeight; return el.scrollTop; });
      expect(scrolled).toBeGreaterThan(0);
      expect(await boxes(page)).toEqual(before);

      // Workspaces and playback: transport and neck keep their place.
      for (const name of ['Harmony Lab', 'Arpeggios Lab', 'Jam Studio', 'Fretboard Lab']) {
        await page.getByRole('button', { name, exact: true }).click();
        const [play, , neck] = await boxes(page);
        expect(play, name).toEqual(before[0]);
        expect(neck?.[1], name).toBe(before[2]?.[1]);
      }
      await page.getByRole('button', { name: 'Harmony Lab', exact: true }).click();
      const playing = await boxes(page);
      await page.getByTestId('play').click();
      for (let i = 0; i < 8; i += 1) {
        await page.waitForTimeout(150);
        expect(await boxes(page), `playing ${i}`).toEqual(playing);
      }
      await page.getByTestId('stop').click();
    });
  }
}

test('the accent grid floats over the page: opening it moves neither transport nor neck', async ({ page }) => {
  await open(page, 'Semplificata', 1440, 900);
  const before = await boxes(page);
  await page.getByTestId('accent-toggle').click();
  await expect(page.getByTestId('accent-grid')).toBeVisible();
  expect(await boxes(page)).toEqual(before);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('accent-grid')).toHaveCount(0);
  await expect(page.getByTestId('accent-toggle')).toHaveAttribute('aria-expanded', 'false');
});

test('resizing a desktop window keeps the layout whole', async ({ page }) => {
  await open(page, 'Studio', 1440, 900);
  for (const [width, height] of [[1280, 720], [1920, 1080], [1366, 768]] as const) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(0);
    expect(await inView(page, '.fretboard')).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  }
});

test('a small window scrolls the page, and the Simple transport stays at the top', async ({ page }) => {
  await open(page, 'Semplificata', 1100, 680);
  expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeGreaterThan(0);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  expect(await inView(page, '[data-testid="play"]')).toBe(true);
});

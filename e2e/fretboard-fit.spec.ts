import { expect, test, type Page } from '@playwright/test';

/**
 * The Studio's neck is fitted by height: when the column gets narrower the
 * strings, the markers and their labels keep their size and only the frets
 * come closer, down to a readable minimum; below it the neck scrolls
 * sideways. Nothing is stretched: a marker is always a circle on its string
 * and between its frets.
 */

interface Neck { readonly strings: number[]; readonly frets: number[]; readonly marker: { w: number; h: number; cx: number; cy: number; string: number; fret: number }; readonly svg: { w: number; h: number }; readonly box: { w: number; h: number }; readonly label: number }

const measure = (page: Page): Promise<Neck> => page.getByTestId('fretboard-panel').evaluate((panel) => {
  const svg = panel.querySelector('svg.fretboard') as SVGSVGElement;
  const scroller = panel.querySelector('.fretboard-scroll') as HTMLElement;
  const rect = (e: Element) => e.getBoundingClientRect();
  const strings = [...svg.querySelectorAll('.string')].map((s) => rect(s).top + rect(s).height / 2).sort((a, b) => a - b);
  const frets = [...svg.querySelectorAll('.fret')].map((f) => rect(f).left + rect(f).width / 2).sort((a, b) => a - b);
  const group = svg.querySelector('.marker') as SVGGElement;
  const shape = group.querySelector('.shape') as SVGElement;
  const r = rect(shape);
  const text = group.querySelector('text') as SVGTextElement | null;
  // Which string and fret cell the marker's centre falls in, from what is drawn.
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const string = strings.reduce((best, y, i) => (Math.abs(y - cy) < Math.abs((strings[best] ?? 0) - cy) ? i : best), 0);
  const fret = frets.filter((x) => x < cx).length + 1;
  return { strings, frets, marker: { w: r.width, h: r.height, cx, cy, string, fret }, svg: { w: rect(svg).width, h: rect(svg).height }, box: { w: scroller.clientWidth, h: scroller.clientHeight }, label: text ? rect(text).height : 0 };
});

const setBars = async (page: Page, rail: boolean, rack: boolean) => {
  for (const [id, want] of [['rail-toggle', rail], ['rack-toggle', rack]] as const) if ((await page.getByTestId(id).getAttribute('aria-expanded')) !== String(want)) await page.getByTestId(id).click();
  await page.waitForTimeout(350);
};

test('narrowing the column brings the frets closer; strings, markers and labels keep their size', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await setBars(page, false, false);
  const wide = await measure(page);
  await setBars(page, true, true);
  const narrow = await measure(page);
  const gap = (n: Neck) => (n.strings[5] ?? 0) - (n.strings[0] ?? 0);
  const cell = (n: Neck) => (n.frets[1] ?? 0) - (n.frets[0] ?? 0);
  expect(narrow.strings).toHaveLength(6);
  expect(narrow.frets).toHaveLength(24);
  // Vertical layout: the same within a few per cent. (The console is a little taller in a narrower column, and the divider
  // shares what is left in proportion: that is the only thing that moves it.) A uniform scaling would have shrunk it as much as the frets.
  expect(Math.abs(gap(narrow) / gap(wide) - 1)).toBeLessThan(0.08);
  expect(Math.abs(narrow.marker.w / wide.marker.w - 1)).toBeLessThan(0.08);
  expect(Math.abs(narrow.label / wide.label - 1)).toBeLessThan(0.08);
  // Marker and string spacing keep their proportion exactly: one scale for everything vertical.
  expect(Math.abs(narrow.marker.w / gap(narrow) - wide.marker.w / gap(wide))).toBeLessThan(0.005);
  // Horizontal layout: the frets are closer, clearly.
  expect(cell(narrow)).toBeLessThan(cell(wide) * 0.8);
  // Never stretched: the marker is a circle, on its string, inside its fret cell, in both.
  for (const n of [wide, narrow]) {
    expect(Math.abs(n.marker.w - n.marker.h)).toBeLessThan(0.6);
    expect(Math.abs((n.strings[n.marker.string] ?? 0) - n.marker.cy)).toBeLessThan(1);
    expect(n.svg.w).toBeLessThanOrEqual(n.box.w + 1);
  }
  expect(narrow.marker.string).toBe(wide.marker.string);
  expect(narrow.marker.fret).toBe(wide.marker.fret);
  // The rendered wood still lies exactly under the board.
  const panel = page.getByTestId('fretboard-panel');
  expect(await panel.locator('.board-image').boundingBox()).toEqual(await panel.locator('rect.board').boundingBox());
});

for (const [width, height] of [[1440, 900], [1366, 768], [1280, 720], [1024, 768]] as const) {
  test(`${width}×${height}: a marker is a circle that can be clicked, with the sidebars compact and expanded`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/?debug=1');
    for (const expanded of [false, true]) {
      await setBars(page, expanded, false);
      const n = await measure(page);
      expect(Math.abs(n.marker.w - n.marker.h)).toBeLessThan(0.6);
      expect(n.marker.w).toBeGreaterThanOrEqual(15);
      // What is under the marker's centre is the marker: overlays and hit areas follow the geometry.
      const hit = await page.evaluate(([x, y]) => Boolean(document.elementFromPoint(x ?? 0, y ?? 0)?.closest('.marker')), [n.marker.cx, n.marker.cy]);
      expect(hit).toBe(true);
      await expect(page.getByTestId('fretboard-panel').locator('.fret')).toHaveCount(24);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  });
}

test('below the minimum distance between frets the neck scrolls sideways instead of shrinking', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/?debug=1');
  await setBars(page, true, false);
  // The tallest neck the divider allows: at this width its frets would have to be closer than the minimum.
  await page.getByTestId('divider').focus();
  await page.keyboard.press('End');
  await page.waitForTimeout(300);
  const n = await measure(page);
  const cell = (n.frets[1] ?? 0) - (n.frets[0] ?? 0);
  // The minimum cell is a marker and a little more: markers of neighbouring frets never touch.
  expect(cell).toBeGreaterThan(n.marker.w * 1.15);
  expect(n.svg.w).toBeGreaterThan(n.box.w + 4);
  await expect(page.getByTestId('fretboard-panel').getByTestId('fret-nav')).toBeVisible();
  expect(Math.abs(n.marker.w - n.marker.h)).toBeLessThan(0.6);
  // Fret 24 is reached by scrolling the neck, not the page; the arrows move it too.
  const scroller = page.getByTestId('fretboard-panel').locator('.fretboard-scroll');
  await scroller.evaluate((e) => { e.scrollLeft = 0; });
  await expect(page.getByRole('button', { name: 'Mostra i tasti più bassi' })).toBeDisabled();
  await page.getByRole('button', { name: 'Mostra i tasti più alti' }).click();
  await expect.poll(() => scroller.evaluate((e) => e.scrollLeft)).toBeGreaterThan(10);
  // The whole drawing fits the scroller's height: fret numbers are not cut.
  expect(n.svg.h).toBeLessThanOrEqual(n.box.h + 1);
  await scroller.evaluate((e) => { e.scrollLeft = e.scrollWidth; });
  await expect(page.getByTestId('fretboard-panel').locator('[data-fret-wire="24"]')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

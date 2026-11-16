import { expect, test, type Page } from '@playwright/test';

/**
 * The mixer drawer and its two faces. Closed: only the bar under the
 * notebook. Open, extended: the long faders over the notebook. Open,
 * compact: one row of knobs between the notebook and the bar. Both faces
 * are the same strips: values and states cannot differ.
 */

const CHANNELS = ['click', 'notes', 'comp', 'bass', 'drums', 'backing', 'guitar', 'master'];
const box = async (page: Page, testId: string) => {
  const b = await page.getByTestId(testId).boundingBox();
  if (!b) throw new Error(`no box for ${testId}`);
  return b;
};
/** The element of the notebook that scrolls, tagged so it can be found again. */
const tagScroller = (page: Page) => page.getByTestId('notebook').evaluate((nb) => {
  const all = [nb, ...nb.querySelectorAll<HTMLElement>('*')] as HTMLElement[];
  const el = all.find((e) => e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY));
  if (el) el.setAttribute('data-e2e-scroll', '1');
  return Boolean(el);
});

for (const [width, height] of [[1440, 900], [1366, 768], [1280, 720], [1024, 768]] as const) {
  test(`${width}×${height}: closed, extended and compact, in the right order from top to bottom`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/?debug=1');
    // 1 · closed: the bar only.
    const handle = page.getByTestId('device-mixer');
    await expect(handle).toBeVisible();
    await expect(page.getByTestId('v57-mixer')).toHaveCount(0);
    await expect(page.getByTestId('mixer-mode')).toHaveCount(0);
    const neck = await box(page, 'fretboard-panel');
    const closedNotebook = await box(page, 'notebook-zone');
    // 2 · open: extended first, with the switch inside the drawer.
    await handle.click();
    await expect(page.getByTestId('v57-mixer')).toHaveAttribute('data-mode', 'extended');
    await expect(page.getByTestId('mixer-mode-extended')).toHaveAttribute('aria-checked', 'true');
    for (const id of CHANNELS) await expect(page.getByTestId(`fader-${id}`)).toBeVisible();
    await expect(page.getByTestId('mixknob-click')).toHaveCount(0);
    expect(await box(page, 'fretboard-panel')).toEqual(neck);
    // 3 · compact: notebook above, one row of eight, the bar below; the neck has not moved.
    await page.getByTestId('mixer-mode-compact').click();
    const mixer = page.getByTestId('v57-mixer');
    await expect(mixer).toHaveAttribute('data-mode', 'compact');
    await expect(page.getByTestId('fader-click')).toHaveCount(0);
    const tops = new Set<number>();
    for (const id of CHANNELS) {
      const cell = page.locator(`.v6-mc-cell[data-strip="${id}"]`);
      await expect(cell).toHaveCount(1);
      tops.add(Math.round((await cell.boundingBox())?.y ?? -1));
      await expect(page.getByTestId(`mixknob-${id}`)).toHaveCount(1);
    }
    expect(tops.size, 'one row, never wrapped').toBe(1);
    const [zone, mx, bar, head, deck] = [await box(page, 'notebook-zone'), await box(page, 'v57-mixer'), await box(page, 'device-mixer'), await box(page, 'studio-header'), await box(page, 'console')];
    expect(await box(page, 'fretboard-panel')).toEqual(neck);
    expect(head.y).toBeLessThan(deck.y);
    expect(deck.y + deck.height).toBeLessThanOrEqual(neck.y + 1);
    expect(neck.y + neck.height).toBeLessThanOrEqual(zone.y + 1);
    expect(zone.y + zone.height).toBeLessThanOrEqual(mx.y + 1);
    expect(mx.y + mx.height).toBeLessThanOrEqual(bar.y + 1);
    // The notebook is shorter, not gone, and the mixer is the smaller of the two changes.
    expect(zone.height).toBeGreaterThan(60);
    expect(zone.height).toBeLessThan(closedNotebook.height);
    expect(mx.height).toBeLessThan(130);
    await expect(page.getByTestId('notebook').getByRole('tab', { selected: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // The bar only opens and closes.
    await handle.click();
    await expect(page.getByTestId('v57-mixer')).toHaveCount(0);
    expect((await box(page, 'notebook-zone')).height).toBe(closedNotebook.height);
  });
}

test('both faces show the same values and states; the knob answers keyboard and mouse', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await page.getByTestId('device-mixer').click();
  await page.getByTestId('fader-bass').fill('0.4');
  await page.getByTestId('mute-drums').click();
  await page.getByTestId('solo-bass').click();
  await page.getByTestId('mixer-mode-compact').click();
  const knob = page.getByTestId('mixknob-bass');
  await expect(knob).toHaveAttribute('role', 'slider');
  await expect(knob).toHaveAccessibleName('Volume Basso');
  await expect(knob).toHaveAttribute('aria-valuenow', '40');
  await expect(knob).toHaveAttribute('aria-valuetext', /dB/);
  await expect(page.getByTestId('mute-drums')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('solo-bass')).toHaveAttribute('aria-pressed', 'true');
  // Exceptions of the engine, kept: no meter on Backing, one Listen key on the guitar, no keys on the master.
  await expect(page.getByTestId('meter-click')).toHaveAttribute('role', 'meter');
  await expect(page.getByTestId('meter-backing')).toHaveCount(0);
  await expect(page.locator('.v6-mc-cell[data-strip="guitar"] button.v6-mx-key')).toHaveCount(1);
  await expect(page.getByTestId('mixer-listen')).toBeDisabled();
  await expect(page.locator('.v6-mc-cell[data-strip="master"] button.v6-mx-key')).toHaveCount(0);
  // Keyboard.
  await knob.focus();
  await page.keyboard.press('ArrowUp');
  await expect(knob).toHaveAttribute('aria-valuenow', '42');
  await page.keyboard.press('End');
  await expect(knob).toHaveAttribute('aria-valuenow', '100');
  await page.keyboard.press('Home');
  await expect(knob).toHaveAttribute('aria-valuenow', '0');
  // Mouse: drag up to raise.
  const b = await knob.boundingBox();
  if (!b) throw new Error('no knob');
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y - 60, { steps: 5 });
  await page.mouse.up();
  const dragged = Number(await knob.getAttribute('aria-valuenow'));
  expect(dragged).toBeGreaterThan(20);
  await page.getByTestId('solo-bass').click();
  // Back to extended: the fader is where the knob left it, the states too.
  await page.getByTestId('mixer-mode-extended').click();
  expect(Math.round(Number(await page.getByTestId('fader-bass').inputValue()) * 100)).toBe(dragged);
  await expect(page.getByTestId('mute-drums')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('solo-bass')).toHaveAttribute('aria-pressed', 'false');
});

test('switching faces keeps the notebook tab and its scroll; the chosen face is remembered', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?debug=1');
  await page.getByTestId('notebook').getByRole('tab', { name: 'Legenda e visualizzazione', exact: true }).click();
  const selected = () => page.getByTestId('notebook').getByRole('tab', { selected: true }).textContent();
  expect(await tagScroller(page)).toBe(true);
  const scroller = page.locator('[data-e2e-scroll="1"]');
  await scroller.evaluate((e) => { e.scrollTop = 40; });
  const before = await scroller.evaluate((e) => e.scrollTop);
  expect(before).toBeGreaterThan(0);
  await page.getByTestId('device-mixer').click();
  await page.getByTestId('mixer-mode-compact').click();
  // Same element, same scroll, same tab: the notebook was not remounted.
  expect(await scroller.evaluate((e) => e.scrollTop)).toBe(before);
  expect(await selected()).toBe('Legenda e visualizzazione');
  await page.getByTestId('mixer-mode-extended').click();
  await page.getByTestId('mixer-mode-compact').click();
  expect(await scroller.evaluate((e) => e.scrollTop)).toBe(before);
  expect(await selected()).toBe('Legenda e visualizzazione');
  // Remembered: after a reload the drawer opens compact.
  await page.reload();
  await page.getByTestId('device-mixer').click();
  await expect(page.getByTestId('v57-mixer')).toHaveAttribute('data-mode', 'compact');
  // The same preference in the settings; a broken stored value falls back to extended.
  await page.getByTestId('device-mixer').click();
  await page.getByTestId('studio-settings-toggle').click();
  await expect(page.getByTestId('pref-mixer-compact')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('pref-mixer-extended').click();
  await page.keyboard.press('Escape');
  await page.getByTestId('device-mixer').click();
  await expect(page.getByTestId('v57-mixer')).toHaveAttribute('data-mode', 'extended');
  await page.evaluate(() => window.localStorage.setItem('gtl.v6.mixM', '"sideways"'));
  await page.reload();
  await page.getByTestId('device-mixer').click();
  await expect(page.getByTestId('v57-mixer')).toHaveAttribute('data-mode', 'extended');
});

test('when the eight channels do not fit, the row scrolls sideways inside the mixer and still does not wrap', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/?debug=1');
  // Both sidebars expanded: the least room there can be.
  await page.getByTestId('rail-toggle').click();
  await page.getByTestId('device-mixer').click();
  await page.getByTestId('mixer-mode-compact').click();
  const row = page.getByTestId('mixer-compact-row');
  const m = await row.evaluate((e) => ({ scroll: e.scrollWidth, client: e.clientWidth, overflowX: getComputedStyle(e).overflowX, wrap: getComputedStyle(e).flexWrap }));
  expect(m.scroll).toBeGreaterThan(m.client);
  expect(m.overflowX).toBe('scroll');
  expect(m.wrap).toBe('nowrap');
  const tops = await page.locator('.v6-mc-cell').evaluateAll((cells) => [...new Set(cells.map((c) => Math.round(c.getBoundingClientRect().top)))]);
  expect(tops).toHaveLength(1);
  // The last channel is reachable by scrolling the row, not the page.
  await page.getByTestId('mixknob-master').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('mixknob-master')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

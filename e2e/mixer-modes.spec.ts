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
    // The neck stays where it is unless the notebook would fall under its minimum (150 px): then it gives back only the difference,
    // and never goes under its own minimum (170 px).
    const neckNow = await box(page, 'fretboard-panel');
    expect(neckNow.y).toBe(neck.y);
    if (neckNow.height !== neck.height) {
      expect(neckNow.height).toBeLessThan(neck.height);
      expect(neckNow.height).toBeGreaterThanOrEqual(170);
      // A few px of slack: the gaps of the column are smaller in a short window than the shell assumes.
      expect(zone.height).toBeLessThanOrEqual(158);
    }
    expect(head.y).toBeLessThan(deck.y);
    expect(deck.y + deck.height).toBeLessThanOrEqual(neck.y + 1);
    expect(neck.y + neck.height).toBeLessThanOrEqual(zone.y + 1);
    expect(zone.y + zone.height).toBeLessThanOrEqual(mx.y + 1);
    expect(mx.y + mx.height).toBeLessThanOrEqual(bar.y + 1);
    // The notebook is shorter but keeps a usable height; the mixer row is low.
    expect(zone.height).toBeGreaterThanOrEqual(148);
    expect(zone.height).toBeLessThan(closedNotebook.height);
    expect(mx.height).toBeLessThanOrEqual(72);
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
  // The level arc of the reference: eight segments from green through yellow and orange to red; none lit in silence.
  const arc = page.getByTestId('meter-click').locator('path');
  await expect(arc).toHaveCount(8);
  const colours = await arc.evaluateAll((paths) => paths.map((p) => p.getAttribute('stroke') ?? ''));
  const hue = (hex: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return { r: r ?? 0, g: g ?? 0, b: b ?? 0 }; };
  expect(hue(colours[0] ?? '').g).toBeGreaterThan(hue(colours[0] ?? '').r * 2);
  expect(Math.abs(hue(colours[3] ?? '').r - hue(colours[3] ?? '').g)).toBeLessThan(40);
  expect(hue(colours[7] ?? '').r).toBeGreaterThan(hue(colours[7] ?? '').g * 3);
  await expect(page.getByTestId('meter-click')).toHaveAttribute('data-lit', '0');
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
  // Volume is not level: the knob moved through its whole travel and, in silence, no segment of the arc lit.
  await expect(page.getByTestId('meter-bass')).toHaveAttribute('data-lit', '0');
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
  // The bar under the row is drawn, with a thumb shorter than the track; it follows the scroll.
  const thumb = page.getByTestId('mixer-compact-bar').locator('i');
  await expect(page.getByTestId('mixer-compact-bar')).toHaveAttribute('data-on', '1');
  const [track, t0] = [await page.getByTestId('mixer-compact-bar').boundingBox(), await thumb.boundingBox()];
  expect(t0 && track && t0.width < track.width - 4 && t0.width > 20).toBe(true);
  // The last channel is reachable by scrolling the row, not the page.
  await page.getByTestId('mixknob-master').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('mixknob-master')).toBeInViewport();
  expect(((await thumb.boundingBox())?.x ?? 0)).toBeGreaterThan((t0?.x ?? 0) + 2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('the level arc follows the real signal: it lights while the click plays and goes dark when it stops, with the knob untouched', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await page.getByTestId('device-mixer').click();
  await page.getByTestId('mixer-mode-compact').click();
  const meter = page.getByTestId('meter-click');
  const knob = page.getByTestId('mixknob-click');
  const volume = await knob.getAttribute('aria-valuenow');
  await expect(meter).toHaveAttribute('data-lit', '0');
  await page.getByTestId('play').click();
  await expect.poll(async () => Number(await meter.getAttribute('data-lit')), { timeout: 8000 }).toBeGreaterThan(0);
  // Lit segments are the first ones of the arc, in order.
  const lit = Number(await meter.getAttribute('data-lit'));
  const on = await meter.locator('path').evaluateAll((paths) => paths.map((p) => p.getAttribute('data-on')));
  expect(on.slice(0, lit).every((v) => v === '1') || on.filter((v) => v === '1').length > 0).toBe(true);
  // The band's channels play nothing in Fretboard Lab: their arcs stay dark.
  await expect(page.getByTestId('meter-drums')).toHaveAttribute('data-lit', '0');
  expect(await knob.getAttribute('aria-valuenow')).toBe(volume);
  await page.getByTestId('stop').click();
  await expect.poll(async () => Number(await meter.getAttribute('data-lit')), { timeout: 8000 }).toBe(0);
  expect(await knob.getAttribute('aria-valuenow')).toBe(volume);
});

test('1280×720 with both sidebars expanded: under the compact mixer the notebook can still be read and used', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?debug=1');
  for (const id of ['rail-toggle', 'rack-toggle']) if ((await page.getByTestId(id).getAttribute('aria-expanded')) !== 'true') await page.getByTestId(id).click();
  await page.getByTestId('device-mixer').click();
  await page.getByTestId('mixer-mode-compact').click();
  const zone = await box(page, 'notebook-zone');
  expect(zone.height).toBeGreaterThanOrEqual(148);
  expect((await box(page, 'fretboard-panel')).height).toBeGreaterThanOrEqual(170);
  // Tabs work, the page scrolls, and a control of the page can be reached and used.
  const notebook = page.getByTestId('notebook');
  await notebook.getByRole('tab', { name: 'Accordi', exact: true }).click();
  await expect(notebook.getByRole('tab', { selected: true })).toHaveText('Accordi');
  await notebook.getByRole('tab', { name: 'Scala', exact: true }).click();
  expect(await tagScroller(page)).toBe(true);
  const scroller = page.locator('[data-e2e-scroll="1"]');
  expect(await scroller.evaluate((e) => e.clientHeight)).toBeGreaterThanOrEqual(90);
  const tonic = notebook.getByRole('combobox').first();
  await tonic.scrollIntoViewIfNeeded();
  await expect(tonic).toBeInViewport();
  const before = await tonic.inputValue();
  await tonic.selectOption({ index: 2 });
  expect(await tonic.inputValue()).not.toBe(before);
  // All eight channels are still one row, reachable by scrolling the mixer.
  await page.getByTestId('mixknob-master').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('mixknob-master')).toBeInViewport();
});

for (const [width, height] of [[1440, 900], [1366, 768], [1280, 720], [1024, 768]] as const) {
  test(`${width}×${height}: in the extended mixer every key stays inside its own strip, with both sidebars expanded`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/?debug=1');
    await page.getByTestId('rail-toggle').click();
    if (width >= 1280 && (await page.getByTestId('rack-toggle').getAttribute('aria-expanded')) !== 'true') await page.getByTestId('rack-toggle').click();
    await page.getByTestId('device-mixer').click();
    await page.waitForTimeout(450);
    const overlaps = await page.getByTestId('v57-mixer').evaluate((mixer) => {
      const out: string[] = [];
      for (const strip of mixer.querySelectorAll<HTMLElement>('.v6-mx-strip')) {
        const s = strip.getBoundingClientRect();
        for (const key of strip.querySelectorAll<HTMLElement>('.v6-mx-key')) {
          const k = key.getBoundingClientRect();
          if (k.left < s.left - 0.5 || k.right > s.right + 0.5) out.push(`${strip.dataset.strip}:${key.textContent}`);
          if (k.width < 22) out.push(`${strip.dataset.strip}:${key.textContent} too narrow (${k.width})`);
        }
      }
      return out;
    });
    expect(overlaps).toEqual([]);
  });
}

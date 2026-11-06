import { expect, test, type Page } from '@playwright/test';

/** Simple and Studio: one state, two layouts, chosen by preference and screen size. */

const open = async (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  await expect(page.getByTestId('play')).toBeVisible();
  return errors;
};
const theme = (page: Page) => page.locator('html');
const studioButton = (page: Page) => page.getByTestId('appearance').getByRole('button', { name: 'Studio', exact: true });
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('switching look keeps playback, chords, scales and the exercise exactly as they are', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await open(page);
  await expect(theme(page)).toHaveAttribute('data-theme', 'simple');
  await page.getByTestId('add-scale').click();
  await page.getByTestId('add-chord').click();
  await page.getByTestId('bpm').fill('150');
  await page.getByTestId('play').click();
  await expect(page.getByTestId('beat-lights')).toHaveAttribute('data-state', 'playing');

  await studioButton(page).click();
  await expect(theme(page)).toHaveAttribute('data-theme', 'studio');
  await expect(page.getByTestId('studio')).toBeVisible();
  // Still playing, same tempo, same chord on the LCD.
  await expect(page.getByTestId('beat-lights')).toHaveAttribute('data-state', 'playing');
  await expect(page.getByTestId('bpm')).toHaveValue('150');
  await expect(page.getByTestId('current-chord')).toHaveText('Cmaj7');
  await page.getByRole('tab', { name: 'Accordi' }).click();
  await expect(page.getByTestId('chord-layer')).toHaveCount(1);
  await page.getByRole('tab', { name: 'Scale' }).click();
  await expect(page.getByTestId('scale-layer')).toHaveCount(1);

  await page.getByTestId('appearance').getByRole('button', { name: 'Semplificata' }).click();
  await expect(theme(page)).toHaveAttribute('data-theme', 'simple');
  await expect(page.getByTestId('beat-lights')).toHaveAttribute('data-state', 'playing');
  await expect(page.getByTestId('chord-layer')).toHaveCount(1);
  await page.getByTestId('stop').click();
  expect(errors).toEqual([]);
});

test('Simple is forced on a phone held upright, the Studio preference returns where it fits', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  await studioButton(page).click();
  await expect(theme(page)).toHaveAttribute('data-theme', 'studio');
  await page.waitForTimeout(400);

  // Phone upright: Simple, toggle hidden, preference kept.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(theme(page)).toHaveAttribute('data-theme', 'simple');
  await expect(page.getByTestId('appearance')).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gtl.session') ?? '{}').data?.appearance)).toBe('studio');
  await page.reload();
  await expect(theme(page)).toHaveAttribute('data-theme', 'simple');

  // Phone on its side: too short for the console, Studio shown but disabled.
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(theme(page)).toHaveAttribute('data-theme', 'simple');
  await expect(studioButton(page)).toBeDisabled();

  // Tablet upright and laptop: Studio comes back by itself.
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(theme(page)).toHaveAttribute('data-theme', 'studio');
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(theme(page)).toHaveAttribute('data-theme', 'studio');
});

test('no horizontal page overflow in either look, in every workspace and size', async ({ page }) => {
  const sizes: [number, number, 'simple' | 'studio'][] = [
    [390, 844, 'simple'], [768, 1024, 'simple'], [768, 1024, 'studio'], [1024, 768, 'studio'], [1280, 800, 'studio'], [1440, 900, 'studio'],
  ];
  await open(page);
  for (const [width, height, look] of sizes) {
    await page.setViewportSize({ width, height });
    const target = look === 'studio' ? studioButton(page) : page.getByTestId('appearance').getByRole('button', { name: 'Semplificata' });
    if (width >= 600) await target.click();
    await expect(theme(page)).toHaveAttribute('data-theme', look);
    for (const name of ['Fretboard Lab', 'Harmony Lab', 'Arpeggios Lab', 'Jam Studio']) {
      await page.getByRole('button', { name, exact: true }).click();
      expect(await overflow(page), `${look} ${width}×${height} ${name}`).toBeLessThanOrEqual(0);
    }
  }
});

test('Studio controls are real inputs, reachable from the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await studioButton(page).click();
  // Tempo knob: an ARIA slider driven by the arrow keys.
  const knob = page.getByTestId('knob-bpm');
  await knob.focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(page.getByTestId('bpm')).toHaveValue('82');
  await page.keyboard.press('PageDown');
  await expect(knob).toHaveAttribute('aria-valuenow', '57');
  // Swing knob changes the shared setting.
  await page.getByTestId('knob-swing').focus();
  await page.keyboard.press('End');
  await expect(page.getByTestId('knob-swing')).toHaveAttribute('aria-valuetext', '100%');
  // Mixer fader writes the click volume.
  await page.getByTestId('fader-click').fill('0.3');
  await page.getByTestId('appearance').getByRole('button', { name: 'Semplificata' }).click();
  await expect(page.getByRole('slider', { name: 'Volume Click' }).first()).toHaveValue('0.3');
  await studioButton(page).click();
  // Module tabs follow the arrow keys.
  await page.getByRole('tab', { name: 'Scale' }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('tab', { name: 'Accordi' })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Accordi' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('add-chord')).toBeVisible();
});

test('Studio stays readable: WCAG contrast measured on the painted colours', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await studioButton(page).click();
  await page.getByRole('tab', { name: 'Accordi' }).click();
  await page.getByTestId('add-chord').click();
  const ratios = await page.evaluate(() => {
    const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const lum = (c: number[]) => {
      const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
    };
    const ratio = (a: string, b: string) => {
      const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((m, n) => n - m);
      return ((x ?? 0) + 0.05) / ((y ?? 0) + 0.05);
    };
    const style = (selector: string) => {
      const el = document.querySelector(selector);
      if (!el) throw new Error(`missing ${selector}`);
      return getComputedStyle(el);
    };
    const panelBg = style('.st-module .panel').backgroundColor;
    return {
      fieldLabel: ratio(style('.st-module .field-label').color, panelBg),
      panelTitle: ratio(style('.st-module .panel-title').color, panelBg),
      legend: ratio(style('.legend').color, style('.legend').backgroundColor),
      tab: ratio(style('.st-tab[aria-selected="false"]').color, '#2b2e33'),
      lcdChord: ratio(style('.st-lcd .now-chord').color, '#1a1207'),
      chordToneLabel: ratio(style('.role-chord-tone .marker-label').fill, style('.role-chord-tone .shape').fill),
      tensionLabel: ratio(style('.role-tension .marker-label').fill, style('.role-tension .shape').fill),
    };
  });
  for (const [name, value] of Object.entries(ratios)) expect(value, name).toBeGreaterThanOrEqual(4.5);
});

test('neck arrows move one hand position on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const nav = page.getByTestId('fret-nav');
  await expect(nav).toBeVisible();
  const before = await nav.locator('.fret-nav-range').textContent();
  await page.getByRole('button', { name: 'Mostra i tasti più alti' }).click();
  await expect.poll(() => nav.locator('.fret-nav-range').textContent()).not.toBe(before);
  // On a wide screen the whole neck fits and the arrows go away.
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(nav).toBeHidden();
});

test('visual comparison: both looks in every workspace (written to test-results/visual)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  for (const look of ['Semplificata', 'Studio']) {
    await page.getByTestId('appearance').getByRole('button', { name: look, exact: true }).click();
    for (const name of ['Fretboard Lab', 'Harmony Lab', 'Arpeggios Lab', 'Jam Studio']) {
      await page.getByRole('button', { name, exact: true }).click();
      await page.screenshot({ path: `test-results/visual/${look.toLowerCase()}-${name.split(' ')[0]?.toLowerCase()}.png`, fullPage: true });
    }
  }
  await page.getByTestId('appearance').getByRole('button', { name: 'Semplificata' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/visual/semplificata-telefono.png' });
});

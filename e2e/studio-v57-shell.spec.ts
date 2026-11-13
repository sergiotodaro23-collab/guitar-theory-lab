import { expect, test, type Page } from '@playwright/test';
import { chooseLook, openDevice, openRack } from './studio';

/**
 * Studio V5.7 shell (D-41): rail, console/LCD, neck and divider, notebook,
 * device drawer. Every reading comes from the shared store and engine.
 */

const open = async (page: Page, width = 1440, height = 900) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewportSize({ width, height });
  await page.goto('/?debug=1');
  await expect(page.getByTestId('studio')).toBeVisible();
  return errors;
};
const lab = (page: Page, name: string) => page.getByTestId('studio-rail').getByRole('button', { name, exact: true });
const tab = (page: Page, name: string) => page.getByTestId('notebook').getByRole('tab', { name, exact: true });
const fbHeight = (page: Page) => page.getByTestId('fretboard-panel').evaluate((el) => el.getBoundingClientRect().height);

test('rail labs change the notebook pages and keep the musical state', async ({ page }) => {
  const errors = await open(page);
  await expect(lab(page, 'Fretboard Lab')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('notebook').getByRole('tab')).toHaveText(['Scala', 'Accordi', 'Esercizi', 'Tastiera secondaria', 'Legenda e visualizzazione', 'Dettagli', 'Ingresso']);
  await page.getByTestId('tonic').selectOption('G');
  await expect(page.getByTestId('lcd-tonic')).toHaveText('G');
  await expect(page.getByTestId('lcd-notes')).toHaveText('G A B C D E F#');

  await lab(page, 'Harmony Lab').click();
  await expect(tab(page, 'Progressione')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('template')).toBeVisible();
  await lab(page, 'Arpeggios Lab').click();
  await expect(tab(page, 'Arpeggi')).toHaveAttribute('aria-selected', 'true');
  await lab(page, 'Jam Studio').click();
  await expect(tab(page, 'Progressione')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('notebook').getByRole('tab')).toHaveText(['Progressione', 'Arrangiamento', 'Batteria', 'Basso / Comping', 'Backing track', 'Accordo', 'Esercizi', 'Tastiera secondaria', 'Legenda e visualizzazione', 'Dettagli', 'Ingresso']);

  // Back in Fretboard Lab the scale is still G major.
  await lab(page, 'Fretboard Lab').click();
  await expect(page.getByTestId('tonic')).toHaveValue('G');
  expect(errors).toEqual([]);
});

test('notebook tabs: arrows, Home and End; the picked page stays per lab', async ({ page }) => {
  await open(page);
  await tab(page, 'Scala').focus();
  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'Accordi')).toBeFocused();
  await expect(tab(page, 'Accordi')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(tab(page, 'Ingresso')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(tab(page, 'Scala')).toBeFocused();
  await tab(page, 'Legenda e visualizzazione').click();
  await expect(page.getByTestId('notebook-legend').getByTestId('legend')).toBeVisible();
  await lab(page, 'Harmony Lab').click();
  await lab(page, 'Fretboard Lab').click();
  await expect(tab(page, 'Legenda e visualizzazione')).toHaveAttribute('aria-selected', 'true');
});

test('LCD: key, chord numeral, next chord, tempo and transport from the engine', async ({ page }) => {
  await open(page);
  await lab(page, 'Harmony Lab').click();
  await page.getByTestId('template').selectOption('ii-v-i');
  await expect(page.getByTestId('current-chord')).toHaveText('Dm7');
  await expect(page.getByTestId('lcd-function')).toHaveText('ii7 in C');
  await expect(page.getByTestId('lcd-context')).toContainText('NEXT G7');
  await page.getByTestId('bpm').fill('132');
  await page.getByTestId('play').click();
  await expect(page.getByTestId('beat-lights')).toHaveAttribute('data-state', 'playing');
  await expect(page.getByTestId('play')).toHaveText('Pausa');
  await page.getByTestId('pause').click();
  await expect(page.getByTestId('beat-lights')).toHaveAttribute('data-state', 'paused');
  await expect(page.getByTestId('play')).toHaveText('Riprendi');
  await page.getByTestId('stop').click();
  await expect(page.getByTestId('beat-lights')).toHaveAttribute('data-state', 'stopped');
  // Compact display: one row, the meter beside the tempo.
  await page.getByTestId('lcd-size').click();
  await expect(page.getByTestId('lcd-context')).toHaveCount(0);
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.getByTestId('lcd-context')).toHaveCount(0);
  await expect(page.getByTestId('bpm')).toHaveValue('132');
});

test('Next Fretboard previews the next chord with engine markers, without playing', async ({ page }) => {
  await open(page);
  await lab(page, 'Harmony Lab').click();
  await page.getByTestId('template').selectOption('ii-v-i');
  await tab(page, 'Tastiera secondaria').click();
  await expect(page.getByTestId('next-now')).toHaveText('Dm7');
  await expect(page.getByTestId('next-chord')).toHaveText('G7');
  const preview = page.getByTestId('next-fretboard');
  expect(await preview.locator('.marker.role-chord-tone').count()).toBeGreaterThan(3);
  await expect(page.getByTestId('beat-lights')).toHaveAttribute('data-state', 'stopped');
});

test('divider: keyboard, drag and double-click; the height is saved', async ({ page }) => {
  await open(page);
  const divider = page.getByTestId('divider');
  const start = await fbHeight(page);
  await divider.focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => fbHeight(page)).toBeLessThan(start - 20);
  const box = await divider.boundingBox();
  if (!box) throw new Error('no divider');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 40, { steps: 4 });
  await page.mouse.up();
  const dragged = await fbHeight(page);
  expect(dragged).toBeLessThan(start - 50);
  // 25 fret positions (0–24) whatever the height.
  await expect(page.locator('.v57-board .fretboard .fret')).toHaveCount(24);
  await page.reload();
  await expect.poll(() => fbHeight(page)).toBeCloseTo(dragged, -1);
  await divider.dblclick();
  await expect.poll(() => fbHeight(page)).toBeGreaterThan(dragged + 30);
});

const rect = (page: Page, selector: string) => page.locator(selector).first().evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom) };
});

test('drawer: covers the whole notebook zone right of the rail; Escape closes, focus returns, neck and page stay', async ({ page }) => {
  await open(page);
  await tab(page, 'Esercizi').click();
  const pageBox = page.getByTestId('notebook-page');
  await pageBox.evaluate((el) => { el.scrollTop = 80; });
  const before = await pageBox.evaluate((el) => [el.getBoundingClientRect().top, el.scrollTop]);
  const neck = await rect(page, '[data-testid="fretboard-panel"]');
  const board = await rect(page, '.v57-board .fretboard');
  for (const device of ['mixer', 'tuner'] as const) {
    await page.getByTestId(`device-${device}`).click();
    await expect(page.getByTestId('device-drawer')).toHaveAttribute('data-device', device);
    await expect(page.getByTestId('device-close')).toBeFocused();
    await page.waitForTimeout(450);
    const [zone, panel, rail] = [await rect(page, '[data-testid="notebook-zone"]'), await rect(page, '.v57-dv'), await rect(page, '[data-testid="studio-rail"]')];
    // The whole zone under the divider, edge to edge, and nothing of the rail.
    for (const side of ['left', 'top', 'right', 'bottom'] as const) expect(Math.abs(panel[side] - zone[side]), `${device} ${side}`).toBeLessThanOrEqual(1);
    expect(panel.left).toBeGreaterThan(rail.right);
    // Nothing of the notebook shows through: the panel is opaque where the page was.
    const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x ?? 0, y ?? 0)?.closest('.v57-dvx') !== null, [zone.left + 30, zone.bottom - 30]);
    expect(hit, device).toBe(true);
    // The neck keeps its size and place.
    expect(await rect(page, '[data-testid="fretboard-panel"]')).toEqual(neck);
    expect(await rect(page, '.v57-board .fretboard')).toEqual(board);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('device-drawer')).toHaveCount(0);
    await expect(page.getByTestId(`device-${device}`)).toBeFocused();
  }
  // Switching device replaces it at once; the rail key closes it; the notebook never moved.
  await page.getByTestId('device-mixer').click();
  await page.getByTestId('device-tuner').click();
  await expect(page.getByTestId('device-drawer')).toHaveAttribute('data-device', 'tuner');
  await page.getByTestId('device-tuner').click();
  await expect(page.getByTestId('device-drawer')).toHaveCount(0);
  await page.getByTestId('device-mixer').click();
  await page.getByTestId('device-close').click();
  await expect(page.getByTestId('device-drawer')).toHaveCount(0);
  await expect(page.getByTestId('device-mixer')).toBeFocused();
  expect(await pageBox.evaluate((el) => [el.getBoundingClientRect().top, el.scrollTop])).toEqual(before);
  await expect(tab(page, 'Esercizi')).toHaveAttribute('aria-selected', 'true');
});

test('drawer: devices fit short and tall notebook zones', async ({ page }) => {
  await open(page);
  const divider = page.getByTestId('divider');
  for (const key of ['End', 'Home']) {
    await divider.focus();
    await page.keyboard.press(key);
    for (const [device, canvas] of [['mixer', '[data-testid="v57-mixer"]'], ['tuner', '.v57-dv .gtl-wrap']] as const) {
      await openDevice(page, device);
      await page.waitForTimeout(450);
      const [panel, box] = [await rect(page, '.v57-dv'), await rect(page, canvas)];
      expect(box.left, `${key} ${device}`).toBeGreaterThanOrEqual(panel.left);
      expect(box.right, `${key} ${device}`).toBeLessThanOrEqual(panel.right);
      expect(box.bottom, `${key} ${device}`).toBeLessThanOrEqual(panel.bottom);
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('device-drawer')).toHaveCount(0);
    }
  }
});

test('reduced motion: the drawer fades and closes at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await page.getByTestId('device-tuner').click();
  const animation = await page.locator('.v57-dv').evaluate((el) => getComputedStyle(el).animationName);
  expect(animation).toBe('v57-fade');
  await page.getByTestId('device-close').click();
  await expect(page.getByTestId('device-drawer')).toHaveCount(0, { timeout: 100 });
});

test('tuner and interface without input: honest states, opening never starts monitoring', async ({ page }) => {
  await open(page);
  await openDevice(page, 'tuner');
  await expect(page.getByTestId('tuner-device-cents')).toHaveText('ACCORDATORE SPENTO');
  await page.getByTestId('tuner-calibration').focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByTestId('tuner-calibration')).toHaveAttribute('aria-valuetext', '440 Hz');
  await page.keyboard.press('End');
  await expect(page.getByTestId('tuner-calibration')).toHaveAttribute('aria-valuetext', '445 Hz');
  await page.getByTestId('device-close').click();
  await openRack(page);
  await expect(page.getByTestId('iface-lcd')).toContainText('Ingresso spento');
  await expect(page.getByTestId('iface-monitor')).toBeDisabled();
  await expect(page.getByTestId('iface-monitor')).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('iface-gain').focus();
  await page.keyboard.press('End');
  await expect(page.getByTestId('iface-gain')).toHaveAttribute('aria-valuetext', '+12.0 dB');
  // The shared setting: Semplificata's input panel reads the same calibration.
  await chooseLook(page, 'Semplificata');
  await page.getByRole('tab', { name: 'Ingresso' }).click();
  await expect(page.getByTestId('tuner-a4')).toHaveValue('445');
});

test('visualisation: labels, overlay marks and display filters, saved', async ({ page }) => {
  await open(page);
  await page.getByTestId('add-scale').click();
  await expect(page.locator('.v57-board .pip-bar').first()).toBeVisible();
  await page.getByTestId('fretboard-panel').getByRole('group', { name: 'Etichette' }).getByRole('button', { name: 'Nome', exact: true }).click();
  await page.getByTestId('viz-toggle').click();
  await expect(page.getByTestId('viz-popover')).toBeVisible();
  await page.getByTestId('viz-popover').getByRole('radio', { name: 'Puntini agli angoli' }).click();
  await expect(page.locator('.v57-board .pip-bar')).toHaveCount(0);
  await page.getByTestId('viz-overlays').click();
  await expect(page.locator('.v57-board .pip').first()).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('viz-popover')).toHaveCount(0);
  await expect(page.getByTestId('viz-toggle')).toBeFocused();
  // The label mode is a musical setting saved with the session (250 ms debounce).
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.locator('.v57-board .pip-bar')).toHaveCount(0);
  await expect(page.locator('.v57-board .pip').first()).toBeHidden();
  await expect(page.locator('.v57-board .marker[data-label="C"]').first()).toBeVisible();
});

test('rail: collapse, tooltips on focus, settings with look and licence', async ({ page }) => {
  await open(page);
  await page.getByTestId('studio-rail').getByRole('button', { name: 'Espandi barra' }).click();
  await expect(page.getByTestId('studio-rail')).toHaveAttribute('data-x', '1');
  await page.reload();
  await expect(page.getByTestId('studio-rail')).toHaveAttribute('data-x', '1');
  await page.getByTestId('studio-rail').getByRole('button', { name: 'Comprimi barra' }).click();
  await lab(page, 'Jam Studio').focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(lab(page, 'Jam Studio').getByRole('tooltip')).toBeVisible();
  await page.getByTestId('studio-settings-toggle').click();
  await expect(page.getByTestId('studio-settings').getByTestId('license-notice')).toContainText('GNU GPL 3.0');
  await expect(page.getByTestId('studio-settings')).toContainText('Preset Library');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('studio-settings')).toHaveCount(0);
  await expect(page.getByTestId('studio-settings-toggle')).toBeFocused();
});

for (const [width, height] of [[1600, 1000], [1440, 900], [1366, 768], [1280, 800], [1100, 720]] as const) {
  test(`fits ${width}×${height}: no page scroll, LCD unclipped, 25 fret positions`, async ({ page }) => {
    const errors = await open(page, width, height);
    for (const name of ['Fretboard Lab', 'Harmony Lab', 'Arpeggios Lab', 'Jam Studio']) {
      await lab(page, name).click();
      const sizes = await page.evaluate(() => ({
        page: [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight],
        // The screen clips nothing vertically, and the key and chord fit their zones.
        lcd: [document.querySelector('.v57-lcdscreen'), document.querySelector('.v57-lmain')].map((el) => (el as HTMLElement).scrollHeight - (el as HTMLElement).clientHeight),
        board: document.querySelector('.v57-board .fretboard')?.getBoundingClientRect().toJSON(),
        panel: document.querySelector('[data-testid="fretboard-panel"]')?.getBoundingClientRect().toJSON(),
      }));
      expect(sizes.page, `${name} page scroll`).toEqual([0, 0]);
      for (const over of sizes.lcd) expect(over, `${name} LCD`).toBeLessThanOrEqual(1);
      expect(sizes.board.right, `${name} board`).toBeLessThanOrEqual(sizes.panel.right);
      await expect(page.locator('.v57-board .fretboard .fret')).toHaveCount(24);
    }
    await lab(page, 'Fretboard Lab').click();
    await page.screenshot({ path: `test-results/visual/v57-${width}x${height}.png` });
    await openDevice(page, 'mixer');
    await page.waitForTimeout(450);
    await page.screenshot({ path: `test-results/visual/v57-${width}x${height}-mixer.png` });
    expect(errors).toEqual([]);
  });
}

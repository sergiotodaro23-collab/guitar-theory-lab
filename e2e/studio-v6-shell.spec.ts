import { expect, test, type Page } from '@playwright/test';

/**
 * Studio V6 shell (D-43): global header, console with pull-tab, rail with
 * faders, mixer handle. Criteria A1–A5 and B1–B3 of
 * docs/STUDIO_V6_ACCEPTANCE_CRITERIA.md.
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
const rect = (page: Page, selector: string) => page.locator(selector).first().evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom) };
});
const NECK = '.v57-board .fretboard';

test('header spans the window without transport; the console sits between the sidebars', async ({ page }) => {
  const errors = await open(page);
  const [head, rail, deck, studio] = [await rect(page, '[data-testid="studio-header"]'), await rect(page, '[data-testid="studio-rail"]'), await rect(page, '[data-testid="console"]'), await rect(page, '[data-testid="studio"]')];
  expect(head.left - studio.left).toBeLessThanOrEqual(10);
  expect(studio.right - head.right).toBeLessThanOrEqual(10);
  expect(head.bottom).toBeLessThanOrEqual(rail.top);
  expect(deck.left).toBeGreaterThanOrEqual(rail.right);
  expect(deck.top).toBeGreaterThanOrEqual(head.bottom);
  const header = page.getByTestId('studio-header');
  await expect(header.getByTestId('play')).toHaveCount(0);
  await expect(header.getByTestId('bpm')).toHaveCount(0);
  await expect(header.getByTestId('brand')).toContainText('Guitar Theory Lab');
  expect(errors).toEqual([]);
});

test('console: the pull-tab folds it into a working strip, saved across reloads', async ({ page }) => {
  await open(page);
  const tall = await rect(page, '[data-testid="console"]');
  await page.getByTestId('console-toggle').click();
  await expect(page.getByTestId('console-strip')).toBeVisible();
  await expect(page.getByTestId('lcd')).toHaveCount(0);
  const folded = await rect(page, '[data-testid="console"]');
  expect(folded.bottom - folded.top).toBeLessThan((tall.bottom - tall.top) / 2);
  await expect(page.getByTestId('strip-tempo')).toContainText('80 BPM');
  await expect(page.getByTestId('current-chord')).toHaveText('Solo scala');
  await page.getByTestId('play').click();
  await expect(page.getByTestId('beat-lights')).toHaveAttribute('data-state', 'playing');
  await page.getByTestId('stop').click();
  await expect(page.getByTestId('beat-lights')).toHaveAttribute('data-state', 'stopped');
  await page.reload();
  await expect(page.getByTestId('console-strip')).toBeVisible();
  await expect(page.getByTestId('console-toggle')).toHaveAttribute('aria-expanded', 'false');
  await page.getByTestId('console-toggle').click();
  await expect(page.getByTestId('lcd')).toBeVisible();
});

test('tempo: wheel and vertical drag stay inside the engine bounds; swing and master answer keys and wheel', async ({ page }) => {
  await open(page);
  const tempo = page.getByTestId('lcd-tempo');
  const box = await tempo.boundingBox();
  if (!box) throw new Error('no tempo zone');
  await page.mouse.move(box.x + box.width - 12, box.y + box.height - 6);
  await page.mouse.wheel(0, -100);
  await page.mouse.wheel(0, -100);
  await expect(page.getByTestId('bpm')).toHaveValue('82');
  await page.mouse.wheel(0, 100);
  await expect(page.getByTestId('bpm')).toHaveValue('81');
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 12, box.y + box.height - 6 - 40, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId('bpm')).toHaveValue('91');
  // Near the top, a drag stops at the engine's upper bound.
  const max = await page.getByTestId('bpm').getAttribute('max');
  await page.getByTestId('bpm').fill(String(Number(max) - 5));
  await page.mouse.move(box.x + box.width - 12, box.y + box.height - 6);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 12, box.y + box.height - 6 - 60, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByTestId('bpm')).toHaveValue(String(max));

  const master = page.getByTestId('knob-master');
  await expect(master).toHaveAttribute('aria-valuenow', '0.85');
  await master.focus();
  await page.keyboard.press('ArrowDown');
  await expect(master).toHaveAttribute('aria-valuenow', '0.84');
  await master.hover();
  await page.mouse.wheel(0, -100);
  await expect(master).toHaveAttribute('aria-valuenow', '0.86');
  const swing = page.getByTestId('knob-swing');
  await swing.hover();
  await page.mouse.wheel(0, -100);
  await expect(swing).toHaveAttribute('aria-valuetext', '2%');
});

test('rail: guitar fader when compact; names, backing fader and mute when expanded; nothing musical changes', async ({ page }) => {
  await open(page, 1366, 768);
  const rail = page.getByTestId('studio-rail');
  await page.getByTestId('tonic').selectOption('G');
  await expect(page.getByTestId('rail-fader-guitar')).toBeVisible();
  await expect(page.getByTestId('rail-fader-backing')).toBeHidden();
  const neck = await rect(page, NECK);
  await rail.getByRole('button', { name: 'Espandi barra' }).click();
  await expect(page.getByTestId('rail-fader-backing')).toBeVisible();
  // Lab names never run under their icons.
  const overlaps = await rail.locator('.v57-rb').evaluateAll((keys) => keys.filter((key) => {
    const icon = key.querySelector('svg')?.getBoundingClientRect();
    const name = key.querySelector('.v57-rl')?.getBoundingClientRect();
    return !!icon && !!name && name.width > 0 && name.left < icon.right;
  }).length);
  expect(overlaps).toBe(0);
  // The backing trim is a real setting: it moves, mutes and survives a reload.
  const backing = page.getByTestId('rail-fader-backing');
  await backing.focus();
  for (let i = 0; i < 10; i += 1) await page.keyboard.press('ArrowDown');
  await expect(backing).toHaveValue('0.9');
  await page.getByTestId('rail-mute-backing').click();
  await expect(page.getByTestId('rail-mute-backing')).toHaveAttribute('aria-pressed', 'true');
  // Without the input running the guitar cannot be heard: the key says so.
  await expect(page.getByTestId('rail-listen')).toBeDisabled();
  await expect(page.getByTestId('tonic')).toHaveValue('G');
  await expect(rail.getByRole('button', { name: 'Fretboard Lab', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.getByTestId('rail-fader-backing')).toHaveValue('0.9');
  await expect(page.getByTestId('rail-mute-backing')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('rail-mute-backing').click();
  await rail.getByRole('button', { name: 'Comprimi barra' }).click();
  // Back to compact: the neck is where it was.
  await expect.poll(() => rect(page, NECK)).toEqual(neck);
});

test('metronome panel and mixer handle open without moving the neck; Escape closes and focus returns', async ({ page }) => {
  await open(page);
  const neck = await rect(page, NECK);
  await page.getByTestId('metronome-toggle').click();
  const panel = page.getByTestId('metronome-panel');
  await expect(panel).toBeVisible();
  expect(await rect(page, NECK)).toEqual(neck);
  await expect(page.getByTestId('metro-on')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('metro-on').click();
  await expect(page.getByTestId('metro-on')).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId('metro-sound').selectOption('wood');
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(page.getByTestId('metronome-toggle')).toBeFocused();
  // The same click channel as the mixer, and the same timbre as the accent grid.
  const handle = page.getByTestId('device-mixer');
  const handleBox = await rect(page, '[data-testid="device-mixer"]');
  await handle.click();
  await expect(page.getByTestId('device-drawer')).toHaveAttribute('data-device', 'mixer');
  await expect(page.getByTestId('mute-click')).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(450);
  const [zone, drawer] = [await rect(page, '[data-testid="notebook-zone"]'), await rect(page, '.v57-dv')];
  for (const side of ['left', 'top', 'right', 'bottom'] as const) expect(Math.abs(drawer[side] - zone[side]), side).toBeLessThanOrEqual(1);
  // The drawer covers the notebook only: neck and handle stay put, the handle stays reachable.
  expect(await rect(page, NECK)).toEqual(neck);
  expect(await rect(page, '[data-testid="device-mixer"]')).toEqual(handleBox);
  expect(drawer.bottom).toBeLessThanOrEqual(handleBox.top);
  await expect(handle).toHaveAttribute('aria-pressed', 'true');
  await handle.click();
  await expect(page.getByTestId('device-drawer')).toHaveCount(0);
  await page.getByTestId('accent-toggle').click();
  await expect(page.getByTestId('click-sound')).toHaveValue('wood');
});

for (const [width, height] of [[1366, 768], [1280, 800], [1280, 720], [1024, 768]] as const) {
  test(`${width}×${height}: header, console, neck, notebook and mixer handle all fit`, async ({ page }) => {
    await open(page, width, height);
    expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(0);
    for (const sel of ['[data-testid="studio-header"]', '[data-testid="console"]', '[data-testid="fretboard-panel"]', '[data-testid="notebook"]', '[data-testid="device-mixer"]']) {
      const r = await rect(page, sel);
      expect(r.top, sel).toBeGreaterThanOrEqual(0);
      expect(r.bottom, sel).toBeLessThanOrEqual(height);
      expect(r.right, sel).toBeLessThanOrEqual(width);
    }
    // Every header tool is on screen and not covered.
    for (const id of ['metronome-toggle', 'device-tuner', 'rack-toggle']) await page.getByTestId(id).click({ trial: true });
    expect(await page.getByTestId('notebook-page').evaluate((el) => el.clientHeight)).toBeGreaterThanOrEqual(120);
  });
}

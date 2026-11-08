import { expect, test, type Page } from '@playwright/test';

const appearance = (page: Page, name: string) => page.getByTestId('appearance').getByRole('button', { name, exact: true });
const peak = (page: Page) => page.evaluate(async () => {
  // Allow the real gain ramps and any earlier synth tail to settle.
  await new Promise((r) => setTimeout(r, 350));
  let maximum = 0;
  for (let i = 0; i < 100; i += 1) {
    maximum = Math.max(maximum, window.__gtl?.engine.outputLevel() ?? 0);
    await new Promise((r) => setTimeout(r, 10));
  }
  return maximum;
});

test('V5.7 faders and mute share all seven production levels with Simple, including after reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  const values = { click: '0.31', notes: '0.42', comp: '0.53', bass: '0.64', drums: '0.75', guitar: '0.26', master: '0.87' };
  for (const [id, value] of Object.entries(values)) await page.getByTestId(`fader-${id}`).fill(value);
  await page.getByTestId('mute-notes').click();
  await expect(page.getByTestId('fader-click')).toHaveAttribute('aria-valuetext', '-10.2 dB');
  await expect(page.getByTestId('mixer-listen')).toBeDisabled();
  await appearance(page, 'Semplificata').click();
  await expect(page.getByTestId('v57-mixer')).toHaveCount(0);
  for (const [id, value] of Object.entries(values)) await expect(page.getByTestId(`fader-${id}`)).toHaveValue(value);
  await page.getByTestId('fader-click').fill('0.25');
  await appearance(page, 'Studio').click();
  await expect(page.getByTestId('mute-notes')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('fader-click')).toHaveValue('0.25');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('gtl.session') ?? '{}').data?.volClick)).toBe(0.25);
  await page.reload();
  await expect(page.getByTestId('fader-click')).toHaveValue('0.25');
  await expect(page.getByTestId('mixer-listen')).toHaveAttribute('aria-pressed', 'false');
});

test('V5.7 keyboard fader, mute and Solo change the actual audio output', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await page.getByTestId('bpm').fill('180');
  await page.getByRole('checkbox', { name: 'Evidenzia le note a tempo' }).uncheck();
  const fader = page.getByTestId('fader-click');
  await fader.focus();
  await fader.press('End');
  await expect(fader).toHaveValue('1');
  await expect(fader).toHaveAttribute('aria-valuetext', '0.0 dB');
  await page.getByTestId('play').click();
  expect(await peak(page)).toBeGreaterThan(0.01);
  await fader.press('Home');
  await expect(fader).toHaveValue('0');
  await expect(fader).toHaveAttribute('aria-valuetext', '−∞ dB');
  expect(await peak(page)).toBeLessThan(0.002);
  await fader.press('End');
  await page.getByTestId('mute-click').click();
  expect(await peak(page)).toBeLessThan(0.002);
  await appearance(page, 'Semplificata').click();
  expect(await peak(page)).toBeLessThan(0.002);
  await appearance(page, 'Studio').click();
  await page.getByTestId('mute-click').click();
  await page.getByRole('button', { name: 'Solo Batteria', exact: true }).click();
  expect(await peak(page)).toBeLessThan(0.002); // No drum track in Fretboard Lab.
  await page.getByRole('button', { name: 'Solo Click', exact: true }).click();
  expect(await peak(page)).toBeGreaterThan(0.01);
  await expect(page.getByRole('button', { name: 'Solo Batteria', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('fader-master').fill('0');
  expect(await peak(page)).toBeLessThan(0.002);
  await expect(page.getByTestId('beat-lights')).toHaveAttribute('data-state', 'playing');
  await page.getByTestId('stop').click();
});

test('V5.7 assets and controls fit at handoff sizes; pointer moves the real fader', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const [width, height] of [[1440, 900], [1366, 768], [1280, 800], [1100, 720], [768, 1024], [600, 800]]) {
    await page.setViewportSize({ width: width!, height: height! });
    await page.goto('/?debug=1');
    const mixer = page.getByTestId('v57-mixer');
    await expect(mixer).toBeAttached();
    await expect.poll(() => mixer.locator('img').evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    const slider = page.getByTestId('fader-click');
    await slider.scrollIntoViewIfNeeded();
    const rect = await slider.boundingBox();
    if (!rect) throw new Error('Fader missing');
    await page.mouse.click(rect.x + rect.width / 2, rect.y + 12);
    expect(Number(await slider.inputValue())).toBeGreaterThan(0.9);
    await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height - 12);
    expect(Number(await slider.inputValue())).toBeLessThan(0.1);
    await page.screenshot({ path: testInfo.outputPath(`mixer-${width}.png`) });
  }
  expect(errors).toEqual([]);
});

test('V5.7 output meter also measures a diagnostic tone with transport stopped', async ({ page }) => {
  await page.goto('/?debug=1');
  await page.getByText('Diagnostica audio', { exact: true }).click();
  await page.getByTestId('test-tone').click();
  await expect.poll(() => page.getByRole('meter', { name: 'Livello in uscita', exact: true }).getAttribute('aria-valuenow'), { intervals: [20] }).not.toBe('0');
  await expect(page.getByTestId('beat-lights')).toHaveAttribute('data-state', 'stopped');
  await expect(page.getByRole('meter', { name: 'Livello in uscita', exact: true })).toHaveAttribute('aria-valuenow', '0');
});

import { expect, test, type Page } from '@playwright/test';
import { openRack } from './studio';

/**
 * The rendered amplifier head (tools/blender, D-53): the pictures load, the
 * live controls sit on them, the knob shows the frame of its value, and every
 * interaction of the old CSS head still works. What the knobs do to the sound
 * is in guitar-rig.spec.ts.
 */

const KNOBS = ['gain', 'bass', 'mid', 'treble', 'presence', 'out'];

const open = async (page: Page, width = 1440, height = 900) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', (r) => errors.push(`failed: ${r.url()}`));
  await page.setViewportSize({ width, height });
  await page.goto('/?debug=1');
  await openRack(page);
  return errors;
};
/** The frame shown by a knob: its sprite is the element just before its slider button. */
const frameOf = (page: Page, id: string) => page.getByTestId(`amp-${id}`).evaluate((b) => Number((b.previousElementSibling as HTMLElement | null)?.getAttribute('data-frame')));

test('the rendered pictures load and the head keeps its size', async ({ page }) => {
  const errors = await open(page);
  const head = page.getByTestId('amp-head');
  await expect(head).toBeVisible();
  const body = page.getByTestId('amp-body');
  await expect.poll(() => body.evaluate((i) => (i as HTMLImageElement).naturalWidth)).toBe(648);
  expect(await body.evaluate((i) => (i as HTMLImageElement).naturalHeight)).toBe(296);
  const box = await head.boundingBox();
  expect(box?.width).toBe(300);
  expect(box?.height).toBe(124);
  // The knob strip and the lamp are real pictures too.
  const pictures = await page.evaluate(async () => {
    const urls = [...document.querySelectorAll<HTMLElement>('.v57-knob-sprite, .v6-amp-lamp')].map((e) => /url\("?([^")]+)/.exec(getComputedStyle(e).backgroundImage)?.[1] ?? '');
    return Promise.all([...new Set(urls)].map((u) => new Promise<number>((done) => { const i = new Image(); i.onload = () => done(i.naturalWidth); i.onerror = () => done(0); i.src = u; })));
  });
  expect(pictures.sort((a, b) => a - b)).toEqual([48, 3100]);
  expect(errors).toEqual([]);
});

for (const [width, height] of [[1440, 900], [1280, 720], [1024, 768]] as const) {
  test(`${width}×${height}: every knob, label and the lamp lie on the head; nothing overflows the rack`, async ({ page }) => {
    await open(page, width, height);
    const head = await page.getByTestId('amp-head').boundingBox();
    if (!head) throw new Error('no amp head');
    for (const id of KNOBS) {
      const knob = await page.getByTestId(`amp-${id}`).boundingBox();
      if (!knob) throw new Error(`no knob ${id}`);
      // On the control plate: the lower half of the head.
      expect(knob.x, id).toBeGreaterThanOrEqual(head.x + 8);
      expect(knob.x + knob.width, id).toBeLessThanOrEqual(head.x + head.width - 8);
      expect(knob.y, id).toBeGreaterThanOrEqual(head.y + 46);
      expect(knob.y + knob.height, id).toBeLessThanOrEqual(head.y + 118);
    }
    // Knobs do not cover each other: a pointer always lands on the knob under it.
    const boxes = await Promise.all(KNOBS.map((id) => page.getByTestId(`amp-${id}`).boundingBox()));
    for (let i = 1; i < boxes.length; i += 1) expect((boxes[i]?.x ?? 0), KNOBS[i]).toBeGreaterThanOrEqual((boxes[i - 1]?.x ?? 0) + (boxes[i - 1]?.width ?? 0));
    const labels = await page.locator('.v6-amp-lab').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; }));
    for (let i = 1; i < labels.length; i += 1) expect(labels[i]?.[0] ?? 0, `label ${i}`).toBeGreaterThanOrEqual((labels[i - 1]?.[1] ?? 0));
    for (const l of labels) { expect(l[0]).toBeGreaterThanOrEqual(head.x); expect(l[1]).toBeLessThanOrEqual(head.x + head.width); }
    const lamp = await page.getByTestId('amp-lamp').boundingBox();
    expect(lamp && lamp.x >= head.x && lamp.y + lamp.height <= head.y + head.height).toBe(true);
    // The model name fits its badge.
    const fits = await page.locator('.v6-amp-top').evaluate((e) => e.scrollWidth <= e.clientWidth + 1 && (e.firstElementChild?.getBoundingClientRect().width ?? 0) <= e.getBoundingClientRect().width);
    expect(fits).toBe(true);
    const body = page.getByTestId('rig');
    expect(await body.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  });
}

test('the knob shows the frame of its value, by keyboard, drag and double click, and the value is saved', async ({ page }) => {
  await open(page);
  const knob = page.getByTestId('amp-treble');
  const frame = () => frameOf(page, 'treble');
  await knob.focus();
  await page.keyboard.press('Home');
  await expect(knob).toHaveAttribute('aria-valuenow', '0');
  expect(await frame()).toBe(0);
  await page.keyboard.press('End');
  await expect(knob).toHaveAttribute('aria-valuenow', '100');
  expect(await frame()).toBe(30);
  // Double click: back to noon, the middle frame.
  await knob.dblclick();
  await expect(knob).toHaveAttribute('aria-valuenow', '50');
  expect(await frame()).toBe(15);
  // Drag up: the value rises 0.6 per pixel, the frame follows.
  const box = await knob.boundingBox();
  if (!box) throw new Error('no knob');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 50, { steps: 5 });
  await page.mouse.up();
  await expect(knob).toHaveAttribute('aria-valuenow', '80');
  expect(await frame()).toBe(24);
  await page.keyboard.press('ArrowDown');
  await expect(knob).toHaveAttribute('aria-valuenow', '78');
  await page.waitForTimeout(400);
  await page.reload();
  await openRack(page);
  await expect(page.getByTestId('amp-treble')).toHaveAttribute('aria-valuenow', '78');
  expect(await frameOf(page, 'treble')).toBe(23);
});

test('the rendered pointer really points where the value says: left at minimum, up at noon, right at maximum', async ({ page }) => {
  await open(page);
  // Centre of the pixels of the painted pointer line of three frames of the strip, relative to the frame's centre.
  const pointer = await page.evaluate(async () => {
    const url = /url\("?([^")]+)/.exec(getComputedStyle(document.querySelector('.v57-knob-sprite') as HTMLElement).backgroundImage)?.[1] ?? '';
    const image = new Image();
    await new Promise((done) => { image.onload = done; image.src = url; });
    const size = image.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];
    ctx.drawImage(image, 0, 0);
    return [0, 15, 30].map((f) => {
      const data = ctx.getImageData(f * size, 0, size, size).data;
      let sx = 0; let sy = 0; let n = 0;
      for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
        const i = (y * size + x) * 4;
        // Cream paint: bright and nearly neutral. The gold cap is bright too, but far from neutral.
        if ((data[i] ?? 0) > 170 && (data[i + 1] ?? 0) > 165 && (data[i + 2] ?? 0) > 150 && (data[i + 3] ?? 0) > 200 && (data[i] ?? 0) - (data[i + 2] ?? 0) < 35) { sx += x; sy += y; n += 1; }
      }
      return n ? [sx / n - size / 2, sy / n - size / 2, n] : [0, 0, 0];
    });
  });
  const [min, noon, max] = pointer as [number[], number[], number[]];
  expect(min[2]).toBeGreaterThan(20);
  // Minimum: −135°, down and to the left. Maximum: +135°, down and to the right. Noon: straight up.
  // At maximum the line is on the side away from the light, so fewer of its pixels are bright: looser bounds there.
  expect(min[0]).toBeLessThan(-6);
  expect(min[1]).toBeGreaterThan(5);
  expect(max[0]).toBeGreaterThan(3);
  expect(max[1]).toBeGreaterThan(3);
  expect(Math.abs(noon[0] ?? 9)).toBeLessThan(3);
  expect(noon[1]).toBeLessThan(-10);
});

test('power, lamp, bypass and the NAM name keep working on the rendered head', async ({ page }) => {
  await open(page);
  const lamp = page.getByTestId('amp-lamp');
  const picture = () => lamp.evaluate((e) => getComputedStyle(e).backgroundImage);
  await expect(lamp).toHaveAttribute('data-on', '1');
  // Two different pictures (small enough to be inlined by the build, so compared by content).
  const lit = await picture();
  expect(lit).toContain('url(');
  await page.getByTestId('amp-power').click();
  await expect(lamp).toHaveAttribute('data-on', '0');
  const dark = await picture();
  expect(dark).toContain('url(');
  expect(dark).not.toBe(lit);
  await expect(page.getByTestId('amp-head')).toHaveAttribute('data-on', '0');
  // Off, the knobs still turn: settings are kept for when it comes back on.
  await page.getByTestId('amp-gain').focus();
  await page.keyboard.press('End');
  await expect(page.getByTestId('amp-gain')).toHaveAttribute('aria-valuenow', '100');
  await page.getByTestId('amp-power').click();
  await expect(lamp).toHaveAttribute('data-on', '1');
  await page.getByTestId('amp-bypass').click();
  await expect(page.getByTestId('amp-bypass')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.v6-amp-name')).toHaveText('GTL Clean');
  await expect(page.getByTestId('amp-tape')).toHaveText('DSP interno');
  // Every knob is a slider with a name, reachable by keyboard.
  for (const id of KNOBS) await expect(page.getByTestId(`amp-${id}`)).toHaveAttribute('role', 'slider');
  await expect(page.getByRole('slider', { name: 'Amplificatore Treble' })).toBeVisible();
});

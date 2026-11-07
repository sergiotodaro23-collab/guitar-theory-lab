import { expect, test, type Page } from '@playwright/test';

/**
 * Semplificata (the console) and Studio (the workbench): one state, two
 * layouts, chosen by preference and screen size.
 */

const open = async (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  await expect(page.getByTestId('play')).toBeVisible();
  return errors;
};
const theme = (page: Page) => page.locator('html');
const lookButton = (page: Page, name: 'Studio' | 'Semplificata') => page.getByTestId('appearance').getByRole('button', { name, exact: true });
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const savedLook = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('gtl.session') ?? '{}').data?.look);

test('Studio by default on a computer; switching look keeps playback, chords and scales', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await open(page);
  await expect(theme(page)).toHaveAttribute('data-theme', 'studio');
  await expect(page.getByTestId('studio')).toBeVisible();
  await page.getByTestId('add-scale').click();
  await page.getByTestId('add-chord').click();
  await page.getByTestId('bpm').fill('150');
  await page.getByTestId('play').click();
  await expect(page.getByTestId('beat-lights')).toHaveAttribute('data-state', 'playing');

  await lookButton(page, 'Semplificata').click();
  await expect(theme(page)).toHaveAttribute('data-theme', 'simple');
  await expect(page.getByTestId('simple-shell')).toBeVisible();
  await expect(page.getByTestId('beat-lights')).toHaveAttribute('data-state', 'playing');
  await expect(page.getByTestId('bpm')).toHaveValue('150');
  await expect(page.getByTestId('current-chord')).toHaveText('Cmaj7');
  await page.getByRole('tab', { name: 'Accordi' }).click();
  await expect(page.getByTestId('chord-layer')).toHaveCount(1);
  await page.getByRole('tab', { name: 'Scale' }).click();
  await expect(page.getByTestId('scale-layer')).toHaveCount(1);

  await lookButton(page, 'Studio').click();
  await expect(theme(page)).toHaveAttribute('data-theme', 'studio');
  await expect(page.getByTestId('beat-lights')).toHaveAttribute('data-state', 'playing');
  await expect(page.getByTestId('chord-layer')).toHaveCount(1);
  await expect(page.getByTestId('scale-layer')).toHaveCount(1);
  await page.getByTestId('stop').click();
  expect(errors).toEqual([]);
});

test('Simple is forced on a phone held upright; the saved choice returns where Studio fits', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  // An explicit Simple choice holds on a large screen too.
  await lookButton(page, 'Semplificata').click();
  await page.waitForTimeout(400);
  expect(await savedLook(page)).toBe('simple');
  await page.reload();
  await expect(theme(page)).toHaveAttribute('data-theme', 'simple');
  await lookButton(page, 'Studio').click();
  await expect(theme(page)).toHaveAttribute('data-theme', 'studio');
  await page.waitForTimeout(400);

  // Phone upright: Simple, toggle hidden, preference kept.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(theme(page)).toHaveAttribute('data-theme', 'simple');
  await expect(page.getByTestId('appearance')).toBeHidden();
  expect(await savedLook(page)).toBe('studio');
  await page.reload();
  await expect(theme(page)).toHaveAttribute('data-theme', 'simple');

  // Phone on its side: too short for the workbench, Studio shown but disabled.
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(theme(page)).toHaveAttribute('data-theme', 'simple');
  await expect(lookButton(page, 'Studio')).toBeDisabled();

  // Tablet upright and laptop: Studio comes back by itself.
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(theme(page)).toHaveAttribute('data-theme', 'studio');
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(theme(page)).toHaveAttribute('data-theme', 'studio');
});

test('no horizontal page overflow in either look, in every workspace and size', async ({ page }) => {
  const sizes: [number, number, 'simple' | 'studio'][] = [
    [390, 844, 'simple'], [768, 1024, 'simple'], [768, 1024, 'studio'], [1024, 768, 'studio'], [1280, 800, 'studio'], [1440, 900, 'studio'], [1440, 900, 'simple'],
  ];
  await open(page);
  for (const [width, height, look] of sizes) {
    await page.setViewportSize({ width, height });
    if (width >= 600) await lookButton(page, look === 'studio' ? 'Studio' : 'Semplificata').click();
    await expect(theme(page)).toHaveAttribute('data-theme', look);
    for (const name of ['Fretboard Lab', 'Harmony Lab', 'Arpeggios Lab', 'Jam Studio']) {
      await page.getByRole('button', { name, exact: true }).click();
      expect(await overflow(page), `${look} ${width}×${height} ${name}`).toBeLessThanOrEqual(0);
    }
  }
});

test('fret wires: 24 metal bars plus the nut, painted and visible on the wood, in both looks', async ({ page }) => {
  for (const [width, height, look] of [[1440, 900, 'Studio'], [1440, 900, 'Semplificata'], [390, 844, null]] as const) {
    await page.setViewportSize({ width, height });
    await open(page);
    if (look) await lookButton(page, look).click();
    const wires = page.locator('.fretboard .fret');
    await expect(wires).toHaveCount(24);
    await expect(page.locator('.fretboard .nut')).toHaveCount(1);
    await expect(page.locator('.fretboard .string')).toHaveCount(6);
    // Each wire is a real shape with width and a fill, not a zero-width line.
    const shapes = await wires.evaluateAll((els) => els.map((el) => {
      const box = (el as SVGGraphicsElement).getBBox();
      return { width: box.width, fill: getComputedStyle(el).fill };
    }));
    for (const shape of shapes) {
      expect(shape.width).toBeGreaterThanOrEqual(3);
      expect(shape.fill).not.toBe('none');
    }
    // And they show: on the rendered pixels, the wire differs from the wood beside it.
    const wire = wires.nth(9);
    await wire.scrollIntoViewIfNeeded();
    const box = await wire.boundingBox();
    if (!box) throw new Error('fret 10 not on screen');
    const shot = await page.screenshot({ clip: { x: box.x - 14, y: box.y + box.height * 0.3, width: 28, height: 4 } });
    const contrast = await page.evaluate(async (data) => {
      const img = new Image();
      img.src = `data:image/png;base64,${data}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return 0;
      ctx.drawImage(img, 0, 0);
      const lum = (x: number) => {
        const [r = 0, g = 0, b = 0] = ctx.getImageData(Math.round(x * img.width), Math.floor(img.height / 2), 1, 1).data;
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      return Math.abs(lum(0.5) - lum(0.15));
    }, shot.toString('base64'));
    expect(contrast, `${look ?? 'phone'} wire against wood`).toBeGreaterThan(25);
  }
});

test('Studio controls are real inputs, reachable from the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const knob = page.getByTestId('knob-bpm');
  await knob.focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(page.getByTestId('bpm')).toHaveValue('82');
  await page.keyboard.press('PageDown');
  await expect(knob).toHaveAttribute('aria-valuenow', '57');
  await page.getByTestId('knob-swing').focus();
  await page.keyboard.press('End');
  await expect(page.getByTestId('knob-swing')).toHaveAttribute('aria-valuetext', '100%');
  // Fader and mute write the shared mix; the other look sees the same levels.
  await page.getByTestId('fader-click').fill('0.3');
  await page.getByTestId('mute-notes').click();
  await expect(page.getByTestId('mute-notes')).toHaveAttribute('aria-pressed', 'true');
  await lookButton(page, 'Semplificata').click();
  await expect(page.getByTestId('fader-click')).toHaveValue('0.3');
  // The console's module tabs follow the arrow keys.
  await page.getByRole('tab', { name: 'Scale' }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('tab', { name: 'Accordi' })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Accordi' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('add-chord')).toBeVisible();
});

test('the tutor phone: three real modes, words from the engine, folds away', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const tutor = page.getByTestId('tutor');
  await expect(tutor.getByRole('img', { name: /pixel art/ })).toBeVisible();
  await expect(page.getByTestId('tutor-line')).toContainText('C D E F G A B');
  await tutor.getByRole('button', { name: 'Tutor', exact: true }).click();
  await expect(tutor.getByRole('button', { name: 'Tutor', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('tutor-line').locator('.ws-bubble-tip')).toBeVisible();
  await page.getByRole('button', { name: 'Harmony Lab', exact: true }).click();
  await expect(page.getByTestId('tutor-line')).toContainText('Guide tones');
  await tutor.getByRole('button', { name: 'Silenzioso' }).click();
  await expect(page.getByTestId('tutor-line')).toHaveCount(0);
  await page.getByTestId('tutor-minimize').click();
  await expect(page.getByTestId('tutor')).toHaveCount(0);
  await page.getByTestId('tutor-open').click();
  await expect(page.getByTestId('tutor')).toBeVisible();
});

test('the legend lists only what the neck shows', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const legend = page.getByTestId('note-legend').getByTestId('legend');
  // Tonic, scale, and the played-note entry that stays while the exercise is on.
  await expect(legend.locator('[data-kind]')).toHaveCount(3);
  await expect(legend.locator('[data-kind="root"]')).toBeVisible();
  await expect(legend.locator('[data-kind="played"]')).toBeVisible();
  await page.getByRole('button', { name: 'Harmony Lab', exact: true }).click();
  await expect(legend.locator('[data-kind="root"]')).toHaveCount(0);
  await expect(legend.locator('[data-kind="guide"]')).toBeVisible();
});

test('Studio stays readable: WCAG contrast measured on the painted colours', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  // Scale alone first: tonic and scale markers are on the neck.
  const scaleLabels = await page.evaluate(() => {
    const lum = (v: string) => {
      const [r, g, b] = (v.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
    };
    const pair = (role: string) => {
      const label = document.querySelector(`.role-${role} .marker-label`);
      const shape = document.querySelector(`.role-${role} .shape`);
      if (!label || !shape) throw new Error(`missing ${role}`);
      const [x, y] = [lum(getComputedStyle(label).fill), lum(getComputedStyle(shape).fill)].sort((m, n) => n - m);
      return ((x ?? 0) + 0.05) / ((y ?? 0) + 0.05);
    };
    return { root: pair('root'), scale: pair('scale') };
  });
  for (const [name, value] of Object.entries(scaleLabels)) expect(value, `${name} label`).toBeGreaterThanOrEqual(4.5);
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
    const paper = 'rgb(243, 230, 195)';
    return {
      noteTitle: ratio(style('.ws-note .panel-title').color, paper),
      noteLabel: ratio(style('.ws-note .field-label').color, paper),
      legend: ratio(style('.ws-legend-note .legend').color, paper),
      lcdChord: ratio(style('.ws-lcd .now-chord').color, 'rgb(23, 15, 5)'),
      bubble: ratio(style('.ws-bubble').color, style('.ws-bubble').backgroundColor),
      knobLabel: ratio(style('.knob-label').color, 'rgb(63, 67, 72)'),
      chordToneLabel: ratio(style('.role-chord-tone .marker-label').fill, style('.role-chord-tone .shape').fill),
      tensionLabel: ratio(style('.role-tension .marker-label').fill, style('.role-tension .shape').fill),
      litKey: ratio(style('.mode-nav .segment[aria-pressed="true"]').color, 'rgb(232, 119, 26)'),
    };
  });
  for (const [name, value] of Object.entries(ratios)) expect(value, name).toBeGreaterThanOrEqual(4.5);
});

test('Simple stays readable: WCAG contrast on the console', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await lookButton(page, 'Semplificata').click();
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
    const panelBg = style('.cs-module .panel').backgroundColor;
    return {
      fieldLabel: ratio(style('.cs-module .field-label').color, panelBg),
      panelTitle: ratio(style('.cs-module .panel-title').color, panelBg),
      legend: ratio(style('.legend').color, style('.legend').backgroundColor),
      tab: ratio(style('.cs-tab[aria-selected="false"]').color, 'rgb(43, 46, 51)'),
      lcdChord: ratio(style('.cs-lcd .now-chord').color, 'rgb(26, 18, 7)'),
      chordToneLabel: ratio(style('.role-chord-tone .marker-label').fill, style('.role-chord-tone .shape').fill),
      tensionLabel: ratio(style('.role-tension .marker-label').fill, style('.role-tension .shape').fill),
    };
  });
  for (const [name, value] of Object.entries(ratios)) expect(value, name).toBeGreaterThanOrEqual(4.5);
});

test('Simple on a phone: transport bar within reach, time settings folded, neck arrows', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  // The transport bar sits at the bottom edge and stays there.
  const bar = await page.locator('.cs-transport').boundingBox();
  expect(Math.round((bar?.y ?? 0) + (bar?.height ?? 0))).toBe(844);
  await expect(page.getByTestId('knob-bpm')).toBeHidden();
  await page.getByTestId('time-more-toggle').click();
  await expect(page.getByTestId('knob-bpm')).toBeVisible();
  const nav = page.getByTestId('fret-nav');
  await expect(nav).toBeVisible();
  const before = await nav.locator('.fret-nav-range').textContent();
  await page.getByRole('button', { name: 'Mostra i tasti più alti' }).click();
  await expect.poll(() => nav.locator('.fret-nav-range').textContent()).not.toBe(before);
  // On a wide screen the whole neck fits and the arrows go away.
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(nav).toBeHidden();
});

test('visual comparison: both looks, every workspace, desktop, tablet and phone (test-results/visual)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  for (const look of ['Studio', 'Semplificata'] as const) {
    await lookButton(page, look).click();
    for (const name of ['Fretboard Lab', 'Harmony Lab', 'Arpeggios Lab', 'Jam Studio']) {
      await page.getByRole('button', { name, exact: true }).click();
      await page.screenshot({ path: `test-results/visual/${look.toLowerCase()}-${name.split(' ')[0]?.toLowerCase()}.png`, fullPage: true });
    }
  }
  await page.getByRole('button', { name: 'Fretboard Lab', exact: true }).click();
  await lookButton(page, 'Studio').click();
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({ path: 'test-results/visual/studio-tablet.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/visual/semplificata-telefono.png' });
});

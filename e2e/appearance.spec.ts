import { expect, test, type Page } from '@playwright/test';
import { chooseLook, openMixer, openTab, reveal } from './studio';

/**
 * Semplificata (the console) and Studio (the V5.7 console, D-41): one state, two
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
  await reveal(page, page.getByTestId('add-scale'));
  await page.getByTestId('add-scale').click();
  await reveal(page, page.getByTestId('add-chord'));
  await page.getByTestId('add-chord').click();
  await page.getByTestId('bpm').fill('150');
  await page.getByTestId('play').click();
  await expect(page.getByTestId('beat-lights')).toHaveAttribute('data-state', 'playing');

  await chooseLook(page, 'Semplificata');
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
  await reveal(page, page.getByTestId('chord-layer'));
  await expect(page.getByTestId('chord-layer')).toHaveCount(1);
  await reveal(page, page.getByTestId('scale-layer'));
  await expect(page.getByTestId('scale-layer')).toHaveCount(1);
  await page.getByTestId('stop').click();
  expect(errors).toEqual([]);
});

test('Simple is forced on a phone held upright; the saved choice returns where Studio fits', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  // An explicit Simple choice holds on a large screen too.
  await chooseLook(page, 'Semplificata');
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
    if (width >= 600) await chooseLook(page, look === 'studio' ? 'Studio' : 'Semplificata');
    await expect(theme(page)).toHaveAttribute('data-theme', look);
    for (const name of ['Fretboard Lab', 'Harmony Lab', 'Arpeggios Lab', 'Jam Studio']) {
      await reveal(page, page.getByRole('button', { name, exact: true }));
      await page.getByRole('button', { name, exact: true }).click();
      expect(await overflow(page), `${look} ${width}×${height} ${name}`).toBeLessThanOrEqual(0);
    }
  }
});

test('fret wires: 24 metal bars plus the nut, painted and visible on the wood, in both looks', async ({ page }) => {
  for (const [width, height, look] of [[1440, 900, 'Studio'], [1440, 900, 'Semplificata'], [390, 844, null]] as const) {
    await page.setViewportSize({ width, height });
    await open(page);
    if (look) await chooseLook(page, look);
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
    // A wire with no scale notes beside it (the default shape sits on frets 7–10): the sample must read wood, not a marker.
    const wire = wires.nth(13);
    await wire.scrollIntoViewIfNeeded();
    const box = await wire.boundingBox();
    if (!box) throw new Error('fret 14 not on screen');
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
  // Tempo: the LCD field and its keys; swing: the console knob.
  await reveal(page, page.getByRole('button', { name: 'Accelera di 1 BPM' }));
  await page.getByRole('button', { name: 'Accelera di 1 BPM' }).click();
  await reveal(page, page.getByRole('button', { name: 'Accelera di 1 BPM' }));
  await page.getByRole('button', { name: 'Accelera di 1 BPM' }).click();
  await expect(page.getByTestId('bpm')).toHaveValue('82');
  await reveal(page, page.getByTestId('knob-swing'));
  await page.getByTestId('knob-swing').focus();
  await page.keyboard.press('End');
  await reveal(page, page.getByTestId('knob-swing'));
  await expect(page.getByTestId('knob-swing')).toHaveAttribute('aria-valuetext', '100%');
  // Fader and mute write the shared mix; the other look sees the same levels.
  await openMixer(page);
  await reveal(page, page.getByTestId('fader-click'));
  await page.getByTestId('fader-click').fill('0.3');
  await reveal(page, page.getByTestId('mute-notes'));
  await page.getByTestId('mute-notes').click();
  await reveal(page, page.getByTestId('mute-notes'));
  await expect(page.getByTestId('mute-notes')).toHaveAttribute('aria-pressed', 'true');
  await chooseLook(page, 'Semplificata');
  await reveal(page, page.getByTestId('fader-click'));
  await expect(page.getByTestId('fader-click')).toHaveValue('0.3');
  // The console's module tabs follow the arrow keys.
  await page.getByRole('tab', { name: 'Scale' }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('tab', { name: 'Accordi' })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Accordi' })).toHaveAttribute('aria-selected', 'true');
  await reveal(page, page.getByTestId('add-chord'));
  await expect(page.getByTestId('add-chord')).toBeVisible();
});

test('the tutor phone: three real modes, words from the engine, folds away', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await openTab(page, 'Legenda e visualizzazione', 'Legenda');
  const tutor = page.getByTestId('tutor');
  await expect(tutor.getByRole('img', { name: /pixel art/ })).toBeVisible();
  await reveal(page, page.getByTestId('tutor-line'));
  await expect(page.getByTestId('tutor-line')).toContainText('C D E F G A B');
  await tutor.getByRole('button', { name: 'Tutor', exact: true }).click();
  await expect(tutor.getByRole('button', { name: 'Tutor', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await reveal(page, page.getByTestId('tutor-line'));
  await expect(page.getByTestId('tutor-line').locator('.ws-bubble-tip')).toBeVisible();
  await page.getByRole('button', { name: 'Harmony Lab', exact: true }).click();
  await openTab(page, 'Legenda e visualizzazione', 'Legenda');
  await reveal(page, page.getByTestId('tutor-line'));
  await expect(page.getByTestId('tutor-line')).toContainText('Guide tones');
  await tutor.getByRole('button', { name: 'Silenzioso' }).click();
  await expect(page.getByTestId('tutor-line')).toHaveCount(0);
  await reveal(page, page.getByTestId('tutor-minimize'));
  await page.getByTestId('tutor-minimize').click();
  await expect(page.getByTestId('tutor')).toHaveCount(0);
  await reveal(page, page.getByTestId('tutor-open'));
  await page.getByTestId('tutor-open').click();
  await reveal(page, page.getByTestId('tutor'));
  await expect(page.getByTestId('tutor')).toBeVisible();
});

test('the legend lists only what the neck shows', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await openTab(page, 'Legenda e visualizzazione', 'Legenda');
  const legend = page.getByTestId('notebook-legend').getByTestId('legend');
  // Tonic, scale, and the played-note entry that stays while the exercise is on.
  await expect(legend.locator('[data-kind]')).toHaveCount(3);
  await expect(legend.locator('[data-kind="root"]')).toBeVisible();
  await expect(legend.locator('[data-kind="played"]')).toBeVisible();
  await page.getByRole('button', { name: 'Harmony Lab', exact: true }).click();
  await openTab(page, 'Legenda e visualizzazione', 'Legenda');
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
  await reveal(page, page.getByTestId('add-chord'));
  await page.getByTestId('add-chord').click();
  const measure = (selectors: Record<string, [string, string | null, string | null]>) => page.evaluate((pairs) => {
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
    // [foreground selector, background selector or null, fixed background colour or null]; SVG uses fill.
    return Object.fromEntries(Object.entries(pairs).map(([name, [fg, bgSel, bgColor]]) => {
      const f = style(fg);
      const color = f.fill && f.fill !== 'none' && fg.includes('marker-label') ? f.fill : f.color;
      const bg = bgColor ?? (bgSel ? (style(bgSel).fill !== 'none' && bgSel.includes('shape') ? style(bgSel).fill : style(bgSel).backgroundColor) : 'rgb(0, 0, 0)');
      return [name, ratio(color, bg)];
    }));
  }, selectors);
  const paper = 'rgb(239, 227, 189)';
  const first = await measure({
    noteTitle: ['.v57-page .panel-title', null, paper],
    noteLabel: ['.v57-page .field-label', null, paper],
    lcdChord: ['.v57-lmid', null, 'rgb(18, 10, 4)'],
    lcdSub: ['.v57-lsub', null, 'rgb(18, 10, 4)'],
    litKey: ['.v57-rb[data-on="1"]', null, 'rgb(232, 119, 26)'],
    tab: ['.v57-tab[aria-selected="false"]', null, 'rgb(102, 154, 104)'],
    chordToneLabel: ['.v57-board .role-chord-tone .marker-label', '.v57-board .role-chord-tone .shape', null],
  });
  await openTab(page, 'Legenda e visualizzazione', 'Legenda');
  const second = await measure({
    legend: ['.v57-legend .legend', null, paper],
    bubble: ['.ws-bubble', '.ws-bubble', null],
  });
  for (const [name, value] of Object.entries({ ...first, ...second })) expect(value, name).toBeGreaterThanOrEqual(4.5);
});

test('Simple stays readable: WCAG contrast on the console', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await chooseLook(page, 'Semplificata');
  await page.getByRole('tab', { name: 'Accordi' }).click();
  await reveal(page, page.getByTestId('add-chord'));
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
  await reveal(page, page.getByTestId('time-more-toggle'));
  await page.getByTestId('time-more-toggle').click();
  await reveal(page, page.getByTestId('knob-bpm'));
  await expect(page.getByTestId('knob-bpm')).toBeVisible();
  const nav = page.getByTestId('fret-nav');
  await expect(nav).toBeVisible();
  const before = await nav.locator('.fret-nav-range').textContent();
  await reveal(page, page.getByRole('button', { name: 'Mostra i tasti più alti' }));
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
    await chooseLook(page, look);
    for (const name of ['Fretboard Lab', 'Harmony Lab', 'Arpeggios Lab', 'Jam Studio']) {
      await reveal(page, page.getByRole('button', { name, exact: true }));
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

import { expect, test } from '@playwright/test';
import { chooseLook, loadPreset, reveal } from './studio';

/** AR4, AR6: overlays and fourths over the chord, then a line edited note by note and a route written by hand. */

const labels = (page: import('@playwright/test').Page) => page.$$eval('.fretboard .marker .marker-label', (els) => [...new Set(els.map((e) => e.textContent ?? ''))].sort());

for (const look of ['Studio', 'Semplificata'] as const) {
  test(`${look}: Em7 over Cmaj7, then one note moved and a route by hand`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await chooseLook(page, look);
    await page.getByRole('button', { name: 'Arpeggios Lab', exact: true }).click();
    await loadPreset(page, { id: 'ar-em7-over-cmaj7' });
    await reveal(page, page.getByTestId('arp-overlay'));
    await expect(page.getByTestId('arp-vocab')).toContainText('Em7 su Cmaj7: 3 5 7 9');
    await expect.poll(() => labels(page)).toEqual(['3', '5', '7', '9']);

    // One note to another string: the same pitch, the rest of the line where it was.
    const chip = page.getByTestId('arp-note-1');
    await reveal(page, chip);
    const before = await page.getByTestId('arp-edit-notes').innerText();
    await chip.click();
    await page.getByTestId('arp-edit-string').click();
    const after = await page.getByTestId('arp-edit-notes').innerText();
    const lines = (t: string) => t.split('\n').filter(Boolean);
    expect(lines(after)[0]).toBe(lines(before)[0]);
    expect(lines(after)[1]?.split(' ')[0]).toBe(lines(before)[1]?.split(' ')[0]);
    expect(lines(after)[1]).not.toBe(lines(before)[1]);
    await page.getByTestId('arp-edit-reset').click();
    await expect.poll(() => page.getByTestId('arp-edit-notes').innerText()).toBe(before);

    // A route written by hand, checked token by token, and the ergonomic limits.
    await page.getByText('Percorso scritto a mano').click();
    const route = page.getByTestId('arp-route');
    await route.fill('6/8 5/7 9/3');
    await route.blur();
    await expect(page.getByTestId('arp-route-errors')).toContainText('la corda 9 non esiste');
    await route.fill('6/3 5/14');
    await route.blur();
    await expect(page.getByTestId('arp-ergo')).toContainText('Nota 2: salto di 11 tasti');
    await route.fill('6/8 5/7 5/10 4/9');
    await route.blur();
    await expect(page.getByTestId('arp-ergo')).toContainText('Nessun problema');
    expect(errors).toEqual([]);
  });
}

test('Studio: diatonic fourths on Dm7 draw only D dorian notes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await chooseLook(page, 'Studio');
  await page.getByRole('button', { name: 'Arpeggios Lab', exact: true }).click();
  await loadPreset(page, { id: 'ar-dm7-quartal' });
  const drawn = await labels(page);
  expect(drawn.length).toBeGreaterThanOrEqual(4);
  for (const l of drawn) expect(['1', 'b3', '4', '5', 'b7', '9', '11', '6', '13', '2']).toContain(l);
});

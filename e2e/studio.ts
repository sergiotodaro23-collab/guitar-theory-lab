/**
 * Helpers for the Studio shell (D-41, V6 in D-43): the look switch lives in
 * the settings panel of the rail, panels live on notebook tabs, mixer and
 * tuner in the drawer, input and rig in the rack, the metronome in the header. In Semplificata every helper is a no-op or uses
 * its own deck, so the same test runs in both looks.
 */
import { expect, type Locator, type Page } from '@playwright/test';

export type Look = 'Studio' | 'Semplificata';

/** Which shell is on screen, read after the frame that follows a resize or a look change has painted. */
const inStudio = (page: Page) => page.evaluate(() => new Promise<boolean>((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve(document.querySelector('[data-testid="studio"]') !== null)));
}));

/** Switch look from either shell. */
export async function chooseLook(page: Page, look: Look): Promise<void> {
  if (await inStudio(page)) {
    if (look === 'Studio') return;
    await page.getByTestId('studio-settings-toggle').click();
    await page.getByTestId('appearance').getByRole('button', { name: look, exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'simple');
    return;
  }
  await page.getByTestId('appearance').getByRole('button', { name: look, exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', look === 'Studio' ? 'studio' : 'simple');
}

/** Show a notebook page in Studio, or the deck module with the given Simple label. */
export async function openTab(page: Page, studioLabel: string, simpleLabel = studioLabel): Promise<void> {
  if (await inStudio(page)) {
    await page.getByTestId('notebook').getByRole('tab', { name: studioLabel, exact: true }).click();
    return;
  }
  await page.getByRole('tab', { name: simpleLabel, exact: true }).click();
}

/** Show the rig rack in full (Studio V6): it may be hidden or folded to its spine. */
export async function openRack(page: Page): Promise<void> {
  if (!(await inStudio(page))) return;
  const rack = page.getByTestId('rack');
  if (!(await rack.isVisible())) await page.getByTestId('rack-toggle').click();
  if ((await rack.getAttribute('data-mode')) === 'compact') await page.getByTestId('rack-expand').click();
  await expect(rack).toHaveAttribute('data-mode', 'expanded');
}

/** Open a device drawer in Studio (mixer, tuner). */
export async function openDevice(page: Page, device: 'mixer' | 'tuner'): Promise<void> {
  if (!(await inStudio(page))) return;
  const key = page.getByTestId(`device-${device}`);
  const opening = (await key.getAttribute('aria-pressed')) !== 'true';
  if (opening) await key.click();
  await expect(page.getByTestId('device-drawer')).toHaveAttribute('data-device', device);
  // The drawer moves focus to its close key a moment after opening: wait for it, or the next key press lands there.
  if (opening) await expect(page.getByTestId('device-close')).toBeFocused();
}

/** The mixer is always on screen in Semplificata; in Studio it is a drawer device. */
export const openMixer = (page: Page) => openDevice(page, 'mixer');

/**
 * Brings a control into view wherever the look keeps it: a notebook page, a
 * device drawer or the settings panel in Studio, a deck module in
 * Semplificata. A no-op when it is already visible. When the control is not
 * found anywhere, the previous page is restored and the test's own assertion
 * reports the failure. Tests stay about behaviour; where a panel lives is the
 * layout's business.
 */
export async function reveal(page: Page, target: Locator): Promise<void> {
  const shown = () => target.first().isVisible();
  // An open drawer covers the notebook: close it unless the target is on the device.
  const drawer = page.getByTestId('device-drawer');
  if (await drawer.isVisible() && !(await drawer.locator(target).first().isVisible().catch(() => false))) {
    await page.getByTestId('device-close').click();
    await expect(drawer).toHaveCount(0);
  }
  // The preset library is a modal dialog: close it unless the target is in it.
  const library = page.getByTestId('preset-library');
  if (await library.isVisible() && !(await library.locator(target).first().isVisible().catch(() => false))) {
    await page.getByTestId('preset-library-close').click();
    await expect(library).toBeHidden();
  }
  // The metronome panel floats over the console and the rack: close it unless the target is in it.
  const metronome = page.getByTestId('metronome-panel');
  if (await metronome.isVisible() && !(await metronome.locator(target).first().isVisible().catch(() => false))) {
    await page.getByTestId('metronome-toggle').click();
    await expect(metronome).toHaveCount(0);
  }
  // The settings panel has a scrim over everything else: close it unless the target is in it.
  const settings = page.getByTestId('studio-settings');
  if (await settings.isVisible() && !(await settings.locator(target).first().isVisible().catch(() => false))) {
    await page.keyboard.press('Escape');
    await expect(settings).toHaveCount(0);
  }
  // Something just clicked may still be rendering it.
  await target.first().waitFor({ state: 'visible', timeout: 600 }).catch(() => undefined);
  if (await shown()) return;
  const studio = await inStudio(page);
  const closeDrawer = async () => {
    if (!studio || !(await page.getByTestId('device-drawer').isVisible())) return;
    await page.getByTestId('device-close').click();
    await expect(page.getByTestId('device-drawer')).toHaveCount(0);
  };
  await closeDrawer();
  if (await shown()) return;
  if (studio) {
    // Meter, click subdivision and timbre are set in the metronome panel of the header. It is tried
    // before the notebook pages, so reaching it never changes the page or closes the accent grid.
    await page.getByTestId('metronome-toggle').click();
    if (await shown()) return;
    await page.getByTestId('metronome-toggle').click();
    await expect(metronome).toHaveCount(0);
  }
  const tabs = studio ? page.getByTestId('notebook').getByRole('tab') : page.locator('.cs-tabs').getByRole('tab');
  const selected = tabs.and(page.locator('[aria-selected="true"]'));
  const original = (await selected.count()) ? await selected.first().textContent() : null;
  const count = await tabs.count();
  for (let i = 0; i < count; i += 1) {
    await tabs.nth(i).click();
    if (await shown()) return;
  }
  // Not on a notebook page: back to the page that was open, then the places outside the notebook.
  if (original) await tabs.filter({ hasText: original }).first().click();
  if (studio) {
    // Input, amplifier, cabinet and pedals live in the rack on the right.
    const mode = await page.getByTestId('rack').getAttribute('data-mode', { timeout: 300 }).catch(() => null);
    if (mode !== 'expanded') {
      await openRack(page);
      if (await shown()) return;
    }
    for (const device of ['mixer', 'tuner'] as const) {
      await openDevice(page, device);
      if (await shown()) return;
    }
    await closeDrawer();
    // Look and licence live in the settings panel of the rail.
    await page.getByTestId('studio-settings-toggle').click();
    if (await shown()) return;
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('studio-settings')).toHaveCount(0);
    // Study presets live in the library of the header.
    await page.getByTestId('preset-library-open').click();
    if (await shown()) return;
    await page.getByTestId('preset-library-close').click();
  }
}

/**
 * Load a study preset by its id (starter presets) or by its name (the user's
 * own): from the library in Studio, from the presets select in Semplificata.
 */
export async function loadPreset(page: Page, preset: { readonly id: string } | { readonly name: string }): Promise<void> {
  if (await inStudio(page)) {
    const library = page.getByTestId('preset-library');
    if (!(await library.isVisible())) {
      await reveal(page, page.getByTestId('preset-library-open'));
      await page.getByTestId('preset-library-open').click();
    }
    const card = 'id' in preset ? library.locator(`[data-preset-id="${preset.id}"]`) : library.getByTestId('preset-card').filter({ hasText: preset.name });
    await card.getByRole('button', { name: /^Carica / }).click();
    await expect(library).toBeHidden();
    return;
  }
  const select = page.getByTestId('preset-load');
  await reveal(page, select);
  if ('id' in preset) await select.selectOption(preset.id);
  else await select.selectOption(await select.locator('option', { hasText: `Tuo: ${preset.name}` }).getAttribute('value') as string);
}

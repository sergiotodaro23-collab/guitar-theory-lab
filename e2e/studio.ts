/**
 * Helpers for the Studio V5.7 shell (D-41): the look switch lives in the
 * settings panel of the rail, panels live on notebook tabs, the mixer and the
 * other devices in the drawer. In Semplificata every helper is a no-op or uses
 * its own deck, so the same test runs in both looks.
 */
import { expect, type Locator, type Page } from '@playwright/test';

export type Look = 'Studio' | 'Semplificata';

const inStudio = (page: Page) => page.getByTestId('studio').isVisible();

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

/** Open a device drawer in Studio (mixer, amp, tuner, iface). */
export async function openDevice(page: Page, device: 'mixer' | 'amp' | 'tuner' | 'iface'): Promise<void> {
  if (!(await inStudio(page))) return;
  const key = page.getByTestId(`device-${device}`);
  if ((await key.getAttribute('aria-pressed')) !== 'true') await key.click();
  await expect(page.getByTestId('device-drawer')).toHaveAttribute('data-device', device);
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
  // Something just clicked may still be rendering it.
  await target.first().waitFor({ state: 'visible', timeout: 600 }).catch(() => undefined);
  if (await shown()) return;
  const settings = page.getByTestId('studio-settings');
  if (await settings.isVisible()) {
    await page.keyboard.press('Escape');
    await expect(settings).toHaveCount(0);
    if (await shown()) return;
  }
  const studio = await inStudio(page);
  const tabs = studio ? page.getByTestId('notebook').getByRole('tab') : page.locator('.cs-tabs').getByRole('tab');
  const selected = tabs.and(page.locator('[aria-selected="true"]'));
  const original = (await selected.count()) ? await selected.first().textContent() : null;
  const closeDrawer = async () => {
    if (!studio || !(await page.getByTestId('device-drawer').isVisible())) return;
    await page.getByTestId('device-close').click();
    await expect(page.getByTestId('device-drawer')).toHaveCount(0);
  };
  await closeDrawer();
  if (await shown()) return;
  const count = await tabs.count();
  for (let i = 0; i < count; i += 1) {
    await tabs.nth(i).click();
    if (await shown()) return;
  }
  if (studio) {
    for (const device of ['mixer', 'iface', 'tuner', 'amp'] as const) {
      await openDevice(page, device);
      if (await shown()) return;
    }
    await closeDrawer();
    // Presets, look and licence live in the settings panel of the rail.
    await page.getByTestId('studio-settings-toggle').click();
    if (await shown()) return;
    await page.keyboard.press('Escape');
  }
  if (original) await tabs.filter({ hasText: original }).first().click();
}

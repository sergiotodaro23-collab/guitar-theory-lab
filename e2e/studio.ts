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
 * Brings a control into view wherever the look keeps it: a notebook page or
 * a device drawer in Studio, a deck module in Semplificata. Tests stay about
 * behaviour; where a panel lives is the layout's business.
 */
export async function reveal(page: Page, target: Locator): Promise<void> {
  const shown = () => target.first().isVisible();
  if (await shown()) return;
  if (await inStudio(page)) {
    if (await page.getByTestId('device-drawer').isVisible()) {
      await page.getByTestId('device-close').click();
      await expect(page.getByTestId('device-drawer')).toHaveCount(0);
      if (await shown()) return;
    }
    const tabs = page.getByTestId('notebook').getByRole('tab');
    const count = await tabs.count();
    for (let i = 0; i < count; i += 1) {
      await tabs.nth(i).click();
      if (await shown()) return;
    }
    for (const device of ['mixer', 'iface', 'tuner', 'amp'] as const) {
      await openDevice(page, device);
      if (await shown()) return;
    }
  } else {
    const tabs = page.locator('.cs-tabs').getByRole('tab');
    const count = await tabs.count();
    for (let i = 0; i < count; i += 1) {
      await tabs.nth(i).click();
      if (await shown()) return;
    }
  }
  await expect(target.first()).toBeVisible();
}

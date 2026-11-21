import { expect, test, type Page } from '@playwright/test';

/** J1: the jam's acoustic kit, bass and piano play recorded samples, loaded on demand. */

const open = async (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1');
  await expect(page.getByTestId('play')).toBeVisible();
  await page.getByRole('button', { name: 'Jam Studio', exact: true }).click();
  return errors;
};

test('only the zones the jam uses are downloaded, then drums, bass and piano play from them', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/samples/')) requests.push(r.url());
  });
  const errors = await open(page);
  // Nothing is fetched before the audio starts.
  expect(requests).toEqual([]);

  const status = await page.evaluate(() => window.__gtl?.engine.prepareSamples());
  const byId = Object.fromEntries((status ?? []).map((s) => [s.id, s]));
  expect(await page.evaluate(() => window.__gtl?.engine.sampleSets())).toEqual({ drums: 'drums', bass: 'ebass', comp: 'piano' });
  for (const id of ['drums', 'ebass', 'piano']) {
    expect(byId[id]?.state, id).toBe('ready');
    expect(byId[id]?.decoded, id).toBeGreaterThan(0);
    // Lazy: a progression uses a fraction of the recorded zones.
    expect(byId[id]?.decoded ?? 0, id).toBeLessThan((byId[id]?.zones ?? 0) / 2);
  }
  // The double bass is not chosen: nothing of it is loaded.
  expect(byId.upright?.state).toBe('idle');
  expect(requests.some((u) => u.includes('/upright/'))).toBe(false);

  await page.getByTestId('play').click();
  await expect.poll(() => page.evaluate(() => window.__gtl?.engine.sampledCount()?.drums ?? 0), { timeout: 8000 }).toBeGreaterThan(8);
  await expect.poll(() => page.evaluate(() => window.__gtl?.engine.sampledCount()?.bass ?? 0), { timeout: 8000 }).toBeGreaterThan(2);
  await expect.poll(() => page.evaluate(() => window.__gtl?.engine.sampledCount()?.comp ?? 0), { timeout: 8000 }).toBeGreaterThan(2);
  // And they are heard: every channel meter moves.
  for (const channel of ['drums', 'bass', 'comp'] as const) {
    await expect.poll(() => page.evaluate((c) => window.__gtl?.engine.channelLevel(c) ?? 0, channel), { timeout: 6000 }).toBeGreaterThan(0.002);
  }
  await page.getByTestId('play').click();
  expect(errors).toEqual([]);
});

test('a missing sample set falls back to the synthesised sound, with no error', async ({ page }) => {
  await page.route('**/samples/**', (route) => route.fulfill({ status: 404, body: '' }));
  const errors = await open(page);
  const status = await page.evaluate(() => window.__gtl?.engine.prepareSamples());
  expect(status?.find((s) => s.id === 'drums')?.state).toBe('failed');
  await page.getByTestId('play').click();
  await expect.poll(() => page.evaluate(() => window.__gtl?.engine.channelLevel('drums') ?? 0), { timeout: 6000 }).toBeGreaterThan(0.002);
  expect(await page.evaluate(() => window.__gtl?.engine.sampledCount()?.drums)).toBe(0);
  await page.getByTestId('play').click();
  expect(errors).toEqual([]);
});

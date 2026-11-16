import { createHash } from 'node:crypto';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { openRack } from './studio';
import { slimmableA2Nam } from '../src/app/namFixtures';

/**
 * TONE3000 Select flow (D-52) against a **simulated** TONE3000: every request
 * to www.tone3000.com is answered here, following the documented API. This
 * proves the app's side of the flow (PKCE, state, popup relay, token use,
 * attribution, nothing sensitive stored). It does not prove anything about
 * the real service: that needs a real publishable key and an account.
 */

const KEY = 't3k_pub_e2e_simulated';
const TOKEN = 'access-token-simulated';
const REFRESH = 'refresh-token-simulated';
const MODEL = slimmableA2Nam({ name: 'Plexi simulato' });

interface Seen {
  authorize: URLSearchParams[];
  tokenBodies: URLSearchParams[];
  bearer: string[];
  modelDownloads: number;
}

type Outcome = 'tone' | 'wrong-state' | 'canceled' | 'denied';

async function simulateTone3000(context: BrowserContext, outcome: Outcome): Promise<Seen> {
  const seen: Seen = { authorize: [], tokenBodies: [], bearer: [], modelDownloads: 0 };
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type' };
  const json = (body: unknown) => ({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  await context.route('https://www.tone3000.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: cors }); return; }
    if (url.pathname === '/api/v1/oauth/authorize') {
      seen.authorize.push(url.searchParams);
      const back = new URL(url.searchParams.get('redirect_uri') ?? 'http://localhost:4173/');
      const state = url.searchParams.get('state') ?? '';
      if (outcome === 'tone') { back.searchParams.set('code', 'auth-code-simulated'); back.searchParams.set('state', state); back.searchParams.set('tone_id', '42'); }
      if (outcome === 'wrong-state') { back.searchParams.set('code', 'auth-code-simulated'); back.searchParams.set('state', 'someone-elses-state'); back.searchParams.set('tone_id', '42'); }
      if (outcome === 'canceled') { back.searchParams.set('canceled', 'true'); back.searchParams.set('state', state); }
      if (outcome === 'denied') { back.searchParams.set('error', 'access_denied'); back.searchParams.set('state', state); }
      await route.fulfill({ status: 302, headers: { location: back.toString() } });
      return;
    }
    if (url.pathname === '/api/v1/oauth/token') {
      seen.tokenBodies.push(new URLSearchParams(request.postData() ?? ''));
      await route.fulfill(json({ access_token: TOKEN, refresh_token: REFRESH, token_type: 'bearer', expires_in: 3600 }));
      return;
    }
    seen.bearer.push(request.headers().authorization ?? '');
    if (url.pathname === '/api/v1/tones/42') {
      await route.fulfill(json({
        id: 42, title: 'Plexi 68 simulato', description: 'Canale brillante, cassa 4x12.', gear: 'amp-cab', format: 'nam', license: 'cc-by', images: [],
        url: 'https://www.tone3000.com/tones/plexi-68-42', user: { id: 7, username: 'ada', is_verified: true, avatar_url: null },
      }));
      return;
    }
    if (url.pathname === '/api/v1/models') {
      await route.fulfill(json({ data: [
        { id: 501, name: 'Plexi crunch', size: 'standard', tone_id: 42, architecture_version: '2', model_url: 'https://www.tone3000.com/api/v1/models/501/download?sig=temporary' },
        { id: 502, name: 'Plexi lead', size: 'standard', tone_id: 42, architecture_version: '2', model_url: 'https://www.tone3000.com/api/v1/models/502/download?sig=temporary' },
      ] }));
      return;
    }
    if (/^\/api\/v1\/models\/\d+\/download$/.test(url.pathname)) {
      seen.modelDownloads += 1;
      await route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: MODEL });
      return;
    }
    await route.fulfill({ status: 404, headers: cors, body: '{}' });
  });
  return seen;
}

const open = async (page: Page, withKey: boolean) => {
  if (withKey) await page.addInitScript((key) => { try { localStorage.setItem('gtl.tone3000.publishableKey', key); } catch { /* callback window before navigation */ } }, KEY);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?debug=1');
  await openRack(page);
  await page.getByTestId('nam-browse-t3k').click();
  await expect(page.getByTestId('t3k-dialog')).toBeVisible();
};
const stored = (page: Page) => page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
const challengeOf = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

test('without a key the catalogue is offered as optional: a secret key is refused, a publishable key is kept apart from the settings', async ({ page, context }) => {
  const seen = await simulateTone3000(context, 'tone');
  await open(page, false);
  await expect(page.getByTestId('t3k-key-setup')).toBeVisible();
  await expect(page.getByTestId('t3k-redirect')).toHaveText('http://localhost:4173/');
  await page.getByTestId('t3k-key-input').fill('t3k_cs_this_is_a_secret_key');
  await page.getByTestId('t3k-key-save').click();
  await expect(page.getByTestId('t3k-key-error')).toContainText('chiave segreta');
  expect(await stored(page)).not.toContain('t3k_cs_');
  await page.getByTestId('t3k-key-input').fill(KEY);
  await page.getByTestId('t3k-key-save').click();
  await expect(page.getByTestId('t3k-splash')).toBeVisible();
  // The key is on this device under its own name: not in the session, not in a preset.
  const keys = await page.evaluate((key) => Object.entries(localStorage).filter(([, v]) => v.includes(key)).map(([k]) => k), KEY);
  expect(keys).toEqual(['gtl.tone3000.publishableKey']);
  expect(seen.authorize).toHaveLength(0);
});

test('select a tone: PKCE and state hold, the tone is shown with its creator, the model loads in the amp, nothing sensitive is stored', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const seen = await simulateTone3000(context, 'tone');
  await open(page, true);
  await expect(page.getByTestId('t3k-splash')).toContainText('TONE3000');
  await expect(page.getByTestId('t3k-arch-2')).toHaveAttribute('aria-checked', 'true');
  const popupPromise = context.waitForEvent('page');
  await page.getByTestId('t3k-continue').click();
  const popup = await popupPromise;
  await expect(page.getByTestId('t3k-tone')).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => popup.isClosed()).toBe(true);

  // The request the app sent to TONE3000.
  const sent = seen.authorize[0];
  expect(sent?.get('client_id')).toBe(KEY);
  expect(sent?.get('response_type')).toBe('code');
  expect(sent?.get('code_challenge_method')).toBe('S256');
  expect(sent?.get('prompt')).toBe('select_tone');
  expect(sent?.get('architecture')).toBe('2');
  expect(sent?.get('format')).toBe('nam');
  expect(sent?.get('redirect_uri')).toBe('http://localhost:4173/');
  expect(sent?.get('state') ?? '').toMatch(/^[A-Za-z0-9_-]{22}$/);
  // The token request: the verifier is the one behind the challenge, and no secret is sent.
  expect(seen.tokenBodies).toHaveLength(1);
  const body = seen.tokenBodies[0];
  expect(body?.get('grant_type')).toBe('authorization_code');
  expect(body?.get('code')).toBe('auth-code-simulated');
  expect(body?.get('client_id')).toBe(KEY);
  expect(challengeOf(body?.get('code_verifier') ?? '')).toBe(sent?.get('code_challenge'));
  expect(body?.has('client_secret')).toBe(false);
  expect(seen.bearer.every((h) => h === `Bearer ${TOKEN}`)).toBe(true);

  // Tone details, with attribution.
  await expect(page.getByTestId('t3k-tone-title')).toHaveText('Plexi 68 simulato');
  await expect(page.getByTestId('t3k-tone-author')).toHaveText('@ada');
  await expect(page.getByTestId('t3k-tone')).toContainText('Amp + Cab');
  await expect(page.getByTestId('t3k-tone-link')).toHaveAttribute('href', 'https://www.tone3000.com/tones/plexi-68-42');
  await expect(page.getByTestId('t3k-model').locator('option')).toHaveCount(2);
  // Nothing is downloaded until the user asks.
  expect(seen.modelDownloads).toBe(0);
  await page.getByTestId('t3k-model').selectOption('502');
  await page.getByTestId('t3k-load').click();
  await expect(page.getByTestId('t3k-load-status')).toContainText('Modello caricato nel motore', { timeout: 20_000 });
  expect(seen.modelDownloads).toBe(1);
  await page.getByTestId('t3k-close').click();

  // In the amp head: the model the engine confirmed, marked as coming from TONE3000, cabinet skipped (amp + cab capture).
  await expect(page.getByTestId('nam-status')).toHaveAttribute('data-phase', 'ready');
  await expect(page.getByTestId('amp-tape')).toHaveText('NAM · T3K · Plexi 68 simulato');
  await expect(page.getByTestId('nam-origin')).toContainText('Plexi 68 simulato · Amp + Cab · NAM · @ada');
  await expect(page.getByTestId('amp-engine-nam')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('nam-cab')).toHaveAttribute('aria-pressed', 'true');
  const status = await page.evaluate(() => window.__gtl?.nam?.() ?? null);
  expect(status?.summary?.generation).toBe('A2');
  expect(status?.origin).toMatchObject({ kind: 'tone3000', toneId: 42, modelId: 502 });

  // Nothing sensitive or temporary is left in storage: no token, no code, no verifier, no download address, no model.
  await page.waitForTimeout(500);
  const kept = await stored(page);
  for (const secret of [TOKEN, REFRESH, 'auth-code-simulated', body?.get('code_verifier') ?? 'x', 'sig=temporary', '/download', 'SlimmableContainer']) expect(kept).not.toContain(secret);
  expect(page.url()).not.toContain('code=');
  expect(errors).toEqual([]);
});

test('an answer with another state is ignored: no token is asked for, no tone appears', async ({ page, context }) => {
  const seen = await simulateTone3000(context, 'wrong-state');
  await open(page, true);
  const popupPromise = context.waitForEvent('page');
  await page.getByTestId('t3k-continue').click();
  await popupPromise;
  await expect(page.getByTestId('t3k-error')).toContainText('state diverso', { timeout: 15_000 });
  await page.waitForTimeout(500);
  expect(seen.tokenBodies).toHaveLength(0);
  expect(seen.bearer).toHaveLength(0);
  await expect(page.getByTestId('t3k-tone')).toHaveCount(0);
  await expect(page.getByTestId('amp-tape')).toHaveText('DSP interno');
});

test('closing the catalogue and a refusal end the flow cleanly; the rig is untouched', async ({ page, context }) => {
  const seen = await simulateTone3000(context, 'canceled');
  await open(page, true);
  let popupPromise = context.waitForEvent('page');
  await page.getByTestId('t3k-continue').click();
  await popupPromise;
  await expect(page.getByTestId('t3k-status')).toContainText('Catalogo chiuso senza accedere', { timeout: 15_000 });
  expect(seen.tokenBodies).toHaveLength(0);

  await context.unroute('https://www.tone3000.com/**');
  const denied = await simulateTone3000(context, 'denied');
  popupPromise = context.waitForEvent('page');
  await page.getByTestId('t3k-continue').click();
  await popupPromise;
  await expect(page.getByTestId('t3k-error')).toContainText('access_denied', { timeout: 15_000 });
  expect(denied.tokenBodies).toHaveLength(0);
  await page.getByTestId('t3k-close').click();
  await expect(page.getByTestId('amp-tape')).toHaveText('DSP interno');
  await expect(page.getByTestId('amp-engine-internal')).toHaveAttribute('aria-checked', 'true');
});

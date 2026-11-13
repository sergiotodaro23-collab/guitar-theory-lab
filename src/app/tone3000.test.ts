import { describe, expect, it } from 'vitest';
import {
  T3K_MESSAGE, architectureLabel, checkPublishableKey, codeChallenge, gearIncludesCab, gearLabel, isCallbackMessage, isTone3000Url, judgeCallback, modelRequestUrl, newPkce, readCallback,
  readModels, readTokens, readTone, redirectUriOf, selectToneUrl, tokenRequestBody,
} from './tone3000';

describe('publishable key', () => {
  it('accepts a publishable key and trims it', () => {
    expect(checkPublishableKey('  t3k_pub_abc123XYZ  ')).toEqual({ ok: true, key: 't3k_pub_abc123XYZ' });
  });
  it('refuses a secret key with a clear reason, and anything else', () => {
    const secret = checkPublishableKey('t3k_cs_supersecret');
    expect(secret.ok).toBe(false);
    if (!secret.ok) expect(secret.message).toContain('chiave segreta');
    expect(checkPublishableKey('').ok).toBe(false);
    expect(checkPublishableKey('pk_live_123').ok).toBe(false);
    expect(checkPublishableKey('t3k_pub_ab c').ok).toBe(false);
  });
});

describe('PKCE (RFC 7636)', () => {
  it('S256 challenge of the verifier in the RFC, appendix B', async () => {
    expect(await codeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
  it('a new flow has a 43-character verifier, its challenge and a state, all URL-safe and different each time', async () => {
    const a = await newPkce();
    const b = await newPkce();
    expect(a.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.state).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(a.challenge).toBe(await codeChallenge(a.verifier));
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.state).not.toBe(b.state);
  });
});

describe('authorize address of the Select flow', () => {
  const url = new URL(selectToneUrl({ clientId: 't3k_pub_test', redirectUri: 'http://localhost:4173/', challenge: 'CH', state: 'ST', architecture: '2' }));
  it('goes to TONE3000 with the code flow, PKCE S256 and the state', () => {
    expect(url.origin + url.pathname).toBe('https://www.tone3000.com/api/v1/oauth/authorize');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: 't3k_pub_test', redirect_uri: 'http://localhost:4173/', response_type: 'code', code_challenge: 'CH', code_challenge_method: 'S256', state: 'ST',
    });
  });
  it('asks for the Select flow on NAM captures an amp stage can load, with the architecture stated', () => {
    expect(url.searchParams.get('prompt')).toBe('select_tone');
    expect(url.searchParams.get('format')).toBe('nam');
    expect(url.searchParams.get('gears')).toBe('amp_amp-cab_pedal');
    expect(url.searchParams.get('architecture')).toBe('2');
  });
  it('never carries a secret or the verifier', () => {
    expect(url.search).not.toContain('secret');
    expect(url.search).not.toContain('code_verifier');
  });
  it('the redirect address is the app itself, without query or fragment', () => {
    expect(redirectUriOf({ origin: 'https://example.org', pathname: '/gtl/' })).toBe('https://example.org/gtl/');
  });
});

describe('callback', () => {
  it('an ordinary address of the app is not a callback', () => {
    expect(readCallback('')).toBeNull();
    expect(readCallback('?debug=1')).toBeNull();
    expect(readCallback('?code=abc')).toBeNull();
    expect(readCallback('?state=abc')).toBeNull();
  });
  it('reads code, state and tone', () => {
    expect(readCallback('?code=C&state=S&tone_id=42')).toEqual({ code: 'C', state: 'S', error: null, toneId: '42', canceled: false });
    expect(readCallback('?state=S&canceled=true')?.canceled).toBe(true);
    expect(readCallback('?state=S&error=access_denied')?.error).toBe('access_denied');
  });
  it('a state that is not ours is refused before anything else, even with a valid-looking code', () => {
    const params = { code: 'C', state: 'EVIL', error: null, toneId: '42', canceled: false };
    expect(judgeCallback(params, 'MINE')).toMatchObject({ kind: 'refused', reason: 'state-mismatch' });
    expect(judgeCallback(params, null)).toMatchObject({ kind: 'refused', reason: 'state-mismatch' });
    expect(judgeCallback({ ...params, state: null }, 'MINE')).toMatchObject({ kind: 'refused', reason: 'state-mismatch' });
    expect(judgeCallback({ ...params, state: '' }, '')).toMatchObject({ kind: 'refused', reason: 'state-mismatch' });
  });
  it('the right state gives the code and the tone', () => {
    expect(judgeCallback({ code: 'C', state: 'S', error: null, toneId: '42', canceled: false }, 'S')).toEqual({ kind: 'code', code: 'C', toneId: 42, canceled: false });
  });
  it('closed before signing in is a cancellation; closed after signing in still gives a code, without a tone', () => {
    expect(judgeCallback({ code: null, state: 'S', error: null, toneId: null, canceled: true }, 'S')).toMatchObject({ kind: 'refused', reason: 'canceled' });
    expect(judgeCallback({ code: 'C', state: 'S', error: null, toneId: null, canceled: true }, 'S')).toEqual({ kind: 'code', code: 'C', toneId: null, canceled: true });
  });
  it('an error from TONE3000 and a missing code are refused; a tone id that is not a number is dropped', () => {
    expect(judgeCallback({ code: null, state: 'S', error: 'access_denied', toneId: null, canceled: false }, 'S')).toMatchObject({ kind: 'refused', reason: 'denied' });
    expect(judgeCallback({ code: null, state: 'S', error: null, toneId: '1', canceled: false }, 'S')).toMatchObject({ kind: 'refused', reason: 'missing-code' });
    expect(judgeCallback({ code: 'C', state: 'S', error: null, toneId: '4;drop', canceled: false }, 'S')).toMatchObject({ kind: 'code', toneId: null });
  });
  it('only a well-formed relay message is taken', () => {
    expect(isCallbackMessage({ type: T3K_MESSAGE, code: 'C', state: 'S', error: null, toneId: null, canceled: false })).toBe(true);
    expect(isCallbackMessage({ type: 'other', code: 'C', state: 'S', error: null, toneId: null, canceled: false })).toBe(false);
    expect(isCallbackMessage({ type: T3K_MESSAGE, code: 5, state: 'S', error: null, toneId: null, canceled: false })).toBe(false);
    expect(isCallbackMessage(null)).toBe(false);
  });
  it('the token request sends the verifier and no secret', () => {
    const body = tokenRequestBody('t3k_pub_test', 'http://localhost:4173/', 'C', 'V');
    expect(Object.fromEntries(body)).toEqual({ grant_type: 'authorization_code', code: 'C', code_verifier: 'V', redirect_uri: 'http://localhost:4173/', client_id: 't3k_pub_test' });
  });
  it('a token response gives the access token and its expiry; the refresh token is not kept', () => {
    const t = readTokens({ access_token: 'A', refresh_token: 'R', expires_in: 3600, token_type: 'bearer' }, 1000);
    expect(t).toEqual({ accessToken: 'A', expiresAt: 3_601_000 });
    expect(JSON.stringify(t)).not.toContain('R');
    expect(readTokens({ refresh_token: 'R' }, 0)).toBeNull();
    expect(readTokens('nope', 0)).toBeNull();
  });
});

describe('tones and models from the API', () => {
  const rawTone = {
    id: 42, title: 'Plexi 68', description: 'Bright channel', gear: 'amp-cab', format: 'nam', license: 't3k', url: 'https://www.tone3000.com/tones/plexi-68-42',
    images: ['https://cdn.example.net/tones/42.jpg'], user: { username: 'ada', is_verified: true, avatar_url: 'https://cdn.example.net/a.png' },
  };
  it('reads what attribution needs: title, creator, gear, format, page', () => {
    expect(readTone(rawTone)).toMatchObject({ id: 42, title: 'Plexi 68', author: 'ada', authorVerified: true, gear: 'amp-cab', format: 'nam', url: 'https://www.tone3000.com/tones/plexi-68-42', imageUrl: 'https://cdn.example.net/tones/42.jpg' });
    expect(gearLabel('amp-cab')).toBe('Amp + Cab');
    expect(gearIncludesCab('amp-cab')).toBe(true);
    expect(gearIncludesCab('amp')).toBe(false);
    expect(architectureLabel('2')).toBe('A2');
  });
  it('a page address that is not on TONE3000 is replaced, a non-https image is dropped, a tone without id is refused', () => {
    const t = readTone({ ...rawTone, url: 'https://evil.example/tone', images: ['javascript:alert(1)'] });
    expect(t?.url).toBe('https://www.tone3000.com/tones/42');
    expect(t?.imageUrl).toBe('');
    expect(readTone({ title: 'x' })).toBeNull();
  });
  it('keeps only models whose file is on TONE3000', () => {
    const models = readModels({ data: [
      { id: 1, name: 'Standard', size: 'standard', architecture_version: '2', model_url: 'https://www.tone3000.com/api/v1/models/1/download' },
      { id: 2, name: 'Elsewhere', model_url: 'https://evil.example/x.nam' },
      { id: 3, name: 'Plain http', model_url: 'http://www.tone3000.com/x.nam' },
      { name: 'No id', model_url: 'https://www.tone3000.com/x.nam' },
    ] });
    expect(models.map((m) => m.id)).toEqual([1]);
    expect(readModels(null)).toEqual([]);
  });
  it('the token only ever travels to TONE3000: look-alike hosts are not TONE3000', () => {
    expect(isTone3000Url('https://www.tone3000.com/a')).toBe(true);
    expect(isTone3000Url('https://files.tone3000.com/a')).toBe(true);
    expect(isTone3000Url('https://tone3000.com.evil.example/a')).toBe(false);
    expect(isTone3000Url('https://eviltone3000.com/a')).toBe(false);
    expect(isTone3000Url('https://www.tone3000.com@evil.example/a')).toBe(false);
    expect(modelRequestUrl('https://files.tone3000.com/api/v1/models/1/download?x=1')).toBe('https://www.tone3000.com/api/v1/models/1/download?x=1');
    expect(modelRequestUrl('https://evil.example/api/v1/models/1/download')).toBeNull();
  });
});

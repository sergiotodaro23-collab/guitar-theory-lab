/**
 * TONE3000 (D-52, docs/TONE3000_INTEGRATION.md): the pure part of the
 * optional link to the TONE3000 tone library. OAuth 2.0 authorization code
 * with PKCE (S256) and a checked `state`, through the official Select flow
 * (`prompt=select_tone`): TONE3000 shows its own sign-in and catalogue, the
 * user picks a tone there, and the app receives a code and a tone id.
 *
 * Nothing here touches the DOM, storage or the network. Only the publishable
 * key (`t3k_pub_…`, made to be shipped in client apps) is ever used: the app
 * has no backend, so a secret key (`t3k_cs_…`) must never reach it and is
 * refused if someone pastes one.
 *
 * Follows the official example client (github.com/tone-3000/api, web/src/
 * tone3000-client.ts) for parameter names and callback outcomes.
 */

export const T3K_ORIGIN = 'https://www.tone3000.com';
export const T3K_AUTHORIZE = `${T3K_ORIGIN}/api/v1/oauth/authorize`;
export const T3K_TOKEN = `${T3K_ORIGIN}/api/v1/oauth/token`;

/** NAM architectures the catalogue can be narrowed to. The engine in this app loads both (docs/NAM_INTEGRATION.md). */
export type T3kArchitecture = '1' | '2';
/** Gear an amplifier stage can load: amp heads, amp with cabinet, pedals. */
export const T3K_GEARS = 'amp_amp-cab_pedal';

/* ---------------- publishable key ---------------- */

export type KeyCheck = { readonly ok: true; readonly key: string } | { readonly ok: false; readonly message: string };

/** A publishable key is the OAuth client id. A secret key is refused: it must never be in a browser. */
export function checkPublishableKey(raw: string): KeyCheck {
  const key = raw.trim();
  if (key === '') return { ok: false, message: 'Chiave mancante.' };
  if (/^t3k_cs_/i.test(key)) return { ok: false, message: 'Questa è una chiave segreta (t3k_cs_…): non va mai inserita in un’app che gira nel browser. Serve la chiave pubblicabile (t3k_pub_…).' };
  if (!/^t3k_pub_[A-Za-z0-9_-]{6,200}$/.test(key)) return { ok: false, message: 'Non sembra una chiave pubblicabile TONE3000 (t3k_pub_…).' };
  return { ok: true, key };
}

/* ---------------- PKCE and state ---------------- */

export function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The S256 code challenge of a verifier (RFC 7636): base64url of its SHA-256. */
export async function codeChallenge(verifier: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(hash));
}

export interface PkceSecrets {
  /** 43 characters from 32 random bytes; stays in the page that started the flow. */
  readonly verifier: string;
  readonly challenge: string;
  /** Random; must come back unchanged in the callback. */
  readonly state: string;
}

/** Fresh secrets for one flow. Never reuse them: one authorization, one verifier, one state. */
export async function newPkce(random: (bytes: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b)): Promise<PkceSecrets> {
  const verifier = base64url(random(new Uint8Array(32)));
  const state = base64url(random(new Uint8Array(16)));
  return { verifier, state, challenge: await codeChallenge(verifier) };
}

/* ---------------- authorize URL ---------------- */

export interface SelectRequest {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly challenge: string;
  readonly state: string;
  /** Always sent: without it the catalogue falls back to the legacy set, which leaves A2 out. */
  readonly architecture: T3kArchitecture;
}

/** The address of the Select flow: sign-in and catalogue on TONE3000, narrowed to NAM captures an amp stage can load. */
export function selectToneUrl(r: SelectRequest): string {
  const url = new URL(T3K_AUTHORIZE);
  url.searchParams.set('client_id', r.clientId);
  url.searchParams.set('redirect_uri', r.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('code_challenge', r.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', r.state);
  url.searchParams.set('prompt', 'select_tone');
  url.searchParams.set('format', 'nam');
  url.searchParams.set('gears', T3K_GEARS);
  url.searchParams.set('architecture', r.architecture);
  // Audition players inside the flow, and a bar with a close key: recommended for popups.
  url.searchParams.set('preview', 'true');
  url.searchParams.set('menubar', 'true');
  return url.toString();
}

/** Where TONE3000 sends the user back: this app's own address, without query or fragment. */
export function redirectUriOf(location: { readonly origin: string; readonly pathname: string }): string {
  return `${location.origin}${location.pathname}`;
}

/* ---------------- callback ---------------- */

export interface CallbackParams {
  readonly code: string | null;
  readonly state: string | null;
  readonly error: string | null;
  readonly toneId: string | null;
  readonly canceled: boolean;
}

/** The OAuth parameters of a callback address, or null when the address is not a callback at all. */
export function readCallback(search: string): CallbackParams | null {
  const p = new URLSearchParams(search);
  const params: CallbackParams = { code: p.get('code'), state: p.get('state'), error: p.get('error'), toneId: p.get('tone_id'), canceled: p.get('canceled') === 'true' };
  // A callback always carries the state we sent, plus a code, an error or a cancellation.
  if (params.state === null || (params.code === null && params.error === null && !params.canceled)) return null;
  return params;
}

/** The message a callback page relays to the page that opened it. */
export const T3K_MESSAGE = 't3k_oauth_callback';
export const T3K_CHANNEL = 't3k_oauth';
export interface CallbackMessage extends CallbackParams { readonly type: typeof T3K_MESSAGE }

export function isCallbackMessage(data: unknown): data is CallbackMessage {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  const text = (v: unknown) => v === null || typeof v === 'string';
  return d.type === T3K_MESSAGE && text(d.code) && text(d.state) && text(d.error) && text(d.toneId) && typeof d.canceled === 'boolean';
}

export type CallbackVerdict =
  | { readonly kind: 'code'; readonly code: string; readonly toneId: number | null; readonly canceled: boolean }
  | { readonly kind: 'refused'; readonly reason: 'state-mismatch' | 'canceled' | 'denied' | 'missing-code'; readonly detail: string };

/**
 * Decides what a callback means. The state is checked first and always: a
 * callback whose state is not the one this page stored is not ours (or is an
 * attack) and nothing in it is used. A cancellation can still carry a code
 * (the user signed in, then closed the catalogue).
 */
export function judgeCallback(params: CallbackParams, storedState: string | null): CallbackVerdict {
  if (storedState === null || storedState === '' || params.state !== storedState) {
    return { kind: 'refused', reason: 'state-mismatch', detail: 'La risposta non corrisponde alla richiesta partita da questa pagina (state diverso): ignorata.' };
  }
  if (params.canceled && !params.code) return { kind: 'refused', reason: 'canceled', detail: 'Catalogo chiuso senza accedere.' };
  if (params.error) return { kind: 'refused', reason: 'denied', detail: `TONE3000 ha risposto: ${params.error.slice(0, 80)}.` };
  if (!params.code) return { kind: 'refused', reason: 'missing-code', detail: 'La risposta non contiene il codice di autorizzazione.' };
  const id = params.toneId !== null && /^\d{1,15}$/.test(params.toneId) ? Number(params.toneId) : null;
  return { kind: 'code', code: params.code, toneId: id, canceled: params.canceled };
}

/** The body of the token request (authorization code grant with the PKCE verifier; no client secret). */
export function tokenRequestBody(clientId: string, redirectUri: string, code: string, verifier: string): URLSearchParams {
  return new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: redirectUri, client_id: clientId });
}

export interface T3kTokens {
  readonly accessToken: string;
  /** Epoch milliseconds. */
  readonly expiresAt: number;
}

/** Reads a token response. The refresh token is deliberately not kept: tokens live in memory for the visit only. */
export function readTokens(raw: unknown, now: number): T3kTokens | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.access_token !== 'string' || r.access_token === '') return null;
  const seconds = typeof r.expires_in === 'number' && Number.isFinite(r.expires_in) && r.expires_in > 0 ? r.expires_in : 300;
  return { accessToken: r.access_token, expiresAt: now + seconds * 1000 };
}

/* ---------------- tones and models ---------------- */

export interface T3kTone {
  readonly id: number;
  readonly title: string;
  /** The creator's username, shown as @username. */
  readonly author: string;
  readonly authorVerified: boolean;
  readonly avatarUrl: string;
  readonly description: string;
  readonly gear: string;
  readonly format: string;
  readonly license: string;
  readonly imageUrl: string;
  /** The tone's page on TONE3000: a permanent address, safe to show and keep. */
  readonly url: string;
}

export interface T3kModel {
  readonly id: number;
  readonly name: string;
  readonly size: string;
  readonly architecture: string;
  /** Download address: needs the Bearer token, used once and never stored. */
  readonly modelUrl: string;
}

const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.slice(0, max) : '');
const obj = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {});

/** An https address on TONE3000's own site or one of its subdomains; anything else is dropped. */
export function isTone3000Url(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'tone3000.com' || url.hostname.endsWith('.tone3000.com'));
  } catch { return false; }
}
/** Images come from TONE3000's storage, which may be another host: https only. */
const httpsUrl = (value: unknown): string => {
  const s = str(value, 600);
  try { return new URL(s).protocol === 'https:' ? s : ''; } catch { return ''; }
};

export function readTone(raw: unknown): T3kTone | null {
  const r = obj(raw);
  if (typeof r.id !== 'number' || !Number.isInteger(r.id) || r.id <= 0) return null;
  const user = obj(r.user);
  const images = Array.isArray(r.images) ? r.images : [];
  const page = str(r.url, 600);
  return {
    id: r.id,
    title: str(r.title) || `Tone ${r.id}`,
    author: str(user.username, 80),
    authorVerified: user.is_verified === true,
    avatarUrl: httpsUrl(user.avatar_url),
    description: str(r.description, 1200),
    gear: str(r.gear, 40),
    format: str(r.format, 20),
    license: str(r.license, 40),
    imageUrl: httpsUrl(images[0]),
    url: isTone3000Url(page) ? page : `${T3K_ORIGIN}/tones/${r.id}`,
  };
}

/** The models of a tone this app can load: NAM files with a download address on TONE3000. */
export function readModels(raw: unknown): readonly T3kModel[] {
  const list = Array.isArray(obj(raw).data) ? (obj(raw).data as unknown[]) : [];
  const out: T3kModel[] = [];
  for (const item of list) {
    const m = obj(item);
    const modelUrl = str(m.model_url, 1000);
    if (typeof m.id !== 'number' || !isTone3000Url(modelUrl)) continue;
    out.push({ id: m.id, name: str(m.name) || `Modello ${m.id}`, size: str(m.size, 20), architecture: str(m.architecture_version, 10), modelUrl });
  }
  return out;
}

/**
 * The request for a model file: the path of `model_url` on TONE3000's API
 * origin, as the official client does. The token is only ever sent there.
 */
export function modelRequestUrl(modelUrl: string): string | null {
  if (!isTone3000Url(modelUrl)) return null;
  const url = new URL(modelUrl);
  return `${T3K_ORIGIN}${url.pathname}${url.search}`;
}

const GEAR_LABEL: Readonly<Record<string, string>> = { amp: 'Amp', 'amp-cab': 'Amp + Cab', pedal: 'Pedal', outboard: 'Outboard', cab: 'Cab', space: 'Space', experimental: 'Experimental', 'full-rig': 'Amp + Cab' };
export const gearLabel = (gear: string): string => GEAR_LABEL[gear] ?? gear;
export const formatLabel = (format: string): string => (format === 'nam' ? 'NAM' : format === 'ir' ? 'IR' : format.toUpperCase());
/** A capture of an amp with its cabinet: the rig's own cabinet should be skipped. */
export const gearIncludesCab = (gear: string): boolean => gear === 'amp-cab' || gear === 'full-rig';
export const architectureLabel = (a: string): string => (a === '1' ? 'A1' : a === '2' ? 'A2' : a === 'custom' ? 'Custom' : '');

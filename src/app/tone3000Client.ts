/**
 * TONE3000 in the browser (D-52): the popup, the callback, the token and the
 * requests. The rules are in app/tone3000.ts; this file only does the I/O.
 *
 * - The flow runs in a popup, so the app keeps running (audio, loaded
 *   model, unsaved work). The popup comes back to this app's own address;
 *   the page that loads there only relays the callback and closes.
 * - The PKCE verifier and the state live in this page's memory for one
 *   flow. The access token lives in memory for the visit. Neither is
 *   written to storage, to settings or to presets; the refresh token is
 *   not kept at all.
 * - A model's download address is used once and forgotten. What stays with
 *   a loaded model is its attribution: tone, creator, the tone's page.
 * - Only what the free, non-commercial tier allows is called: the Select
 *   flow, the selected tone and its models. No search, no custom catalogue.
 */
import { create } from 'zustand';
import { NAM_MAX_BYTES } from './namModel';
import {
  T3K_CHANNEL, T3K_MESSAGE, T3K_ORIGIN, T3K_TOKEN, checkPublishableKey, isCallbackMessage, judgeCallback, modelRequestUrl, newPkce, readCallback, readModels, readTokens,
  readTone, redirectUriOf, selectToneUrl, tokenRequestBody, type CallbackMessage, type CallbackParams, type KeyCheck, type T3kArchitecture, type T3kModel, type T3kTokens, type T3kTone,
} from './tone3000';

export type T3kPhase = 'idle' | 'waiting' | 'exchanging' | 'fetching' | 'tone' | 'error';

export interface T3kState {
  readonly phase: T3kPhase;
  readonly error: string | null;
  /** The flow ended without a tone (closed, or signed in and closed). */
  readonly note: string | null;
  readonly tone: T3kTone | null;
  readonly models: readonly T3kModel[];
  readonly architecture: T3kArchitecture;
  /** A token is in memory: the next flow usually skips the sign-in. */
  readonly signedIn: boolean;
  /** A model file is being downloaded. */
  readonly downloading: boolean;
}

export const useTone3000 = create<T3kState>(() => ({ phase: 'idle', error: null, note: null, tone: null, models: [], architecture: '2', signedIn: false, downloading: false }));

/* ---------------- publishable key ---------------- */

const KEY_STORAGE = 'gtl.tone3000.publishableKey';

/** The key built into this copy of the app, if its builder set one (VITE_TONE3000_PUBLISHABLE_KEY). */
function builtInKey(): string {
  const raw = (import.meta.env.VITE_TONE3000_PUBLISHABLE_KEY as string | undefined) ?? '';
  const check = checkPublishableKey(raw);
  return check.ok ? check.key : '';
}

/** The publishable key in use: the built-in one, or one the user entered on this device. Never part of settings or presets. */
export function publishableKey(): string {
  const built = builtInKey();
  if (built) return built;
  try {
    const check = checkPublishableKey(localStorage.getItem(KEY_STORAGE) ?? '');
    return check.ok ? check.key : '';
  } catch { return ''; }
}
export const hasBuiltInKey = (): boolean => builtInKey() !== '';

export function savePublishableKey(raw: string): KeyCheck {
  const check = checkPublishableKey(raw);
  if (check.ok) { try { localStorage.setItem(KEY_STORAGE, check.key); } catch { /* private mode: the key lasts for this visit only */ } }
  return check;
}
export function forgetPublishableKey(): void {
  try { localStorage.removeItem(KEY_STORAGE); } catch { /* nothing to forget */ }
}

export const redirectUri = (): string => redirectUriOf(window.location);

/* ---------------- one flow ---------------- */

interface Flow {
  readonly state: string;
  readonly verifier: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly architecture: T3kArchitecture;
  readonly popup: Window | null;
  readonly watch: ReturnType<typeof setInterval>;
}

let flow: Flow | null = null;
let tokens: T3kTokens | null = null;
let listening = false;
let channel: BroadcastChannel | null = null;

const set = (patch: Partial<T3kState>) => useTone3000.setState(patch);

function endFlow(): Flow | null {
  const ended = flow;
  flow = null;
  if (ended) clearInterval(ended.watch);
  return ended;
}

function listen(): void {
  if (listening) return;
  listening = true;
  // The callback page relays to its opener, or on a channel when the browser dropped the opener link.
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || !isCallbackMessage(event.data)) return;
    void receive(event.data);
  });
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(T3K_CHANNEL);
    channel.onmessage = (event: MessageEvent<unknown>) => { if (isCallbackMessage(event.data)) void receive(event.data); };
  }
}

/**
 * Opens the TONE3000 catalogue in a popup. Must be called from a click: the
 * window is opened at once, before the secrets are computed, or popup
 * blockers stop it.
 */
export async function browseTone3000(architecture: T3kArchitecture): Promise<void> {
  const clientId = publishableKey();
  if (!clientId) { set({ phase: 'error', error: 'Manca la chiave pubblicabile TONE3000.' }); return; }
  endFlow()?.popup?.close();
  listen();
  const width = 520;
  const height = 760;
  const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
  const popup = window.open('', 't3k_select', `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
  if (!popup) { set({ phase: 'error', error: 'Il browser ha bloccato la finestra di TONE3000: consenti i popup per questa pagina e riprova.' }); return; }
  set({ phase: 'waiting', error: null, note: null, architecture });
  const pkce = await newPkce();
  const uri = redirectUri();
  // The popup closing without an answer ends the wait; this is not a musical clock.
  const watch = setInterval(() => {
    if (flow && flow.popup?.closed) {
      endFlow();
      if (useTone3000.getState().phase === 'waiting') set({ phase: 'idle', note: 'Finestra di TONE3000 chiusa senza scegliere un tone.' });
    }
  }, 500);
  flow = { state: pkce.state, verifier: pkce.verifier, clientId, redirectUri: uri, architecture, popup, watch };
  popup.location.href = selectToneUrl({ clientId, redirectUri: uri, challenge: pkce.challenge, state: pkce.state, architecture });
}

export function cancelTone3000(): void {
  endFlow()?.popup?.close();
  set({ phase: 'idle', note: null, error: null });
}

/** Forgets the tone on show (the loaded model stays in the rig). */
export function clearTone(): void {
  set({ phase: 'idle', tone: null, models: [], error: null, note: null });
}

/** Drops the token: the next flow signs in again. */
export function signOutTone3000(): void {
  tokens = null;
  set({ signedIn: false });
}

async function receive(message: CallbackMessage | CallbackParams): Promise<void> {
  // One flow, one answer: the secrets are taken out before anything else, so a replayed callback finds nothing.
  const current = flow;
  const verdict = judgeCallback(message, current?.state ?? null);
  if (verdict.kind === 'refused' && verdict.reason === 'state-mismatch') {
    // Not an answer to the flow that is open: leave that flow alone, use nothing from the message.
    if (!current) return;
    set({ error: verdict.detail });
    return;
  }
  endFlow();
  current?.popup?.close();
  if (!current) return;
  if (verdict.kind === 'refused') {
    if (verdict.reason === 'canceled') set({ phase: 'idle', note: verdict.detail, error: null });
    else set({ phase: 'error', error: verdict.detail });
    return;
  }
  set({ phase: 'exchanging', error: null });
  try {
    const response = await fetch(T3K_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenRequestBody(current.clientId, current.redirectUri, verdict.code, current.verifier),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: unknown };
      throw new Error(`scambio del codice rifiutato (${response.status}${typeof body.error === 'string' ? `, ${body.error.slice(0, 60)}` : ''})`);
    }
    tokens = readTokens(await response.json(), Date.now());
    if (!tokens) throw new Error('risposta senza token');
    set({ signedIn: true });
  } catch (error) {
    tokens = null;
    set({ phase: 'error', signedIn: false, error: `Accesso a TONE3000 non riuscito: ${error instanceof Error ? error.message : 'errore di rete'}.` });
    return;
  }
  if (verdict.toneId === null) {
    set({ phase: 'idle', note: verdict.canceled ? 'Accesso fatto, catalogo chiuso senza scegliere un tone.' : 'Nessun tone scelto.' });
    return;
  }
  await showTone(verdict.toneId, current.architecture);
}

async function api(path: string): Promise<unknown> {
  if (!tokens || tokens.expiresAt <= Date.now()) { signOutTone3000(); throw new Error('sessione scaduta: riapri TONE3000'); }
  const response = await fetch(`${T3K_ORIGIN}${path}`, { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
  if (response.status === 401) { signOutTone3000(); throw new Error('sessione scaduta: riapri TONE3000'); }
  if (response.status === 429) throw new Error('troppe richieste: riprova fra un minuto');
  if (!response.ok) throw new Error(`risposta ${response.status}`);
  return response.json();
}

async function showTone(toneId: number, architecture: T3kArchitecture): Promise<void> {
  set({ phase: 'fetching', error: null });
  try {
    const [rawTone, rawModels] = await Promise.all([
      api(`/api/v1/tones/${toneId}?architecture=${architecture}`),
      api(`/api/v1/models?tone_id=${toneId}&architecture=${architecture}`),
    ]);
    const tone = readTone(rawTone);
    if (!tone) throw new Error('tone non leggibile');
    const models = readModels(rawModels);
    set({ phase: 'tone', tone, models, architecture, error: models.length ? null : 'Questo tone non ha modelli NAM nell’architettura scelta.' });
  } catch (error) {
    set({ phase: 'error', error: `Non riesco a leggere il tone da TONE3000: ${error instanceof Error ? error.message : 'errore di rete'}.` });
  }
}

/** Downloads one model file as text. The address and the token are used here and nowhere else. */
export async function downloadModel(model: T3kModel): Promise<string> {
  const url = modelRequestUrl(model.modelUrl);
  if (!url) throw new Error('indirizzo del modello non valido');
  if (!tokens || tokens.expiresAt <= Date.now()) { signOutTone3000(); throw new Error('sessione scaduta: riapri TONE3000'); }
  set({ downloading: true });
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
    if (response.status === 401) { signOutTone3000(); throw new Error('sessione scaduta: riapri TONE3000'); }
    if (!response.ok) throw new Error(`download rifiutato (${response.status})`);
    const declared = Number(response.headers.get('content-length') ?? '0');
    if (declared > NAM_MAX_BYTES) throw new Error('modello troppo grande');
    return await response.text();
  } finally {
    set({ downloading: false });
  }
}

/**
 * Run on the page TONE3000 redirects to. If the address is an OAuth
 * callback, relays it to the page that opened the flow, takes the code out
 * of the address bar and closes the window. Returns true when it did: the
 * app must not start in that window.
 */
export function relayTone3000Callback(): boolean {
  const params = readCallback(window.location.search);
  if (!params) return false;
  const message: CallbackMessage = { type: T3K_MESSAGE, ...params };
  try { (window.opener as Window | null)?.postMessage(message, window.location.origin); } catch { /* the opener is gone: the channel below still reaches it */ }
  if (typeof BroadcastChannel !== 'undefined') {
    const relay = new BroadcastChannel(T3K_CHANNEL);
    relay.postMessage(message);
    relay.close();
  }
  window.history.replaceState(null, '', window.location.pathname);
  const root = document.getElementById('root') ?? document.body;
  root.textContent = '';
  const text = document.createElement('p');
  text.setAttribute('data-testid', 't3k-callback');
  text.style.cssText = 'margin:40px auto;max-width:420px;padding:0 16px;font:16px/24px system-ui,sans-serif;color:#f2ead8';
  text.textContent = 'Risposta di TONE3000 ricevuta. Puoi chiudere questa finestra e tornare a Guitar Theory Lab.';
  root.append(text);
  document.body.style.background = '#16130f';
  window.setTimeout(() => window.close(), 150);
  return true;
}

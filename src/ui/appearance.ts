/**
 * Which look a screen can show. Decided by the viewport size, never by the
 * user agent: a phone held upright is narrow, a phone on its side is short.
 */
import type { Appearance } from '../app/settings';

/** Narrower than this is a phone held upright: Studio's console does not fit. */
export const STUDIO_MIN_WIDTH = 600;
/** Shorter than this (a phone on its side) leaves no room for console and neck together. */
export const STUDIO_MIN_HEIGHT = 480;

export const studioAvailable = (width: number, height: number): boolean =>
  width >= STUDIO_MIN_WIDTH && height >= STUDIO_MIN_HEIGHT;

/** The saved preference wins whenever the screen allows it; it is never overwritten by the fallback. */
export const effectiveAppearance = (preference: Appearance, width: number, height: number): Appearance =>
  preference === 'studio' && studioAvailable(width, height) ? 'studio' : 'simple';

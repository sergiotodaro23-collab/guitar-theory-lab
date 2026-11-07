/**
 * Which look a screen can show. Decided by the viewport size, never by the
 * user agent: a phone held upright is narrow, a phone on its side is short.
 */
import type { Appearance, Look } from '../app/settings';

/** Narrower than this is a phone held upright: Studio's console does not fit. */
export const STUDIO_MIN_WIDTH = 600;
/** Shorter than this (a phone on its side) leaves no room for console and neck together. */
export const STUDIO_MIN_HEIGHT = 480;

export const studioAvailable = (width: number, height: number): boolean =>
  width >= STUDIO_MIN_WIDTH && height >= STUDIO_MIN_HEIGHT;

/**
 * Studio wherever it fits unless the user chose Simple. The saved choice is
 * never overwritten by the fallback, so it returns when the screen allows it.
 */
export const effectiveAppearance = (look: Look, width: number, height: number): Appearance =>
  look !== 'simple' && studioAvailable(width, height) ? 'studio' : 'simple';

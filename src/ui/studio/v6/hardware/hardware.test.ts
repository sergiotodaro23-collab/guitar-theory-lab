import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { knobFrame } from '../../v57/RotaryKnob';
import { AMP_HEAD } from './amp.generated';

/**
 * The rendered hardware and the code that places controls on it must agree.
 * These checks need no Blender: they compare the committed pictures, the
 * manifest the build wrote, the spec Blender read and the generated module
 * React reads.
 */

const here = resolve('src/ui/studio/v6/hardware');
const spec = JSON.parse(readFileSync(resolve('tools/blender/specs/amp.json'), 'utf8')) as typeof AMP_HEAD.spec;
interface Asset { file: string; px: [number, number]; css: [number, number]; scale: number; bytes: number; sha256: string }
const manifest = JSON.parse(readFileSync(resolve(here, 'assets/amp.manifest.json'), 'utf8')) as { samples: number; engine: string; assets: Record<string, Asset> };

/** Width and height of a WebP file, from its header (VP8X, VP8L or VP8). */
function webpSize(data: Buffer): [number, number] {
  const kind = data.toString('ascii', 12, 16);
  if (kind === 'VP8X') return [1 + data.readUIntLE(24, 3), 1 + data.readUIntLE(27, 3)];
  if (kind === 'VP8L') { const b = data.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
  return [data.readUInt16LE(26) & 0x3fff, data.readUInt16LE(28) & 0x3fff];
}

describe('amplifier head: spec, pictures and generated geometry agree', () => {
  it('the generated module carries the spec Blender read, unchanged', () => {
    expect(AMP_HEAD.spec).toEqual(spec);
  });

  it('every picture in the manifest is the committed file: size in pixels, bytes and hash', () => {
    expect(Object.keys(manifest.assets).sort()).toEqual(['body', 'knob', 'lampOff', 'lampOn']);
    for (const asset of Object.values(manifest.assets)) {
      const data = readFileSync(resolve(here, 'assets', asset.file));
      expect(webpSize(data), asset.file).toEqual(asset.px);
      expect(data.length, asset.file).toBe(asset.bytes);
      expect(createHash('sha256').update(data).digest('hex').slice(0, 16), asset.file).toBe(asset.sha256);
      // Two device pixels per CSS pixel.
      expect(asset.px[0], asset.file).toBe(asset.css[0] * asset.scale);
      expect(asset.px[1], asset.file).toBe(asset.css[1] * asset.scale);
    }
  });

  it('the body picture is the device plus its shadow margin, offset so the device sits at the origin', () => {
    const { size, margin } = spec;
    expect(AMP_HEAD.assets.body.css).toEqual([size.w + margin.left + margin.right, size.h + margin.top + margin.bottom]);
    expect(AMP_HEAD.assets.body.offset).toEqual([-margin.left, -margin.top]);
  });

  it('the knob strip has one square frame per position', () => {
    const k = spec.knobs;
    expect(AMP_HEAD.assets.knob.frames).toBe(k.frames);
    expect(AMP_HEAD.assets.knob.css).toEqual([k.frame * k.frames, k.frame]);
  });

  it('every knob, with its marks, lies on the control plate and clear of its neighbours', () => {
    const { knobs: k, plate, size } = spec;
    expect(k.ids).toHaveLength(6);
    const last = k.first + k.pitch * (k.ids.length - 1);
    expect(k.first - k.tickRadius).toBeGreaterThanOrEqual(plate.x);
    expect(last + k.tickRadius).toBeLessThanOrEqual(plate.x + plate.w);
    expect(k.y - k.tickRadius).toBeGreaterThanOrEqual(plate.y);
    expect(k.y + k.diameter / 2).toBeLessThanOrEqual(plate.y + plate.h);
    expect(k.pitch).toBeGreaterThanOrEqual(k.tickRadius * 2);
    // The pointer target is never smaller than the knob it turns, and the device fits the rack's 300 px column.
    expect(k.hit).toBeGreaterThanOrEqual(k.diameter);
    expect(size.w).toBeLessThanOrEqual(300);
  });

  it('a value picks its frame: ends and middle exact, never out of the strip', () => {
    const n = spec.knobs.frames;
    expect(knobFrame(0, n)).toBe(0);
    expect(knobFrame(50, n)).toBe((n - 1) / 2);
    expect(knobFrame(100, n)).toBe(n - 1);
    expect(knobFrame(-20, n)).toBe(0);
    expect(knobFrame(400, n)).toBe(n - 1);
    // An odd number of frames, so noon has a frame of its own.
    expect(n % 2).toBe(1);
  });

  it('the pictures stay small: the whole amplifier under 160 kB', () => {
    const total = Object.values(manifest.assets).reduce((sum, a) => sum + a.bytes, 0);
    expect(total).toBeLessThan(160 * 1024);
    expect(manifest.engine).toBe('CYCLES');
    expect(manifest.samples).toBeGreaterThanOrEqual(96);
  });
});

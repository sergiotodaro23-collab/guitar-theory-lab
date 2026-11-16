import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { knobFrame } from '../../v57/RotaryKnob';
import { AMP_HEAD } from './amp.generated';
import { PEDALS_HW } from './pedals.generated';
import { CAB_HW } from './cab.generated';
import { IFACE_HW } from './iface.generated';
import { MIXER_HW } from './mixer.generated';
import { CONSOLE_HW } from './console.generated';
import { FRAME_HW } from './frame.generated';
import { PEDAL_SPECS } from '../../../../app/rig';

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

/** Every rendered component: its manifest must describe the committed files, and its generated module the spec. */
const COMPONENTS = [
  { name: 'amp', generated: AMP_HEAD as { spec: unknown; assets: Record<string, { file: string }> }, budget: 160 },
  { name: 'pedals', generated: PEDALS_HW as { spec: unknown; assets: Record<string, { file: string }> }, budget: 160 },
  { name: 'cab', generated: CAB_HW as { spec: unknown; assets: Record<string, { file: string }> }, budget: 60 },
  { name: 'iface', generated: IFACE_HW as { spec: unknown; assets: Record<string, { file: string }> }, budget: 80 },
  { name: 'console', generated: CONSOLE_HW as { spec: unknown; assets: Record<string, { file: string }> }, budget: 20 },
  { name: 'frame', generated: FRAME_HW as { spec: unknown; assets: Record<string, { file: string }> }, budget: 60 },
  { name: 'mixer', generated: MIXER_HW as { spec: unknown; assets: Record<string, { file: string }> }, budget: 20 },
];

describe.each(COMPONENTS)('rendered component $name', ({ name, generated, budget }) => {
  const componentSpec = JSON.parse(readFileSync(resolve(`tools/blender/specs/${name}.json`), 'utf8')) as unknown;
  const componentManifest = JSON.parse(readFileSync(resolve(here, `assets/${name}.manifest.json`), 'utf8')) as { samples: number; assets: Record<string, Asset> };

  it('generated module = spec; manifest = committed files; within its weight budget', () => {
    expect(generated.spec).toEqual(componentSpec);
    expect(Object.keys(generated.assets).sort()).toEqual(Object.keys(componentManifest.assets).sort());
    let total = 0;
    for (const asset of Object.values(componentManifest.assets)) {
      const data = readFileSync(resolve(here, 'assets', asset.file));
      expect(webpSize(data), asset.file).toEqual(asset.px);
      expect(data.length, asset.file).toBe(asset.bytes);
      expect(createHash('sha256').update(data).digest('hex').slice(0, 16), asset.file).toBe(asset.sha256);
      expect(asset.px, asset.file).toEqual([asset.css[0] * asset.scale, asset.css[1] * asset.scale]);
      total += asset.bytes;
    }
    expect(total).toBeLessThan(budget * 1024);
    expect(componentManifest.samples).toBeGreaterThanOrEqual(96);
  });
});

describe('pedals: the rendered bodies match the pedals of the rig', () => {
  const hw = PEDALS_HW.spec;
  it('one body per pedal of the rig, with a hole for every knob it has', () => {
    expect(Object.keys(hw.pedals).sort()).toEqual(Object.keys(PEDAL_SPECS).sort());
    for (const [id, pedal] of Object.entries(hw.pedals)) {
      expect(pedal.knobs, id).toBe(PEDAL_SPECS[id as keyof typeof PEDAL_SPECS].knobs.length);
      expect(pedal.paint.toLowerCase(), id).toBe(PEDAL_SPECS[id as keyof typeof PEDAL_SPECS].color.toLowerCase());
      expect(PEDALS_HW.assets[`body-${id}` as keyof typeof PEDALS_HW.assets].file, id).toBe(`pedal-${id}@2x.webp`);
    }
  });
  it('knobs, LED and switch lie on the enclosure and clear of each other', () => {
    const { size, knobs: k, led, switch: sw, name, labelY } = hw;
    const spread = k.pitch * 2 + k.diameter;
    expect(spread).toBeLessThanOrEqual(size.w - 8);
    expect(k.pitch).toBeGreaterThanOrEqual(k.hit);
    expect(k.y + k.diameter / 2).toBeLessThanOrEqual(labelY);
    expect(labelY + 10).toBeLessThanOrEqual(name.y);
    expect(name.y + name.h).toBeLessThanOrEqual(led.y - led.r);
    expect(led.y + led.r).toBeLessThan(sw.y - sw.hit / 2);
    expect(sw.y + sw.hit / 2).toBeLessThanOrEqual(size.h - 8);
    expect(k.frames % 2).toBe(1);
  });
});

describe('audio interface and cabinet: live controls have their place on the pictures', () => {
  it('interface: socket, knob with its marks, meter window and control strip lie on the panel without overlapping', () => {
    const { size, cheek, jack, knob: k, meter, controls } = IFACE_HW.spec;
    expect(size.w).toBeLessThanOrEqual(300);
    expect(jack.x - jack.r).toBeGreaterThanOrEqual(cheek);
    expect(jack.x + jack.r).toBeLessThanOrEqual(k.x - k.tickRadius);
    expect(k.x + k.tickRadius).toBeLessThanOrEqual(meter.x);
    expect(k.y + k.tickRadius).toBeLessThanOrEqual(size.h);
    expect(meter.x + meter.w).toBeLessThanOrEqual(size.w - cheek);
    expect(meter.y + meter.h).toBeLessThanOrEqual(controls.y);
    expect(controls.y + controls.h).toBeLessThanOrEqual(size.h);
    expect(k.hit).toBeGreaterThanOrEqual(k.diameter);
    expect(IFACE_HW.assets.knob.frames).toBe(k.frames);
  });
  it('cabinet: as wide as the amplifier head above it, speakers inside the grille', () => {
    const { size, grille, speakers } = CAB_HW.spec;
    expect(size.w).toBe(AMP_HEAD.spec.size.w);
    for (const s of speakers) {
      expect(s.x - s.r).toBeGreaterThanOrEqual(grille.x);
      expect(s.x + s.r).toBeLessThanOrEqual(grille.x + grille.w);
      expect(s.y - s.r).toBeGreaterThanOrEqual(grille.y);
      expect(s.y + s.r).toBeLessThanOrEqual(grille.y + grille.h);
    }
  });
});

describe('mixer parts', () => {
  it('the cap picture holds the cap and its shadow; a key can be sliced into nine', () => {
    const { cap, key } = MIXER_HW.spec;
    expect(cap.frame.w).toBeGreaterThan(cap.w);
    expect(cap.frame.h).toBeGreaterThanOrEqual(cap.h + 2 * cap.shadowDrop);
    expect(key.slice * 2).toBeLessThan(key.h);
    expect(MIXER_HW.assets.keyOff.px).toEqual([key.w * 2, key.h * 2]);
    expect(MIXER_HW.assets.keyMute.slice).toBe(key.slice);
    const { strip, slot, bank } = MIXER_HW.spec;
    // Nine-slice sources: the borders, with their screws, never meet in the middle.
    for (const part of [strip, slot, bank]) expect(part.slice * 2).toBeLessThan(Math.min(part.w, part.h));
    expect(slot.w).toBeGreaterThan(cap.w);
  });
});

describe('console parts', () => {
  it('the stylesheet slices each picture where the spec says, and uses the rendered files', () => {
    const css = readFileSync(resolve('src/ui/studio/v57/v57.css'), 'utf8');
    const { plate, lcd, key } = CONSOLE_HW.spec;
    // border-image: <file> <slice in image px> fill / <slice in CSS px>
    expect(css).toContain(`console-plate9@2x.webp') ${plate.slice * 2} fill / ${plate.slice}px`);
    expect(css).toContain(`console-lcd9@2x.webp') ${lcd.slice * 2} fill / ${lcd.slice}px`);
    expect(css).toMatch(new RegExp(`console-key-up@2x\\.webp'\\) \\d+ fill / ${key.slice}px`));
    for (const state of ['up', 'down', 'lit']) expect(css).toContain(`console-key-${state}@2x.webp`);
    for (const part of [plate, lcd, key]) expect(part.slice * 2).toBeLessThan(Math.min(part.w, part.h));
  });
});

describe('wood', () => {
  it('the board pictures have the proportions of the board in the SVG fretboard, and the rail keeps the V5.7 slice', () => {
    const { board, rail } = FRAME_HW.spec;
    const source = readFileSync(resolve('src/viz/Fretboard.tsx'), 'utf8');
    const constant = (name: string) => Number(new RegExp(`const ${name} = (\\d+)`).exec(source)?.[1]);
    const [width, height, nut, top] = [constant('WIDTH'), constant('HEIGHT'), constant('NUT_X'), constant('TOP')];
    // RIGHT = WIDTH - 14, BOTTOM = HEIGHT - 38; the board rectangle is 12 taller than the strings at each side.
    expect(board.w).toBe(width - 14 - nut);
    expect(board.h).toBe(height - 38 - top + 24);
    const css = readFileSync(resolve('src/ui/studio/v57/v57.css'), 'utf8');
    expect(css).toContain(`frame-rail9@2x.webp') ${rail.slice * 2} fill / ${rail.slice}px`);
  });
});

describe('header nameplate', () => {
  it('uses the paths, colours and label of the approved V6.7 vector header, unchanged', () => {
    const reference = readFileSync(resolve('docs/hardware/v6_7-vector-header.svg'), 'utf8');
    const logo = readFileSync(resolve('src/ui/studio/v6/StudioLogo.tsx'), 'utf8');
    const paths = [...reference.matchAll(/ d="([^"]+)"/g)].map((m) => m[1] ?? '');
    // Plate outline, two stripe centre lines (each drawn twice in the reference) and the wordmark.
    expect(new Set(paths).size).toBe(4);
    for (const d of paths) expect(logo, d.slice(0, 30)).toContain(d);
    for (const colour of ['#e5bd80', '#76100d', '#f6d9a8', '#e53b13', '#750b09', '#26150d', '#fbe6bd', '#ead0a0', '#9a673d']) {
      expect(reference).toContain(colour);
      expect(logo).toContain(colour);
    }
    expect(logo).toContain('STUDIO · VER. 6.0');
    expect(reference).toContain('STUDIO · VER. 6.0');
  });
});

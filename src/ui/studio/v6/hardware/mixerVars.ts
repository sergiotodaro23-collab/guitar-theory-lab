/**
 * The rendered mixer parts (tools/blender/specs/mixer.json) as CSS custom
 * properties: the stylesheet places fader caps and keys from the numbers
 * Blender used, never from numbers copied by hand.
 */
import type { CSSProperties } from 'react';
import { MIXER_HW } from './mixer.generated';
import cap from './assets/mixer-cap@2x.webp';
import capMaster from './assets/mixer-cap-master@2x.webp';
import keyOff from './assets/mixer-key-off@2x.webp';
import keyMute from './assets/mixer-key-mute@2x.webp';
import keySolo from './assets/mixer-key-solo@2x.webp';

const { cap: c, key: k } = MIXER_HW.spec;

export const MIXER_VARS = {
  '--cap': `url(${cap})`,
  '--cap-master': `url(${capMaster})`,
  '--cap-w': `${c.w}px`,
  '--cap-h': `${c.h}px`,
  '--cap-fw': `${c.frame.w}px`,
  '--cap-fh': `${c.frame.h}px`,
  '--cap-drop': `${c.shadowDrop}px`,
  '--key-off': `url(${keyOff})`,
  '--key-mute': `url(${keyMute})`,
  '--key-solo': `url(${keySolo})`,
  '--key-h': `${k.h}px`,
  '--key-slice': `${k.slice}px`,
  '--key-slice-px': `${k.slice * 2}`,
} as CSSProperties;

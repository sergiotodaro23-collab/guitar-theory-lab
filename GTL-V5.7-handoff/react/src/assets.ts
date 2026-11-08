/** Rendered hardware assets (Blender 5.2.3 / Cycles). Copy ../assets/* to your public folder at ASSET_BASE. */
export const ASSET_BASE = '/assets/gtl/';
const a = (f: string) => ASSET_BASE + f;
export const assets = {
  mixerBody: a('mixer-body@2x.webp'), faderCap: a('fader-cap@2x.png'), faderCapMaster: a('fader-cap-master@2x.png'),
  btnOff: a('btn-off@2x.png'), btnMuteOn: a('btn-mute-on@2x.png'), btnSoloOn: a('btn-solo-on@2x.png'),
  ampBody: a('amp-body@2x.webp'), knobGold: a('knob-gold@2x.png'), rockerOn: a('rocker-on@2x.png'), rockerOff: a('rocker-off@2x.png'),
  toggleUp: a('toggle-up@2x.png'), toggleDown: a('toggle-down@2x.png'),
  tunerBody: a('tuner-body@2x.webp'), knobBlack: a('knob-black@2x.png'), footswitch: a('footswitch@2x.png'),
  ifaceBody: a('iface-body@2x.webp'), knobAlu: a('knob-alu@2x.png'),
  plate9: a('plate9@2x.webp'), lcd9: a('lcd9@2x.webp'), railWood9: a('rail-wood9@2x.webp'),
  keyUp: a('key-up@2x.png'), keyDown: a('key-down@2x.png'), keyLit: a('key-lit@2x.png'), coil: a('coil@2x.png')
} as const;

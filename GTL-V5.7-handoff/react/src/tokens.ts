/** Design tokens extracted from the V5.7 prototype (Main.dc.html + ds/guitar-theory-lab/tokens.css). */
export const color = {
  walnut: '#4a2c1a', gunmetal: '#2b2d31', brushed: '#8c939b', paper: '#efe3bd', paperInk: '#2a2418',
  accentOrange: '#f26b1d', lcdAmber: '#ffb23f', lcdBlue: '#4fb2ff', ledGreen: '#7dff6a', ledRed: '#ff3b2f',
  markerTonic: '#f08a24', markerScale: '#4a9fe8', markerChord: '#3cc27a', markerTension: '#a77bf0', markerExternal: '#8a8a8a',
  scaleLayers: ['#d84fa8', '#1fbfb6', '#e0c030', '#8fd14f'],
  chordLayers: ['#ff7f50', '#6f8cff', '#c9d94a', '#ff5fa2', '#3fd0e0', '#b08cff', '#f0a040'],
  tabs: { scale: '#7fb2e0', chords: '#74c795', exercise: '#f0a05a', legend: '#ae92e6', next: '#dcbc4e' }
} as const;
export const font = {
  ui: '"Barlow", system-ui, sans-serif',
  label: '"Barlow Condensed", "Arial Narrow", sans-serif',
  display: '"Cormorant Garamond", Georgia, serif',
  lcd: '"IBM Plex Mono", ui-monospace, monospace'
} as const;
export const radius = { sm: 2, md: 6, plate: 8, device: 12 } as const;
export const motion = {
  drawerIn: { durationMs: 340, delayMs: 40, easing: 'cubic-bezier(.25,1.12,.4,1)', keyframes: 'translateY(100%+24px) → -3px @78% → +1px @90% → 0' },
  drawerOut: { durationMs: 200, easing: 'cubic-bezier(.5,0,.9,.4)', keyframes: '0 → -3px @22% → translateY(100%+24px)' },
  slot: { inMs: 160, outMs: 200, outDelayMs: 80 },
  scrim: { inMs: 200 },
  unmountAfterMs: 260,
  reducedMotion: 'opacity fade 120 ms in; close is immediate'
} as const;
/** Device canvases (CSS px at scale 1). Assets are @2x of the *render frame*, which is larger (shadow margin). */
export const deviceGeometry = {
  mixer: { canvas: [828, 432], render: [890, 490], renderOffset: [-16, -12], body: [780, 380], bodyOffset: [24, 20] },
  amp: { canvas: [868, 344], render: [930, 402], renderOffset: [-16, -12], body: [820, 300], bodyOffset: [24, 20] },
  tuner: { canvas: [428, 404], render: [490, 462], renderOffset: [-16, -12], body: [380, 360], bodyOffset: [24, 20] },
  iface: { canvas: [668, 254], render: [730, 312], renderOffset: [-16, -12], body: [620, 210], bodyOffset: [24, 20] }
} as const;

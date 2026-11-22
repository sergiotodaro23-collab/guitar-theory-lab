/**
 * Customizable marker colours (N3). The user may replace the colour of each
 * role; a role left alone keeps its theme's colour. Colours become CSS custom
 * properties on the shell, so the neck, the secondary neck and the legend take
 * them at once. Each colour comes with the ink its label needs to stay
 * readable. Pure, no DOM.
 */
export type ColorRole = 'root' | 'scale' | 'chord' | 'tension' | 'avoid' | 'outside' | 'arpeggio';
export type MarkerColors = Partial<Record<ColorRole, string>>;
export type PaletteLook = 'studio' | 'simple';

export interface ColorRoleSpec {
  readonly id: ColorRole;
  readonly label: string;
  /** Theme colours, shown in the picker while the role is not customized. */
  readonly defaults: Readonly<Record<PaletteLook, string>>;
  /** Custom properties the theme reads for this role. */
  readonly vars: Readonly<Record<PaletteLook, readonly string[]>>;
  /** Custom property for the label drawn on the note; null when the role has no label on a fill. */
  readonly ink: string | null;
}

export const COLOR_ROLES: readonly ColorRoleSpec[] = [
  { id: 'root', label: 'Tonica della scala', defaults: { studio: '#f08a24', simple: '#a3201a' }, vars: { studio: ['--marker-tonic'], simple: ['--root'] }, ink: '--ink-root' },
  { id: 'scale', label: 'Note della scala', defaults: { studio: '#4a9fe8', simple: '#1d3561' }, vars: { studio: ['--marker-scale'], simple: ['--scale'] }, ink: '--ink-scale' },
  { id: 'chord', label: "Note dell'accordo (fondamentale compresa)", defaults: { studio: '#3cc27a', simple: '#0d6b62' }, vars: { studio: ['--marker-chord'], simple: ['--chord-tone'] }, ink: '--ink-chord' },
  { id: 'tension', label: 'Tensioni', defaults: { studio: '#a77bf0', simple: '#9a5800' }, vars: { studio: ['--marker-tension'], simple: ['--tension'] }, ink: '--ink-tension' },
  { id: 'avoid', label: 'Avoid', defaults: { studio: '#b3241b', simple: '#b0231b' }, vars: { studio: ['--avoid'], simple: ['--avoid'] }, ink: null },
  { id: 'outside', label: 'Note esterne', defaults: { studio: '#8a8a8a', simple: '#6f6455' }, vars: { studio: ['--marker-external'], simple: ['--outside'] }, ink: null },
  { id: 'arpeggio', label: "Triangolo dell'arpeggio", defaults: { studio: '#1d1409', simple: '#1d1409' }, vars: { studio: ['--arp-mark'], simple: ['--arp-mark'] }, ink: null },
];

const HEX = /^#[0-9a-f]{6}$/;
const ROLE_IDS = new Set<string>(COLOR_ROLES.map((r) => r.id));

/** Keep only known roles with a #rrggbb colour (lower case); anything else is dropped. */
export function sanitizeMarkerColors(raw: unknown): MarkerColors {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const out: Partial<Record<ColorRole, string>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!ROLE_IDS.has(key) || typeof value !== 'string') continue;
    const hex = value.trim().toLowerCase();
    if (HEX.test(hex)) out[key as ColorRole] = hex;
  }
  return out;
}

/** WCAG relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

export const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
};

export const DARK_INK = '#14100a';
export const LIGHT_INK = '#fbf7ec';

/** The label colour that reads best on a fill: dark or light, whichever has the higher contrast. */
export const inkFor = (fill: string): string => (contrast(fill, DARK_INK) >= contrast(fill, LIGHT_INK) ? DARK_INK : LIGHT_INK);

/** Custom properties for the shell: only the customized roles, each with the ink of its label. */
export function markerColorVars(colors: MarkerColors, look: PaletteLook): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const role of COLOR_ROLES) {
    const color = colors[role.id];
    if (!color) continue;
    for (const name of role.vars[look]) vars[name] = color;
    if (role.ink) vars[role.ink] = inkFor(color);
  }
  return vars;
}

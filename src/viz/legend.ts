/**
 * The legend lists what the neck shows right now, nothing more: each entry
 * appears only when at least one drawn marker carries it. Pure, no DOM.
 */
import type { Marker, MarkerRole } from './markers';

export type LegendKind = MarkerRole | 'guide' | 'voicing' | 'target-now' | 'target-next' | 'played';

export interface LegendEntry {
  readonly kind: LegendKind;
  readonly label: string;
}

const ORDER: readonly LegendEntry[] = [
  { kind: 'root', label: 'Tonica' },
  { kind: 'scale', label: 'Nota della scala' },
  { kind: 'guide', label: 'Guide tone (3ª e 7ª)' },
  { kind: 'chord-tone', label: "Nota dell'accordo" },
  { kind: 'tension', label: 'Tensione' },
  { kind: 'avoid', label: 'Avoid contestuale' },
  { kind: 'outside', label: 'Nota esterna' },
  { kind: 'other-scale', label: 'Solo nelle scale aggiunte' },
  { kind: 'voicing', label: "Forma dell'accordo" },
  { kind: 'target-now', label: 'Target ora' },
  { kind: 'target-next', label: 'Target sul prossimo accordo' },
  { kind: 'played', label: "Nota suonata dall'esercizio" },
];

export function legendEntries(markers: readonly Marker[], options: { readonly played: boolean }): readonly LegendEntry[] {
  const present = new Set<LegendKind>();
  for (const m of markers) {
    present.add(m.role === 'chord-tone' && m.isGuide ? 'guide' : m.role);
    if (m.inVoicing) present.add('voicing');
    if (m.target === 'now') present.add('target-now');
    if (m.target === 'next') present.add('target-next');
  }
  if (options.played) present.add('played');
  return ORDER.filter((entry) => present.has(entry.kind));
}

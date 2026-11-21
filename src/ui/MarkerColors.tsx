/**
 * Colour pickers for the marker roles (N3). A choice is saved with the
 * settings and applied at once to the neck, the secondary neck and the legend;
 * «Predefinito» gives the role back to its theme.
 */
import { useApp } from '../app/store';
import { COLOR_ROLES, type ColorRole, type PaletteLook } from '../viz/palette';

export function MarkerColorsPanel({ look }: { readonly look: PaletteLook }) {
  const colors = useApp((s) => s.settings.markerColors);
  const update = useApp((s) => s.update);
  const set = (role: ColorRole, value: string | null) => {
    const next = { ...colors };
    if (value === null) delete next[role];
    else next[role] = value.toLowerCase();
    update({ markerColors: next });
  };
  const customized = COLOR_ROLES.some((r) => colors[r.id]);
  return (
    <div className="marker-colors" data-testid="marker-colors">
      <ul className="marker-colors-list">
        {COLOR_ROLES.map((role) => {
          const value = colors[role.id] ?? role.defaults[look];
          const custom = Boolean(colors[role.id]);
          return (
            <li key={role.id} className="marker-colors-row" data-role={role.id} data-custom={custom ? '1' : '0'}>
              <input
                type="color"
                className="marker-colors-input"
                value={value}
                aria-label={`Colore: ${role.label}`}
                data-testid={`marker-color-${role.id}`}
                onChange={(e) => set(role.id, e.target.value)}
              />
              <span className="marker-colors-name">{role.label}</span>
              {custom ? (
                <button type="button" className="link marker-colors-reset" aria-label={`Colore predefinito: ${role.label}`} onClick={() => set(role.id, null)}>Predefinito</button>
              ) : <span className="marker-colors-theme muted">del tema</span>}
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn marker-colors-all" data-testid="marker-colors-reset" disabled={!customized} onClick={() => update({ markerColors: {} })}>
        Ripristina i colori del tema
      </button>
    </div>
  );
}

/**
 * The rendered hardware key (key-up / key-down / key-lit, nine-slice). A real
 * button: the image is only its border. Icons are drawn as SVG strokes.
 */
import type { ReactNode } from 'react';

export type KeyIcon = 'play' | 'pause' | 'stop' | 'minus' | 'plus' | 'expand' | 'compact';

const PATHS: Record<KeyIcon, ReactNode> = {
  play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />,
  pause: <path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" stroke="none" />,
  stop: <path d="M7 7h10v10H7z" fill="currentColor" stroke="none" />,
  minus: <path d="M6 12h12" />,
  plus: <path d="M6 12h12M12 6v12" />,
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  compact: <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />,
};

export function KeyGlyph({ icon }: { readonly icon: KeyIcon }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {PATHS[icon]}
    </svg>
  );
}

interface HardwareKeyProps {
  readonly label: string;
  readonly icon?: KeyIcon;
  readonly text?: string;
  /** Lit key: a toggled state that is on now. */
  readonly lit?: boolean;
  readonly pressed?: boolean;
  readonly disabled?: boolean;
  readonly size?: 'transport' | 'mini';
  readonly testId?: string;
  /** Visually hidden text that names the state for tests and screen readers. */
  readonly hiddenText?: string;
  readonly onClick: () => void;
}

export function HardwareKey({ label, icon, text, lit = false, pressed, disabled = false, size = 'transport', testId, hiddenText, onClick }: HardwareKeyProps) {
  return (
    <span className="v57-tw">
      <button
        type="button"
        className={`v57-key v57-key-${size}`}
        data-on={lit ? '1' : '0'}
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        data-testid={testId}
        onClick={onClick}
      >
        {icon ? <KeyGlyph icon={icon} /> : null}
        {text ? <span className="v57-key-text">{text}</span> : null}
        {hiddenText ? <span className="v57-sr">{hiddenText}</span> : null}
      </button>
      <span className="v57-tip" role="tooltip">{label}</span>
    </span>
  );
}

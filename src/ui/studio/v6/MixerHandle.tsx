/**
 * The mixer handle: a bar under the notebook zone that raises and lowers the
 * mixer drawer. The drawer covers the notebook only; the neck above and the
 * handle itself stay where they are.
 */
import { useStudioUi } from '../v57/uiStore';

export function MixerHandle() {
  const open = useStudioUi((u) => u.device === 'mixer');
  const openDevice = useStudioUi((u) => u.openDevice);
  const closeDevice = useStudioUi((u) => u.closeDevice);
  const chevron = open ? 'M2 2l6 5 6-5' : 'M2 7l6-5 6 5';
  const Chevron = () => <svg width="16" height="9" viewBox="0 0 16 9" aria-hidden="true"><path d={chevron} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  return (
    <button type="button" className="v6-mixhandle" aria-pressed={open} aria-label="Mixer analogico" data-on={open ? '1' : '0'} data-testid="device-mixer"
      onClick={(e) => (open ? closeDevice() : openDevice('mixer', e.currentTarget))}>
      <Chevron />
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3v18M12 3v18M18 3v18M4 15h4M10 8h4M16 12h4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>
      <span>Mixer <em>({open ? 'chiudi' : 'apri'})</em></span>
      <Chevron />
    </button>
  );
}

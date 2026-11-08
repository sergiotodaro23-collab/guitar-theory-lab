export * from './types';
export * from './tokens';
export * from './assets';
export { DeviceDrawer } from './devices/DeviceDrawer';
export { RotaryKnob } from './devices/RotaryKnob';
export { MixerDevice, MIXER, faderDb } from './devices/MixerDevice';
export { AmpDevice, AMP } from './devices/AmpDevice';
export { TunerDevice, TUNER } from './devices/TunerDevice';
export { InterfaceDevice, IFACE } from './devices/InterfaceDevice';
/** Scale a device canvas into the free notebook area (prototype rule). */
export function fitScale(canvasW: number, canvasH: number, notebookW: number, notebookH: number, hasNote: boolean): number {
  const h = notebookH - 16 - (hasNote && notebookH >= 350 ? 36 : 0);
  return Math.max(0.45, Math.min(1, h / canvasH, (notebookW - 20) / canvasW));
}

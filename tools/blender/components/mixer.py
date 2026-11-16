"""
Moving parts of the Studio V6 mixer: the fader cap (channel and master) and
the console key in its three states (off, mute lit red, solo lit amber).
A cap only slides, so one picture under the kit's light serves the whole
travel. Keys are rendered edge to edge and used as nine-slice borders.
The slots, scales and meters stay CSS: they stretch with the console and
the meters change every frame.
"""
from gtlkit import export
from gtlkit import materials as M
from gtlkit import parts as P
from gtlkit.scene import camera, catcher, reset, studio_rig

NAME = 'mixer'
EXPORT = 'MIXER_HW'

CAPS = {'cap': ((0.62, 0.6, 0.55), (0.02, 0.02, 0.02)), 'capMaster': ((0.5, 0.045, 0.03), (0.9, 0.88, 0.8))}
KEYS = {'keyOff': ((0.022, 0.023, 0.026), False), 'keyMute': ((0.85, 0.03, 0.012), True), 'keySolo': ((1.0, 0.3, 0.0), True)}


def cap(spec, samples, which):
    reset(samples)
    c = spec['cap']
    fw, fh = c['frame']['w'], c['frame']['h']
    body, line = CAPS[which]
    P.fader_cap(fw / 2, fh / 2 - c['shadowDrop'], c['w'], c['h'], 0, M.bakelite('cap', body, rough=0.36), M.enamel('cap-line', line))
    catcher(0, 0, fw, fh)
    studio_rig(fw / 2, fh / 2, fw * 1.6)
    camera(0, 0, fw, fh)


def key(spec, samples, which):
    reset(samples)
    k = spec['key']
    color, lit = KEYS[which]
    P.console_key(0, 0, k['w'], k['h'], 0, M.key_cap('key', color, lit))
    studio_rig(k['w'] / 2, k['h'] / 2, k['w'] * 1.6)
    camera(0, 0, k['w'], k['h'])


def pictures(spec, samples):
    c, k = spec['cap'], spec['key']
    names = {'cap': 'mixer-cap', 'capMaster': 'mixer-cap-master', 'keyOff': 'mixer-key-off', 'keyMute': 'mixer-key-mute', 'keySolo': 'mixer-key-solo'}
    out = [dict(key=w, file=f'{names[w]}@2x.webp', css=(c['frame']['w'], c['frame']['h']), quality=90, use=f'Fader cap ({w})',
                scenes=[(names[w], lambda w=w: cap(spec, samples, w))], post=lambda im: export.feather(im, 4)) for w in CAPS]
    out += [dict(key=w, file=f'{names[w]}@2x.webp', css=(k['w'], k['h']), quality=92, use=f'Console key ({w}), nine-slice',
                 scenes=[(names[w], lambda w=w: key(spec, samples, w))], post=lambda im: im, extra={'slice': k['slice']}) for w in KEYS]
    return out

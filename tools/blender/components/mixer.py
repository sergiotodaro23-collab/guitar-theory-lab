"""
Moving parts of the Studio V6 mixer: the fader cap (channel and master) and
the console key in its three states (off, mute lit red, solo lit amber).
A cap only slides, so one picture under the kit's light serves the whole
travel. Keys are rendered edge to edge and used as nine-slice borders.
Strip faceplates, the fader guide and the bank's tray are nine-slice
sources too: their corners and screws stay whole while the middle
stretches with the console. Scales and meters stay live: the meters change
every frame.
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


STRIPS = {'strip': (0.03, 0.032, 0.037), 'stripGroup': (0.07, 0.04, 0.02), 'stripMaster': (0.085, 0.022, 0.016)}


def _flat(w, h, samples):
    """Light and camera for a panel rendered edge to edge (a nine-slice source): no catcher, no outer shadow."""
    studio_rig(w / 2, h / 2, max(w, h) * 1.4)
    camera(0, 0, w, h)


def strip(spec, samples, which):
    """A channel strip's faceplate: anodised, softly bevelled, a screw in every corner (inside the slice, so they never stretch)."""
    reset(samples)
    s = spec['strip']
    P.rbox('strip', 0, 0, s['w'], s['h'], 0, 3, M.anodized('strip', STRIPS[which], rough=0.46), corner=s['corner'], edge=1.3, segments=4)
    nickel, slot = M.nickel('strip-screw', 0.34), M.void('slot')
    for (x, y) in ((6, 6), (s['w'] - 6, 6), (6, s['h'] - 6), (s['w'] - 6, s['h'] - 6)):
        P.screw(x, y, 1.7, 3, nickel, slot, turn=(x * 5 + y) * 3)
    _flat(s['w'], s['h'], samples)


def slot(spec, samples):
    """A fader guide: a steel escutcheon with a dark groove down its middle; the ends, with their screws, stay whole when it stretches."""
    reset(samples)
    s = spec['slot']
    w, h, g = s['w'], s['h'], s['groove']
    P.rbox('guide', 0, 0, w, h, 0, 1.6, M.brushed('guide-steel', (0.035, 0.035, 0.038), rough=0.44, streak=0.5, direction='Y'), corner=3, edge=0.7, segments=3)
    void = M.void('groove')
    P.rbox('groove', (w - g) / 2, 8, g, h - 16, 1.5, 1.66, void, corner=g / 2)
    # Raised lips along the groove catch the light on the left and throw a shadow on the right.
    lip = M.nickel('groove-lip', 0.3)
    for x in ((w - g) / 2 - 1.0, (w + g) / 2):
        P.rbox('lip', x, 7, 1.0, h - 14, 1.6, 2.3, lip, corner=0.5, edge=0.25, segments=2)
    for y in (4.5, h - 4.5):
        P.screw(w / 2, y, 1.6, 1.6, M.nickel('guide-screw', 0.34), void, turn=y * 9)
    _flat(w, h, samples)


def bank(spec, samples):
    """The tray the strips sit in: a darker frame with a recessed floor."""
    reset(samples)
    b = spec['bank']
    w, h = b['w'], b['h']
    rim = M.anodized('bank', (0.016, 0.016, 0.018), rough=0.5)
    # Four bars, not a boolean frame: a cut flat face shades wrongly (see the amp's plate).
    for (x, y, bw, bh) in ((0, 0, w, 5), (0, h - 5, w, 5), (0, 0, 5, h), (w - 5, 0, 5, h)):
        P.rbox('bank-rim', x, y, bw, bh, 0, 4, rim, corner=2, edge=1.2, segments=3)
    P.rbox('bank-floor', 3, 3, w - 6, h - 6, 0, 1.5, M.plain('bank-floor', (0.006, 0.006, 0.007), 0.7))
    _flat(w, h, samples)


def pictures(spec, samples):
    c, k = spec['cap'], spec['key']
    names = {'cap': 'mixer-cap', 'capMaster': 'mixer-cap-master', 'keyOff': 'mixer-key-off', 'keyMute': 'mixer-key-mute', 'keySolo': 'mixer-key-solo'}
    out = [dict(key=w, file=f'{names[w]}@2x.webp', css=(c['frame']['w'], c['frame']['h']), quality=90, use=f'Fader cap ({w})',
                scenes=[(names[w], lambda w=w: cap(spec, samples, w))], post=lambda im: export.feather(im, 4)) for w in CAPS]
    out += [dict(key=w, file=f'{names[w]}@2x.webp', css=(k['w'], k['h']), quality=92, use=f'Console key ({w}), nine-slice',
                 scenes=[(names[w], lambda w=w: key(spec, samples, w))], post=lambda im: im, extra={'slice': k['slice']}) for w in KEYS]
    names.update({'strip': 'mixer-strip', 'stripGroup': 'mixer-strip-group', 'stripMaster': 'mixer-strip-master'})
    st, sl, bk = spec['strip'], spec['slot'], spec['bank']
    out += [dict(key=w, file=f'{names[w]}@2x.webp', css=(st['w'], st['h']), quality=90, use=f'Channel strip faceplate ({w}), nine-slice',
                 scenes=[(names[w], lambda w=w: strip(spec, samples, w))], post=lambda im: im, extra={'slice': st['slice']}) for w in STRIPS]
    out.append(dict(key='slot', file='mixer-slot@2x.webp', css=(sl['w'], sl['h']), quality=90, use='Fader guide, sliced top and bottom',
                    scenes=[('mixer-slot', lambda: slot(spec, samples))], post=lambda im: im, extra={'slice': sl['slice']}))
    out.append(dict(key='bank', file='mixer-bank@2x.webp', css=(bk['w'], bk['h']), quality=90, use='Tray of a bank of strips, nine-slice',
                    scenes=[('mixer-bank', lambda: bank(spec, samples))], post=lambda im: im, extra={'slice': bk['slice']}))
    return out

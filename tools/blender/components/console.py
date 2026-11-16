"""
Console of the Studio V6: the parts every deck is made of, as nine-slice
sources rendered edge to edge under the kit's light.

- plate: a dark steel tray with a raised anodised faceplate and a screw in
  each corner;
- lcd: a gloss black bezel around a recessed pane of smoked glass (the live
  readout is HTML over it);
- key: the moulded hardware key released, pressed and lit.
"""
from gtlkit import materials as M
from gtlkit import parts as P
from gtlkit.scene import camera, reset, studio_rig

NAME = 'console'
EXPORT = 'CONSOLE_HW'

KEYS = {'keyUp': ((0.02, 0.021, 0.024), False, 5.0), 'keyDown': ((0.013, 0.014, 0.016), False, 2.4), 'keyLit': ((1.0, 0.27, 0.0), True, 5.0)}


def _flat(w, h, key=0.55, fill=0.6):
    # Large flat parts face the lamps squarely: at full power they wash out next to the devices.
    studio_rig(w / 2, h / 2, max(w, h) * 1.2, key=key, fill=fill)
    camera(0, 0, w, h)


def plate(spec, samples):
    reset(samples)
    p = spec['plate']
    w, h = p['w'], p['h']
    P.rbox('tray', 0, 0, w, h, 0, 3, M.plain('tray', (0.01, 0.01, 0.011), 0.42, metal=1.0), corner=p['corner'], edge=1.6, segments=4)
    P.rbox('faceplate', 4, 4, w - 8, h - 8, 2, 4.4, M.anodized('faceplate', (0.05, 0.054, 0.062), rough=0.5), corner=p['corner'] - 2, edge=1.0, segments=4)
    # A fine brass inlay runs round the faceplate, as on the approved V6.7 console (transport and toolbar frames).
    P.outline('inlay', 6.2, 6.2, w - 12.4, h - 12.4, 4.4, M.brushed('inlay-brass', (0.78, 0.52, 0.2), rough=0.36), line=0.9)
    nickel, slot = M.nickel('plate-screw', 0.32), M.void('slot')
    i = p['screwInset']
    for (x, y) in ((i, i), (w - i, i), (i, h - i), (w - i, h - i)):
        P.screw(x, y, 3.0, 4.4, nickel, slot, turn=(x + y * 3) * 2)
    _flat(w, h)


def lcd(spec, samples):
    reset(samples)
    l = spec['lcd']
    w, h, b = l['w'], l['h'], l['bezel']
    gloss = M.plain('lcd-bezel', (0.006, 0.006, 0.007), 0.22, coat=0.6)
    # Bezel of four bars around the glass, which sits lower: no boolean on a flat face.
    for (x, y, bw, bh) in ((0, 0, w, b), (0, h - b, w, b), (0, 0, b, h), (w - b, 0, b, h)):
        P.rbox('bezel', x, y, bw, bh, 0, 4, gloss, edge=1.5, segments=4)
    # The amber-gold lip of the readout's frame (V6.7 reference).
    P.outline('lip', b - 1.6, b - 1.6, w - 2 * b + 3.2, h - 2 * b + 3.2, 4.0, M.brushed('lcd-lip', (0.82, 0.5, 0.14), rough=0.34), line=1.1)
    P.rbox('glass', b - 1, b - 1, w - 2 * b + 2, h - 2 * b + 2, 0, 1.6, M.plain('lcd-glass', (0.0022, 0.0016, 0.001), 0.3, spec=0.25))
    # The glass must stay dark under the amber readout: only a faint sheen from the lamps.
    _flat(w, h, key=0.3, fill=0.25)


def key(spec, samples, which):
    reset(samples)
    k = spec['key']
    color, lit, height = KEYS[which]
    P.rbox('key', 0, 0, k['w'], k['h'], 0, height, M.key_cap('key', color, lit, strength=0.2), corner=k['corner'], edge=2.2, segments=5)
    # Lit from a fixed place: a pressed key is lower, so its bevel catches less light.
    studio_rig(k['w'] / 2, k['h'] / 2, k['w'] * 1.6, key=0.5, fill=0.5)
    camera(0, 0, k['w'], k['h'])


def pictures(spec, samples):
    p, l, k = spec['plate'], spec['lcd'], spec['key']
    same = lambda im: im
    out = [
        dict(key='plate', file='console-plate9@2x.webp', css=(p['w'], p['h']), quality=88, use='Deck plate, nine-slice', scenes=[('console-plate', lambda: plate(spec, samples))], post=same, extra={'slice': p['slice']}),
        dict(key='lcd', file='console-lcd9@2x.webp', css=(l['w'], l['h']), quality=90, use='LCD bezel and glass, nine-slice', scenes=[('console-lcd', lambda: lcd(spec, samples))], post=same, extra={'slice': l['slice']}),
    ]
    names = {'keyUp': 'console-key-up', 'keyDown': 'console-key-down', 'keyLit': 'console-key-lit'}
    out += [dict(key=w, file=f'{names[w]}@2x.webp', css=(k['w'], k['h']), quality=92, use=f'Hardware key ({w}), nine-slice',
                 scenes=[(names[w], lambda w=w: key(spec, samples, w))], post=same, extra={'slice': k['slice']}) for w in KEYS]
    return out

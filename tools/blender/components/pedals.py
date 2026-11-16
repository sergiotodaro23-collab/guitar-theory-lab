"""
The pedals of the Studio V6 pedalboard.

One body per pedal (enclosure, paint, artwork, screws, jacks, the holes of
knobs, LED and switch) and three shared parts under the same light: a knob at
every position (sprite strip), the LED off and lit, the footswitch up and
down. Names and labels stay live HTML. Each pedal is told apart by paint,
finish and artwork; the hardware is the same on all, as on a real maker's line.
"""
from gtlkit import export
from gtlkit import materials as M
from gtlkit import parts as P
from gtlkit.scene import camera, catcher, reset, studio_rig

NAME = 'pedals'
EXPORT = 'PEDALS_HW'


def frame(spec):
    m, s = spec['margin'], spec['size']
    return -m['left'], -m['top'], s['w'] + m['left'] + m['right'], s['h'] + m['top'] + m['bottom']


def knob_xs(spec, count):
    k, w = spec['knobs'], spec['size']['w']
    return [w / 2 + (i - (count - 1) / 2) * k['pitch'] for i in range(count)]


def artwork(spec, pedal, z):
    """The painted graphics that give each pedal its face."""
    W, H = spec['size']['w'], spec['size']['h']
    n, k = spec['name'], spec['knobs']
    paint = M.enamel('art', M.srgb(pedal['artColor']), rough=0.34)
    art = pedal['art']
    if art == 'pinstripes':       # two fine lines above and below the name, a third under the switch
        for y in (n['y'] - 5, n['y'] + n['h'] + 3):
            P.decal('art', 10, y, W - 20, 1.3, z, paint)
            P.decal('art', 10, y + 2.6, W - 20, 0.6, z, paint)
    elif art == 'panel':          # a black control panel behind the knobs
        P.decal('art', 8, 12, W - 16, 58, z, paint, corner=5)
    elif art == 'frame':          # a cream double frame around the foot zone
        top = n['y'] + n['h'] + 4
        P.outline('art', 13, top, W - 26, H - top - 13, z, paint, line=1.5)
        P.outline('art', 16.4, top + 3.4, W - 32.8, H - top - 19.8, z, paint, line=0.6)
    elif art == 'rules':          # graphic-equaliser rules: a scale under every knob, a rule around the name
        for cx in knob_xs(spec, pedal['knobs']):
            if abs(cx - spec['led']['x']) < 12:
                continue   # the LED sits there
            for i in range(5):
                P.decal('art', cx - (7 if i % 2 == 0 else 4), n['y'] + n['h'] + 4 + i * 2.6, 14 if i % 2 == 0 else 8, 0.8, z, paint)
        P.decal('art', 10, n['y'] - 4, W - 20, 1.0, z, paint)
    elif art == 'band':           # a dark band across the face, behind the name
        P.decal('art', 0.5, n['y'] - 5, W - 1, n['h'] + 10, z, paint)
    elif art == 'footplate':      # bare metal above, a black rubberised plate under the foot
        P.decal('art', 8, n['y'] + n['h'] + 6, W - 16, H - (n['y'] + n['h'] + 6) - 8, z, M.rubber('art'), corner=5)
        P.decal('art', 10, n['y'] - 4, W - 20, 1.0, z, paint)
    elif art == 'arches':         # concentric rings around the switch: a room's echo
        s = spec['switch']
        for r in (23, 29, 35):
            ring = P.cyl('art', s['x'], s['y'], r, z - 0.2, z + 0.12, paint, verts=96)
            P.cut(ring, P.cyl('art-cut', s['x'], s['y'], r - 1.0, z - 2, z + 2, verts=96))


def body(spec, pedal_id, samples):
    reset(samples)
    pedal = spec['pedals'][pedal_id]
    W, H, Z = spec['size']['w'], spec['size']['h'], spec['height']
    color = M.deepen(M.srgb(pedal['paint']))
    paint = M.brushed('paint', (0.78, 0.78, 0.8), rough=0.36, streak=0.5, direction='Y') if pedal['finish'] == 'brushed' else M.painted('paint', color, pedal['finish'])
    P.enclosure(0, 0, W, H, Z, paint, corner=spec['corner'])
    artwork(spec, pedal, Z)
    nickel, slot = M.nickel(), M.void('slot')
    i = spec['screwInset']
    for (sx, sy) in ((i, i), (W - i, i), (i, H - i), (W - i, H - i)):
        P.screw(sx, sy, 2.4, Z, nickel, slot, turn=(sx * 3 + sy) * 5)
    k = spec['knobs']
    for cx in knob_xs(spec, pedal['knobs']):
        # Nut and washer of the potentiometer: seen as a bright rim around the knob's foot.
        P.cyl('pot-washer', cx, k['y'], k['diameter'] * 0.56, Z, Z + 0.5, nickel, verts=48)
    led, sw = spec['led'], spec['switch']
    P.cyl('led-well', led['x'], led['y'], led['r'] + 0.5, Z - 1, Z + 0.06, slot, verts=32)
    P.cyl('switch-well', sw['x'], sw['y'], sw['r'] * 0.7, Z - 1, Z + 0.06, slot, verts=48)
    for side, x in ((-1, 0), (1, W)):
        P.side_jack(x, spec['jackY'], side, Z * 0.45)
    fx, fy, fw, fh = frame(spec)
    catcher(fx, fy, fw, fh)
    # Lit as one pedal of a row: the rig is sized on the pedal's height.
    studio_rig(W / 2, H / 2, H * 1.25)
    camera(fx, fy, fw, fh)


def _part(size, samples):
    reset(samples)
    catcher(0, 0, size, size)
    studio_rig(size / 2, size / 2, size * 1.6)
    camera(0, 0, size, size)


def knob(spec, samples, angle):
    k = spec['knobs']
    _part(k['frame'], samples)
    P.barrel_knob(k['frame'] / 2, k['frame'] / 2, k['diameter'], angle=angle)


def knob_angles(spec):
    k = spec['knobs']
    return [-k['sweep'] / 2 + k['sweep'] * i / (k['frames'] - 1) for i in range(k['frames'])]


def led(spec, samples, lit):
    f = spec['led']['frame']
    _part(f, samples)
    P.led(f / 2, f / 2, spec['led']['r'], 0, lit)


def switch(spec, samples, pressed):
    f = spec['switch']['frame']
    _part(f, samples)
    P.footswitch(f / 2, f / 2, spec['switch']['r'], 0, pressed)


def pictures(spec, samples):
    k, lf, sf = spec['knobs'], spec['led']['frame'], spec['switch']['frame']
    fx, fy, fw, fh = frame(spec)
    angles = knob_angles(spec)
    part = max(32, samples // 2)
    out = [
        dict(key=f'body-{pid}', file=f'pedal-{pid}@2x.webp', css=(fw, fh), quality=88, use=f'Pedal body: {pid}',
             scenes=[(f'pedal-{pid}', lambda pid=pid: body(spec, pid, samples))], post=lambda im: export.feather(im, 6), extra={'offset': [fx, fy]})
        for pid in spec['pedals']
    ]
    out.append(dict(key='knob', file='pedal-knob-strip@2x.webp', css=(k['frame'] * k['frames'], k['frame']), quality=86, use='Pedal knob at every position of its travel (sprite strip)',
                    scenes=[('pedal-knob' if i == len(angles) // 2 else f'pedal-knob-{i:02d}', lambda a=a: knob(spec, part, a)) for i, a in enumerate(angles)],
                    post=lambda im: export.vignette(im, 0.8, 0.98), extra={'frames': k['frames'], 'frame': [k['frame'], k['frame']]}))
    for lit in (False, True):
        out.append(dict(key='ledOn' if lit else 'ledOff', file=f"pedal-led-{'on' if lit else 'off'}@2x.webp", css=(lf, lf), quality=92, use='Pedal LED, lit' if lit else 'Pedal LED, off',
                        scenes=[(f"pedal-led-{'on' if lit else 'off'}", lambda lit=lit: led(spec, samples, lit))], post=lambda im: export.vignette(im, 0.7, 0.98)))
    for pressed in (False, True):
        out.append(dict(key='switchDown' if pressed else 'switchUp', file=f"pedal-switch-{'down' if pressed else 'up'}@2x.webp", css=(sf, sf), quality=90, use='Footswitch, pressed' if pressed else 'Footswitch, released',
                        scenes=[(f"pedal-switch-{'down' if pressed else 'up'}", lambda pressed=pressed: switch(spec, samples, pressed))], post=lambda im: export.vignette(im, 0.8, 0.98)))
    return out

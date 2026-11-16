"""
Amplifier head of the Studio V6 rack: the reference component of the kit.

Three pictures, all from specs/amp.json:
- the body (cabinet, grille, badge, control plate with its marks), without
  anything that moves or lights up;
- one knob, rendered at every position of its travel under the same light
  (a sprite strip): the highlight stays where the light is while the pointer
  turns, which a rotated bitmap cannot do;
- the pilot lamp, off and lit.
Labels, the model name and the tape are live HTML over the body: they change
with the state and stay sharp at any zoom.
"""
import bpy

from gtlkit import materials as M
from gtlkit import parts as P
from gtlkit.scene import camera, catcher, px, reset, studio_rig


def frame(spec):
    """The CSS rectangle of the body picture: the device plus its shadow margin."""
    m, s = spec['margin'], spec['size']
    return -m['left'], -m['top'], s['w'] + m['left'] + m['right'], s['h'] + m['top'] + m['bottom']


def body(spec, samples):
    reset(samples)
    W, H = spec['size']['w'], spec['size']['h']
    Z = P.Z_CABINET
    tolex = M.tolex()
    cab = spec['cabinet']
    cabinet = P.rbox('cabinet', 0, 0, W, H, 0, Z, tolex, corner=cab['corner'], edge=4.0, segments=6)

    # Grille: a recess in the cabinet, cloth at the bottom, cream piping around the opening.
    g = spec['grille']
    P.cut(cabinet, P.rbox('grille-cut', g['x'], g['y'], g['w'], g['h'], Z - 7, Z + 10, corner=g['corner']))
    P.rbox('grille-cloth', g['x'] - 1, g['y'] - 1, g['w'] + 2, g['h'] + 2, Z - 9, Z - 6.5, M.grille_cloth(), corner=g['corner'])
    pipe = P.rbox('piping', g['x'] - 2.2, g['y'] - 2.2, g['w'] + 4.4, g['h'] + 4.4, Z - 2, Z + 1.6, M.piping(), corner=g['corner'] + 2, edge=1.5, segments=4)
    P.cut(pipe, P.rbox('piping-cut', g['x'], g['y'], g['w'], g['h'], Z - 12, Z + 12, corner=g['corner']))

    # Badge: a brass plate on the cloth; the model name is live text over it.
    b = spec['badge']
    brass = M.brushed('badge-brass', (0.76, 0.5, 0.18), rough=0.34, streak=0.4)
    P.rbox('badge', b['x'], b['y'], b['w'], b['h'], Z - 6.5, Z - 4.2, brass, corner=3, edge=0.9, segments=3)
    slot = M.void('slot')
    nickel = M.nickel()
    for sx in (b['x'] + 6, b['x'] + b['w'] - 6):
        P.screw(sx, b['y'] + b['h'] / 2, 1.7, Z - 4.2, nickel, slot, turn=sx * 7)

    # Control plate: brushed gold, four screws, a mark ring for every knob, a well for the lamp.
    p = spec['plate']
    gold = M.brushed('plate-gold', (0.84, 0.5, 0.14), rough=0.38, streak=0.45)
    P.rbox('plate', p['x'], p['y'], p['w'], p['h'], Z, Z + P.Z_PLATE, gold, corner=p['corner'], edge=0.8, segments=3)
    top = Z + P.Z_PLATE
    for (sx, sy) in ((p['x'] + 7, p['y'] + 7), (p['x'] + p['w'] - 7, p['y'] + 7), (p['x'] + p['w'] - 7, p['y'] + p['h'] - 7), (p['x'] + 7, p['y'] + p['h'] - 7)):
        P.screw(sx, sy, 2.3, top, nickel, slot, turn=(sx + sy) * 3)
    k = spec['knobs']
    ink = M.ink()
    for i in range(len(k['ids'])):
        cx = k['first'] + k['pitch'] * i
        P.tick_ring(cx, k['y'], k['tickRadius'], top, ink, sweep=k['sweep'], start=-k['sweep'] / 2)
        # The shaft hole under the knob: seen only at the rim, it grounds the knob on the plate.
        P.cyl('shaft-hole', cx, k['y'], k['diameter'] * 0.3, top - 1.5, top + 0.05, slot, verts=32)
    lamp = spec['lamp']
    # The lamp's well is a dark disc on the plate, not a boolean hole: cutting the plate turned its flat top into an
    # n-gon whose hardened normals shaded as a diagonal band across the whole plate.
    P.cyl('lamp-well', lamp['x'], lamp['y'], lamp['r'] + 0.6, top - 1.5, top + 0.05, slot, verts=40)

    # Corner protectors.
    black = M.plain('corner-black', (0.012, 0.012, 0.012), rough=0.4, coat=0.3)
    c = cab['cornerCap']
    for (x, y, sx, sy) in ((0, 0, 1, 1), (W, 0, -1, 1), (0, H, 1, -1), (W, H, -1, -1)):
        P.corner_cap(x - sx * 1.2, y - sy * 1.2, sx, sy, c, Z + 2.2, black)

    fx, fy, fw, fh = frame(spec)
    catcher(fx, fy, fw, fh)
    studio_rig(W / 2, H / 2, W)
    camera(fx, fy, fw, fh)


def knob(spec, samples, angle):
    """One knob on a shadow catcher at the plate's height, turned to `angle` degrees."""
    reset(samples)
    k = spec['knobs']
    c = k['frame'] / 2
    P.skirted_knob(c, c, k['diameter'], angle=angle)
    catcher(0, 0, k['frame'], k['frame'])
    studio_rig(c, c, k['frame'] * 1.6, key=1.0, fill=1.0)
    camera(0, 0, k['frame'], k['frame'])


def knob_angles(spec):
    k = spec['knobs']
    n = k['frames']
    return [-k['sweep'] / 2 + k['sweep'] * i / (n - 1) for i in range(n)]


def lamp(spec, samples, lit):
    reset(samples)
    l = spec['lamp']
    c = l['frame'] / 2
    P.pilot_lamp(c, c, l['r'], 0, lit)
    catcher(0, 0, l['frame'], l['frame'])
    studio_rig(c, c, l['frame'] * 1.6)
    camera(0, 0, l['frame'], l['frame'])
    if lit:
        bpy.context.scene.view_settings.look = 'AgX - Medium High Contrast'


NAME = 'amp'
EXPORT = 'AMP_HEAD'


def pictures(spec, samples):
    """What the build renders: see build.py for the fields."""
    from gtlkit import export
    k, f = spec['knobs'], spec['lamp']['frame']
    fx, fy, fw, fh = frame(spec)
    angles = knob_angles(spec)
    return [
        dict(key='body', file='amp-body@2x.webp', css=(fw, fh), quality=90, use='Amplifier head: cabinet, grille, badge, control plate',
             scenes=[('amp-body', lambda: body(spec, samples))], post=lambda im: export.feather(im, 8), extra={'offset': [fx, fy]}),
        dict(key='knob', file='amp-knob-strip@2x.webp', css=(k['frame'] * k['frames'], k['frame']), quality=88, use='Amplifier knob at every position of its travel (sprite strip)',
             scenes=[('amp-knob' if i == len(angles) // 2 else f'amp-knob-{i:02d}', lambda a=a: knob(spec, max(24, samples // 2), a)) for i, a in enumerate(angles)],
             post=lambda im: export.vignette(im, 0.8, 0.98), extra={'frames': k['frames'], 'frame': [k['frame'], k['frame']]}),
        dict(key='lampOff', file='amp-lamp-off@2x.webp', css=(f, f), quality=92, use='Pilot lamp, off',
             scenes=[('amp-lamp-off', lambda: lamp(spec, samples, False))], post=lambda im: export.vignette(im, 0.72, 0.98)),
        dict(key='lampOn', file='amp-lamp-on@2x.webp', css=(f, f), quality=92, use='Pilot lamp, lit',
             scenes=[('amp-lamp-on', lambda: lamp(spec, samples, True))], post=lambda im: export.vignette(im, 0.72, 0.98)),
    ]

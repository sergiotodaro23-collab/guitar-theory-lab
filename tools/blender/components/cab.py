"""
Loudspeaker cabinet of the Studio V6 rack: tolex, piping, an open-weave
grille cloth with two speakers seen faintly behind it, a small brass badge.
One picture: nothing on a cabinet moves. It shares cabinet height, corner
protectors, tolex and piping with the amplifier head that sits above it.
"""
from gtlkit import export
from gtlkit import materials as M
from gtlkit import parts as P
from gtlkit.scene import camera, catcher, reset, studio_rig

NAME = 'cab'
EXPORT = 'CAB_HW'


def frame(spec):
    m, s = spec['margin'], spec['size']
    return -m['left'], -m['top'], s['w'] + m['left'] + m['right'], s['h'] + m['top'] + m['bottom']


def body(spec, samples):
    reset(samples)
    W, H, Z = spec['size']['w'], spec['size']['h'], P.Z_CABINET
    cab, g = spec['cabinet'], spec['grille']
    cabinet = P.rbox('cabinet', 0, 0, W, H, 0, Z, M.tolex(), corner=cab['corner'], edge=4.0, segments=6)
    P.cut(cabinet, P.rbox('grille-cut', g['x'], g['y'], g['w'], g['h'], Z - 26, Z + 10, corner=g['corner']))
    # The baffle behind the speakers, the speakers, then the cloth in front of them.
    P.rbox('baffle', g['x'] - 1, g['y'] - 1, g['w'] + 2, g['h'] + 2, Z - 27, Z - 25, M.plain('baffle', (0.012, 0.011, 0.01), 0.8))
    for s in spec['speakers']:
        P.speaker(s['x'], s['y'], s['r'], Z - 8.5)
    cloth = P.rbox('grille-cloth', g['x'] - 1, g['y'] - 1, g['w'] + 2, g['h'] + 2, Z - 7.2, Z - 6.5, M.grille_cloth(open_weave=0.1), corner=g['corner'])
    # The cloth casts no shadow: the room's light reaches the cones as it does through a real open weave.
    cloth.visible_shadow = False
    pipe = P.rbox('piping', g['x'] - 2.2, g['y'] - 2.2, g['w'] + 4.4, g['h'] + 4.4, Z - 2, Z + 1.6, M.piping(), corner=g['corner'] + 2, edge=1.5, segments=4)
    P.cut(pipe, P.rbox('piping-cut', g['x'], g['y'], g['w'], g['h'], Z - 12, Z + 12, corner=g['corner']))
    b = spec['badge']
    P.rbox('badge', b['x'], b['y'], b['w'], b['h'], Z - 6.5, Z - 4.6, M.brushed('badge-brass', (0.76, 0.5, 0.18), rough=0.34, streak=0.4), corner=2, edge=0.6, segments=3)
    black = M.plain('corner-black', (0.012, 0.012, 0.012), rough=0.4, coat=0.3)
    for (x, y, sx, sy) in ((0, 0, 1, 1), (W, 0, -1, 1), (0, H, 1, -1), (W, H, -1, -1)):
        P.corner_cap(x - sx * 1.2, y - sy * 1.2, sx, sy, cab['cornerCap'], Z + 2.2, black)
    fx, fy, fw, fh = frame(spec)
    catcher(fx, fy, fw, fh)
    studio_rig(W / 2, H / 2, W)
    camera(fx, fy, fw, fh)


def pictures(spec, samples):
    fx, fy, fw, fh = frame(spec)
    return [dict(key='body', file='cab-body@2x.webp', css=(fw, fh), quality=88, use='Loudspeaker cabinet: tolex, grille cloth, two speakers behind it',
                 scenes=[('cab-body', lambda: body(spec, samples))], post=lambda im: export.feather(im, 8), extra={'offset': [fx, fy]})]

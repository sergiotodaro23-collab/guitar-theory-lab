"""
Wood of the Studio V6.

- board: the face of a fretboard, maple for the main one and rosewood for
  the preview of the next chord. Only the wood: frets, nut, inlays, strings,
  markers and every note stay SVG over it.
- rail: the walnut plank of the left rail, a nine-slice source with a screw
  in every corner.
"""
from gtlkit import materials as M
from gtlkit import parts as P
from gtlkit.scene import camera, reset, studio_rig

NAME = 'frame'
EXPORT = 'FRAME_HW'

BOARDS = {'boardMaple': M.maple, 'boardRosewood': M.rosewood}


def board(spec, samples, which):
    reset(samples)
    b = spec['board']
    P.rbox('board', -4, -4, b['w'] + 8, b['h'] + 8, 0, 3, BOARDS[which]())
    # Even light: the picture is stretched to the board, a hot spot would travel with the window's size.
    studio_rig(b['w'] / 2, b['h'] / 2, b['w'] * 1.3, key=0.75, fill=1.0)
    camera(0, 0, b['w'], b['h'])


def rail(spec, samples):
    reset(samples)
    r = spec['rail']
    w, h = r['w'], r['h']
    P.rbox('rail', 0, 0, w, h, 0, 5, M.walnut(), corner=r['corner'], edge=2.2, segments=5)
    brass, slot = M.brushed('rail-screw', (0.72, 0.5, 0.2), rough=0.34), M.void('slot')
    i = r['screwInset']
    for (x, y) in ((i, i), (w - i, i), (i, h - i), (w - i, h - i)):
        P.screw(x, y, 2.8, 5, brass, slot, turn=(x * 2 + y) * 3)
    studio_rig(w / 2, h / 2, h * 1.0, key=0.6, fill=0.7)
    camera(0, 0, w, h)


def pictures(spec, samples):
    b, r = spec['board'], spec['rail']
    same = lambda im: im
    names = {'boardMaple': 'board-maple', 'boardRosewood': 'board-rosewood'}
    out = [dict(key=w, file=f'{names[w]}@2x.webp', css=(b['w'], b['h']), quality=74, use=f'Fretboard face ({w}), stretched under the SVG fretboard',
                scenes=[(names[w], lambda w=w: board(spec, max(48, samples // 2), w))], post=same) for w in BOARDS]
    out.append(dict(key='rail', file='frame-rail9@2x.webp', css=(r['w'], r['h']), quality=82, use='Walnut rail, nine-slice',
                    scenes=[('frame-rail', lambda: rail(spec, samples))], post=same, extra={'slice': r['slice']}))
    return out

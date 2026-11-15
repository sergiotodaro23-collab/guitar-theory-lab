"""Scene set-up shared by every component: units, camera, light rig, render."""
import math
import os

import bpy
from mathutils import Vector

U = 0.01  # 1 CSS px in Blender units


def px(v: float) -> float:
    return v * U


def reset(samples: int = 96, seed: int = 7):
    """An empty Cycles scene with the kit's colour and sampling settings."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    s.cycles.device = 'CPU'
    s.cycles.samples = samples
    s.cycles.seed = seed  # fixed: a re-render of unchanged code gives the same picture
    s.cycles.use_denoising = True
    s.cycles.use_adaptive_sampling = True
    s.cycles.max_bounces = 6
    s.render.film_transparent = True
    s.render.image_settings.file_format = 'PNG'
    s.render.image_settings.color_mode = 'RGBA'
    s.render.image_settings.color_depth = '8'
    s.view_settings.view_transform = 'AgX'
    s.view_settings.look = 'AgX - Medium High Contrast'
    world = bpy.data.worlds.new('GTLWorld')
    s.world = world
    try:
        world.use_nodes = True
    except Exception:
        pass
    bg = world.node_tree.nodes['Background']
    bg.inputs[0].default_value = (0.05, 0.05, 0.055, 1)
    bg.inputs[1].default_value = 1.0
    return s


def look_at(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


# The one light of the Studio: where it comes from and what colour it is.
KEY_DIRECTION = (-0.52, 0.52, 0.68)   # from the upper left, towards the viewer
KEY_COLOR = (1.0, 0.95, 0.88)
FILL_COLOR = (0.92, 0.95, 1.0)


def studio_rig(cx: float, cy: float, span: float, key: float = 1.0, fill: float = 1.0):
    """
    The standard light for a subject centred at CSS (cx, cy) and `span` CSS px
    wide. Distances and sizes scale with the subject, energies with its area,
    so a knob and a whole chassis get the same highlights and shadow angle.
    """
    c = Vector((px(cx), -px(cy), 0))
    r = px(span)
    d = Vector(KEY_DIRECTION).normalized()
    bpy.ops.object.light_add(type='AREA', location=c + d * r * 1.9)
    k = bpy.context.object
    k.name = 'key'
    k.data.size = r * 0.75
    k.data.energy = 62 * r * r * key
    k.data.color = KEY_COLOR
    look_at(k, c)
    bpy.ops.object.light_add(type='AREA', location=c + Vector((0, 0, r * 1.6)))
    f = bpy.context.object
    f.name = 'fill'
    f.data.size = r * 2.2
    f.data.energy = 7 * r * r * fill
    f.data.color = FILL_COLOR
    return k, f


def camera(x0: float, y0: float, w: float, h: float, scale: int = 2):
    """Orthographic camera framing the CSS rectangle (x0, y0, w, h); `scale` device pixels per CSS px."""
    s = bpy.context.scene
    bpy.ops.object.camera_add(location=(px(x0 + w / 2), -px(y0 + h / 2), 20))
    c = bpy.context.object
    c.data.type = 'ORTHO'
    c.data.ortho_scale = px(max(w, h))
    c.data.clip_end = 100
    s.camera = c
    s.render.resolution_x = int(round(w * scale))
    s.render.resolution_y = int(round(h * scale))
    s.render.resolution_percentage = 100
    return c


def catcher(x0: float, y0: float, w: float, h: float, z: float = 0.0):
    """A shadow catcher under the subject: the shadow ends up in the picture's alpha."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=(px(x0 + w / 2), -px(y0 + h / 2), px(z)))
    p = bpy.context.object
    p.name = 'catcher'
    p.scale = (px(w) * 1.6, px(h) * 1.6, 1)
    p.is_shadow_catcher = True
    return p


def render(path: str):
    s = bpy.context.scene
    os.makedirs(os.path.dirname(path), exist_ok=True)
    s.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path


def save_blend(path: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=path, compress=True)
    backup = path + '1'
    if os.path.exists(backup):
        os.remove(backup)


def rad(deg: float) -> float:
    return math.radians(deg)

# GTL hardware render kit — orthographic top-down Cycles renders in CSS-pixel space.
import bpy, math, os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
U = 0.01  # 1 css px = 0.01 blender units
def P(v): return v * U

def reset(samples=96):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = 'CYCLES'; s.cycles.device = 'CPU'; s.cycles.samples = samples
    s.cycles.use_denoising = True; s.cycles.use_adaptive_sampling = True
    s.render.film_transparent = True
    s.render.image_settings.file_format = 'PNG'; s.render.image_settings.color_mode = 'RGBA'; s.render.image_settings.color_depth = '8'
    s.view_settings.view_transform = 'AgX'; s.view_settings.look = 'AgX - Medium High Contrast'
    s.cycles.max_bounces = 6
    w = bpy.data.worlds.new('W'); s.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.05, 0.05, 0.055, 1); bg.inputs[1].default_value = 1.0
    return s

def lights(key=900, fill=120, cx=0, cy=0, size=10, overhead=True):
    # key: upper-left, 40 deg elevation ; fill: big soft overhead
    bpy.ops.object.light_add(type='AREA', location=(cx - 7, cy + 7, 8))
    k = bpy.context.object; k.data.energy = key; k.data.size = 4; k.data.color = (1.0, 0.95, 0.88)
    k.rotation_euler = (math.radians(-38), math.radians(-38), 0)
    look_at(k, (cx, cy, 0))
    if overhead:
        bpy.ops.object.light_add(type='AREA', location=(cx, cy, 12))
        f = bpy.context.object; f.data.energy = fill; f.data.size = size * 1.6; f.data.color = (0.92, 0.95, 1.0)
    else:
        bpy.ops.object.light_add(type='AREA', location=(cx + 6, cy - 6, 6))
        f = bpy.context.object; f.data.energy = fill; f.data.size = 3; f.data.color = (0.92, 0.95, 1.0); look_at(f, (cx, cy, 0))
    return k, f

def look_at(obj, target):
    from mathutils import Vector
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

def camera(x0, y0, w, h, scale=2):
    s = bpy.context.scene
    bpy.ops.object.camera_add(location=(P(x0 + w / 2), -P(y0 + h / 2), 20))
    c = bpy.context.object; c.data.type = 'ORTHO'; c.data.ortho_scale = P(max(w, h)); c.data.clip_end = 100
    s.camera = c; s.render.resolution_x = int(w * scale); s.render.resolution_y = int(h * scale); s.render.resolution_percentage = 100
    return c

def catcher(x0, y0, w, h):
    bpy.ops.mesh.primitive_plane_add(size=1, location=(P(x0 + w / 2), -P(y0 + h / 2), 0))
    p = bpy.context.object; p.scale = (P(w) * 1.5, P(h) * 1.5, 1); p.is_shadow_catcher = True
    return p

def _bsdf(m):
    return m.node_tree.nodes['Principled BSDF']

def mat(name, color, rough=0.5, metal=0.0, bump=0.0, bump_scale=900.0, brushed=False, emit=None, emit_str=0.0, coat=0.0, aniso=0.0, spec=0.5, transmission=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = _bsdf(m)
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    b.inputs['Specular IOR Level'].default_value = spec
    if coat: b.inputs['Coat Weight'].default_value = coat
    if aniso: b.inputs['Anisotropic'].default_value = aniso
    if transmission: b.inputs['Transmission Weight'].default_value = transmission
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = emit_str
    if bump or brushed:
        tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); nz = nt.nodes.new('ShaderNodeTexNoise')
        nt.links.new(tc.outputs['Object'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], nz.inputs['Vector'])
        nz.inputs['Scale'].default_value = bump_scale; nz.inputs['Detail'].default_value = 8; nz.inputs['Roughness'].default_value = 0.6
        if brushed: mp.inputs['Scale'].default_value = (1, 160, 1); nz.inputs['Scale'].default_value = 60
        bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump if bump else 0.15; bp.inputs['Distance'].default_value = 0.002
        nt.links.new(nz.outputs['Fac'], bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
        # roughness variation
        if not brushed:
            nz2 = nt.nodes.new('ShaderNodeTexNoise'); nt.links.new(tc.outputs['Object'], nz2.inputs['Vector']); nz2.inputs['Scale'].default_value = 6; nz2.inputs['Detail'].default_value = 3
            mr2 = nt.nodes.new('ShaderNodeMapRange'); mr2.inputs['To Min'].default_value = rough * 0.75; mr2.inputs['To Max'].default_value = min(1, rough * 1.3)
            nt.links.new(nz2.outputs['Fac'], mr2.inputs['Value']); nt.links.new(mr2.outputs['Result'], b.inputs['Roughness'])
            return m
        mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['To Min'].default_value = rough * 0.8; mr.inputs['To Max'].default_value = min(1, rough * 1.25)
        nt.links.new(nz.outputs['Fac'], mr.inputs['Value']); nt.links.new(mr.outputs['Result'], b.inputs['Roughness'])
    return m

def bevel(o, w, seg=4, angle=None):
    md = o.modifiers.new('bev', 'BEVEL'); md.width = w; md.segments = seg; md.limit_method = 'ANGLE'
    if angle: md.angle_limit = math.radians(angle)
    md.harden_normals = True
    return md

def box(name, x, y, w, h, z0, z1, m=None, bev=0.0, seg=4, corner=0.0):
    """CSS rect (x,y,w,h) from z0..z1 (css px). corner: rounded vertical corners radius (css px)."""
    if corner > 0:
        bpy.ops.mesh.primitive_cube_add(size=1)
        o = bpy.context.object
        o.scale = (P(w), P(h), P(z1 - z0)); bpy.ops.object.transform_apply(scale=True)
        # round vertical edges first
        import bmesh
        bm = bmesh.new(); bm.from_mesh(o.data)
        vert_edges = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > 1e-6]
        bmesh.ops.bevel(bm, geom=vert_edges, offset=P(corner), segments=10, affect='EDGES', profile=0.5)
        bm.to_mesh(o.data); bm.free()
    else:
        bpy.ops.mesh.primitive_cube_add(size=1)
        o = bpy.context.object; o.scale = (P(w), P(h), P(z1 - z0)); bpy.ops.object.transform_apply(scale=True)
    o.location = (P(x + w / 2), -P(y + h / 2), P((z0 + z1) / 2)); o.name = name
    if bev: bevel(o, P(bev), seg, 60)
    if m: o.data.materials.append(m)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40)) if hasattr(bpy.ops.object, 'shade_smooth_by_angle') else None
    return o

def cyl(name, x, y, r, z0, z1, m=None, bev=0.0, verts=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=P(r), depth=P(z1 - z0), location=(P(x), -P(y), P((z0 + z1) / 2)))
    o = bpy.context.object; o.name = name
    if bev: bevel(o, P(bev), 4, 60)
    if m: o.data.materials.append(m)
    try: bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
    except Exception: pass
    return o

def cut(target, cutter, mode='DIFFERENCE'):
    md = target.modifiers.new('cut', 'BOOLEAN'); md.operation = mode; md.object = cutter; md.solver = 'EXACT'
    cutter.hide_render = True; cutter.display_type = 'WIRE'
    return md

def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join(); o = bpy.context.object; o.name = name
    return o

def screw(x, y, r, z, m, rot=30, mslot=None):
    head = cyl('screw', x, y, r, z, z + r * 0.45, m, bev=r * 0.35, verts=48)
    dk = mslot or mat('screwslot', (0.02, 0.02, 0.02), rough=0.8)
    for k in (0, 90):
        bpy.ops.mesh.primitive_cube_add(size=1)
        c = bpy.context.object; c.scale = (P(r * 1.25), P(r * 0.24), P(r * 0.2)); c.location = (P(x), -P(y), P(z + r * 0.4))
        c.rotation_euler = (0, 0, math.radians(rot + k)); c.data.materials.append(dk)
    return head

def text(s, x, y, size, z, m, align='CENTER', extrude=0.4, font=None, bold=False):
    bpy.ops.object.text_add(location=(P(x), -P(y), P(z)))
    t = bpy.context.object; t.data.body = s; t.data.size = P(size); t.data.extrude = P(extrude)
    t.data.align_x = align; t.data.align_y = 'CENTER'
    if font: t.data.font = bpy.data.fonts.load(font)
    t.data.materials.append(m)
    return t

def render(name):
    s = bpy.context.scene; s.render.filepath = os.path.join(OUT, name)
    if os.environ.get('SAVE_BLEND'):
        bd = os.path.join(os.path.dirname(OUT), 'blend'); os.makedirs(bd, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(bd, name.replace('@2x.png', '.blend')), compress=True)
    if os.environ.get('NORENDER'): return s.render.filepath
    bpy.ops.render.render(write_still=True)
    return s.render.filepath

def knurl_mat(name, color, rough=0.35, metal=1.0, ridges=72, strength=0.6):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = _bsdf(m)
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    tc = nt.nodes.new('ShaderNodeTexCoord'); g = nt.nodes.new('ShaderNodeTexGradient'); g.gradient_type = 'RADIAL'
    nt.links.new(tc.outputs['Object'], g.inputs['Vector'])
    m1 = nt.nodes.new('ShaderNodeMath'); m1.operation = 'MULTIPLY'; m1.inputs[1].default_value = ridges * 6.2831853
    m2 = nt.nodes.new('ShaderNodeMath'); m2.operation = 'SINE'
    nt.links.new(g.outputs['Fac'], m1.inputs[0]); nt.links.new(m1.outputs[0], m2.inputs[0])
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = strength; bp.inputs['Distance'].default_value = 0.002
    nt.links.new(m2.outputs[0], bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m

def cone(name, x, y, r1, r2, z0, z1, m=None, verts=96, bev=0.0):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=P(r1), radius2=P(r2), depth=P(z1 - z0), location=(P(x), -P(y), P((z0 + z1) / 2)))
    o = bpy.context.object; o.name = name
    if bev: bevel(o, P(bev), 3, 50)
    if m: o.data.materials.append(m)
    try: bpy.ops.object.shade_smooth_by_angle(angle=math.radians(50))
    except Exception: pass
    return o

def part_lights(cx, cy):
    lights(key=700, fill=90, cx=cx, cy=cy, size=1.2, overhead=False)

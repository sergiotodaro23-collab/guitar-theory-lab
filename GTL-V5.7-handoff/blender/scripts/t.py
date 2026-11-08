import bpy, time
try: bpy.ops.preferences.addon_enable(module='cycles')
except Exception as e: print('addon',e)
print(bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items.keys())
bpy.ops.wm.read_factory_settings(use_empty=True)
s=bpy.context.scene; s.render.engine='CYCLES'; s.cycles.device='CPU'; s.cycles.samples=32
bpy.ops.mesh.primitive_cylinder_add(radius=1,depth=0.6)
bpy.ops.object.light_add(type='AREA',location=(-3,3,5)); bpy.context.object.data.energy=500
bpy.ops.object.camera_add(location=(0,0,10)); cam=bpy.context.object; cam.data.type='ORTHO'; cam.data.ortho_scale=3; s.camera=cam
s.render.resolution_x=s.render.resolution_y=256; s.render.filepath='/tmp/claude-0/-home-claude/fecb535e-9d56-576d-a6fc-f24f8474f021/scratchpad/bl/t.png'
s.cycles.use_denoising=True
t=time.time(); bpy.ops.render.render(write_still=True); print('t',time.time()-t)

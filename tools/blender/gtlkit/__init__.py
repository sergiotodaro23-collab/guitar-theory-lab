"""GTL hardware kit: Blender scenes for the Studio's skeuomorphic interface.

One convention for every component, so separately rendered pieces fit
together on screen:

- Units: 1 CSS pixel = 0.01 Blender units (`px()`); x to the right, y down
  (as in CSS: scene Y is negated), z towards the viewer.
- Camera: orthographic, straight on. A control drawn at CSS (x, y) is at
  CSS (x, y) in the render: live HTML controls sit exactly on the picture.
- Light: one rig for everything (`scene.studio_rig`): warm key from the
  upper left, cool soft fill from above. It is the direction the CSS
  shadows of the Studio already use.
- Materials: procedural only (`materials`): no image textures, no HDRI, no
  third-party assets. Everything renders from this code alone.
"""

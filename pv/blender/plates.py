"""Cycles background plates for the 3D shots of the motion study.

All geometry is original and procedural (boxes, spheres, cylinders); nothing is modelled after
the reference. Each plate is an image sequence in local shot time: frame f  ->  lt = f / 30 s,
the same `lt` the 2D scene code sees, so 2D overlays stay in sync with the 3D camera.

  blender -b -P plates.py -- <shot> <out_dir> [start end samples scale]

  shots: glass tower cubefield tunnel wall lens kv
"""
import bpy, math, random, sys, os
from mathutils import Vector, noise

FPS = 30
BAR = 4 * 60 / 170

# frames = shot length + a little tail for cross-dissolves / scene overlaps
SHOTS = {
    'glass':     2 * BAR + 0.5,
    'tower':     3 * BAR + 0.5,
    'cubefield': 2 * BAR + 0.3,
    'tunnel':    2 * BAR + 0.3,
    'wall':      2 * BAR + 0.3,
    'lens':      3 * BAR + 0.3,
    'kv':        2 * BAR + 0.3,
}


def hexc(h, a=1.0):
    h = h.lstrip('#')
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, a)


# ---------------------------------------------------------------- scene setup
def reset(samples, scale):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    cy = sc.cycles
    cy.device = 'CPU'
    cy.samples = samples
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = 0.05
    cy.use_denoising = True
    cy.denoiser = 'OPENIMAGEDENOISE'
    cy.max_bounces = 8
    cy.diffuse_bounces = 2
    cy.glossy_bounces = 3
    cy.transmission_bounces = 8
    cy.transparent_max_bounces = 8
    cy.volume_bounces = 0
    cy.caustics_reflective = False
    cy.caustics_refractive = False
    cy.blur_glossy = 1.0
    cy.sample_clamp_indirect = 8
    cy.volume_step_rate = 4
    sc.render.resolution_x = 1280
    sc.render.resolution_y = 720
    sc.render.resolution_percentage = scale
    sc.render.fps = FPS
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = 'JPEG'
    sc.render.image_settings.quality = 92
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Base Contrast'
    sc.render.use_persistent_data = True
    return sc


def world(top, bottom, hdri=None, hdri_strength=0.5, fog=0.0, fog_color=None, rot=0.0, span=(0.49, 0.64)):
    """camera sees a vertical gradient; lighting comes from a bundled studio HDRI"""
    w = bpy.data.worlds.new('W')
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    N, L = nt.nodes, nt.links
    N.clear()
    out = N.new('ShaderNodeOutputWorld')
    tc = N.new('ShaderNodeTexCoord')
    sep = N.new('ShaderNodeSeparateXYZ')
    L.new(tc.outputs['Generated'], sep.inputs[0])  # view direction: same gradient in reflections/refractions
    ramp = N.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = span[0]
    ramp.color_ramp.elements[1].position = span[1]
    ramp.color_ramp.elements[0].color = hexc(bottom)
    ramp.color_ramp.elements[1].color = hexc(top)
    mr = N.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value, mr.inputs['From Max'].default_value = -1, 1
    L.new(sep.outputs['Z'], mr.inputs['Value'])
    L.new(mr.outputs[0], ramp.inputs[0])
    bg_cam = N.new('ShaderNodeBackground')
    L.new(ramp.outputs[0], bg_cam.inputs[0])
    bg_env = N.new('ShaderNodeBackground')
    if hdri:
        path = os.path.join(os.path.dirname(bpy.app.binary_path), '4.2', 'datafiles', 'studiolights', 'world', hdri)
        env = N.new('ShaderNodeTexEnvironment')
        env.image = bpy.data.images.load(path)
        mp = N.new('ShaderNodeMapping')
        mp.inputs['Rotation'].default_value[2] = rot
        tc2 = N.new('ShaderNodeTexCoord')
        L.new(tc2.outputs['Generated'], mp.inputs[0])
        L.new(mp.outputs[0], env.inputs[0])
        L.new(env.outputs[0], bg_env.inputs[0])
    else:
        L.new(ramp.outputs[0], bg_env.inputs[0])
    bg_env.inputs[1].default_value = hdri_strength
    lp = N.new('ShaderNodeLightPath')
    mix = N.new('ShaderNodeMixShader')
    L.new(lp.outputs['Is Diffuse Ray'], mix.inputs[0])  # only diffuse bounces are lit by the HDRI
    L.new(bg_cam.outputs[0], mix.inputs[1])
    L.new(bg_env.outputs[0], mix.inputs[2])
    L.new(mix.outputs[0], out.inputs['Surface'])
    comp(fog, fog_color or bottom)


def comp(fog, fog_color):
    """depth fog from the mist pass (≈100× cheaper than a scattering volume) + soft glow on emitters"""
    sc = bpy.context.scene
    sc.use_nodes = True
    sc.render.use_compositing = True
    nt = sc.node_tree
    N, L = nt.nodes, nt.links
    N.clear()
    rl = N.new('CompositorNodeRLayers')
    co = N.new('CompositorNodeComposite')
    img = rl.outputs['Image']
    if fog > 0:
        sc.view_layers[0].use_pass_mist = True
        ms = sc.world.mist_settings
        ms.start, ms.depth, ms.falloff = 0.0, 2.3 / fog, 'QUADRATIC'
        sc.view_layers[0].use_pass_z = True
        # fog only on geometry: the sky keeps its gradient (mask = depth < 1 km)
        lt = N.new('CompositorNodeMath'); lt.operation = 'LESS_THAN'; lt.inputs[1].default_value = 1000
        L.new(rl.outputs['Depth'], lt.inputs[0])
        m2 = N.new('CompositorNodeMath'); m2.operation = 'MULTIPLY'
        L.new(rl.outputs['Mist'], m2.inputs[0]); L.new(lt.outputs[0], m2.inputs[1])
        mul = N.new('CompositorNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 0.92
        L.new(m2.outputs[0], mul.inputs[0])
        mix = N.new('CompositorNodeMixRGB')
        mix.inputs[2].default_value = hexc(fog_color)
        L.new(mul.outputs[0], mix.inputs[0]); L.new(img, mix.inputs[1])
        img = mix.outputs[0]
    gl = N.new('CompositorNodeGlare')
    gl.glare_type = 'FOG_GLOW'; gl.quality = 'MEDIUM'; gl.threshold = 1.2; gl.mix = -0.75; gl.size = 8
    L.new(img, gl.inputs[0])
    L.new(gl.outputs[0], co.inputs[0])


_mats = {}


def mat(name, color='#ffffff', metal=0.0, rough=0.5, emit=None, strength=0.0, glass=False, ior=1.45,
        coat=0.0, aniso=0.0, flat=False):
    key = (name,)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = hexc(color)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    b.inputs['Coat Weight'].default_value = coat
    b.inputs['Anisotropic'].default_value = aniso
    if glass:
        b.inputs['Transmission Weight'].default_value = 1.0
        b.inputs['IOR'].default_value = ior
    if emit:
        b.inputs['Emission Color'].default_value = hexc(emit)
        b.inputs['Emission Strength'].default_value = strength
    _mats[key] = m
    return m


def obj(mesh_op, name, loc=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0), m=None, bevel=0.0, seg=3, smooth=False, **kw):
    mesh_op(location=loc, **kw)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    o.rotation_euler = rot
    if m:
        o.data.materials.append(m)
    if bevel > 0:
        md = o.modifiers.new('bev', 'BEVEL')
        md.width = bevel
        md.segments = seg
        md.limit_method = 'NONE'
        md.harden_normals = True
        md.use_clamp_overlap = True
        # bevel width is in object space; scale-aware by applying scale first
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if smooth:
        bpy.ops.object.shade_smooth()
    return o


def box(name, loc, size, m, bevel=0.0, rot=(0, 0, 0)):
    return obj(bpy.ops.mesh.primitive_cube_add, name, loc, (size[0] / 2, size[1] / 2, size[2] / 2), rot, m, bevel, size=2)


def sphere(name, loc, r, m, seg=48):
    return obj(bpy.ops.mesh.primitive_uv_sphere_add, name, loc, (r, r, r), (0, 0, 0), m, smooth=True, segments=seg, ring_count=seg // 2)


def cyl(name, loc, r, depth, m, rot=(0, 0, 0), verts=32):
    return obj(bpy.ops.mesh.primitive_cylinder_add, name, loc, (r, r, depth / 2), rot, m, smooth=True, vertices=verts, depth=2, radius=1)


def light(kind, name, loc, energy, color='#ffffff', size=1.0, target=(0, 0, 0), spot=None):
    d = bpy.data.lights.new(name, kind)
    d.energy = energy
    d.color = hexc(color)[:3]
    if kind == 'AREA':
        d.shape = 'DISK'
        d.size = size
    if kind == 'SUN':
        d.angle = size
    if kind == 'SPOT' and spot:
        d.spot_size = spot
        d.spot_blend = 0.6
    o = bpy.data.objects.new(name, d)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    look(o, target)
    return o


def look(o, target):
    d = Vector(target) - Vector(o.location)
    o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def camera(lens=50, fstop=None, focus=10.0, sensor=36):
    d = bpy.data.cameras.new('Cam')
    d.lens = lens
    d.sensor_width = sensor
    d.clip_start = 0.05
    d.clip_end = 400
    if fstop:
        d.dof.use_dof = True
        d.dof.aperture_fstop = fstop
        d.dof.focus_distance = focus
        d.dof.aperture_blades = 6
    o = bpy.data.objects.new('Cam', d)
    bpy.context.scene.collection.objects.link(o)
    bpy.context.scene.camera = o
    return o


class Anim:
    """collect per-frame transforms, then keyframe everything (enables true motion blur)"""
    def __init__(self, n):
        self.n = n
        self.tracks = []

    def add(self, o, fn):
        self.tracks.append((o, fn))

    def bake(self):
        for f in range(-1, self.n + 1):
            lt = f / FPS
            for o, fn in self.tracks:
                r = fn(lt)
                if 'loc' in r:
                    o.location = r['loc']
                    o.keyframe_insert('location', frame=f)
                if 'rot' in r:
                    o.rotation_euler = r['rot']
                    o.keyframe_insert('rotation_euler', frame=f)
                if 'look' in r:
                    look(o, r['look'])
                    o.keyframe_insert('rotation_euler', frame=f)
                if 'scale' in r:
                    o.scale = r['scale']
                    o.keyframe_insert('scale', frame=f)
                if 'focus' in r:
                    o.data.dof.focus_distance = r['focus']
                    o.data.dof.keyframe_insert('focus_distance', frame=f)
                if 'energy' in r:
                    o.data.energy = r['energy']
                    o.data.keyframe_insert('energy', frame=f)
        # keys on every frame → linear interpolation keeps motion-blur sub-frames honest
        for a in bpy.data.actions:
            for fc in a.fcurves:
                for k in fc.keyframe_points:
                    k.interpolation = 'LINEAR'


def smooth01(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


# ---------------------------------------------------------------- shots
def shot_glass(A):
    """glass panes tumble around a dark segmented monolith in morning fog"""
    world('#4d6377', '#e6ecf0', 'sunrise.exr', 0.35, fog=0.018, rot=1.2)
    floor = mat('floor', '#d9e1e7', rough=0.12)
    box('floor', (0, 0, -0.05), (500, 500, 0.1), floor)
    dark = mat('slab', '#39424d', metal=0.85, rough=0.28, aniso=0.4)
    glow = mat('slabglow', '#000000', emit='#bff7f0', strength=9)
    for i in range(9):
        s = box(f'slab{i}', (0, 0, 0.26 + i * 0.47), (1.5, 1.5, 0.42), dark, bevel=0.03)
        d = 1 if i % 2 else -1
        A.add(s, lambda lt, i=i, d=d: {'rot': (0, 0, i * 0.4 + d * lt * 0.35)})
        if i in (2, 6):
            g = box(f'seam{i}', (0, 0, 0.26 + i * 0.47 + 0.23), (1.38, 1.38, 0.035), glow)
            A.add(g, lambda lt, i=i, d=d: {'rot': (0, 0, i * 0.4 + d * lt * 0.35)})
    rnd = random.Random(100)
    for i in range(16):
        rough = 0.02 if i % 3 else 0.28
        gm = mat(f'glass{i % 3 == 0}', '#f4f8fb', rough=rough, glass=True, ior=1.45)
        w, h = rnd.uniform(2.2, 4.2), rnd.uniform(1.6, 3.0)
        a = rnd.uniform(0, math.tau)
        R = rnd.uniform(2.6, 8.5)
        p0 = Vector((math.cos(a) * R, math.sin(a) * R * 0.7 - 0.5, rnd.uniform(0.6, 5.2)))
        v = Vector((rnd.uniform(-0.35, 0.35), rnd.uniform(-0.2, 0.2), rnd.uniform(-0.12, 0.12)))
        r0 = Vector((rnd.uniform(0, 6), rnd.uniform(0, 6), rnd.uniform(0, 6)))
        w0 = Vector((rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3), rnd.uniform(-0.2, 0.2)))
        q = box(f'pane{i}', p0, (w, 0.035, h), gm, bevel=0.012)
        A.add(q, lambda lt, p0=p0, v=v, r0=r0, w0=w0: {'loc': p0 + v * lt, 'rot': tuple(r0 + w0 * lt)})
    light('AREA', 'key', (6, 9, 9), 5200, '#fff4e6', size=6, target=(0, 0, 2))
    light('AREA', 'rim', (-7, 3, 4), 900, '#9fe9ff', size=4, target=(0, 0, 2))
    light('AREA', 'fill', (0, -9, 6), 300, '#ffffff', size=8, target=(0, 0, 2))
    cam = camera(48, fstop=2.2, focus=12.5)
    A.add(cam, lambda lt: {'loc': (0.4 - lt * 0.12, -13.2 + lt * 0.42, 1.7 + lt * 0.08), 'look': (0, 0, 2.3), 'focus': 13.0 - lt * 0.42})


def shot_tower(A):
    """a twisting stack of dark slabs, lit from inside, backlit through haze"""
    world('#1f2a34', '#6a7c8c', 'night.exr', 0.25, fog=0.03)
    box('floor', (0, 0, -0.05), (500, 500, 0.1), mat('tfloor', '#4c5966', rough=0.18))
    dark = mat('tslab', '#2a333d', metal=0.9, rough=0.3, aniso=0.6)
    for i in range(11):
        s = box(f'ts{i}', (0, 0, 0.36 + i * 0.9), (4.0, 4.0, 0.72), dark, bevel=0.05)
        A.add(s, lambda lt, i=i: {'rot': (0, 0, i * 0.17 + lt * (0.25 + (i % 3) * 0.06))})
    cyl('core', (0, 0, 5), 1.2, 10.5, mat('core', '#000000', emit='#f2fbff', strength=14), verts=48)
    back = light('AREA', 'back', (0, 14, 7), 26000, '#e9f4ff', size=5, target=(0, 0, 5))
    light('AREA', 'salmon', (-12, -2, 5), 2200, '#f2a48f', size=5, target=(0, 0, 5))
    light('AREA', 'cyan', (12, 0, 3), 1800, '#6fe6da', size=5, target=(0, 0, 4))
    bar = cyl('lightbar', (0, -3.4, 4), 0.025, 6.5, mat('bar', '#000000', emit='#ffffff', strength=60), rot=(0, math.pi / 2, 0))
    A.add(bar, lambda lt: {'loc': (0, -3.4, 4.6 + math.sin(lt * 1.3) * 1.5)})
    cam = camera(40, fstop=2.8, focus=21)
    A.add(cam, lambda lt: {'loc': (1.2 - lt * 0.3, -21, 1.4 + lt * 0.75), 'look': (0, 0, 3.8 + lt * 0.55)})


def shot_cubefield(A):
    """fly-over of a bevelled voxel city, emissive motes as bokeh, glass sheet slicing the frame"""
    world('#0b0f13', '#2a3643', 'night.exr', 0.3, fog=0.06, span=(0.46, 0.56))
    rnd = random.Random(5)
    dark = mat('cf', '#353d47', metal=0.6, rough=0.32)
    white = mat('cfw', '#d9dde2', rough=0.25, coat=0.5)
    cyan = mat('cfc', '#0c4f4a', emit='#2fd6c6', strength=4)
    for i in range(-10, 11):
        for j in range(-2, 26):
            h = 0.25 + rnd.random() ** 2 * 2.6
            r = rnd.random()
            box(f'c{i}_{j}', (i * 1.0, j * 1.0, h / 2), (0.76, 0.76, h), white if r < 0.07 else dark, bevel=0.04, )
            if 0.07 <= r < 0.11:
                box(f'cc{i}_{j}', (i * 1.0, j * 1.0, h + 0.012), (0.5, 0.5, 0.02), cyan)
    for k in range(40):
        c = '#bff4ff' if k % 3 else '#ffffff'
        sphere(f'mote{k}', (rnd.uniform(-9, 9), rnd.uniform(-2, 26), rnd.uniform(1.5, 5.5)), rnd.uniform(0.05, 0.12),
               mat(f'mote{k % 3}', '#000000', emit=c, strength=30), seg=12)
    gl = box('sheet', (0, 10, 3.2), (40, 0.04, 9), mat('sheet', '#ffffff', rough=0.04, glass=True), rot=(0.9, 0, -0.35))
    light('AREA', 'sky', (0, 10, 20), 9000, '#dbe8f5', size=18, target=(0, 10, 0))
    light('AREA', 'rimc', (-14, 20, 4), 3000, '#6fe6da', size=6, target=(0, 8, 1))
    cam = camera(30, fstop=1.4, focus=8.5)
    A.add(cam, lambda lt: {'loc': (math.sin(lt * 0.4) * 0.6, -5.5 + lt * 2.0, 6.0), 'look': (math.sin(lt * 0.4) * 0.3 - 0.8 + lt * 0.25, 5.5 + lt * 2.0, 0.8)})


def shot_tunnel(A):
    """forward rush through rings of blocks, rolling camera, true motion blur"""
    world('#d8d9db', '#cfd1d4', 'studio.exr', 0.8, fog=0.03, fog_color='#e4e6e8')
    rnd = random.Random(32)
    wm = mat('tw', '#eceef0', rough=0.35)
    dm = mat('td', '#30333a', metal=0.5, rough=0.3)
    cm = mat('tc', '#2fd6c6', rough=0.3, emit='#2fd6c6', strength=0.8)
    for j in range(0, 60):
        for i in range(14):
            h = rnd.random()
            if h < 0.22:
                continue
            a = i / 14 * math.tau + j * 0.27
            R = 3.3 + rnd.random() * 0.6
            sz = (0.7 + h * 0.9, 1.2, 0.5 + rnd.random() * 0.7)
            box(f'b{j}_{i}', (math.cos(a) * R, j * 1.7, math.sin(a) * R), sz, cm if h > 0.9 else dm if h > 0.72 else wm,
                bevel=0.03, rot=(0, -a + math.pi / 2, 0))
    light('SUN', 'sun', (0, 0, 10), 3.0, '#ffffff', size=0.3, target=(0.3, 1, -0.6))
    cam = camera(16)
    A.add(cam, lambda lt: {'loc': (0, lt * 9.5, 0), 'rot': (math.pi / 2, lt * 0.35, 0)})
    sc = bpy.context.scene
    sc.render.use_motion_blur = True
    sc.render.motion_blur_shutter = 0.5


def shot_wall(A):
    """a wall of bevelled cubes breathing in and out under a grazing key light"""
    world('#c9cbce', '#d4d6d8', 'studio.exr', 0.25)
    wm = mat('ww', '#e4e5e7', rough=0.45)
    gm = mat('wg', '#b9bcc0', rough=0.5)
    cubes = []
    for j in range(-8, 9):
        for i in range(-14, 15):
            c = box(f'w{i}_{j}', (i * 1.0, 0, j * 1.0), (0.96, 1.6, 0.96), gm if (i * 7 + j * 3) % 11 == 0 else wm, bevel=0.035)
            A.add(c, lambda lt, i=i, j=j: {'loc': (i * 1.0, -0.9 * (noise.noise(Vector((i * 0.35 + lt * 0.8, j * 0.35 + 3.1, lt * 0.2))) + 0.5), j * 1.0)})
    light('AREA', 'graze', (-18, -3.5, 6), 9000, '#ffffff', size=3, target=(0, 0, 0))
    light('AREA', 'fill', (10, -14, -2), 350, '#e9f7ff', size=10, target=(0, 0, 0))
    cam = camera(50)
    A.add(cam, lambda lt: {'loc': (0.2, -19 + lt * 0.35, 0.3), 'look': (0, 0, 0.3)})


def shot_lens(A):
    """frosted glass sheets, clear spheres and bright bars drifting in a pale void"""
    world('#7d93a6', '#e3eaef', 'interior.exr', 0.8, fog=0.012, fog_color='#eef3f6', rot=0.6)
    rnd = random.Random(900)
    for i in range(22):
        gm = mat(f'lg{i % 2}', '#f6f9fb', rough=0.35 if i % 2 else 0.06, glass=True)
        p0 = Vector((rnd.uniform(-7, 7), rnd.uniform(-2, 8), rnd.uniform(-3.2, 3.2)))
        v = Vector((rnd.uniform(-0.3, 0.3), rnd.uniform(-0.2, 0.2), rnd.uniform(-0.15, 0.15)))
        r0 = Vector((rnd.uniform(0, 6), rnd.uniform(0, 6), rnd.uniform(0, 6)))
        w0 = Vector((rnd.uniform(-0.25, 0.25), rnd.uniform(-0.25, 0.25), rnd.uniform(-0.25, 0.25)))
        q = box(f'lp{i}', p0, (rnd.uniform(1.4, 3.4), 0.04, rnd.uniform(1.0, 2.4)), gm, bevel=0.012)
        A.add(q, lambda lt, p0=p0, v=v, r0=r0, w0=w0: {'loc': p0 + v * lt, 'rot': tuple(r0 + w0 * lt)})
    clear = mat('lsph', '#ffffff', rough=0.0, glass=True, ior=1.5)
    for i in range(9):
        p0 = Vector((rnd.uniform(-4, 4), rnd.uniform(-1, 5), rnd.uniform(-2, 2)))
        s = sphere(f'ls{i}', p0, rnd.uniform(0.15, 0.6), clear)
        A.add(s, lambda lt, p0=p0, k=i: {'loc': p0 + Vector((math.sin(lt * 0.5 + k) * 0.2, 0, math.cos(lt * 0.4 + k) * 0.25))})
    em = mat('lbar', '#000000', emit='#ffffff', strength=12)
    for i in range(34):
        a = rnd.uniform(0, math.tau)
        r = rnd.uniform(1.5, 7)
        sp = rnd.uniform(0.15, 0.4)
        y = rnd.uniform(-1, 9)
        b = box(f'lb{i}', (0, 0, 0), (0.5, 0.05, 0.08), em)
        A.add(b, lambda lt, a=a, r=r, sp=sp, y=y: {'loc': (math.cos(a + lt * sp) * r, y, math.sin(a + lt * sp) * r * 0.55), 'rot': (0, a * 2 + lt, 0)})
    light('AREA', 'top', (0, 2, 10), 2500, '#ffffff', size=10, target=(0, 2, 0))
    cam = camera(35, fstop=2.8, focus=10)
    A.add(cam, lambda lt: {'loc': (math.sin(lt * 0.15) * 1.5, -10 + lt * 0.3, 0.2), 'look': (0, 3, 0)})


def shot_kv(A):
    """original key-visual diorama: a small field-lab outpost on a white pad under a cyan sky"""
    world('#19c7b6', '#eafbf8', 'sunset.exr', 0.6, rot=2.4, span=(0.5, 0.58))
    white = mat('kw', '#eef0f1', rough=0.4)
    off = mat('ko', '#c9cdd1', rough=0.5)
    cyan = mat('kc', '#2fd6c6', rough=0.35)
    coral = mat('kr', '#ff7a5c', rough=0.4)
    ink = mat('kk', '#1b1d21', rough=0.25, metal=0.3)
    glassm = mat('kg', '#cfe9ef', rough=0.05, glass=True)
    box('pad', (0, 0, -0.1), (60, 60, 0.2), mat('kpad', '#f1f2f3', rough=0.55))
    for k in range(-3, 4):  # floor markings
        box(f'mark{k}', (k * 1.1 - 0.4, -2.6, 0.003), (0.55, 0.12, 0.006), coral if k % 2 else ink, rot=(0, 0, 0.35))
    box('ring', (0, 0.3, 0.004), (7.5, 0.06, 0.008), coral, rot=(0, 0, -0.2))
    # main lab module on legs
    box('body', (0, 0.6, 1.25), (3.4, 2.1, 1.5), white, bevel=0.12)
    box('band', (0, 0.6, 1.02), (3.44, 2.14, 0.28), cyan, bevel=0.04)
    box('win', (0.35, -0.46, 1.55), (1.8, 0.03, 0.34), glassm)
    box('winb', (0.35, -0.44, 1.55), (1.84, 0.02, 0.38), ink)
    box('door', (-1.2, -0.46, 1.2), (0.55, 0.03, 1.0), off, bevel=0.02)
    box('roof', (0.4, 0.6, 2.08), (1.6, 1.2, 0.18), off, bevel=0.04)
    for x in (-1.45, 1.45):
        for y in (-0.2, 1.4):
            box(f'leg{x}{y}', (x, y, 0.25), (0.16, 0.16, 0.5), ink, bevel=0.02)
            box(f'foot{x}{y}', (x, y, 0.03), (0.4, 0.4, 0.06), coral, bevel=0.01)
    # sensor mast
    cyl('mast', (1.9, 1.3, 2.3), 0.05, 4.6, off)
    dish = obj(bpy.ops.mesh.primitive_cone_add, 'dish', (1.9, 1.15, 4.1), (0.5, 0.5, 0.18), (1.1, 0, 0), white, smooth=True, vertices=40)
    beacon = sphere('beacon', (1.9, 1.3, 4.66), 0.09, mat('kbeacon', '#000000', emit='#ff7a5c', strength=30), seg=16)
    A.add(beacon, lambda lt: {'scale': (0.09,) * 3 if (lt * 2.8) % 1 < 0.5 else (0.05,) * 3})
    # crates
    rnd = random.Random(45)
    for k, (x, y, s) in enumerate([(-2.6, -0.9, 0.7), (-2.6, -0.9, 0.5), (-3.3, 0.1, 0.6), (2.8, -1.2, 0.55), (3.4, -0.6, 0.45), (-1.9, -1.9, 0.4)]):
        z = s / 2 + (0.7 if k == 1 else 0)
        box(f'crate{k}', (x, y, z), (s, s, s), [off, coral, white, cyan, off, ink][k], bevel=0.03, rot=(0, 0, rnd.uniform(-0.4, 0.4)))
    # striped barrier posts
    for k, x in enumerate((-3.9, 3.9)):
        for q in range(4):
            cyl(f'post{k}{q}', (x, -2.0, 0.15 + q * 0.3), 0.12, 0.3, coral if q % 2 else white, verts=24)
    # geometric plants
    leaf = mat('kleaf', '#7fe4da', rough=0.5)
    leaf2 = mat('kleaf2', '#d8f7f2', rough=0.5)
    for k, (x, y, h) in enumerate([(-4.6, 2.4, 2.4), (-3.6, 3.4, 1.6), (4.5, 2.8, 2.0), (5.4, 1.6, 1.3), (-5.6, 0.2, 1.1), (3.2, 3.8, 2.8)]):
        cyl(f'stem{k}', (x, y, h / 2), 0.05, h, ink, verts=12)
        cn = obj(bpy.ops.mesh.primitive_ico_sphere_add, f'crown{k}', (x, y, h + 0.3), (0.55, 0.55, 0.7), (0, 0, k), leaf if k % 2 else leaf2, subdivisions=1)
        A.add(cn, lambda lt, x=x, y=y, h=h, k=k: {'rot': (math.sin(lt * 1.3 + k) * 0.05, 0, k + lt * 0.1)})
    # hovering drone
    drone = box('drone', (0, 0, 0), (0.6, 0.6, 0.16), ink, bevel=0.03)
    rotors = [cyl(f'rot{q}', (0, 0, 0), 0.22, 0.01, mat('krotor', '#bfc4c9', rough=0.3), verts=24) for q in range(4)]
    def dpos(lt):
        return Vector((-1.2 + lt * 0.35, -1.0, 3.2 + math.sin(lt * 2.1) * 0.15))
    A.add(drone, lambda lt: {'loc': dpos(lt), 'rot': (0.08, -0.12, lt * 0.3)})
    for q, r in enumerate(rotors):
        dx, dy = (0.38 if q % 2 else -0.38), (0.38 if q // 2 else -0.38)
        A.add(r, lambda lt, dx=dx, dy=dy: {'loc': dpos(lt) + Vector((dx, dy, 0.1))})
    light('SUN', 'sun', (0, 0, 10), 4.2, '#fff3e3', size=0.02, target=(-0.5, 0.8, -1))
    light('AREA', 'fill', (-6, -8, 4), 800, '#dff9f6', size=8, target=(0, 0, 1))
    cam = camera(35, fstop=5.6, focus=10.0)
    A.add(cam, lambda lt: {'loc': (0.9 - lt * 0.25, -10.0 + lt * 0.28, 1.0 + lt * 0.03), 'look': (0.1, 0.8, 2.1)})


# ---------------------------------------------------------------- main
def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    name = argv[0]
    out = argv[1]
    n = round(SHOTS[name] * FPS)
    start = int(argv[2]) if len(argv) > 2 else 0
    end = min(int(argv[3]) if len(argv) > 3 else n - 1, n - 1)
    samples = int(argv[4]) if len(argv) > 4 else 24
    scale = int(argv[5]) if len(argv) > 5 else 100
    step = int(argv[6]) if len(argv) > 6 else 1
    sc = reset(samples, scale)
    A = Anim(n)
    globals()['shot_' + name](A)
    A.bake()
    sc.frame_start, sc.frame_end, sc.frame_step = start, end, step
    os.makedirs(out, exist_ok=True)
    sc.render.filepath = os.path.join(out, '')
    sc.render.use_file_extension = True
    bpy.ops.render.render(animation=True)


main()

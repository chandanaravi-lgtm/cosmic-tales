"""
Asset pipeline step 1 (run with Blender's Python, `bpy`).

Converts the user-supplied source models (FBX / .blend / glTF) into lean GLB
files the browser can load quickly. Nothing is generated here: every mesh comes
from the provided files. We only

  * strip non-mesh helpers (cameras, lamps, hidden reference planes),
  * decimate very dense meshes (the Moon FBX alone has 260k polygons),
  * normalise size/origin so the app can scale them predictably,
  * compute a lat/lon calibration for each planet so the app can place
    landing sites at the real coordinates quoted in the data.

Usage:
  python blender_convert.py -- <assets-src dir> <output models dir>
"""
import bpy, bmesh, sys, os, json, math
from mathutils import Vector, Matrix

SRC, OUT = sys.argv[-2], sys.argv[-1]
os.makedirs(OUT, exist_ok=True)
report = {}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def keep_only_meshes(objs=None):
    """Delete everything that is not a renderable, visible mesh with faces."""
    for o in list(bpy.data.objects):
        visible = o.visible_get() and not o.hide_render
        if o.type != 'MESH' or not visible or len(o.data.polygons) == 0:
            bpy.data.objects.remove(o, do_unlink=True)


def bake_and_join(name):
    """Apply modifiers + world transforms and merge into one object."""
    deps = bpy.context.evaluated_depsgraph_get()
    meshes = []
    for o in list(bpy.context.scene.objects):
        ev = o.evaluated_get(deps)
        me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=deps)
        me.transform(o.matrix_world)
        meshes.append(me)
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    objs = []
    for me in meshes:
        ob = bpy.data.objects.new(me.name, me)
        bpy.context.scene.collection.objects.link(ob)
        objs.append(ob)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    return ob


def decimate(ob, target_faces):
    n = len(ob.data.polygons)
    if n <= target_faces:
        return n
    mod = ob.modifiers.new('dec', 'DECIMATE')
    mod.ratio = target_faces / n
    mod.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return len(ob.data.polygons)


def recentre_sphere(ob):
    """Centre on the origin and scale to radius 1."""
    me = ob.data
    c = sum((v.co for v in me.vertices), Vector()) / len(me.vertices)
    me.transform(Matrix.Translation(-c))
    r = max(v.co.length for v in me.vertices)
    me.transform(Matrix.Scale(1.0 / r, 4))


def to_gltf(v):
    """Blender Z-up -> glTF Y-up (what the exporter does)."""
    return Vector((v.x, v.z, -v.y))


def canonical(lat, lon):
    """Must match src/scenes/geo.js -> latLonToCanonical()."""
    la, lo = math.radians(lat), math.radians(lon)
    return Vector((math.cos(la) * math.cos(lo), math.sin(la), -math.cos(la) * math.sin(lo)))


def calibrate(ob):
    """
    Fit a rotation R so that R * canonical(lat, lon) points at the model vertex
    whose UV shows that lat/lon on an equirectangular texture
    (u = 0.5 -> lon 0, v = 1 -> north pole). Kabsch algorithm via SVD.
    """
    import numpy as np
    me = ob.data
    uv = me.uv_layers.active.data
    P, Q = [], []
    step = max(1, len(me.loops) // 6000)
    for li in range(0, len(me.loops), step):
        u, v = uv[li].uv
        if v < 0.03 or v > 0.97:
            continue  # poles are numerically unstable
        lat = (v - 0.5) * 180.0
        lon = (u - 0.5) * 360.0
        P.append(canonical(lat, lon))
        Q.append(to_gltf(me.vertices[me.loops[li].vertex_index].co).normalized())
    P, Q = np.array(P), np.array(Q)
    H = P.T @ Q
    U, S, Vt = np.linalg.svd(H)
    d = np.sign(np.linalg.det(Vt.T @ U.T))
    D = np.diag([1, 1, d])
    R = Vt.T @ D @ U.T
    err = float(np.degrees(np.arccos(np.clip(np.sum((P @ R.T) * Q, axis=1), -1, 1))).mean())
    return R.tolist(), err


def export(path, materials='EXPORT'):
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', export_apply=True,
        export_materials=materials, export_yup=True,
        export_image_format='JPEG', export_jpeg_quality=85,
    )


# ---------------------------------------------------------------- planets
planets = {
    'earth': ('earth/source/Earth.fbx', 20000),
    'moon': ('moon/source/cinematic-moon.fbx', 40000),
    'mars': ('mars/source/Sketchfab_2022_05_13_12_48_11.blend', 20000),
}
for key, (rel, target) in planets.items():
    reset()
    p = os.path.join(SRC, rel)
    if p.endswith('.blend'):
        bpy.ops.wm.open_mainfile(filepath=p)
    else:
        bpy.ops.import_scene.fbx(filepath=p)
    keep_only_meshes()
    ob = bake_and_join(key)
    src_faces = len(ob.data.polygons)
    faces = decimate(ob, target)
    recentre_sphere(ob)
    R, err = calibrate(ob)
    mirrored = False
    if err > 1.0:
        # Some source meshes (the supplied Mars) have UVs mirrored east-west,
        # which would show the planet as a mirror image. Flip U and refit.
        for d in ob.data.uv_layers.active.data:
            d.uv[0] = 1.0 - d.uv[0]
        R, err = calibrate(ob)
        mirrored = True
    # Geometry only: textures are attached in the app so we can swap 2K/4K (LOD).
    export(os.path.join(OUT, f'{key}.glb'), materials='NONE')
    report[key] = {'sourceFaces': src_faces, 'faces': faces, 'latLonRotation': R, 'calibrationErrorDeg': round(err, 3), 'uvMirrorFixed': mirrored}
    print('DONE', key, report[key]['faces'], 'err', err)

# ---------------------------------------------------------------- sun
reset()
bpy.ops.import_scene.fbx(filepath=os.path.join(SRC, 'sun/source/UnstableStar.fbx'))
keep_only_meshes()
core = bpy.data.objects.get('UnstableStarCore')
for o in list(bpy.data.objects):
    if o is not core:
        bpy.data.objects.remove(o, do_unlink=True)
ob = bake_and_join('sun')
recentre_sphere(ob)
export(os.path.join(OUT, 'sun.glb'), materials='NONE')
report['sun'] = {'faces': len(ob.data.polygons)}


def legacy_to_principled(mat):
    """
    The Apollo .blend (Blender 2.79) uses old Cycles shaders (Diffuse / Glossy /
    Glass / custom 'Metal Colors' groups) that the glTF exporter cannot read.
    Rebuild each as a Principled BSDF keeping the author's colours.
    """
    if not mat.use_nodes:
        return
    nt = mat.node_tree
    nodes = list(nt.nodes)
    base, metallic, rough = None, 0.0, 0.7
    types = {n.type for n in nodes}
    def col(n):
        c = n.inputs.get('Color')
        return tuple(c.default_value) if c is not None and not c.is_linked else None
    for n in nodes:
        if n.type == 'GROUP' and n.node_tree and 'Metal Colors' in n.node_tree.name:
            # use the RGB node that feeds the linked group output
            used = [l.from_socket.name for l in nt.links if l.from_node == n]
            out = next((g for g in n.node_tree.nodes if g.type == 'GROUP_OUTPUT'), None)
            if out:
                for l in n.node_tree.links:
                    if l.to_node == out and (not used or l.to_socket.name in used) and l.from_node.type == 'RGB':
                        base = tuple(l.from_node.outputs[0].default_value); break
            metallic, rough = 1.0, 0.35
    if base is None:
        glossy = next((n for n in nodes if n.type == 'BSDF_GLOSSY'), None)
        diffuse = next((n for n in nodes if n.type == 'BSDF_DIFFUSE' and col(n)), None)
        glass = next((n for n in nodes if n.type == 'BSDF_GLASS'), None)
        if glass is not None:
            base, metallic, rough = col(glass), 0.6, 0.3
        elif diffuse is not None and glossy is not None:
            base, metallic, rough = col(diffuse), 0.5, glossy.inputs['Roughness'].default_value
        elif glossy is not None:
            base, metallic, rough = col(glossy), 1.0, max(0.2, glossy.inputs['Roughness'].default_value)
        elif diffuse is not None:
            base, metallic, rough = col(diffuse), 0.0, 0.8
    base = base or (0.7, 0.7, 0.7, 1.0)
    for n in nodes:
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (base[0], base[1], base[2], 1.0)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = rough
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    print('MAT', mat.name, [round(x, 2) for x in base[:3]], metallic, round(rough, 2))

# ---------------------------------------------------------------- Apollo LM
def normalise_machine(ob, up_height=1.0):
    """Origin at the bottom-centre, tallest axis (Z in Blender) scaled to 1."""
    me = ob.data
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
    c = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)))
    me.transform(Matrix.Translation(-c))
    size = max(max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs))
    me.transform(Matrix.Scale(up_height / size, 4))


reset()
bpy.ops.wm.open_mainfile(filepath=os.path.join(SRC, 'apollo/apollo_out-upload.blend'))
keep_only_meshes()
src_faces = sum(len(o.data.polygons) for o in bpy.context.scene.objects)
# The .blend's image textures are blueprint/reference photos used while
# modelling, not the craft's surface, so drop them (keeps the GLB small).
for m in bpy.data.materials:
    legacy_to_principled(m)
ob = bake_and_join('apollo_lm')
faces = decimate(ob, 45000)
normalise_machine(ob)
export(os.path.join(OUT, 'apollo_lm.glb'))
report['apollo_lm'] = {'sourceFaces': src_faces, 'faces': faces}

# ---------------------------------------------------------------- Mars rover
reset()
bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, 'rover/scene.gltf'))
keep_only_meshes()
src_faces = sum(len(o.data.polygons) for o in bpy.context.scene.objects)
ob = bake_and_join('mars_rover')
faces = decimate(ob, 70000)
normalise_machine(ob)
for img in bpy.data.images:
    if img.size[0] > 1024:
        img.scale(1024, 1024)
export(os.path.join(OUT, 'mars_rover.glb'))
report['mars_rover'] = {'sourceFaces': src_faces, 'faces': faces}

with open(os.path.join(OUT, 'models-report.json'), 'w') as f:
    json.dump(report, f, indent=2)
print('REPORT', json.dumps({k: {kk: vv for kk, vv in v.items() if kk != 'latLonRotation'} for k, v in report.items()}))

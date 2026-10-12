"""Photo-real studio render of the whole banana (and optional close-ups) with full procedural PBR
shaders on top of the vertex-colour build: freckles, scuffs, fine streaks, waxy sheen, subsurface.

Run:  python photo.py --out <dir> [--samples 128] [--blend]
"""
import argparse
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "tools"))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import banana as B  # noqa: E402
import lib  # noqa: E402
from lib import srgb  # noqa: E402


class G:
    """Tiny node-graph helper."""

    def __init__(self, mat):
        mat.use_nodes = True
        self.nt = mat.node_tree
        self.nt.nodes.clear()

    def n(self, kind, **inputs):
        node = self.nt.nodes.new(kind)
        for k, v in inputs.items():
            if k.startswith("_"):
                setattr(node, k[1:], v)
            elif isinstance(v, bpy.types.NodeSocket):
                self.nt.links.new(v, node.inputs[k])
            else:
                node.inputs[k].default_value = v
        return node

    def link(self, a, b):
        self.nt.links.new(a, b)

    def math(self, op, a, b=0.0, clamp=False):
        node = self.nt.nodes.new("ShaderNodeMath")
        node.operation = op
        node.use_clamp = clamp
        for i, v in enumerate((a, b)):
            if isinstance(v, bpy.types.NodeSocket):
                self.link(v, node.inputs[i])
            else:
                node.inputs[i].default_value = v
        return node.outputs[0]


def mix(g, a, b, fac, blend="MIX"):
    m = g.n("ShaderNodeMix", _data_type="RGBA", _blend_type=blend)
    for sock, v in ((m.inputs[0], fac), (m.inputs[6], a), (m.inputs[7], b)):
        if isinstance(v, bpy.types.NodeSocket):
            g.link(v, sock)
        else:
            sock.default_value = (*v[:3], 1) if isinstance(v, (tuple, Vector)) else v
    return m.outputs[2]


def ramp(g, x, stops):
    r = g.n("ShaderNodeValToRGB")
    g.link(x, r.inputs[0])
    els = r.color_ramp.elements
    while len(els) > 2:
        els.remove(els[-1])
    for i, (p, c) in enumerate(stops):
        e = els[i] if i < 2 else els.new(p)
        e.position = p
        e.color = (*c, 1) if len(c) == 3 else c
    return r.outputs[0]


def peel_shader(mat):
    """Waxy ripe banana skin. Base colour = vertex colour (macro gradients, ridges, neck, tip),
    then fine streaks, pale buttery patches, natural freckles, faint scuffs and micro bump."""
    g = G(mat)
    out = g.n("ShaderNodeOutputMaterial")
    bsdf = g.n("ShaderNodeBsdfPrincipled")
    vc = g.n("ShaderNodeVertexColor", _layer_name=lib.COL).outputs["Color"]
    uv = g.n("ShaderNodeUVMap", _uv_map="UVMap").outputs["UV"]
    obj = g.n("ShaderNodeTexCoord").outputs["Object"]
    # long fibrous streaks: squash noise along the fruit (v)
    streak_co = g.n("ShaderNodeMapping", Vector=uv, Scale=(60.0, 3.0, 1.0)).outputs[0]
    streak = g.n("ShaderNodeTexNoise", Vector=streak_co, Scale=1.0, Detail=6.0, Roughness=0.6).outputs[0]
    fine_co = g.n("ShaderNodeMapping", Vector=uv, Scale=(260.0, 18.0, 1.0)).outputs[0]
    fine = g.n("ShaderNodeTexNoise", Vector=fine_co, Scale=1.0, Detail=4.0).outputs[0]
    patch = g.n("ShaderNodeTexNoise", Vector=obj, Scale=45.0, Detail=3.0).outputs[0]
    c = mix(g, vc, srgb("#F8E07A"), g.math("MULTIPLY", g.math("SUBTRACT", patch, 0.52, True), 1.6, True))
    c = mix(g, c, srgb("#D89E1E"), g.math("MULTIPLY", g.math("SUBTRACT", 0.5, streak, True), 0.5, True))
    c = mix(g, c, srgb("#E9B832"), g.math("MULTIPLY", fine, 0.25))
    # freckles: small irregular dots, density varies over the fruit, fewer near the neck
    vor = g.n("ShaderNodeTexVoronoi", Vector=obj, Scale=420.0, Randomness=1.0, _feature="F1")
    dens = g.n("ShaderNodeTexNoise", Vector=obj, Scale=22.0, Detail=2.0).outputs[0]
    cell = vor.outputs["Color"]
    sep = g.n("ShaderNodeSeparateColor", Color=cell)
    pick = g.math("GREATER_THAN", sep.outputs[0], g.math("ADD", 0.84, g.math("MULTIPLY", g.math("SUBTRACT", 0.55, dens), 0.9)))
    radius = g.math("ADD", 0.06, g.math("MULTIPLY", g.math("POWER", sep.outputs[1], 3.0), 0.34))
    dot = g.math("MULTIPLY", g.math("SUBTRACT", 1.0, g.math("DIVIDE", vor.outputs["Distance"], radius)), 3.0, True)
    edge_noise = g.n("ShaderNodeTexNoise", Vector=obj, Scale=2600.0, Detail=2.0).outputs[0]
    dot = g.math("MULTIPLY", dot, g.math("ADD", 0.55, edge_noise), True)
    freck = g.math("MULTIPLY", g.math("MULTIPLY", dot, pick), g.math("ADD", 0.35, g.math("MULTIPLY", sep.outputs[2], 0.65)))
    neck = g.n("ShaderNodeVertexColor", _layer_name=lib.COL)
    sepv = g.n("ShaderNodeSeparateColor", Color=neck.outputs["Color"], _mode="HSV")
    yellow = g.math("LESS_THAN", sepv.outputs[0], 0.155)   # no freckles on the green neck and stem
    freck = g.math("MULTIPLY", freck, yellow)
    c = mix(g, c, srgb("#6B4320"), g.math("MULTIPLY", freck, 0.85, True))
    # faint scuffs
    sc = g.n("ShaderNodeTexNoise", Vector=g.n("ShaderNodeMapping", Vector=uv, Scale=(8.0, 2.5, 1.0)).outputs[0],
             Scale=3.0, Detail=8.0, Roughness=0.7).outputs[0]
    scuff = g.math("MULTIPLY", g.math("SUBTRACT", sc, 0.66, True), 2.2, True)
    c = mix(g, c, srgb("#B8862E"), g.math("MULTIPLY", scuff, 0.45))
    g.link(c, bsdf.inputs["Base Color"])
    # waxy, soft spec; slightly rougher on freckles and scuffs
    rough = g.math("ADD", 0.42, g.math("MULTIPLY", fine, 0.12))
    rough = g.math("ADD", rough, g.math("MULTIPLY", g.math("ADD", freck, scuff), 0.25))
    g.link(rough, bsdf.inputs["Roughness"])
    bsdf.inputs["Specular IOR Level"].default_value = 0.32
    bsdf.inputs["Sheen Weight"].default_value = 0.08
    bsdf.inputs["Sheen Roughness"].default_value = 0.4
    bsdf.inputs["Coat Weight"].default_value = 0.0
    bsdf.inputs["Subsurface Weight"].default_value = 0.12
    bsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.75, 0.25)
    bsdf.inputs["Subsurface Scale"].default_value = 0.0015
    # micro relief: fibres along the fruit, fine pores, slightly sunken freckles
    h = g.math("ADD", g.math("MULTIPLY", streak, 0.6), g.math("MULTIPLY", fine, 0.4))
    h = g.math("SUBTRACT", h, g.math("MULTIPLY", freck, 0.3))
    bump = g.n("ShaderNodeBump", Height=h, Strength=0.12, Distance=0.0003)
    g.link(bump.outputs[0], bsdf.inputs["Normal"])
    g.link(bsdf.outputs[0], out.inputs[0])


def stem_shader(mat, rough=0.75):
    g = G(mat)
    out = g.n("ShaderNodeOutputMaterial")
    bsdf = g.n("ShaderNodeBsdfPrincipled")
    vc = g.n("ShaderNodeVertexColor", _layer_name=lib.COL).outputs["Color"]
    uv = g.n("ShaderNodeUVMap", _uv_map="UVMap").outputs["UV"]
    obj = g.n("ShaderNodeTexCoord").outputs["Object"]
    fib = g.n("ShaderNodeTexNoise", Vector=g.n("ShaderNodeMapping", Vector=uv, Scale=(220.0, 6.0, 1.0)).outputs[0],
              Scale=1.0, Detail=8.0, Roughness=0.7).outputs[0]
    grit = g.n("ShaderNodeTexNoise", Vector=obj, Scale=1800.0, Detail=4.0).outputs[0]
    c = mix(g, vc, srgb("#3A2A18"), g.math("MULTIPLY", g.math("SUBTRACT", 0.5, fib, True), 1.2, True))
    c = mix(g, c, srgb("#A88A5A"), g.math("MULTIPLY", g.math("SUBTRACT", grit, 0.6, True), 1.0, True))
    g.link(c, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Specular IOR Level"].default_value = 0.3
    h = g.math("ADD", fib, g.math("MULTIPLY", grit, 0.5))
    bump = g.n("ShaderNodeBump", Height=h, Strength=0.5, Distance=0.0005)
    g.link(bump.outputs[0], bsdf.inputs["Normal"])
    g.link(bsdf.outputs[0], out.inputs[0])


def flesh_shader(mat, base_mul, rough, coat, bump_k, scale=(40.0, 3.0, 1.0)):
    """Banana flesh: creamy ivory, dense, a little translucent; cut faces moist with a soft sheen."""
    g = G(mat)
    out = g.n("ShaderNodeOutputMaterial")
    bsdf = g.n("ShaderNodeBsdfPrincipled")
    vc = g.n("ShaderNodeVertexColor", _layer_name=lib.COL).outputs["Color"]
    obj = g.n("ShaderNodeTexCoord").outputs["Object"]
    fib = g.n("ShaderNodeTexNoise", Vector=g.n("ShaderNodeMapping", Vector=obj, Scale=scale).outputs[0],
              Scale=60.0, Detail=8.0, Roughness=0.65).outputs[0]
    pore = g.n("ShaderNodeTexNoise", Vector=obj, Scale=3000.0, Detail=3.0).outputs[0]
    c = mix(g, vc, srgb("#E6D3A6"), g.math("MULTIPLY", g.math("SUBTRACT", 0.5, fib, True), base_mul, True))
    c = mix(g, c, srgb("#FBF5E6"), g.math("MULTIPLY", g.math("SUBTRACT", pore, 0.55, True), 1.5, True))
    g.link(c, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Specular IOR Level"].default_value = 0.4
    bsdf.inputs["Coat Weight"].default_value = coat
    bsdf.inputs["Coat Roughness"].default_value = 0.28
    bsdf.inputs["Subsurface Weight"].default_value = 0.35
    bsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.85, 0.55)
    bsdf.inputs["Subsurface Scale"].default_value = 0.002
    h = g.math("ADD", fib, g.math("MULTIPLY", pore, 0.35))
    bump = g.n("ShaderNodeBump", Height=h, Strength=bump_k, Distance=0.0004)
    g.link(bump.outputs[0], bsdf.inputs["Normal"])
    g.link(bsdf.outputs[0], out.inputs[0])


def cut_shader(mat, centre=False):
    """Moist cut flesh. Polar coordinates around the piece's own axis (object properties written by
    banana.objects_for) drive fine radial fibres, stronger in the seed core's star, as on a real slice."""
    g = G(mat)
    out = g.n("ShaderNodeOutputMaterial")
    bsdf = g.n("ShaderNodeBsdfPrincipled")
    vc = g.n("ShaderNodeVertexColor", _layer_name=lib.COL).outputs["Color"]
    obj = g.n("ShaderNodeTexCoord").outputs["Object"]
    attr = lambda name: g.n("ShaderNodeAttribute", _attribute_type="OBJECT", _attribute_name=name)
    ax, nr, c0 = attr("ax").outputs["Vector"], attr("nr").outputs["Vector"], attr("c0").outputs["Vector"]
    rr = attr("rr").outputs["Fac"]
    vm = lambda op, a, b=None: _vm(g, op, a, b)
    d = vm("SUBTRACT", obj, c0).outputs[0]
    along = vm("DOT_PRODUCT", d, ax).outputs["Value"]
    rad = vm("SUBTRACT", d, vm("SCALE", ax, along).outputs[0]).outputs[0]
    rn = g.math("DIVIDE", vm("LENGTH", rad).outputs["Value"], rr)
    side = vm("CROSS_PRODUCT", ax, nr).outputs[0]
    cx = vm("DOT_PRODUCT", rad, nr).outputs["Value"]
    cy = vm("DOT_PRODUCT", rad, side).outputs["Value"]
    ang = g.math("ARCTAN2", cy, cx)
    # radial streaks: noise over (cos a, sin a) * high frequency and radius * low frequency
    comb = g.n("ShaderNodeCombineXYZ", X=g.math("MULTIPLY", g.math("COSINE", ang), 12.0),
               Y=g.math("MULTIPLY", g.math("SINE", ang), 12.0), Z=g.math("MULTIPLY", rn, 2.2)).outputs[0]
    rays = g.n("ShaderNodeTexNoise", Vector=comb, Scale=1.0, Detail=6.0, Roughness=0.6).outputs[0]
    comb2 = g.n("ShaderNodeCombineXYZ", X=g.math("MULTIPLY", g.math("COSINE", ang), 70.0),
                Y=g.math("MULTIPLY", g.math("SINE", ang), 70.0), Z=g.math("MULTIPLY", rn, 6.0)).outputs[0]
    fine = g.n("ShaderNodeTexNoise", Vector=comb2, Scale=1.0, Detail=4.0).outputs[0]
    pore = g.n("ShaderNodeTexNoise", Vector=obj, Scale=2600.0, Detail=3.0).outputs[0]
    # the star: rays are strongest in the centre and fade out by about half the radius
    inner = g.math("SUBTRACT", 1.0, g.math("MULTIPLY", g.math("SUBTRACT", rn, 0.15, True), 2.8), True)
    k = g.math("ADD", 0.12, g.math("MULTIPLY", inner, 1.0))
    streak = g.math("MULTIPLY", g.math("MULTIPLY", g.math("SUBTRACT", rays, 0.45, True), 2.0, True), k, True)
    c = mix(g, vc, srgb("#DDC9A0"), g.math("MULTIPLY", streak, 0.75))
    c = mix(g, c, srgb("#FBF7EC"), g.math("MULTIPLY", g.math("MULTIPLY", g.math("SUBTRACT", fine, 0.55, True), 1.2, True), k))
    c = mix(g, c, srgb("#E9DCBD"), g.math("MULTIPLY", g.math("SUBTRACT", pore, 0.6, True), 1.2, True))
    # slightly darker, yellower rim at the very edge
    edge = g.math("MULTIPLY", g.math("SUBTRACT", rn, 0.9, True), 8.0, True)
    c = mix(g, c, srgb("#E8D9AE"), g.math("MULTIPLY", edge, 0.6))
    g.link(c, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.45
    bsdf.inputs["Specular IOR Level"].default_value = 0.4
    bsdf.inputs["Coat Weight"].default_value = 0.2
    bsdf.inputs["Coat Roughness"].default_value = 0.3
    bsdf.inputs["Subsurface Weight"].default_value = 0.35
    bsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.85, 0.55)
    bsdf.inputs["Subsurface Scale"].default_value = 0.002
    h = g.math("ADD", g.math("MULTIPLY", streak, 0.6), g.math("ADD", g.math("MULTIPLY", fine, 0.4), g.math("MULTIPLY", pore, 0.5)))
    bump = g.n("ShaderNodeBump", Height=h, Strength=0.3, Distance=0.0003)
    g.link(bump.outputs[0], bsdf.inputs["Normal"])
    g.link(bsdf.outputs[0], out.inputs[0])


def _vm(g, op, a, b):
    node = g.nt.nodes.new("ShaderNodeVectorMath")
    node.operation = op
    g.link(a, node.inputs[0])
    if b is not None:
        if isinstance(b, bpy.types.NodeSocket):
            g.link(b, node.inputs[3] if op == "SCALE" else node.inputs[1])
    return node


def photo_materials(mats):
    by = {m.name: m for m in mats}
    peel_shader(by["peel"])
    stem_shader(by["stem"])
    stem_shader(by["tip"], rough=0.9)
    flesh_shader(by["flesh"], 0.5, 0.55, 0.05, 0.35, scale=(1.0, 1.0, 1.0))
    cut_shader(by["flesh_cut"])
    cut_shader(by["core_cut"])


def studio(scene, cam, target, res, samples, lens=70):
    lib.studio(scene, bg="#F3F1EE", cam_loc=tuple(cam), cam_target=tuple(target), res=res,
               samples=samples, lens=lens)
    for ob in scene.objects:
        if ob.type == "LIGHT":
            ob.data.energy *= {"key": 0.85, "fill": 1.1, "rim": 1.4}.get(ob.name, 1.0)
            if ob.name == "key":
                ob.data.size = 0.9
    scene.cycles.max_bounces = 8
    scene.cycles.transmission_bounces = 4


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--samples", type=int, default=128)
    ap.add_argument("--blend", action="store_true")
    ap.add_argument("--views", default="hero,close_stem,close_tip")
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    a = ap.parse_args(argv)
    os.makedirs(a.out, exist_ok=True)
    lib.new_scene()
    parts, info = B.build()
    for view in a.views.split(","):
        scene = lib.new_scene()
        mats = B.materials()
        photo_materials(mats)
        if view == "slice":
            obs, _ = B.state_slices_peeled(parts, info, mats, scene.collection, thick=0.015)
            keep = obs[len(obs) // 2]
            for o in obs:
                if o is not keep:
                    bpy.data.objects.remove(o)
            B.pose_cut_up([keep], per_row=1)
            bpy.context.view_layer.update()
            pts = [keep.matrix_world @ v.co for v in keep.data.vertices]
            c = sum(pts, Vector()) / len(pts)
            cam = c + Vector((0.0, -0.10, 0.085))
            studio(scene, cam, c, (1200, 1000), a.samples, lens=85)
            lib.render(scene, os.path.join(a.out, f"banana_photo_{view}.jpg"))
            continue
        obs, _ = B.state_whole(parts, info, mats, scene.collection)
        ob = obs[0]
        ob.location = (0, 0, 0)
        bpy.context.view_layer.update()
        pts = [ob.matrix_world @ v.co for v in ob.data.vertices]
        lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
        ob.location -= Vector((0, 0, lo.z))
        hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
        c = (lo + hi) / 2
        c.z = (hi.z - lo.z) * 0.45
        if view == "hero":
            # three-quarter view from the front, a little above: curve, stem and tip all visible
            cam = c + Vector((-0.07, -0.33, 0.21))
            studio(scene, cam, c, (1600, 1100), a.samples)
        elif view == "close_stem":
            t = ob.matrix_world @ max(ob.data.vertices, key=lambda v: v.co.x).co
            cam = t + Vector((0.02, -0.11, 0.05))
            studio(scene, cam, t + Vector((-0.012, 0, -0.008)), (1200, 900), a.samples, lens=85)
        else:
            t = ob.matrix_world @ min(ob.data.vertices, key=lambda v: v.co.x).co
            cam = t + Vector((-0.05, -0.10, 0.045))
            studio(scene, cam, t + Vector((0.014, 0, 0.004)), (1200, 900), a.samples, lens=85)
        lib.render(scene, os.path.join(a.out, f"banana_photo_{view}.jpg"))
        if a.blend and view == "hero":
            bpy.ops.file.pack_all()
            bpy.ops.wm.save_as_mainfile(filepath=os.path.join(a.out, "banana_photo.blend"))


if __name__ == "__main__":
    main()

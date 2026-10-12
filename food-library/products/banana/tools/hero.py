"""Hero render and turntable for the banana, staged like Katusha's reference photo: the banana
stands upright, both ends keep their peel, the middle is cut into peeled slices floating apart.

Run:  python hero.py --out <dir> [--samples 128] [--frames 72] [--blend]
"""
import argparse
import math
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "tools"))

import bpy  # noqa: E402
from mathutils import Euler, Matrix, Vector  # noqa: E402

import banana as B  # noqa: E402
import lib  # noqa: E402

CUTS = [-0.031, -0.018, -0.005, 0.008, 0.021]   # five cuts: two peel ends + four peeled slices
GAP = 0.0075


def build_scene(samples, res):
    lib.new_scene()
    parts, info = B.build()
    scene = lib.new_scene()
    coll = scene.collection
    mats = B.materials()
    rng = lib.rng(B.SEED + 71)
    planes = []
    for s in CUTS:
        t = math.radians(1.5)
        no = Euler((rng.uniform(-t, t), rng.uniform(-t, t), rng.uniform(-t, t))).to_matrix() @ B.tangent(s)
        planes.append((B.bend(s, 0, 0), no))
    pieces = B.make_pieces(parts, planes, B.SOLID + ["fibers"])
    pieces = [p for p in pieces if any(k in p for k in ("peel", "flesh"))]
    pieces.sort(key=B.s_key)
    ends = [pieces[0], pieces[-1]]
    middle = pieces[1:-1]
    for p in ends:
        p.pop("fibers", None)
    for p in middle:
        p.pop("peel", None)
    e_obs, _ = B.objects_for(ends, "end", info, mats, coll, peeled=False)
    m_obs, _ = B.objects_for(middle, "slice", info, mats, coll, peeled=True)
    obs = [e_obs[0]] + m_obs + [e_obs[1]]

    # pull the pieces apart along the fruit, then stand the banana up (stem on top, curve to the right)
    n = len(obs)
    for k, ob in enumerate(obs):
        s = B.unbend(ob.location)[0]
        ob.location += B.tangent(s) * (k - (n - 1) / 2) * GAP
    bpy.context.view_layer.update()
    centre = sum((o.location for o in obs), Vector()) / n
    stand = Euler((0, math.radians(-90), 0)).to_matrix().to_4x4()   # +X (stem) -> +Z
    turn = Euler((0, 0, math.radians(0))).to_matrix().to_4x4()        # concave side to the left
    rig = bpy.data.objects.new("rig", None)
    coll.objects.link(rig)
    for k, ob in enumerate(obs):
        tilt = Euler((math.radians(rng.uniform(8, 14) if 0 < k < n - 1 else 6),
                      math.radians(rng.uniform(-6, 6)), math.radians(rng.uniform(-15, 15)))).to_matrix().to_4x4()
        loc = ob.location - centre
        rot = ob.matrix_world.to_3x3().to_4x4()
        R = turn @ stand
        ob.matrix_world = Matrix.Translation(R @ loc) @ tilt @ R @ rot
        ob.parent = rig
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ v.co for o in obs for v in list(o.data.vertices)[::9]]
    zmin = min(p.z for p in pts)
    rig.location.z = -zmin + 0.035
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ v.co for o in obs for v in list(o.data.vertices)[::9]]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    c = (lo + hi) / 2
    c.z -= 0.012
    h = hi.z - lo.z
    e = math.radians(9)
    dist = h * 3.3
    cam = c + Vector((0, -math.cos(e), math.sin(e))) * dist
    lib.studio(scene, bg="#F4F1EE", cam_loc=tuple(cam), cam_target=tuple(c), res=res,
               samples=samples, lens=85)
    return scene, rig, obs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--samples", type=int, default=128)
    ap.add_argument("--frames", type=int, default=0)
    ap.add_argument("--blend", action="store_true")
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    a = ap.parse_args(argv)
    os.makedirs(a.out, exist_ok=True)
    scene, rig, obs = build_scene(a.samples, (1080, 1920))
    lib.render(scene, os.path.join(a.out, "banana_hero.jpg"))
    if a.blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(a.out, "banana_hero.blend"))
    if a.frames:
        scene.render.resolution_x, scene.render.resolution_y = 540, 960
        frames = os.path.join(a.out, "frames")
        os.makedirs(frames, exist_ok=True)
        for f in range(a.frames):
            rig.rotation_euler.z = 2 * math.pi * f / a.frames
            lib.render(scene, os.path.join(frames, f"f{f:03d}.jpg"))
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", "24", "-i",
                        os.path.join(frames, "f%03d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p",
                        "-crf", "22", os.path.join(a.out, "banana_turntable.mp4")], check=True)


if __name__ == "__main__":
    main()

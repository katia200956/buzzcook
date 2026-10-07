"""Check built GLBs against food-library/STANDARD.md (plain Python, no Blender needed).

    python validate.py <product dir with meta.json> <build dir with <state>/*.glb>
"""
import json
import os
import re
import struct
import sys

PARTS = {"skin", "peel", "rind", "pith", "flesh", "gel", "seed", "core", "layer", "vesicle",
         "calyx", "stem", "crust", "crumb", "meat", "fat", "bone", "yolk", "white", "juice",
         "zest", "leaf", "puree"}
MAX_BYTES = 2.5 * 1024 * 1024
MAX_BYTES_MANY = 3.0 * 1024 * 1024  # states with 40+ pieces
BANNED_EXT = {"KHR_draco_mesh_compression", "EXT_meshopt_compression", "KHR_mesh_quantization"}


def read_glb(path):
    with open(path, "rb") as f:
        data = f.read()
    magic, version, length = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67 and version == 2, "not a glTF 2 binary"
    clen, ctype = struct.unpack_from("<II", data, 12)
    return json.loads(data[20:20 + clen])


def check(meta, build_dir):
    pid = meta["id"]
    problems, rows = [], []
    for state in sorted(os.listdir(build_dir)):
        folder = os.path.join(build_dir, state)
        if not os.path.isdir(folder):
            continue
        for fn in sorted(os.listdir(folder)):
            if not fn.endswith(".glb"):
                continue
            path = os.path.join(folder, fn)
            g = read_glb(path)
            size = os.path.getsize(path)
            name = fn[:-4]
            if not re.fullmatch(rf"{re.escape(pid)}_{re.escape(state)}(_[a-z0-9]+)*", name):
                problems.append(f"{fn}: file name does not follow <id>_<state>[_<variant>]")
            n_pieces = len(g["nodes"]) - 1
            limit = MAX_BYTES_MANY if n_pieces >= 40 else MAX_BYTES
            if size > limit:
                problems.append(f"{fn}: {size / 1048576:.2f} MB is over the "
                                f"{limit / 1048576:.1f} MB budget")
            used = set(g.get("extensionsUsed", []))
            if used & BANNED_EXT:
                problems.append(f"{fn}: uses {sorted(used & BANNED_EXT)}")
            for m in g.get("materials", []):
                base = m["name"].removesuffix("_cut")
                if base not in PARTS:
                    problems.append(f"{fn}: material '{m['name']}' is not in the shared vocabulary")
            roots = [g["nodes"][i] for i in g["scenes"][g.get("scene", 0)]["nodes"]]
            if len(roots) != 1 or roots[0]["name"] != name:
                problems.append(f"{fn}: expected one root node named {name}")
            if roots and roots[0].get("translation", [0, 0, 0]) != [0, 0, 0] and \
                    any(abs(t) > 1e-6 for t in roots[0].get("translation", [0, 0, 0])):
                problems.append(f"{fn}: root node is not at the origin")
            # Y-up metres: product-sized bounds
            lo = [1e9] * 3
            hi = [-1e9] * 3
            for n in g["nodes"]:
                if "mesh" not in n:
                    continue
                t = n.get("translation", [0, 0, 0])
                for prim in g["meshes"][n["mesh"]]["primitives"]:
                    acc = g["accessors"][prim["attributes"]["POSITION"]]
                    if acc["componentType"] != 5126:
                        problems.append(f"{fn}: quantized positions")
                    for i in range(3):
                        lo[i] = min(lo[i], acc["min"][i] + t[i])
                        hi[i] = max(hi[i], acc["max"][i] + t[i])
                    if "COLOR_0" not in prim["attributes"]:
                        problems.append(f"{fn}: primitive without vertex colour")
            ext = [hi[i] - lo[i] for i in range(3)]
            if max(ext) > 0.5 or max(ext) < 0.001:
                problems.append(f"{fn}: extent {ext} m does not look like metres")
            if lo[1] < -0.002:
                problems.append(f"{fn}: geometry below the floor (min y {lo[1]:.4f})")
            rows.append((state, fn, len(g["nodes"]) - 1, size, [round(e * 1000, 1) for e in ext]))
    whole = os.path.join(build_dir, "whole", f"{pid}_whole.glb")
    if os.path.exists(whole):
        g = read_glb(whole)
        d = meta["dimensions_m"]
        for row in rows:
            if row[1] == f"{pid}_whole.glb":
                x, y, z = (e / 1000 for e in row[4])
                # stem and calyx add height; compare the width
                if abs(x - d["x"]) / d["x"] > 0.05 or abs(z - d["z"]) / d["z"] > 0.05:
                    problems.append(f"whole: width {x:.3f} x {z:.3f} m differs from meta "
                                    f"{d['x']} x {d['z']} m by more than 5 %")
    return rows, problems


def main():
    meta = json.load(open(os.path.join(sys.argv[1], "meta.json")))
    rows, problems = check(meta, sys.argv[2])
    for r in rows:
        print(f"{r[0]:12s} {r[1]:36s} nodes {r[2]:4d}  {r[3] / 1048576:5.2f} MB  extent mm {r[4]}")
    print("\n".join(problems) if problems else "OK: all files follow the standard")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()

"""Shrink GLBs: store COLOR_0 as normalized unsigned bytes (RGBA8) instead of float RGB.

Blender's exporter writes vertex colours as 32-bit floats, a third of every file. RGBA8 is part
of core glTF 2.0 (no extension) and three.js reads it directly.

    python pack_colors.py file.glb [more.glb ...]     (rewrites in place)
"""
import array
import json
import struct
import sys


def to_byte(lin):
    # glTF stores COLOR_0 in linear space; keep it linear
    return max(0, min(255, int(round(lin * 255))))


def pack(path):
    data = open(path, "rb").read()
    jlen, = struct.unpack_from("<I", data, 12)
    g = json.loads(data[20:20 + jlen])
    bin_off = 20 + jlen
    blen, = struct.unpack_from("<I", data, bin_off)
    blob = data[bin_off + 8: bin_off + 8 + blen]
    colour_acc = {p["attributes"]["COLOR_0"] for m in g["meshes"] for p in m["primitives"]
                  if "COLOR_0" in p["attributes"]}
    views = g["bufferViews"]
    new_views, chunks, off = [], [], 0
    view_map = {}
    for ai in sorted(colour_acc):
        acc = g["accessors"][ai]
        if acc["componentType"] != 5126:
            colour_acc.discard(ai)
    replaced = {}
    for ai in colour_acc:
        acc = g["accessors"][ai]
        bv = views[acc["bufferView"]]
        n = acc["count"]
        comps = 4 if acc["type"] == "VEC4" else 3
        floats = array.array("f")
        start = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
        floats.frombytes(blob[start:start + n * comps * 4])
        out = bytearray(n * 4)
        for i in range(n):
            for c in range(3):
                out[i * 4 + c] = to_byte(floats[i * comps + c])
            out[i * 4 + 3] = to_byte(floats[i * comps + 3]) if comps == 4 else 255
        replaced[acc["bufferView"]] = bytes(out)
        acc.update(componentType=5121, normalized=True, type="VEC4")
        acc.pop("byteOffset", None)
    for vi, bv in enumerate(views):
        raw = replaced.get(vi)
        if raw is None:
            s = bv.get("byteOffset", 0)
            raw = blob[s:s + bv["byteLength"]]
        pad = (-off) % 4
        chunks.append(b"\0" * pad)
        off += pad
        nb = dict(bv, byteOffset=off, byteLength=len(raw))
        nb.pop("byteStride", None) if vi in replaced else None
        new_views.append(nb)
        chunks.append(raw)
        off += len(raw)
    g["bufferViews"] = new_views
    newbin = b"".join(chunks)
    newbin += b"\0" * ((-len(newbin)) % 4)
    g["buffers"][0]["byteLength"] = len(newbin)
    js = json.dumps(g, separators=(",", ":")).encode()
    js += b" " * ((-len(js)) % 4)
    total = 12 + 8 + len(js) + 8 + len(newbin)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A))
        f.write(js)
        f.write(struct.pack("<II", len(newbin), 0x004E4942))
        f.write(newbin)
    return len(data), total


if __name__ == "__main__":
    for p in sys.argv[1:]:
        a, b = pack(p)
        print(f"{p}: {a / 1048576:.2f} -> {b / 1048576:.2f} MB")

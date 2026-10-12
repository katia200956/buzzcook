"""Write a build report into a product's meta.json (states, files, piece masses and sizes).

    python update_meta.py <product dir> <build dir> [url prefix]
"""
import json
import os
import sys


def main():
    pdir, bdir = sys.argv[1], sys.argv[2]
    prefix = sys.argv[3] if len(sys.argv) > 3 else ""
    meta_path = os.path.join(pdir, "meta.json")
    meta = json.load(open(meta_path))
    rep = json.load(open(os.path.join(bdir, "build_report.json")))
    pid = meta["id"]
    for state, entry in meta["states"].items():
        built = {k: v for k, v in rep.items() if isinstance(v, dict) and
                 v.get("file", "").startswith(state + "/")}
        if not built:
            continue
        entry["status"] = "built"
        entry["files"] = []
        for name, r in sorted(built.items()):
            f = {"name": os.path.basename(r["file"]), "lod": 0, "bytes": os.path.getsize(
                os.path.join(bdir, r["file"])), "triangles": r["triangles"], "pieces": r["pieces"],
                "piece_mass_g": r["piece_mass_g"], "mass_total_g": r["mass_total_g"],
                "piece_size_mm": r["piece_size_mm"]}
            if prefix:
                f["url"] = prefix.rstrip("/") + "/" + r["file"]
            entry["files"].append(f)
        main_file = entry["files"][0]
        entry["piece_count"] = main_file["pieces"]
        entry["piece_mass_g"] = main_file["piece_mass_g"]
        s = main_file["piece_size_mm"]
        entry["piece_size_mm"] = {"x": s[0], "y": s[1], "z": s[2]}
    meta["build"]["built_at"] = rep.get("built_at", meta["build"].get("built_at", ""))
    with open(meta_path, "w") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print(f"{pid}: " + ", ".join(f"{k}={v['status']}" for k, v in meta["states"].items()))


if __name__ == "__main__":
    main()

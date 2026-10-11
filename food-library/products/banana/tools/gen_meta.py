"""Write ../meta.json from a build report (build_report.json of banana.py)."""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
rep = json.load(open(sys.argv[1]))


def f(name, lod=0):
    r = rep[name]
    return dict(name=os.path.basename(r["file"]), lod=lod, bytes=r["bytes"], triangles=r["triangles"],
                pieces=r["pieces"], piece_mass_g=r["piece_mass_g"], mass_total_g=r["mass_total_g"],
                piece_size_mm=r["piece_size_mm"])


def state(names, variants=None, **extra):
    fs = [f(n) for n in names]
    s = dict(status="built", files=fs, piece_count=fs[0]["pieces"], piece_mass_g=fs[0]["piece_mass_g"],
             piece_size_mm=dict(zip("xyz", fs[0]["piece_size_mm"])))
    if variants:
        s["variants"] = variants
    s.update(extra)
    return s


meta = {
    "id": "banana",
    "names": {"uk": "Банан", "en": "Banana"},
    "aliases": ["банани", "бананчик", "bananas"],
    "category": "fruit",
    "dimensions_m": {"x": 0.185, "y": 0.036, "z": 0.036, "length_along_curve": rep["length_axis_m"],
                     "range": {"min": {"x": 0.15, "y": 0.03, "z": 0.03},
                               "max": {"x": 0.23, "y": 0.042, "z": 0.042}}},
    "mass_g": {"avg": rep["whole"]["mass_total_g"], "min": 100, "max": 200},
    "density_g_cm3": 0.96,
    "edible_parts": ["flesh", "core", "seed"],
    "inedible_parts": ["peel", "stem"],
    "waste_ratio": round(1 - rep["peeled"]["mass_total_g"] / rep["whole"]["mass_total_g"], 2),
    "states": {
        "whole": state(["whole"]),
        "peeled": state(["peeled"]),
        "slices": state(["slices_peel", "slices_peeled"], variants=["peel", "peeled"], thickness_mm=10),
        "cubes": state(["cubes"], detail="шматки 15 мм, кожен розрізаний на чверті вздовж осі"),
    },
    "preparation": ["peel", "slice", "cube", "mash"],
    "cooking_actions": [
        {"action": "peel", "state": "whole"},
        {"action": "slice", "state": "peeled"},
        {"action": "dice", "state": "peeled"},
        {"action": "place_in", "state": "slices"},
    ],
    "look": ("Вигнутий жовтий банан з п'ятьма ледь помітними гранями, зеленуватою шийкою, темним зрізом "
             "хвостика і темною кнопкою на кінчику. Шкірка 2.5 мм: жовтий край, бліда внутрішня частина. "
             "М'якоть кремово-жовта з поздовжніми борозенками і ниточками; у центрі м'яка трипроменева "
             "зірочка з радіальними волокнами і дрібним темним насінням."),
    "references": ["products/references/banana-slices-2.jpg",
                   "Katusha's BANANA.blend (low-poly shape reference only, geometry not reused)"],
    "textures": {"third_party": [], "note": "Без сторонніх текстур: усі кольори у вершинах (COLOR_0), "
                                            "геометрія процедурна."},
    "materials": ["peel", "peel_cut", "flesh", "flesh_cut", "core", "core_cut", "seed", "seed_cut", "stem"],
    "build": {"seed": 2002, "script": "tools/banana.py", "script_version": "1",
              "built_at": "2026-10-11", "seeds": rep["seeds"], "peel_min_mm": rep["peel_min_mm"]},
    "transitions": [
        {"from": "whole", "to": "peeled", "op": "peel", "detail": "шкірка знімається як окремий шар"},
        {"from": "whole", "to": "slices", "variant": "peel", "op": "slice",
         "detail": "площини 10 мм перпендикулярно до вигнутої осі, кінці з хвостиком і кінчиком"},
        {"from": "peeled", "to": "slices", "variant": "peeled", "op": "slice",
         "detail": "ті самі площини по почищеній м'якоті"},
        {"from": "peeled", "to": "cubes", "op": "dice",
         "detail": "шматки 15 мм, кожен на 4 частини двома поздовжніми площинами"},
    ],
}
out = os.path.join(HERE, "..", "meta.json")
json.dump(meta, open(out, "w"), ensure_ascii=False, indent=2)
print("wrote", out)

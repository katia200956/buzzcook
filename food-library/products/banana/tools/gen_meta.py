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
        "half": state(["half"], detail="поперек навпіл, зі шкіркою"),
        "cross_section": state(["cross_section"], detail="відрізок 25 мм із середини зі шкіркою, обидва торці — зрізи"),
        "slices": state(["slices_10mm", "slices_5mm", "slices_15mm", "slices_peel"],
                        variants=["10mm", "5mm", "15mm", "peel"],
                        detail="почищені скибки 5/10/15 мм; peel — 10 мм зі шкіркою"),
        "half_slices": state(["half_slices"], detail="скибки 10 мм навпіл"),
        "strips": state(["strips"], detail="почищений банан на 4 поздовжні смужки"),
        "cubes": state(["cubes"], detail="шматки 15 мм, кожен розрізаний на чверті вздовж осі"),
        "diced": state(["diced"], detail="кубики ~5 мм, репрезентативна порція 30 мм банана (множити в застосунку)"),
        "mashed": state(["mashed", "puree"], variants=["mashed", "puree"],
                        detail="mashed — нерівна грудкувата маса з шматочками; puree — гладке пюре; об'єм = вся м'якоть"),
        "cooked": state(["cooked_fried", "cooked_baked"], variants=["fried", "baked"],
                        detail="fried — обсмажені скибки 10 мм; baked — запечений у шкірці"),
        "parts": state(["parts_peel"], variants=["peel"],
                       detail="шкірка окремою геометрією; peeled + parts_peel складаються в whole"),
    },
    "preparation": ["peel", "cut", "slice", "dice", "mash", "blend", "fry", "bake"],
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
    "build": {"seed": 2002, "script": "tools/banana.py", "script_version": "2",
              "built_at": "2026-10-11", "seeds": rep["seeds"], "peel_min_mm": rep["peel_min_mm"]},
    "transitions": [
        {"from": "whole", "to": "peeled", "op": "peel", "detail": "шкірка (parts_peel) знімається окремою геометрією"},
        {"from": "whole", "to": "half", "op": "cut", "detail": "одна площина поперек посередині"},
        {"from": "half", "to": "cross_section", "op": "cut", "detail": "ще один зріз через 25 мм"},
        {"from": "whole", "to": "slices", "variant": "peel", "op": "slice", "detail": "площини 10 мм перпендикулярно до вигнутої осі"},
        {"from": "peeled", "to": "slices", "variant": "5mm|10mm|15mm", "op": "slice", "detail": "ті самі площини по почищеній м'якоті"},
        {"from": "slices", "to": "half_slices", "op": "cut", "detail": "площина вздовж осі через усі скибки"},
        {"from": "peeled", "to": "strips", "op": "cut", "detail": "три поздовжні площини"},
        {"from": "peeled", "to": "cubes", "op": "dice", "detail": "шматки 15 мм, кожен на 4 частини"},
        {"from": "cubes", "to": "diced", "op": "chop", "detail": "сітка 5 мм"},
        {"from": "diced", "to": "mashed", "variant": "mashed", "op": "crush", "detail": "морф шматочків у грудкувату масу"},
        {"from": "mashed", "to": "mashed", "variant": "puree", "op": "blend", "detail": "грудки згладжуються"},
        {"from": "slices", "to": "cooked", "variant": "fried", "op": "fry", "detail": "колір карамелізується, усадка ~7 %"},
        {"from": "whole", "to": "cooked", "variant": "baked", "op": "roast", "detail": "шкірка темніє, усадка ~5 %"},
    ],
}
out = os.path.join(HERE, "..", "meta.json")
json.dump(meta, open(out, "w"), ensure_ascii=False, indent=2)
print("wrote", out)

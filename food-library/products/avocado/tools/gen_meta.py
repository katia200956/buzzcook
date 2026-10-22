"""Write ../meta.json from a build report (build_report.json of avocado.py)."""
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


w = rep["whole"]
meta = {
    "id": "avocado",
    "names": {"uk": "Авокадо", "en": "Avocado"},
    "aliases": ["авокадо хаас", "авокадо хасс", "hass avocado", "avocados"],
    "category": "fruit",
    "dimensions_m": {"x": round(w["piece_size_mm"][0] / 1000, 4), "y": round(w["piece_size_mm"][1] / 1000, 4),
                     "z": round(w["piece_size_mm"][2] / 1000, 4),
                     "range": {"min": {"x": 0.08, "y": 0.055, "z": 0.055},
                               "max": {"x": 0.125, "y": 0.08, "z": 0.08}}},
    "mass_g": {"avg": w["mass_total_g"], "min": 170, "max": 320},
    "density_g_cm3": {"skin": 1.0, "flesh": 0.97, "seed": 1.1},
    "edible_parts": ["flesh"],
    "inedible_parts": ["skin", "seed"],
    "waste_ratio": round(1 - rep["peeled"]["mass_total_g"] / w["mass_total_g"], 2),
    "states": {
        "whole": state(["whole"]),
        "half": state(["half"], detail="уздовж навколо кісточки; half_00 з кісточкою (pit_00 окремим шматком), half_01 з ямкою"),
        "quarter": state(["quarter"], detail="чверті зі шкіркою, без кісточки"),
        "peeled": state(["peeled"], detail="дві половинки м'якоті, вийняті ложкою зі шкірки, без кісточки"),
        "slices": state(["slices_6mm"], variants=["6mm"],
                        detail="почищені половинки, нарізані вздовж скибками 6 мм (±8 %), як для тосту"),
        "cubes": state(["cubes"], detail="кубики 15 мм з почищених половинок; крайові шматки неправильні, як від ножа"),
        "diced": state(["diced"], detail="кубики 8 мм з однієї почищеної половинки (репрезентативна порція, множити в застосунку)"),
        "mashed": state(["mashed", "puree"], variants=["mashed", "puree"],
                        detail="mashed — розім'яте виделкою з грудочками; puree — гладке; об'єм = вся м'якоть"),
        "parts": state(["parts_pit", "parts_pit_cut", "parts_skin"], variants=["pit", "pit_cut", "skin"],
                       detail="кісточка; кісточка навпіл (бура оболонка, світла сім'ядоля); дві порожні шкірки"),
    },
    "preparation": ["cut", "pit", "scoop", "slice", "dice", "mash", "blend"],
    "cooking_actions": [
        {"action": "cut", "state": "whole"},
        {"action": "pit", "state": "half"},
        {"action": "scoop", "state": "half"},
        {"action": "slice", "state": "peeled"},
        {"action": "dice", "state": "peeled"},
        {"action": "mash", "state": "peeled"},
    ],
    "look": ("Авокадо Хасс: майже чорна з фіолетовим відливом шкірка з дрібними пухирцями й рудими цятками, "
             "форма груші (вузький кінець біля плодоніжки). На зрізі тонка темна смужка шкірки, яскраво-зелений "
             "шар м'якоті 3–4 мм, далі перехід у блідо-жовту масляну серцевину. Кісточка кругло-яйцеподібна, "
             "світло-бура з бежевими плямами; всередині кремова."),
    "references": ["AVO-1.usdz (фотограмметрія половинки Хасу з кісточкою; колір, нормалі, AO 4096 px)"],
    "textures": {
        "files": ["avocado_skin_basecolor.jpg (2048 px)", "avocado_skin_normal.jpg (1024 px)"],
        "source": "запечено зі скану AVO-1 на власну UV-мапу половинки шкірки; друга половинка — дзеркальна копія",
        "cleaned": "прибрано наліпку Del Monte / Mexico / 4770, відблиски, дірку знизу (місце, де плід лежав), "
                   "зелені плями м'якоті на краю",
        "note": "Нормалі в JPEG (а не PNG, як у §7), щоб GLB вкладався в 2.5 MB.",
    },
    "materials": ["skin", "skin_cut", "flesh", "flesh_cut", "seed", "seed_cut", "puree"],
    "build": {"seed": 4770, "script": "tools/avocado.py", "script_version": "1", "built_at": "2026-10-22",
              "prep": ["tools/scan_info.py", "tools/scan_frame.py", "tools/scan_prep.py", "tools/bake_skin.py",
                       "tools/dump_uv.py", "tools/skin_texture.py", "tools/dump_skin.py"],
              "layers_mm": {"skin": 1.2, "green_flesh_to": 5, "yellow_flesh_from": 12}},
    "transitions": [
        {"from": "whole", "to": "half", "op": "cut", "detail": "площина вздовж довгої осі навколо кісточки"},
        {"from": "half", "to": "parts", "variant": "pit", "op": "pit", "detail": "кісточка pit_00 виймається з half_00"},
        {"from": "half", "to": "quarter", "op": "cut", "detail": "ще одна поздовжня площина"},
        {"from": "half", "to": "peeled", "op": "scoop", "detail": "м'якоть виходить зі шкірки; лишається parts_skin"},
        {"from": "peeled", "to": "slices", "op": "slice", "detail": "поздовжні площини 6 мм"},
        {"from": "peeled", "to": "cubes", "op": "dice", "detail": "сітка 15 мм"},
        {"from": "cubes", "to": "diced", "op": "chop", "detail": "сітка 8 мм"},
        {"from": "diced", "to": "mashed", "variant": "mashed", "op": "mash", "detail": "морф шматочків у грудкувату масу"},
        {"from": "mashed", "to": "mashed", "variant": "puree", "op": "blend", "detail": "грудки згладжуються"},
    ],
}
out = os.path.join(HERE, "..", "meta.json")
json.dump(meta, open(out, "w"), ensure_ascii=False, indent=2)
print("wrote", out)

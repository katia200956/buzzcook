"""Е. Збереження CSV і звіт test_report.md з реальними цифрами запуску."""
from __future__ import annotations

from collections import Counter
from datetime import datetime

import pandas as pd

from . import config

REST_COLS = ["restaurant_id", "name", "address", "latitude", "longitude", "cuisine", "phone",
             "website", "website_found", "website_reachable", "website_http_status", "social_page",
             "menu_found", "menu_url", "menu_formats", "dishes_extracted", "dishes_with_price",
             "dishes_with_nutrition", "needs_manual", "failure_reason", "osm_url"]
DISH_COLS = ["restaurant_id", "restaurant_name", "dish_name", "description", "category", "price",
             "currency", "calories_kcal", "proteins_g", "fats_g", "carbohydrates_g", "source_url",
             "extraction_method", "extraction_status"]
SRC_COLS = ["restaurant_id", "restaurant_name", "url", "source_type", "http_status", "robots_allowed", "note"]


def save(restaurants, dishes, sources) -> None:
    config.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(restaurants).reindex(columns=REST_COLS).to_csv(
        config.OUTPUT_DIR / "restaurants.csv", index=False, encoding="utf-8-sig")
    pd.DataFrame(dishes).reindex(columns=DISH_COLS).to_csv(
        config.OUTPUT_DIR / "dishes.csv", index=False, encoding="utf-8-sig")
    pd.DataFrame(sources).reindex(columns=SRC_COLS).to_csv(
        config.OUTPUT_DIR / "sources.csv", index=False, encoding="utf-8-sig")


def _pct(a: int, b: int) -> str:
    return f"{a} з {b} ({round(100 * a / b) if b else 0}%)"


def write(restaurants, dishes, sources, osm_stats: dict, started: datetime, seconds: float) -> str:
    n = len(restaurants)
    site = sum(1 for r in restaurants if r["website_found"])
    reach = sum(1 for r in restaurants if r["website_reachable"])
    menu = sum(1 for r in restaurants if r["menu_found"])
    auto = sum(1 for r in restaurants if r["dishes_extracted"] > 0)
    d_total = len(dishes)
    d_price = sum(1 for d in dishes if d.get("price") is not None)
    d_nutr = sum(1 for d in dishes if d.get("calories_kcal") is not None)
    d_bzhv = sum(1 for d in dishes if all(d.get(k) is not None for k in ("proteins_g", "fats_g", "carbohydrates_g")))
    fmts = Counter(f.strip() for r in restaurants for f in (r["menu_formats"] or "").split(",") if f.strip())
    fail_fmt = Counter(f.strip() for r in restaurants if r["menu_found"] and not r["dishes_extracted"]
                       for f in (r["menu_formats"] or "").split(",") if f.strip())
    reasons = Counter(r["failure_reason"] for r in restaurants if r["failure_reason"])
    manual = Counter(m.strip() for r in restaurants for m in (r["needs_manual"] or "").split(";") if m.strip())

    L = []
    L.append(f"# Тест збору даних: {n} ресторанів, {config.CITY_NAME}\n")
    L.append(f"Запуск: {started:%Y-%m-%d %H:%M}, тривалість {round(seconds / 60, 1)} хв. "
             "Лише Python, без AI і без платних сервісів. Усі цифри з реального запуску.\n")
    L.append("## Підсумок по етапах\n")
    L.append("| Етап | Результат |\n| --- | --- |")
    L.append(f"| Ресторанів знайдено в OpenStreetMap (вибірка) | {n} |")
    L.append(f"| Мають сайт в OpenStreetMap | {_pct(site, n)} |")
    L.append(f"| Сайт відкривається | {_pct(reach, n)} |")
    L.append(f"| Меню знайдено | {_pct(menu, n)} |")
    L.append(f"| Страви витягнуто автоматично | {_pct(auto, n)} |")
    L.append(f"| Страв витягнуто всього | {d_total} |")
    L.append(f"| Страв із ціною | {_pct(d_price, d_total)} |")
    L.append(f"| Страв із калорійністю з джерела | {_pct(d_nutr, d_total)} |")
    L.append(f"| Страв із повним БЖВ з джерела | {_pct(d_bzhv, d_total)} |\n")
    L.append("## Усе місто в OpenStreetMap\n")
    L.append(f"У Києві в OpenStreetMap {osm_stats['osm_total']} ресторанів із назвою. "
             f"Сайт указаний у {_pct(osm_stats['osm_with_website'], osm_stats['osm_total'])}, "
             f"адреса у {_pct(osm_stats['osm_with_address'], osm_stats['osm_total'])}, "
             f"тип кухні у {_pct(osm_stats['osm_with_cuisine'], osm_stats['osm_total'])}. "
             f"Вибірку з {n} закладів взято випадково (фіксоване зерно {config.RANDOM_SEED}).\n")
    L.append("## Формати меню\n")
    L.append("| Формат | Знайдено | Страви не витягнуто |\n| --- | --- | --- |")
    for f, c in fmts.most_common():
        L.append(f"| {f} | {c} | {fail_fmt.get(f, 0)} |")
    if not fmts:
        L.append("| — | 0 | 0 |")
    L.append("\n## Причини невдач\n")
    L.append("| Причина | Ресторанів |\n| --- | --- |")
    for k, c in reasons.most_common():
        L.append(f"| {k} | {c} |")
    L.append("\n## Що потребує ручної роботи\n")
    L.append("| Етап | Ресторанів |\n| --- | --- |")
    for k, c in manual.most_common():
        L.append(f"| {k} | {c} |")
    L.append("\n## Ресторани з найбільшою кількістю страв\n")
    L.append("| Ресторан | Формат | Страв | З ціною | З калоріями |\n| --- | --- | --- | --- | --- |")
    for r in sorted(restaurants, key=lambda x: -x["dishes_extracted"])[:15]:
        if r["dishes_extracted"]:
            L.append(f"| {r['name']} | {r['menu_formats']} | {r['dishes_extracted']} | "
                     f"{r['dishes_with_price']} | {r['dishes_with_nutrition']} |")
    L.append("\n## Вартість тесту\n")
    L.append("| Операція | Вартість |\n| --- | --- |")
    L.append("| Список ресторанів (OpenStreetMap, Overpass API) | 0 грн |")
    L.append(f"| Відкриття сайтів і меню ({len(sources)} джерел) | 0 грн |")
    L.append("| Обробка HTML, PDF, QR (Python на твоєму Mac) | 0 грн |")
    L.append("| Пошуковий сервіс для закладів без сайту | не використовувався (потребує дозволу, платний) |")
    L.append("\nЯкість витягнутих страв треба перевірити вибірково: алгоритм шукає ціну і бере назву поруч, "
             "тож на нестандартних сайтах можливі зайві рядки. Дані OpenStreetMap: © учасники OpenStreetMap, ODbL.\n")
    text = "\n".join(L)
    (config.OUTPUT_DIR / "test_report.md").write_text(text, encoding="utf-8")
    return text

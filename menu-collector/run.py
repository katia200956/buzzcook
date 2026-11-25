"""Запуск усього тесту однією командою:  python run.py

Порядок: А) ресторани з OpenStreetMap -> Б) сайти -> В) меню -> Г) QR -> Д) страви -> Е) CSV і звіт.
"""
from __future__ import annotations

import logging
import sys
import time
from datetime import datetime

from collector import config, osm, pipeline, report


def setup_logging() -> None:
    config.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[logging.FileHandler(config.LOG_FILE, encoding="utf-8"), logging.StreamHandler(sys.stdout)],
    )


def main() -> None:
    setup_logging()
    log = logging.getLogger("run")
    started, t0 = datetime.now(), time.time()
    log.info("А. Завантажую ресторани %s з OpenStreetMap...", config.CITY_NAME)
    sample, osm_stats = osm.collect()
    log.info("Усього в OSM: %d, у вибірці: %d", osm_stats["osm_total"], len(sample))

    restaurants, dishes, sources = [], [], []
    for i, r in enumerate(sample, 1):
        log.info("[%d/%d] %s (%s)", i, len(sample), r["name"], r["osm_website"] or "сайту немає")
        try:
            rec, ds, ss = pipeline.process(r)
        except Exception as e:  # noqa: BLE001  один ресторан не зупиняє тест
            log.exception("Помилка на ресторані %s", r["name"])
            rec, ds, ss = dict(r), [], []
            rec.update({"restaurant_found": True, "website_found": bool(r["osm_website"]),
                        "website_reachable": False, "menu_found": False, "dishes_extracted": 0,
                        "dishes_with_price": 0, "dishes_with_nutrition": 0, "menu_formats": "",
                        "needs_manual": "", "failure_reason": f"помилка програми: {type(e).__name__}"})
        log.info("    меню: %s, формати: %s, страв: %d %s", rec["menu_found"], rec.get("menu_formats", ""),
                 rec["dishes_extracted"], ("| " + rec["failure_reason"]) if rec.get("failure_reason") else "")
        restaurants.append(rec)
        dishes += ds
        sources += ss
        report.save(restaurants, dishes, sources)  # зберігаємо після кожного ресторану

    report.write(restaurants, dishes, sources, osm_stats, started, time.time() - t0)
    log.info("Готово. Результати в папці output/")


if __name__ == "__main__":
    main()

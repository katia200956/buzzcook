"""А. Збір ресторанів з OpenStreetMap (безкоштовно, ліцензія ODbL).

Завантажує всі заклади з тегом amenity=restaurant у межах Києва,
потім випадково (але завжди однаково) вибирає 50 із них.
Випадкова вибірка чесніша, ніж «перші 50»: так видно реальну частку
закладів із сайтом і меню.
"""
from __future__ import annotations

import json
import logging
import random

from . import config, http

log = logging.getLogger(__name__)

QUERY = f"""
[out:json][timeout:120];
area["wikidata"="{config.CITY_WIKIDATA}"]->.city;
nwr["amenity"="restaurant"]["name"](area.city);
out center tags;
"""

WEBSITE_TAGS = ["website", "contact:website", "url", "brand:website"]
SOCIAL_TAGS = ["contact:facebook", "facebook", "contact:instagram", "instagram"]


def _first(tags: dict, keys: list[str]) -> str:
    for k in keys:
        v = (tags.get(k) or "").strip()
        if v:
            return v.split(";")[0].strip()
    return ""


def fetch_all() -> list[dict]:
    last_err = None
    for url in config.OVERPASS_URLS:
        try:
            r = http.post(url, {"data": QUERY})
            r.raise_for_status()
            elements = r.json().get("elements", [])
            log.info("Overpass %s: %d закладів", url, len(elements))
            return elements
        except Exception as e:  # noqa: BLE001
            last_err = e
            log.warning("Overpass %s не відповів: %s", url, e)
    raise RuntimeError(f"OpenStreetMap недоступний: {last_err}")


def to_row(el: dict) -> dict:
    t = el.get("tags", {})
    lat = el.get("lat") or (el.get("center") or {}).get("lat")
    lon = el.get("lon") or (el.get("center") or {}).get("lon")
    street = t.get("addr:street", "")
    house = t.get("addr:housenumber", "")
    address = ", ".join(x for x in [street, house] if x)
    return {
        "restaurant_id": f"osm-{el['type'][0]}{el['id']}",
        "name": t.get("name", ""),
        "address": address,
        "latitude": lat,
        "longitude": lon,
        "cuisine": t.get("cuisine", "").replace(";", ", "),
        "phone": _first(t, ["phone", "contact:phone"]),
        "osm_website": _first(t, WEBSITE_TAGS),
        "social_page": _first(t, SOCIAL_TAGS),
        "osm_menu_url": _first(t, ["website:menu", "menu:url", "contact:menu"]),
        "osm_url": f"https://www.openstreetmap.org/{el['type']}/{el['id']}",
    }


def collect(sample_size: int = config.SAMPLE_SIZE) -> tuple[list[dict], dict]:
    elements = fetch_all()
    config.RAW_DIR.mkdir(parents=True, exist_ok=True)
    (config.RAW_DIR / "osm_kyiv_restaurants.json").write_text(
        json.dumps(elements, ensure_ascii=False), encoding="utf-8")
    rows = [to_row(e) for e in elements]
    rows.sort(key=lambda r: r["restaurant_id"])
    stats = {
        "osm_total": len(rows),
        "osm_with_website": sum(1 for r in rows if r["osm_website"]),
        "osm_with_address": sum(1 for r in rows if r["address"]),
        "osm_with_cuisine": sum(1 for r in rows if r["cuisine"]),
    }
    random.Random(config.RANDOM_SEED).shuffle(rows)
    return rows[:sample_size], stats

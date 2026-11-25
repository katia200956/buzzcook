"""Д. Витягування страв звичайними алгоритмами, без AI.

HTML: спочатку шукаємо структуровану розмітку schema.org (MenuItem),
потім елементи з ціною («грн», «₴», клас price) і беремо назву поруч.
PDF: беремо текст із файлу і шукаємо рядки «назва ... ціна».
Калорії та БЖВ записуємо тільки тоді, коли вони прямо підписані в джерелі.
"""
from __future__ import annotations

import json
import re

from bs4 import BeautifulSoup, Tag

CURRENCY = r"(?:грн\.?|₴|uah|гривень|гривні)"
NUM = r"\d{1,5}(?:[.,]\d{1,2})?"
PRICE_RE = re.compile(rf"({NUM})\s*{CURRENCY}", re.I)
PRICE_ONLY_RE = re.compile(rf"^\s*({NUM})\s*{CURRENCY}?\s*$", re.I)
KCAL_RE = re.compile(r"(\d{1,4}(?:[.,]\d)?)\s*(?:ккал|kcal|кКал)", re.I)
PROT_RE = re.compile(r"(?:білк[иі]в?|белк[иі]|protein[s]?|б)\s*[:\-–]?\s*(\d{1,3}(?:[.,]\d)?)\s*(?:г|g)?\b", re.I)
FAT_RE = re.compile(r"(?:жир[иі]в?|fat[s]?|ж)\s*[:\-–]?\s*(\d{1,3}(?:[.,]\d)?)\s*(?:г|g)?\b", re.I)
CARB_RE = re.compile(r"(?:вуглевод[иі]в?|углевод[ыи]|carb(?:ohydrate)?s?|в|у)\s*[:\-–]?\s*(\d{1,3}(?:[.,]\d)?)\s*(?:г|g)?\b", re.I)
LETTERS = re.compile(r"[A-Za-zА-Яа-яІіЇїЄєҐґ]{3,}")
WEIGHT_ONLY = re.compile(r"^\s*\d+\s*(?:г|гр|g|мл|ml|шт)\.?\s*(?:/\s*\d+\s*(?:г|гр|g|мл|ml)\.?)*\s*$", re.I)


def _num(s: str) -> float:
    return float(s.replace(",", "."))


def nutrition(text: str) -> dict:
    """КБЖВ тільки з явних підписів. Літерні скорочення Б/Ж/В беремо лише
    коли поруч є «ккал», щоб не сплутати з іншими числами."""
    out = {"calories_kcal": None, "proteins_g": None, "fats_g": None, "carbohydrates_g": None}
    m = KCAL_RE.search(text)
    if not m:
        return out
    out["calories_kcal"] = _num(m.group(1))
    for key, rx in (("proteins_g", PROT_RE), ("fats_g", FAT_RE), ("carbohydrates_g", CARB_RE)):
        mm = rx.search(text)
        if mm:
            out[key] = _num(mm.group(1))
    return out


def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip(" \t\n·•-–—|:")


def _dish(name, price, desc, category, src, method, text_for_nutr="") -> dict:
    d = {
        "dish_name": _clean(name)[:200],
        "description": _clean(desc)[:500],
        "category": _clean(category)[:100],
        "price": price,
        "currency": "UAH" if price is not None else "",
        "source_url": src,
        "extraction_method": method,
    }
    d.update(nutrition(text_for_nutr))
    d["extraction_status"] = "ok" if price is not None else "no_price"
    return d


# ---------- HTML ----------

def _jsonld_items(soup: BeautifulSoup, url: str) -> list[dict]:
    dishes = []

    def walk(node, section=""):
        if isinstance(node, list):
            for n in node:
                walk(n, section)
        elif isinstance(node, dict):
            t = node.get("@type", "")
            t = " ".join(t) if isinstance(t, list) else str(t)
            if "MenuSection" in t:
                section = node.get("name", section)
            if "MenuItem" in t:
                price = None
                offers = node.get("offers")
                if isinstance(offers, list) and offers:
                    offers = offers[0]
                if isinstance(offers, dict) and offers.get("price") not in (None, ""):
                    try:
                        price = _num(str(offers["price"]))
                    except ValueError:
                        price = None
                nut = node.get("nutrition") or {}
                d = _dish(node.get("name", ""), price, node.get("description", ""), section, url, "schema.org")
                if isinstance(nut, dict):
                    def first_num(v):
                        m = re.search(r"\d+(?:[.,]\d+)?", str(v or ""))
                        return _num(m.group(0)) if m else None
                    d["calories_kcal"] = first_num(nut.get("calories"))
                    if d["calories_kcal"] is not None:
                        d["proteins_g"] = first_num(nut.get("proteinContent"))
                        d["fats_g"] = first_num(nut.get("fatContent"))
                        d["carbohydrates_g"] = first_num(nut.get("carbohydrateContent"))
                dishes.append(d)
            for v in node.values():
                if isinstance(v, (dict, list)):
                    walk(v, section)

    for s in soup.find_all("script", type="application/ld+json"):
        try:
            walk(json.loads(s.string or ""))
        except (json.JSONDecodeError, TypeError):
            continue
    return dishes


def _is_price_node(el: Tag) -> bool:
    cls = " ".join(el.get("class", [])) + " " + (el.get("id") or "")
    return bool(re.search(r"price|cost|ціна|цена", cls, re.I))


def _heading_before(el: Tag) -> str:
    h = el.find_previous(["h1", "h2", "h3", "h4"])
    return h.get_text(" ", strip=True) if h else ""


def _name_in(container: Tag, price_text: str) -> tuple[str, str]:
    for sel in ["[class*=title]", "[class*=name]", "h3", "h4", "h5", "h2", "strong", "b"]:
        el = container.select_one(sel)
        if el:
            t = _clean(el.get_text(" ", strip=True))
            if LETTERS.search(t) and not PRICE_RE.search(t) and len(t) < 120:
                desc_el = container.select_one("[class*=desc], [class*=compos], [class*=ingred], p")
                desc = desc_el.get_text(" ", strip=True) if desc_el and desc_el is not el else ""
                return t, desc
    parts = [p for p in (_clean(x) for x in container.stripped_strings)
             if p and price_text not in p and LETTERS.search(p) and not WEIGHT_ONLY.match(p)]
    if not parts:
        return "", ""
    return parts[0], " ".join(parts[1:3])


def html_dishes(html: str, url: str) -> tuple[list[dict], dict]:
    soup = BeautifulSoup(html, "html.parser")
    info = {"text_len": len(soup.get_text(" ", strip=True)),
            "scripts": len(soup.find_all("script"))}
    dishes = _jsonld_items(soup, url)
    if dishes:
        return dishes, info
    for t in soup(["script", "style", "noscript"]):
        t.decompose()

    seen, out = set(), []
    candidates = []
    for s in soup.find_all(string=PRICE_RE):
        candidates.append(s.parent)
    for el in soup.find_all(_is_price_node):
        if PRICE_ONLY_RE.match(el.get_text(" ", strip=True) or "x"):
            candidates.append(el)
    for el in candidates:
        ptext = el.get_text(" ", strip=True)
        m = PRICE_RE.search(ptext) or PRICE_ONLY_RE.match(ptext)
        if not m:
            continue
        price = _num(m.group(1))
        if price <= 0 or price > 50000:
            continue
        container = el
        name = desc = ""
        for _ in range(5):
            if container.parent is None:
                break
            container = container.parent
            txt = container.get_text(" ", strip=True)
            if len(txt) > 600:
                break
            name, desc = _name_in(container, m.group(0))
            if name:
                break
        if not name:
            continue
        key = (name.lower(), price)
        if key in seen:
            continue
        seen.add(key)
        nut_text = container.get_text(" ", strip=True) if len(container.get_text()) < 600 else ""
        out.append(_dish(name, price, desc, _heading_before(container), url, "html-price", nut_text))
    return out, info


# ---------- PDF ----------

NOISE_RE = re.compile(r"©|тел|tel\b|\+38|www\.|http|@|wi-?fi|адрес|вул\.|street", re.I)
LINE_PRICE_RE = re.compile(rf"^(.*?[A-Za-zА-Яа-яІіЇїЄєҐґ].*?)[\s.…_\-–]*({NUM})\s*{CURRENCY}?\s*$", re.I)


def pdf_dishes(text: str, url: str) -> list[dict]:
    lines = [_clean(l) for l in text.splitlines()]
    lines = [l for l in lines if l]
    out, seen, category, prev = [], set(), "", ""
    for line in lines:
        if NOISE_RE.search(line):
            prev = line
            continue
        m = LINE_PRICE_RE.match(line)
        pm = PRICE_ONLY_RE.match(line)
        name = price = None
        if m and LETTERS.search(m.group(1)) and not WEIGHT_ONLY.match(m.group(1)):
            name, price = m.group(1), _num(m.group(2))
            # «Борщ 300 г 120» — прибираємо вагу з кінця назви
            name = re.sub(r"\s*\d+\s*(?:г|гр|g|мл|ml)\.?(?:\s*/\s*\d+\s*(?:г|гр|g|мл|ml)\.?)*\s*$", "", name, flags=re.I)
        elif pm and prev and LETTERS.search(prev) and PRICE_RE.search(line + " грн"):
            name, price = prev, _num(pm.group(1))
        if name and price and 5 <= price <= 50000 and len(name) < 120:
            key = (name.lower(), price)
            if key not in seen:
                seen.add(key)
                out.append(_dish(name, price, "", category, url, "pdf-text", line))
        elif not re.search(r"\d", line) and 2 < len(line) < 40 and line.upper() == line:
            category = line
        prev = line
    return out

"""Б, В, Г. Перевірка сайту, пошук меню, QR-коди, витягування страв для одного ресторану.

Кожен ресторан обробляється окремо: помилка на одному не зупиняє інші.
"""
from __future__ import annotations

import logging
import re
from urllib.parse import urljoin, urlparse

import pymupdf as fitz  # PyMuPDF
import requests
from bs4 import BeautifulSoup

from . import config, extract, http, qr

log = logging.getLogger(__name__)

MENU_WORDS = re.compile(r"menu|меню|menyu|food|kitchen|кухн|страв|dish|qr|eat|карта|bar-?menu|винн", re.I)
NOT_SITE = re.compile(r"facebook\.com|instagram\.com|tripadvisor|google\.|goo\.gl|t\.me|tiktok|youtube|glovo|bolt\.eu|wolt|uklon", re.I)
SKIP_HREF = re.compile(r"^(mailto:|tel:|javascript:|#)", re.I)
IMG_QR = re.compile(r"qr", re.I)
IMG_MENU = re.compile(r"menu|меню", re.I)


def page_text(resp: requests.Response) -> str:
    """Правильне кодування: якщо сервер не вказав charset, визначаємо його самі
    (інакше кирилиця перетворюється на «кракозябри»)."""
    if "charset" not in resp.headers.get("Content-Type", "").lower():
        resp.encoding = resp.apparent_encoding or "utf-8"
    return resp.text


def norm_url(u: str) -> str:
    u = u.strip()
    if not re.match(r"^https?://", u, re.I):
        u = "https://" + u.lstrip("/")
    return u


def _host(u: str) -> str:
    return urlparse(u).netloc.lower().removeprefix("www.")


def _is_pdf(url: str, resp: requests.Response | None = None) -> bool:
    if resp is not None and "pdf" in resp.headers.get("Content-Type", "").lower():
        return True
    return urlparse(url).path.lower().endswith(".pdf")


def _links(soup: BeautifulSoup, base: str, site_host: str) -> list[tuple[str, str]]:
    """Повертає [(url, kind)]: kind = menu_page | pdf | online_menu."""
    out = []
    for a in soup.find_all(["a", "iframe"]):
        href = a.get("href") or a.get("src") or ""
        if not href or SKIP_HREF.match(href):
            continue
        url = urljoin(base, href).split("#")[0]
        if not url.startswith("http"):
            continue
        text = (a.get_text(" ", strip=True) or "") + " " + (a.get("title") or "") + " " + url
        host = _host(url)
        if _is_pdf(url):
            out.append((url, "pdf"))
        elif NOT_SITE.search(host):
            continue
        elif host == site_host or host.endswith("." + site_host):
            if MENU_WORDS.search(text):
                out.append((url, "menu_page"))
        elif re.search(r"menu|qr", host, re.I) or (MENU_WORDS.search(text) and a.name == "iframe"):
            out.append((url, "online_menu"))
    seen, uniq = set(), []
    for u, k in out:
        if u not in seen:
            seen.add(u)
            uniq.append((u, k))
    order = {"pdf": 0, "online_menu": 1, "menu_page": 2}
    uniq.sort(key=lambda x: order[x[1]])
    return uniq


def _images(soup: BeautifulSoup, base: str, rx: re.Pattern) -> list[str]:
    out = []
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src") or ""
        meta = " ".join([src, img.get("alt") or "", " ".join(img.get("class", []))])
        if src and rx.search(meta):
            out.append(urljoin(base, src))
    return list(dict.fromkeys(out))


def process(r: dict) -> tuple[dict, list[dict], list[dict]]:
    rec = dict(r)
    rec.update({
        "restaurant_found": True, "website": "", "website_found": False, "website_reachable": False,
        "website_http_status": "", "menu_found": False, "menu_url": "", "menu_formats": "",
        "dishes_extracted": 0, "dishes_with_price": 0, "dishes_with_nutrition": 0,
        "needs_manual": "", "failure_reason": "",
    })
    sources: list[dict] = []
    dishes: list[dict] = []
    rid = r["restaurant_id"]

    def src(url, kind, status="", allowed="", note=""):
        sources.append({"restaurant_id": rid, "restaurant_name": r["name"], "url": url,
                        "source_type": kind, "http_status": status, "robots_allowed": allowed, "note": note})

    if r.get("social_page"):
        src(r["social_page"], "social_page", note="соцмережа з OSM, не обробляється")

    site = r.get("osm_website", "")
    if not site:
        rec["failure_reason"] = "сайту немає в OpenStreetMap (щоб знайти, потрібен пошуковий сервіс)"
        rec["needs_manual"] = "пошук сайту"
        return rec, dishes, sources
    site = norm_url(site)
    if NOT_SITE.search(_host(site)):
        src(site, "social_page", note="в OSM замість сайту вказана соцмережа/агрегатор")
        rec["failure_reason"] = "замість сайту вказана соцмережа або агрегатор"
        rec["needs_manual"] = "пошук сайту"
        return rec, dishes, sources
    rec["website"] = site
    rec["website_found"] = True

    # головна сторінка
    try:
        resp = http.get(site)
    except http.Blocked:
        src(site, "website", allowed=False, note="заборонено в robots.txt")
        rec["failure_reason"] = "сайт забороняє автоматичний доступ (robots.txt)"
        return rec, dishes, sources
    except requests.exceptions.SSLError:
        try:
            site = site.replace("https://", "http://", 1)
            resp = http.get(site)
        except Exception as e:  # noqa: BLE001
            src(site, "website", note=f"помилка: {type(e).__name__}")
            rec["failure_reason"] = "сайт не відкривається (помилка SSL)"
            return rec, dishes, sources
    except Exception as e:  # noqa: BLE001
        src(site, "website", note=f"помилка: {type(e).__name__}")
        rec["failure_reason"] = f"сайт не відкривається ({type(e).__name__})"
        return rec, dishes, sources

    rec["website_http_status"] = resp.status_code
    src(site, "website", resp.status_code, True, f"кінцева адреса: {resp.url}" if resp.url != site else "")
    if resp.status_code >= 400:
        rec["failure_reason"] = f"сайт повертає помилку {resp.status_code}"
        return rec, dishes, sources
    rec["website_reachable"] = True
    site_host = _host(resp.url)

    formats: set[str] = set()
    js_suspect = False
    manual: list[str] = []
    menu_urls: list[str] = []

    queue: list[tuple[str, str]] = []
    if r.get("osm_menu_url"):
        queue.append((norm_url(r["osm_menu_url"]), "menu_page"))
    home_html = page_text(resp)
    home_soup = BeautifulSoup(home_html, "html.parser") if "html" in resp.headers.get("Content-Type", "html") else None
    if home_soup is not None:
        found, info = extract.html_dishes(home_html, resp.url)
        if len(found) >= 3:
            dishes += found
            formats.add("HTML")
            menu_urls.append(resp.url)
        queue += _links(home_soup, resp.url, site_host)
        for img in _images(home_soup, resp.url, IMG_QR)[: config.MAX_IMAGES_FOR_QR]:
            queue += _qr_targets(img, src)

    visited = {resp.url}
    pages = 0
    while queue and pages < config.MAX_PAGES_PER_SITE:
        url, kind = queue.pop(0)
        if url in visited:
            continue
        visited.add(url)
        pages += 1
        try:
            if kind == "pdf" or _is_pdf(url):
                got, fmt, note = _pdf(url)
                src(url, "pdf_menu", 200 if fmt else "", True, note)
                if fmt:
                    formats.add(fmt)
                    menu_urls.append(url)
                    if fmt == "PDF-зображення":
                        manual.append("PDF без тексту (скан): потрібне розпізнавання")
                dishes += got
                continue
            p = http.get(url)
            if p.status_code >= 400:
                src(url, kind, p.status_code, True, "помилка сторінки")
                continue
            if _is_pdf(url, p):
                queue.insert(0, (p.url, "pdf"))
                visited.discard(p.url)
                continue
            html = page_text(p)
            got, info = extract.html_dishes(html, p.url)
            src(url, kind, p.status_code, True, f"страв: {len(got)}")
            soup = BeautifulSoup(html, "html.parser")
            menu_imgs = _images(soup, p.url, IMG_MENU)
            if got:
                dishes += got
                formats.add("онлайн-меню" if kind in ("online_menu", "qr_target") else "HTML")
                menu_urls.append(p.url)
            elif kind in ("online_menu", "qr_target", "menu_page"):
                if info["text_len"] < 400 and info["scripts"] >= 3:
                    js_suspect = True
                    formats.add("JS-сторінка")
                    menu_urls.append(p.url)
                elif menu_imgs:
                    formats.add("зображення")
                    menu_urls.append(p.url)
                    for im in menu_imgs[:5]:
                        src(im, "menu_image", note="меню картинкою: потрібне розпізнавання")
            # на сторінці меню шукаємо PDF і QR
            for u, k in _links(soup, p.url, site_host):
                if k == "pdf" and u not in visited:
                    queue.insert(0, (u, k))
            for img in _images(soup, p.url, IMG_QR)[:3]:
                queue += _qr_targets(img, src)
        except http.Blocked:
            src(url, kind, allowed=False, note="заборонено в robots.txt")
        except Exception as e:  # noqa: BLE001
            src(url, kind, note=f"помилка: {type(e).__name__}")
            log.debug("%s: %s", url, e)

    # прибираємо повтори страв між сторінками
    uniq, seen = [], set()
    for d in dishes:
        key = (d["dish_name"].lower(), d["price"])
        if d["dish_name"] and key not in seen:
            seen.add(key)
            d["restaurant_id"] = rid
            d["restaurant_name"] = r["name"]
            uniq.append(d)
    dishes = uniq

    if js_suspect:
        manual.append("меню підвантажується JavaScript: потрібен браузерний режим")
    if "зображення" in formats:
        manual.append("меню картинкою: потрібне розпізнавання")
    rec["menu_found"] = bool(menu_urls or dishes)
    rec["menu_url"] = menu_urls[0] if menu_urls else ""
    rec["menu_formats"] = ", ".join(sorted(formats))
    rec["dishes_extracted"] = len(dishes)
    rec["dishes_with_price"] = sum(1 for d in dishes if d["price"] is not None)
    rec["dishes_with_nutrition"] = sum(1 for d in dishes if d.get("calories_kcal") is not None)
    rec["needs_manual"] = "; ".join(dict.fromkeys(manual))
    if not rec["menu_found"]:
        rec["failure_reason"] = "на сайті не знайдено посилання на меню"
    elif not dishes:
        rec["failure_reason"] = "меню знайдено, але страви не вдалося витягти автоматично"
    return rec, dishes, sources


def _pdf(url: str) -> tuple[list[dict], str, str]:
    resp = http.get(url, stream=True)
    if resp.status_code >= 400:
        return [], "", f"помилка {resp.status_code}"
    size = int(resp.headers.get("Content-Length") or 0)
    if size > config.MAX_PDF_MB * 1024 * 1024:
        return [], "PDF", "файл завеликий, пропущено"
    data = resp.content
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception:  # noqa: BLE001
        return [], "", "не PDF або пошкоджений файл"
    text = "\n".join(page.get_text() for page in doc)
    if len(text.strip()) < 20 * max(doc.page_count, 1):
        return [], "PDF-зображення", f"сторінок: {doc.page_count}, тексту немає (скан)"
    got = extract.pdf_dishes(text, url)
    return got, "PDF", f"сторінок: {doc.page_count}, страв: {len(got)}"


def _qr_targets(img_url: str, src) -> list[tuple[str, str]]:
    try:
        r = http.get(img_url)
        if r.status_code >= 400:
            return []
        urls = [u for u in qr.decode(r.content) if u.startswith("http")]
        src(img_url, "qr_image", r.status_code, True, f"розпізнано посилань: {len(urls)}")
        for u in urls:
            src(u, "qr_target", note="адреса з QR-коду")
        return [(u, "qr_target") for u in urls]
    except Exception as e:  # noqa: BLE001
        src(img_url, "qr_image", note=f"помилка: {type(e).__name__}")
        return []

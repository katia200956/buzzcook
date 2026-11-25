"""Ввічливі HTTP-запити.

Перед кожним сайтом читає robots.txt і не відкриває заборонені сторінки,
робить паузу між запитами до одного сайту, не обходить жодних обмежень.
"""
from __future__ import annotations

import logging
import time
import urllib.robotparser
from urllib.parse import urlparse

import requests

from . import config

log = logging.getLogger(__name__)

_session = requests.Session()
_session.headers.update({
    "User-Agent": config.USER_AGENT,
    "Accept-Language": "uk,en;q=0.8,ru;q=0.5",
})
_robots: dict[str, urllib.robotparser.RobotFileParser | None] = {}
_last_hit: dict[str, float] = {}


class Blocked(Exception):
    """Сторінку заборонено в robots.txt."""


def _domain(url: str) -> str:
    return urlparse(url).netloc.lower()


def _robots_for(url: str):
    p = urlparse(url)
    key = f"{p.scheme}://{p.netloc}"
    if key not in _robots:
        rp = urllib.robotparser.RobotFileParser()
        try:
            r = _session.get(key + "/robots.txt", timeout=config.REQUEST_TIMEOUT)
            if r.status_code == 200:
                rp.parse(r.text.splitlines())
            elif r.status_code in (401, 403):
                rp.parse(["User-agent: *", "Disallow: /"])
            else:
                rp = None  # robots.txt немає: дозволено
        except requests.RequestException:
            rp = None
        _robots[key] = rp
    return _robots[key]


def allowed(url: str) -> bool:
    rp = _robots_for(url)
    return True if rp is None else rp.can_fetch(config.USER_AGENT, url)


def _wait(url: str) -> None:
    d = _domain(url)
    gap = time.time() - _last_hit.get(d, 0)
    if gap < config.DELAY_PER_DOMAIN:
        time.sleep(config.DELAY_PER_DOMAIN - gap)
    _last_hit[d] = time.time()


def get(url: str, stream: bool = False, check_robots: bool = True) -> requests.Response:
    """GET із перевіркою robots.txt і паузою. Помилки мережі піднімає далі."""
    if check_robots and not allowed(url):
        raise Blocked(url)
    _wait(url)
    return _session.get(url, timeout=config.REQUEST_TIMEOUT, stream=stream, allow_redirects=True)


def post(url: str, data: dict) -> requests.Response:
    _wait(url)
    return _session.post(url, data=data, timeout=(15, 120))

"""Налаштування в одному місці: місто, кількість, паузи, назва бота."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / "output"
RAW_DIR = ROOT / "data" / "raw"
LOG_FILE = ROOT / "output" / "run.log"

# Київ у Вікіданих (так OpenStreetMap однозначно знаходить межі міста)
CITY_NAME = "Київ"
CITY_WIKIDATA = "Q1899"
SAMPLE_SIZE = 50
RANDOM_SEED = 2026  # однаковий набір ресторанів при кожному запуску

OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
OVERPASS_ROUNDS = 3          # скільки разів пройти по всіх серверах
OVERPASS_WAIT = [30, 90]     # пауза між колами, секунд

USER_AGENT = "BuzzcookMenuBot/0.1 (test research; respects robots.txt)"
REQUEST_TIMEOUT = 20          # секунд на один запит
DELAY_PER_DOMAIN = 1.5        # пауза між запитами до одного сайту, секунд
MAX_PAGES_PER_SITE = 6        # скільки сторінок одного сайту максимум відкриваємо
MAX_PDF_MB = 25
MAX_IMAGES_FOR_QR = 8

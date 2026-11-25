"""Перевірка алгоритмів на зразках, без інтернету:  python -m unittest"""
import unittest

import cv2
import numpy as np
import pymupdf

from collector import extract, qr

HTML_CARDS = """
<html><body><h2>Перші страви</h2>
<div class="menu-item"><div class="item-title">Борщ український</div>
<p class="desc">З пампушками та салом</p><span class="weight">350 г</span><span class="price">145 грн</span></div>
<div class="menu-item"><div class="item-title">Солянка</div><span class="price">160 ₴</span>
<small>320 ккал, білки 14 г, жири 18 г, вуглеводи 22 г</small></div>
<h2>Десерти</h2>
<div class="menu-item"><h4>Сирники</h4><span class="price">120</span></div>
</body></html>"""

HTML_JSONLD = """<html><head><script type="application/ld+json">
{"@type":"Menu","hasMenuSection":[{"@type":"MenuSection","name":"Салати",
"hasMenuItem":[{"@type":"MenuItem","name":"Цезар","description":"курка, романо",
"offers":{"@type":"Offer","price":"210","priceCurrency":"UAH"},
"nutrition":{"@type":"NutritionInformation","calories":"450 calories"}}]}]}
</script></head><body></body></html>"""

PDF_TEXT = """САЛАТИ
Олів'є 250 г ........ 135
Грецький салат 180 грн
Тел. +38 044 123 45 67
ГАРЯЧІ СТРАВИ
Деруни зі сметаною
95
"""


class T(unittest.TestCase):
    def test_html_cards(self):
        ds, _ = extract.html_dishes(HTML_CARDS, "https://x.ua/menu")
        names = {d["dish_name"]: d for d in ds}
        self.assertIn("Борщ український", names)
        self.assertEqual(names["Борщ український"]["price"], 145)
        self.assertEqual(names["Борщ український"]["category"], "Перші страви")
        self.assertIsNone(names["Борщ український"]["calories_kcal"])
        self.assertEqual(names["Солянка"]["calories_kcal"], 320)
        self.assertEqual(names["Солянка"]["proteins_g"], 14)
        self.assertEqual(names["Сирники"]["price"], 120)

    def test_jsonld(self):
        ds, _ = extract.html_dishes(HTML_JSONLD, "https://x.ua")
        self.assertEqual(len(ds), 1)
        self.assertEqual(ds[0]["dish_name"], "Цезар")
        self.assertEqual(ds[0]["price"], 210)
        self.assertEqual(ds[0]["category"], "Салати")
        self.assertEqual(ds[0]["calories_kcal"], 450)

    def test_pdf_lines(self):
        ds = extract.pdf_dishes(PDF_TEXT, "https://x.ua/m.pdf")
        got = {d["dish_name"]: (d["price"], d["category"]) for d in ds}
        self.assertEqual(got.get("Олів'є"), (135, "САЛАТИ"))
        self.assertEqual(got.get("Грецький салат"), (180, "САЛАТИ"))
        self.assertEqual(got.get("Деруни зі сметаною"), (95, "ГАРЯЧІ СТРАВИ"))
        self.assertEqual(len(ds), 3)

    def test_real_pdf_roundtrip(self):
        doc = pymupdf.open()
        page = doc.new_page()
        page.insert_text((50, 80), "Pasta Carbonara 240 UAH\nTiramisu 150 UAH", fontsize=12)
        text = pymupdf.open(stream=doc.tobytes(), filetype="pdf")[0].get_text()
        ds = extract.pdf_dishes(text, "u")
        self.assertEqual([(d["dish_name"], d["price"]) for d in ds],
                         [("Pasta Carbonara", 240), ("Tiramisu", 150)])

    def test_qr(self):
        enc = cv2.QRCodeEncoder.create()
        img = enc.encode("https://example.com/menu")
        img = cv2.resize(img, None, fx=8, fy=8, interpolation=cv2.INTER_NEAREST)
        img = cv2.copyMakeBorder(img, 40, 40, 40, 40, cv2.BORDER_CONSTANT, value=255)
        ok, png = cv2.imencode(".png", img)
        self.assertEqual(qr.decode(png.tobytes()), ["https://example.com/menu"])


if __name__ == "__main__":
    unittest.main()

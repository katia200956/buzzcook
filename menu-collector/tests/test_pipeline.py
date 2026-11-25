"""Перевірка всього ланцюжка на маленькому локальному «сайті ресторану»."""
import http.server
import os
import threading
import unittest
from functools import partial

import pymupdf

from collector import config, pipeline

config.DELAY_PER_DOMAIN = 0
os.environ["NO_PROXY"] = "127.0.0.1,localhost"


def make_site(root):
    os.makedirs(os.path.join(root, "files"), exist_ok=True)
    open(os.path.join(root, "robots.txt"), "w").write("User-agent: *\nDisallow: /private/\n")
    open(os.path.join(root, "index.html"), "w").write(
        '<html><body><a href="/menu.html">Меню</a> <a href="/private/menu2.html">Bar menu</a>'
        '<a href="https://instagram.com/x">insta</a></body></html>')
    open(os.path.join(root, "menu.html"), "w").write(
        '<html><body><h2>Супи</h2><div class="item"><b>Борщ</b><span class="price">150 грн</span></div>'
        '<div class="item"><b>Юшка</b><span class="price">130 грн</span></div>'
        '<a href="/files/wine.pdf">Винна карта PDF</a></body></html>')
    doc = pymupdf.open()
    doc.new_page().insert_text((50, 80), "Prosecco 180 UAH\nMerlot 220 UAH", fontsize=12)
    doc.save(os.path.join(root, "files", "wine.pdf"))


class T(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import tempfile
        cls.dir = tempfile.mkdtemp()
        make_site(cls.dir)
        handler = partial(http.server.SimpleHTTPRequestHandler, directory=cls.dir)
        handler.log_message = lambda *a: None
        cls.srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.srv.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()

    def test_site(self):
        r = {"restaurant_id": "t1", "name": "Тест", "osm_website": self.base + "/",
             "social_page": "", "osm_menu_url": ""}
        rec, dishes, sources = pipeline.process(r)
        names = sorted(d["dish_name"] for d in dishes)
        self.assertEqual(names, ["Merlot", "Prosecco", "Борщ", "Юшка"])
        self.assertTrue(rec["menu_found"])
        self.assertIn("PDF", rec["menu_formats"])
        self.assertIn("HTML", rec["menu_formats"])
        blocked = [s for s in sources if s["robots_allowed"] is False]
        self.assertEqual(len(blocked), 1)  # /private/ заборонено robots.txt

    def test_no_site(self):
        rec, d, s = pipeline.process({"restaurant_id": "t2", "name": "Без сайту", "osm_website": "",
                                      "social_page": "https://instagram.com/x", "osm_menu_url": ""})
        self.assertFalse(rec["website_found"])
        self.assertEqual(rec["needs_manual"], "пошук сайту")


if __name__ == "__main__":
    unittest.main()

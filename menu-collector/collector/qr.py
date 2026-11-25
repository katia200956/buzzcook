"""Г. Декодування QR-кодів із картинок на сайті (OpenCV, без AI)."""
from __future__ import annotations

import logging

import cv2
import numpy as np

log = logging.getLogger(__name__)
_detector = cv2.QRCodeDetector()


def decode(image_bytes: bytes) -> list[str]:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return []
    found = []
    try:
        ok, texts, _, _ = _detector.detectAndDecodeMulti(img)
        if ok:
            found = [t for t in texts if t]
    except cv2.error as e:
        log.debug("QR decode error: %s", e)
    if not found:
        try:
            t, _, _ = _detector.detectAndDecode(img)
            if t:
                found = [t]
        except cv2.error:
            pass
    return found

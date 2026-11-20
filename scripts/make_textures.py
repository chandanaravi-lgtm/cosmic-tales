#!/usr/bin/env python3
"""
Texture tiers for fast loading (run: `npm run textures`).

The 8K source textures (assets-src/) are far too heavy for the web, so each
planet gets three WebP sizes:
    *_1k.webp  shown at start-up (the whole solar system is small on screen)
    *_2k.webp  swapped in silently once the scene is visible
    *_4k.webp  loaded only when the camera flies to that body
WebP is ~40-60% smaller than JPEG at the same quality and works in every
current browser. The images are only resized — never edited or flipped — so
they line up with the calibrated models exactly like the originals.
"""
from pathlib import Path
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/images/planets"

SOURCES = {
    "earth": ROOT / "assets-src/earth/textures/1_earth_8k.jpg",
    "moon": ROOT / "assets-src/moon/textures/8k_moon.jpeg",
    "mars": ROOT / "assets-src/mars/textures/mars.jpg",
    "sun": ROOT / "assets-src/sun/textures/sun_2k.jpg",  # the Sun's texture is only 2000x1000 to begin with
}
TIERS = {"1k": (1024, 80), "2k": (2048, 82), "4k": (4096, 84)}
SUN_TIERS = {"1k": (1024, 82)}

for name, src in SOURCES.items():
    if not src.exists():
        print(f"skip {name}: {src} missing")
        continue
    img = Image.open(src).convert("RGB")
    for tier, (w, q) in (SUN_TIERS if name == "sun" else TIERS).items():
        out = OUT / f"{name}_{tier}.webp"
        img.resize((w, w // 2), Image.LANCZOS).save(out, "WEBP", quality=q, method=6)
        print(f"{out.relative_to(ROOT)}  {out.stat().st_size // 1024} KB")

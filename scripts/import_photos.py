#!/usr/bin/env python3
"""
Photo pack -> small local WebP images (run: `npm run photos`, then `npm run data`).

Reads data/photos.json (which file belongs to which machine) and writes
    public/images/rovers/<machine>/<id>.webp         max 1200 px, timeline + gallery viewer
    public/images/rovers/<machine>/<id>-thumb.webp   max 420 px, cards, lists, gallery grid
    public/images/rovers/<machine>/ev-<moment>.webp  new moment photos from data-raw/photos-new/<machine>/<moment>.jpg
    public/images/gallery/<name>.webp (+ -thumb)     every other photo in the pack (gallery only)
and public/data/gallery.json — EVERY photo in data-raw/photos/ (and photos-new/), each
exactly once: pictures that are the same image (a perceptual hash, so a smaller crop or a
re-save counts as the same) are listed only once.
The originals stay untouched. Photos are only resized and re-encoded (EXIF orientation
applied); nothing is cropped or edited.
"""
import json, re, shutil
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
PACK = ROOT / "data-raw/photos"
NEW = ROOT / "data-raw/photos-new"
OUT = ROOT / "public/images"
SIZES = {"": (1200, 78), "-thumb": (420, 72)}
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".jfif"}

cfg = json.loads((ROOT / "data/photos.json").read_text())
machines = {m["id"]: m for m in json.loads((ROOT / "data/machines.source.json").read_text())["machines"]}
for sub in ("rovers", "gallery"):
    if (OUT / sub).exists():
        shutil.rmtree(OUT / sub)


def dhash(im, n=12):
    """64+ bit difference hash: survives resizing, re-compression and small crops."""
    g = im.convert("L").resize((n + 1, n), Image.LANCZOS)
    px = list(g.getdata())
    return sum(1 << i for i, (a, b) in enumerate((px[r * (n + 1) + c], px[r * (n + 1) + c + 1]) for r in range(n) for c in range(n)) if a > b)


def same(h1, h2, n=12):
    return bin(h1 ^ h2).count("1") <= n * n * 0.12


def save(im, folder, stem):
    out = OUT / folder
    out.mkdir(parents=True, exist_ok=True)
    paths = {}
    for suffix, (edge, q) in SIZES.items():
        f = out / f"{stem}{suffix}.webp"
        c = im.copy()
        c.thumbnail((edge, edge), Image.LANCZOS)
        c.save(f, "WEBP", quality=q, method=6)
        paths[suffix] = f.relative_to(ROOT / "public").as_posix()
    return paths[""], paths["-thumb"]


def load(p):
    return ImageOps.exif_transpose(Image.open(p)).convert("RGB")


entries, hashes, dupes = [], [], []
total_in = total_out = 0


def add_to_gallery(im, key, name, group, machine=None, local=None, thumb=None, folder="gallery", stem=None):
    """Add a photo to the gallery unless the same picture is already there."""
    h = dhash(im)
    for k, other in hashes:
        if same(h, other):
            if k != key:  # one pack file used by two machines is simply listed once
                dupes.append(f"{key} (same picture as {k})")
            return None
    hashes.append((key, h))
    if not local:
        local, thumb = save(im, folder, stem)
    e = {"id": f"g{len(entries) + 1}", "name": name, "group": group, "local": local, "thumb": thumb, "pack": key}
    if machine:
        e["machine"] = machine
    entries.append(e)
    return e


# 1. machine photos (used by cards and timelines) — they lead the gallery, grouped by machine
for mid, m in cfg["machines"].items():
    name = machines[mid].get("shortName") or machines[mid]["name"]
    for img in m["images"]:
        src = PACK / m["folder"] / img["file"]
        im = load(src)
        total_in += src.stat().st_size
        local, thumb = save(im, f"rovers/{mid}", img["id"])
        total_out += (ROOT / "public" / local).stat().st_size + (ROOT / "public" / thumb).stat().st_size
        caption = re.sub(r"\.$", "", img.get("caption") or img["alt"])
        add_to_gallery(im, f"{m['folder']}/{img['file']}", caption, name, mid, local, thumb)
        print(f"{mid}/{img['id']}  {im.width}x{im.height}")

# 2. new moment photos: data-raw/photos-new/<machine>/<moment>.<ext> (+ optional <moment>.txt caption)
if NEW.exists():
    for d in sorted(p for p in NEW.iterdir() if p.is_dir() and p.name in machines):
        for f in sorted(p for p in d.iterdir() if p.suffix.lower() in EXTS):
            im = load(f)
            local, thumb = save(im, f"rovers/{d.name}", f"ev-{f.stem}")
            cap = f.with_suffix(".txt")
            name = cap.read_text().strip() if cap.exists() else f.stem.replace("-", " ").capitalize()
            add_to_gallery(im, f"photos-new/{d.name}/{f.name}", name, machines[d.name].get("shortName") or machines[d.name]["name"], d.name, local, thumb)
            print(f"new {d.name}/{f.name}")

# 3. every other photo in the pack — gallery only (named in data/photos.json "galleryNames")
used = {f"{m['folder']}/{i['file']}" for m in cfg["machines"].values() for i in m["images"]}
names = cfg.get("galleryNames", {})
for folder in sorted(p for p in PACK.iterdir() if p.is_dir()):
    for f in sorted(folder.iterdir()):
        key = f"{folder.name}/{f.name}"
        if key in used or f.name.startswith("."):
            continue
        try:
            im = load(f)
        except Exception:
            print(f"skip (not an image): {key}")
            continue
        stem = re.sub(r"[^a-z0-9]+", "-", f"{folder.name}-{f.stem}".lower()).strip("-")
        add_to_gallery(im, key, names.get(key, f.stem), "More space photos", stem=stem)

(ROOT / "public/data").mkdir(parents=True, exist_ok=True)
(ROOT / "public/data/gallery.json").write_text(json.dumps({"photos": entries, "skippedDuplicates": dupes}, indent=1, ensure_ascii=False))
print(f"photo pack {total_in // 1024} KB -> {total_out // 1024} KB of WebP (machine photos)")
print(f"gallery: {len(entries)} unique photos ({len(dupes)} duplicates skipped: {'; '.join(dupes) or '-'})")

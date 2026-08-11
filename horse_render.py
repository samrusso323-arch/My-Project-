"""Renders the board's horse+jockey artwork.

Uses one fixed illustrated pose (render_assets/pose1) split into three
precomputed layers: the recolorable coat, the recolorable silk/jacket
(torso+sleeves+cap+cloth), and everything else (boots, pants, mane, tail,
tack) which stays fixed. Recoloring keeps each layer's original shading by
scaling a chosen flat color by the pixel's lightness relative to that
layer's average lightness, so muscle definition/fabric folds survive.
"""
import hashlib
import json
import os

import numpy as np
from PIL import Image, ImageDraw

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
POSE_DIR = os.path.join(BASE_DIR, "render_assets", "pose1")
CACHE_DIR = os.path.join(BASE_DIR, "render_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

with open(os.path.join(POSE_DIR, "pose1_meta.json")) as f:
    _meta = json.load(f)

_fixed = np.array(Image.open(os.path.join(POSE_DIR, "layer_fixed.png")).convert("RGBA"))
_body = np.array(Image.open(os.path.join(POSE_DIR, "layer_body.png")).convert("RGBA"))
_jacket = np.array(Image.open(os.path.join(POSE_DIR, "layer_jacket.png")).convert("RGBA"))

_body_alpha = _body[..., 3] > 0
_jacket_alpha = _jacket[..., 3] > 0
_fixed_alpha = _fixed[..., 3] > 0
_body_v = _body[..., 0] / 255.0
_jacket_v = _jacket[..., 0] / 255.0

AVG_V_BODY = _meta["avg_v_body"]
AVG_V_JACKET = _meta["avg_v_jacket"]
JACKET_BBOX = _meta["jacket_bbox"]
CLOTH_CENTER = _meta["cloth_center"]
WIDTH, HEIGHT = _meta["width"], _meta["height"]

# where the render is displayed at ~210px wide; render at 2x for sharpness
OUTPUT_SCALE = 2.0

PATTERN_TILE = 16


def hex_to_rgb01(hx):
    hx = (hx or "#808080").lstrip("#")
    if len(hx) == 3:
        hx = "".join(c * 2 for c in hx)
    if len(hx) != 6:
        hx = "808080"
    return tuple(int(hx[i:i + 2], 16) / 255 for i in (0, 2, 4))


def make_pattern_tile(pattern, c1, c2):
    tile = Image.new("RGB", (PATTERN_TILE, PATTERN_TILE), c1)
    d = ImageDraw.Draw(tile)
    t = PATTERN_TILE
    if pattern == "hoops":
        d.rectangle([0, 0, t, t // 2], fill=c2)
    elif pattern == "stripes":
        d.rectangle([0, 0, t // 2, t], fill=c2)
    elif pattern == "spots":
        r = t // 4
        d.ellipse([t // 2 - r, t // 2 - r, t // 2 + r, t // 2 + r], fill=c2)
    elif pattern == "quarters":
        d.rectangle([0, 0, t // 2, t // 2], fill=c2)
        d.rectangle([t // 2, t // 2, t, t], fill=c2)
    elif pattern == "stars":
        cx = cy = t // 2
        r = t // 3
        d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=c2)
    elif pattern == "sash":
        d.polygon([(0, 0), (t // 2, 0), (t, t // 2), (t, t)], fill=c2)
    return tile


def render_horse(body_hex, pattern, silk1_hex, silk2_hex, silk_image_path):
    body_rgb = np.array(hex_to_rgb01(body_hex))
    out = np.zeros((HEIGHT, WIDTH, 4), dtype=np.uint8)

    rel_body = np.clip(_body_v / max(AVG_V_BODY, 0.01), 0.35, 1.55)
    for ch in range(3):
        val = np.clip(body_rgb[ch] * 255 * rel_body, 0, 255)
        out[..., ch] = np.where(_body_alpha, val, out[..., ch])
    out[..., 3] = np.where(_body_alpha, 255, out[..., 3])

    if silk_image_path and os.path.exists(silk_image_path):
        photo = Image.open(silk_image_path).convert("RGB")
        x0, y0, x1, y1 = JACKET_BBOX
        bw, bh = x1 - x0, y1 - y0
        scale = max(bw / photo.width, bh / photo.height)
        nw, nh = max(1, int(photo.width * scale) + 1), max(1, int(photo.height * scale) + 1)
        photo_r = photo.resize((nw, nh))
        left, top = (nw - bw) // 2, (nh - bh) // 2
        photo_c = photo_r.crop((left, top, left + bw, top + bh))
        canvas = Image.new("RGB", (WIDTH, HEIGHT), (0, 0, 0))
        canvas.paste(photo_c, (x0, y0))
        fill_arr = np.array(canvas).astype(float) / 255.0
        shade_strength = 0.30
    else:
        c1 = tuple(int(c * 255) for c in hex_to_rgb01(silk1_hex))
        c2 = tuple(int(c * 255) for c in hex_to_rgb01(silk2_hex))
        tile_arr = np.array(make_pattern_tile(pattern or "solid", c1, c2))
        reps_y = HEIGHT // PATTERN_TILE + 2
        reps_x = WIDTH // PATTERN_TILE + 2
        big = np.tile(tile_arr, (reps_y, reps_x, 1))[:HEIGHT, :WIDTH]
        fill_arr = big.astype(float) / 255.0
        shade_strength = 0.85

    rel_jacket = np.clip(_jacket_v / max(AVG_V_JACKET, 0.01), 0.55, 1.35)
    shade = 1.0 + (rel_jacket - 1.0) * shade_strength
    for ch in range(3):
        val = np.clip(fill_arr[..., ch] * 255 * shade, 0, 255)
        out[..., ch] = np.where(_jacket_alpha, val, out[..., ch])
    out[..., 3] = np.where(_jacket_alpha, 255, out[..., 3])

    for ch in range(4):
        out[..., ch] = np.where(_fixed_alpha, _fixed[..., ch], out[..., ch])

    img = Image.fromarray(out, "RGBA")
    if OUTPUT_SCALE != 1.0:
        img = img.resize((int(WIDTH * OUTPUT_SCALE), int(HEIGHT * OUTPUT_SCALE)), Image.LANCZOS)
    return img


def cache_key(body_hex, pattern, silk1_hex, silk2_hex, silk_filename):
    raw = f"{body_hex}|{pattern}|{silk1_hex}|{silk2_hex}|{silk_filename or ''}"
    return hashlib.sha1(raw.encode()).hexdigest()


def get_or_render_path(body_hex, pattern, silk1_hex, silk2_hex, silk_filename, silks_dir):
    key = cache_key(body_hex, pattern, silk1_hex, silk2_hex, silk_filename)
    cache_path = os.path.join(CACHE_DIR, key + ".png")
    if os.path.exists(cache_path):
        return cache_path
    silk_path = os.path.join(silks_dir, silk_filename) if silk_filename else None
    img = render_horse(body_hex, pattern, silk1_hex, silk2_hex, silk_path)
    img.save(cache_path)
    return cache_path


# fractional position of the saddle-cloth's center, for the number overlay
CLOTH_CENTER_FRACTION = (CLOTH_CENTER[0] / WIDTH, CLOTH_CENTER[1] / HEIGHT)

"""Renders the board's horse+jockey artwork.

Each horse is rendered from one of a few fixed illustrated poses
(render_assets/poseN/), each split into three precomputed layers: the
recolorable coat, the recolorable silk (torso+sleeves+cap, treated as one
region), and everything else (boots, pants, saddle, tack) which stays
fixed. Recoloring keeps each layer's original shading by scaling a chosen
flat color by the pixel's lightness relative to that layer's average
lightness, so muscle definition/fabric folds survive.
"""
import hashlib
import json
import os

import numpy as np
from PIL import Image, ImageDraw

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RENDER_ASSETS_DIR = os.path.join(BASE_DIR, "render_assets")
CACHE_DIR = os.path.join(BASE_DIR, "render_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

OUTPUT_SCALE = 1.6
PATTERN_TILE = 16

POSES = {}


def _load_pose(pose_id):
    pose_dir = os.path.join(RENDER_ASSETS_DIR, pose_id)
    with open(os.path.join(pose_dir, "pose_meta.json")) as f:
        meta = json.load(f)
    fixed = np.array(Image.open(os.path.join(pose_dir, "layer_fixed.png")).convert("RGBA"))
    body = np.array(Image.open(os.path.join(pose_dir, "layer_body.png")).convert("RGBA"))
    jacket = np.array(Image.open(os.path.join(pose_dir, "layer_jacket.png")).convert("RGBA"))
    POSES[pose_id] = {
        "meta": meta,
        "fixed": fixed,
        "fixed_alpha": fixed[..., 3] > 0,
        "body_alpha": body[..., 3] > 0,
        "body_v": body[..., 0] / 255.0,
        "jacket_alpha": jacket[..., 3] > 0,
        "jacket_v": jacket[..., 0] / 255.0,
        "width": meta["width"],
        "height": meta["height"],
        "avg_v_body": meta["avg_v_body"],
        "avg_v_jacket": meta["avg_v_jacket"],
        "jacket_bbox": meta["jacket_bbox"],
        "cloth_center": meta["cloth_center"],
        "cloth_center_fraction": (meta["cloth_center"][0] / meta["width"], meta["cloth_center"][1] / meta["height"]),
    }


for _pose_id in sorted(os.listdir(RENDER_ASSETS_DIR)):
    if os.path.isdir(os.path.join(RENDER_ASSETS_DIR, _pose_id)):
        _load_pose(_pose_id)

DEFAULT_POSE = "pose1" if "pose1" in POSES else sorted(POSES)[0]


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


def render_horse(pose_id, body_hex, pattern, silk1_hex, silk2_hex, silk_image_path):
    pose = POSES.get(pose_id) or POSES[DEFAULT_POSE]
    w, h = pose["width"], pose["height"]
    body_alpha, body_v = pose["body_alpha"], pose["body_v"]
    jacket_alpha, jacket_v = pose["jacket_alpha"], pose["jacket_v"]
    fixed, fixed_alpha = pose["fixed"], pose["fixed_alpha"]

    body_rgb = np.array(hex_to_rgb01(body_hex))
    out = np.zeros((h, w, 4), dtype=np.uint8)

    rel_body = np.clip(body_v / max(pose["avg_v_body"], 0.01), 0.35, 1.55)
    for ch in range(3):
        val = np.clip(body_rgb[ch] * 255 * rel_body, 0, 255)
        out[..., ch] = np.where(body_alpha, val, out[..., ch])
    out[..., 3] = np.where(body_alpha, 255, out[..., 3])

    if silk_image_path and os.path.exists(silk_image_path):
        photo = Image.open(silk_image_path).convert("RGB")
        x0, y0, x1, y1 = pose["jacket_bbox"]
        bw, bh = x1 - x0, y1 - y0
        scale = max(bw / photo.width, bh / photo.height)
        nw, nh = max(1, int(photo.width * scale) + 1), max(1, int(photo.height * scale) + 1)
        photo_r = photo.resize((nw, nh))
        left, top = (nw - bw) // 2, (nh - bh) // 2
        photo_c = photo_r.crop((left, top, left + bw, top + bh))
        canvas = Image.new("RGB", (w, h), (0, 0, 0))
        canvas.paste(photo_c, (x0, y0))
        fill_arr = np.array(canvas).astype(float) / 255.0
        shade_strength = 0.30
    else:
        c1 = tuple(int(c * 255) for c in hex_to_rgb01(silk1_hex))
        c2 = tuple(int(c * 255) for c in hex_to_rgb01(silk2_hex))
        tile_arr = np.array(make_pattern_tile(pattern or "solid", c1, c2))
        reps_y = h // PATTERN_TILE + 2
        reps_x = w // PATTERN_TILE + 2
        big = np.tile(tile_arr, (reps_y, reps_x, 1))[:h, :w]
        fill_arr = big.astype(float) / 255.0
        shade_strength = 0.85

    rel_jacket = np.clip(jacket_v / max(pose["avg_v_jacket"], 0.01), 0.55, 1.35)
    shade = 1.0 + (rel_jacket - 1.0) * shade_strength
    for ch in range(3):
        val = np.clip(fill_arr[..., ch] * 255 * shade, 0, 255)
        out[..., ch] = np.where(jacket_alpha, val, out[..., ch])
    out[..., 3] = np.where(jacket_alpha, 255, out[..., 3])

    for ch in range(4):
        out[..., ch] = np.where(fixed_alpha, fixed[..., ch], out[..., ch])

    img = Image.fromarray(out, "RGBA")
    if OUTPUT_SCALE != 1.0:
        img = img.resize((int(w * OUTPUT_SCALE), int(h * OUTPUT_SCALE)), Image.LANCZOS)
    return img


def cache_key(pose_id, body_hex, pattern, silk1_hex, silk2_hex, silk_filename):
    raw = f"{pose_id}|{body_hex}|{pattern}|{silk1_hex}|{silk2_hex}|{silk_filename or ''}"
    return hashlib.sha1(raw.encode()).hexdigest()


def get_or_render_path(pose_id, body_hex, pattern, silk1_hex, silk2_hex, silk_filename, silks_dir):
    if pose_id not in POSES:
        pose_id = DEFAULT_POSE
    key = cache_key(pose_id, body_hex, pattern, silk1_hex, silk2_hex, silk_filename)
    cache_path = os.path.join(CACHE_DIR, key + ".png")
    if os.path.exists(cache_path):
        return cache_path
    silk_path = os.path.join(silks_dir, silk_filename) if silk_filename else None
    img = render_horse(pose_id, body_hex, pattern, silk1_hex, silk2_hex, silk_path)
    img.save(cache_path)
    return cache_path


def pose_list():
    return [
        {"id": pid, "cloth_center_fraction": POSES[pid]["cloth_center_fraction"]}
        for pid in sorted(POSES)
    ]

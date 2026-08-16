"""
Generate OTIS-branded PWA icons (web manifest).

Creates in apps/web/public/:
  - pwa-192x192.png         "any" icon (rounded panel, matches favicon.svg)
  - pwa-512x512.png         "any" icon at 512
  - maskable-512x512.png    full-bleed background, logo inside the safe zone

Reuses the OTIS logo geometry from generate_android_icons.py so the web/PWA
icons stay pixel-identical to the Android launcher icon.
"""

import os

from PIL import Image, ImageDraw

from generate_android_icons import (
    OTIS_BLUE,
    OTIS_NAVY,
    WHITE,
    draw_otis_logo,
    find_font,
)

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public')


def create_pwa_icon(size, maskable=False):
    # Maskable icons need a full-bleed background (no rounded corners or
    # transparent margin) because the platform crops them to its own shape.
    # The "any" icon mirrors favicon.svg: navy rounded panel + inner blue panel.
    img = Image.new('RGBA', (size, size), OTIS_NAVY)
    draw = ImageDraw.Draw(img)

    if maskable:
        safe = size * 0.8
        cx = size / 2
        cy = safe / 2 + (size - safe) / 2 - size * 0.02
        logo_radius = size * 0.16
    else:
        margin = max(1, size * 0.02)
        rect = (margin, margin, size - margin, size - margin)
        corner = size * 0.22
        draw.rounded_rectangle(rect, radius=corner, fill=OTIS_NAVY)
        inner_margin = size * 0.08
        inner_rect = (
            margin + inner_margin,
            margin + inner_margin,
            size - margin - inner_margin,
            size - margin - inner_margin,
        )
        draw.rounded_rectangle(inner_rect, radius=corner * 0.6, fill=OTIS_BLUE)
        cx = size / 2
        cy = size * 0.36
        logo_radius = size * 0.20

    draw_otis_logo(draw, cx, cy, logo_radius, WHITE)

    # "OTIS" wordmark — larger and lower, clear of the "O" logo.
    text_size = max(9, int(size * 0.14))
    font = find_font(text_size)
    text = 'OTIS'
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    tx = (size - tw) / 2
    ty = size * 0.63
    shadow = max(1, size * 0.008)
    draw.text((tx + shadow, ty + shadow), text, fill=(0, 0, 0, 60), font=font)
    draw.text((tx, ty), text, fill=WHITE, font=font)

    return img


def save_icons():
    os.makedirs(OUT_DIR, exist_ok=True)

    targets = [
        ('pwa-192x192.png', 192, False),
        ('pwa-512x512.png', 512, False),
        ('maskable-512x512.png', 512, True),
    ]
    for name, size, maskable in targets:
        img = create_pwa_icon(size, maskable)
        out = os.path.join(OUT_DIR, name)
        img.save(out, 'PNG')
        print(f'  [OK] {name} ({size}x{size}) -> {out}')


if __name__ == '__main__':
    save_icons()

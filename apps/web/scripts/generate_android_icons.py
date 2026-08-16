"""
Generate OTIS-branded Android app icons at all mipmap densities.

Creates:
  - ic_launcher.png        (round icon with OTIS "O" logo on blue bg)
  - ic_launcher_round.png  (same as launcher, circular crop)
  - ic_launcher_foreground.png (transparent bg, white "O" logo for adaptive icon)

Placed in: android/app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/
"""

import os
from PIL import Image, ImageDraw, ImageFont

# --- Configuration ---

OTIS_NAVY = (0, 32, 91)       # #00205b
OTIS_BLUE = (0, 52, 135)      # #003487
OTIS_LIGHT = (0, 85, 196)     # #0055c4
WHITE = (255, 255, 255)

BASE_DIR = os.path.join(os.path.dirname(__file__), '..', 'android', 'app', 'src', 'main', 'res')

# Launcher icon sizes (standard Android mipmap sizes)
ICON_SIZES = {
    'mipmap-mdpi':     48,   # 1x
    'mipmap-hdpi':     72,   # 1.5x
    'mipmap-xhdpi':    96,   # 2x
    'mipmap-xxhdpi':   144,  # 3x
    'mipmap-xxxhdpi':  192,  # 4x
}

# Foreground icon sizes (adaptive icon viewport is 108dp at mdpi base)
FOREGROUND_SIZES = {
    'mipmap-mdpi':     108,  # 1x  (108dp viewport)
    'mipmap-hdpi':     162,  # 1.5x
    'mipmap-xhdpi':    216,  # 2x
    'mipmap-xxhdpi':   324,  # 3x
    'mipmap-xxxhdpi':  432,  # 4x
}


def find_font(size: int):
    """Try to find a bold sans-serif font, fallback to default."""
    candidates = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
        '/System/Library/Fonts/Helvetica.ttc',
        '/System/Library/Fonts/SFNSDisplay.ttf',
        'C:\\Windows\\Fonts\\segoeuib.ttf',
        'C:\\Windows\\Fonts\\arialbd.ttf',
        'C:\\Windows\\Fonts\\arial.ttf',
        'C:\\Windows\\Fonts\\Calibri.ttf',
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def draw_otis_logo(draw, cx, cy, radius, fill=WHITE):
    """Draw a stylized 'O' for OTIS - a thick-ring circle."""
    # Outer circle
    draw.ellipse(
        [cx - radius, cy - radius, cx + radius, cy + radius],
        fill=None,
        outline=fill,
        width=max(2, int(radius * 0.22)),
    )
    # Inner circle (hollow center)
    inner_r = radius * 0.52
    draw.ellipse(
        [cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r],
        fill=None,
        outline=fill,
        width=max(2, int(radius * 0.15)),
    )
    # Small center dot
    dot_r = radius * 0.08
    draw.ellipse(
        [cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r],
        fill=fill,
    )


def create_launcher_icon(size, round_=False):
    """Create a launcher icon (blue bg + white OTIS logo)."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    rect_margin = max(1, size * 0.02)
    rect = (rect_margin, rect_margin, size - rect_margin, size - rect_margin)

    if round_:
        draw.ellipse(rect, fill=OTIS_NAVY)
        inner_margin = size * 0.08
        inner_rect = (
            rect_margin + inner_margin,
            rect_margin + inner_margin,
            size - rect_margin - inner_margin,
            size - rect_margin - inner_margin,
        )
        draw.ellipse(inner_rect, fill=OTIS_BLUE)
    else:
        corner_radius = size * 0.22
        draw.rounded_rectangle(rect, radius=corner_radius, fill=OTIS_NAVY)
        inner_margin = size * 0.08
        inner_rect = (
            rect_margin + inner_margin,
            rect_margin + inner_margin,
            size - rect_margin - inner_margin,
            size - rect_margin - inner_margin,
        )
        inner_corner = corner_radius * 0.6
        draw.rounded_rectangle(inner_rect, radius=inner_corner, fill=OTIS_BLUE)

    # Draw the OTIS "O" logo (upper part, clear of the wordmark below)
    cx = size / 2
    cy = size * 0.36 if size >= 48 else size / 2
    logo_radius = size * 0.20
    draw_otis_logo(draw, cx, cy, logo_radius, WHITE)

    # Draw "OTIS" text — larger and lower, so it never overlaps the "O" logo
    if size >= 48:
        text_size = max(9, int(size * 0.14))
        font = find_font(text_size)
        text = "OTIS"
        try:
            bbox = draw.textbbox((0, 0), text, font=font)
            tw = bbox[2] - bbox[0]
        except AttributeError:
            tw, _ = draw.textsize(text, font=font)
        tx = (size - tw) / 2
        ty = size * 0.63
        shadow_off = max(1, size * 0.008)
        draw.text((tx + shadow_off, ty + shadow_off), text, fill=(0, 0, 0, 60), font=font)
        draw.text((tx, ty), text, fill=WHITE, font=font)

    return img


def create_foreground_icon(size):
    """Create a foreground icon for adaptive icons (transparent bg, white logo)."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    safe_ratio = 0.667
    cx = size / 2
    cy = size * 0.38
    logo_radius = size * 0.20

    draw_otis_logo(draw, cx, cy, logo_radius, WHITE)

    # Draw "OTIS" text — larger and lower, so it never overlaps the "O" logo
    if size >= 108:
        text_size = max(11, int(size * 0.11))
        font = find_font(text_size)
        text = "OTIS"
        try:
            bbox = draw.textbbox((0, 0), text, font=font)
            tw = bbox[2] - bbox[0]
        except AttributeError:
            tw, _ = draw.textsize(text, font=font)
        tx = (size - tw) / 2
        ty = size * 0.63
        draw.text((tx, ty), text, fill=WHITE, font=font)

    return img


def save_icons():
    """Generate and save all icons to the Android mipmap directories."""
    print("Generating OTIS Android icons...\n")

    for density, size in ICON_SIZES.items():
        dir_path = os.path.join(BASE_DIR, density)
        os.makedirs(dir_path, exist_ok=True)

        img = create_launcher_icon(size, round_=False)
        img.save(os.path.join(dir_path, 'ic_launcher.png'), 'PNG')
        print(f"  [OK] ic_launcher.png ({size}x{size}) -> {density}")

        img_round = create_launcher_icon(size, round_=True)
        img_round.save(os.path.join(dir_path, 'ic_launcher_round.png'), 'PNG')
        print(f"  [OK] ic_launcher_round.png ({size}x{size}) -> {density}")

    for density, size in FOREGROUND_SIZES.items():
        dir_path = os.path.join(BASE_DIR, density)
        os.makedirs(dir_path, exist_ok=True)

        img_fg = create_foreground_icon(size)
        img_fg.save(os.path.join(dir_path, 'ic_launcher_foreground.png'), 'PNG')
        print(f"  [OK] ic_launcher_foreground.png ({size}x{size}) -> {density}")

    print(f"\n[DONE] All icons generated successfully in {BASE_DIR}")


if __name__ == '__main__':
    save_icons()

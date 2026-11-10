"""Generates the PWA icons (run: python tools/make_icons.py)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "icons"
OUT.mkdir(exist_ok=True)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def sparkle(draw, cx, cy, r, fill):
    pts = []
    import math
    for i in range(64):
        a = i / 64 * 2 * math.pi
        # astroid-like 4-point star
        x = math.copysign(abs(math.cos(a)) ** 3, math.cos(a))
        y = math.copysign(abs(math.sin(a)) ** 3, math.sin(a))
        pts.append((cx + x * r, cy + y * r))
    draw.polygon(pts, fill=fill)


def make(size, scale=1.0, rounded=False):
    S = size * 4
    img = Image.new("RGB", (S, S))
    top, bottom = (246, 214, 220), (176, 96, 120)
    px = img.load()
    for y in range(S):
        for x in range(S):
            t = (x * 0.35 + y * 0.65) / S
            px[x, y] = lerp(top, bottom, min(1, t))
    glow = Image.new("RGBA", (S, S), (255, 245, 240, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((S * 0.05, -S * 0.25, S * 0.95, S * 0.55), fill=(255, 245, 240, 90))
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.08))
    img.paste(glow, (0, 0), glow)
    d = ImageDraw.Draw(img)
    sparkle(d, S * 0.5, S * 0.52, S * 0.30 * scale, (255, 252, 250))
    sparkle(d, S * (0.5 + 0.26 * scale), S * (0.52 - 0.25 * scale), S * 0.075 * scale, (255, 240, 236))
    sparkle(d, S * (0.5 - 0.27 * scale), S * (0.52 + 0.24 * scale), S * 0.05 * scale, (255, 236, 232))
    img = img.resize((size, size), Image.LANCZOS)
    if rounded:
        mask = Image.new("L", (size * 4, size * 4), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, size * 4 - 1, size * 4 - 1), radius=size * 4 * 0.22, fill=255)
        mask = mask.resize((size, size), Image.LANCZOS)
        rgba = img.convert("RGBA")
        rgba.putalpha(mask)
        return rgba
    return img


make(180).save(OUT / "apple-touch-icon.png")
make(192, rounded=True).save(OUT / "icon-192.png")
make(512, rounded=True).save(OUT / "icon-512.png")
make(512, scale=0.72).save(OUT / "icon-maskable-512.png")
print("icons written to", OUT)

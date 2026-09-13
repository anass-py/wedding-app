"""Generate PWA icons (two interlocking rings on a warm gradient).  npm run icons"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)


def render(size: int, radius_frac: float) -> Image.Image:
    s = size * 4  # supersample for smooth edges
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # gradient background
    top, bottom = (28, 22, 18), (74, 54, 30)
    for y in range(s):
        t = y / s
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        d.line([(0, y), (s, y)], fill=c + (255,))
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * radius_frac), fill=255)
    img.putalpha(mask)
    # two rings
    gold = (217, 181, 109, 255)
    r = s * 0.24
    w = int(s * 0.055)
    cx1, cx2, cy = s * 0.40, s * 0.60, s * 0.52
    for cx in (cx1, cx2):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=gold, width=w)
    return img.resize((size, size), Image.LANCZOS)


render(512, 0.0).save(OUT / "icon-512.png")
render(192, 0.0).save(OUT / "icon-192.png")
render(180, 0.0).save(OUT / "apple-touch-icon.png")
print(f"Icons written to {OUT}")

"""One-off script to derive PWA icons from the source logo.
Run once locally: python3 scripts/make_icons.py
Not part of the app build/runtime.
"""
from PIL import Image
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "logo.png")
ICONS_DIR = os.path.join(ROOT, "public", "icons")

os.makedirs(ICONS_DIR, exist_ok=True)

src = Image.open(SRC).convert("RGB")

# --- App icon mark: the "Z" + scissors glyph, cropped from the wordmark ---
mark_box = (228, 95, 582, 632)
mark = src.crop(mark_box)

WHITE = (255, 255, 255)


def square_pad(img: Image.Image, target: int, content_ratio: float) -> Image.Image:
    """Paste `img` centered on a `target`x`target` white square, scaled so the
    image's longest side occupies `content_ratio` of the canvas (leaves a
    safe-zone margin, required for maskable icons)."""
    canvas = Image.new("RGB", (target, target), WHITE)
    scale = (target * content_ratio) / max(img.size)
    new_size = (round(img.width * scale), round(img.height * scale))
    resized = img.resize(new_size, Image.LANCZOS)
    offset = ((target - new_size[0]) // 2, (target - new_size[1]) // 2)
    canvas.paste(resized, offset)
    return canvas


# Standard icons: content nearly fills the canvas.
square_pad(mark, 512, 0.92).save(os.path.join(ICONS_DIR, "icon-512.png"))
square_pad(mark, 192, 0.92).save(os.path.join(ICONS_DIR, "icon-192.png"))
square_pad(mark, 180, 0.92).save(os.path.join(ICONS_DIR, "apple-touch-icon.png"))

# Maskable icon: OS may crop to a circle, so keep content inside the ~80% safe zone.
square_pad(mark, 512, 0.6).save(os.path.join(ICONS_DIR, "icon-maskable-512.png"))

# Favicon: small multi-resolution .ico (must be RGBA or Next's image
# processing fails to decode it)
favicon_src = square_pad(mark, 256, 0.92).convert("RGBA")
favicon_src.save(
    os.path.join(ROOT, "app", "favicon.ico"),
    sizes=[(16, 16), (32, 32), (48, 48)],
)

print("Icons generated.")

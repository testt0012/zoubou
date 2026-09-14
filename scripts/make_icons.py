"""One-off script to derive PWA icons from the source logo.
Run once locally: python3 scripts/make_icons.py
Not part of the app build/runtime.
"""
from PIL import Image
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_SRC = os.path.join(ROOT, "assets", "icon-source.png")
ICON_SRC_DARK = os.path.join(ROOT, "assets", "icon-source-dark.jpg")
ICONS_DIR = os.path.join(ROOT, "public", "icons")

os.makedirs(ICONS_DIR, exist_ok=True)

# Pre-composed square artwork (two-line "ZOU / BOU" wordmark, blobs filling
# edge-to-edge) supplied directly as the icon source — no cropping/layout
# needed here, just resize for each target.
icon_src = Image.open(ICON_SRC).convert("RGB")


def square_resize(img: Image.Image, target: int) -> Image.Image:
    return img.resize((target, target), Image.LANCZOS)


# All icons, including maskable, are a plain edge-to-edge resize — no
# padding/border added around the artwork.
square_resize(icon_src, 512).save(os.path.join(ICONS_DIR, "icon-512.png"))
square_resize(icon_src, 192).save(os.path.join(ICONS_DIR, "icon-192.png"))
square_resize(icon_src, 180).save(os.path.join(ICONS_DIR, "apple-touch-icon.png"))
square_resize(icon_src, 512).save(os.path.join(ICONS_DIR, "icon-maskable-512.png"))

# Favicon: small multi-resolution .ico (must be RGBA or Next's image
# processing fails to decode it)
favicon_src = square_resize(icon_src, 256).convert("RGBA")
favicon_src.save(
    os.path.join(ROOT, "app", "favicon.ico"),
    sizes=[(16, 16), (32, 32), (48, 48)],
)

# Dark-mode variants (black-background artwork) for the browser-tab favicon
# and the iOS 18+ "Add to Home Screen" dark icon — both wired up in
# app/layout.tsx via `media: "(prefers-color-scheme: dark)"` icon entries.
# Optional: only generated when the dark source has been supplied.
if os.path.exists(ICON_SRC_DARK):
    icon_src_dark = Image.open(ICON_SRC_DARK).convert("RGB")
    square_resize(icon_src_dark, 180).save(os.path.join(ICONS_DIR, "apple-touch-icon-dark.png"))
    square_resize(icon_src_dark, 192).save(os.path.join(ICONS_DIR, "icon-dark.png"))
    print("Dark icons generated.")

print("Icons generated.")

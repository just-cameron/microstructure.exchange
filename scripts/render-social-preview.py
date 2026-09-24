"""Render the existing TME wordmark as a social-sharing PNG (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SCALE = 2
image = Image.new("RGB", (1200 * SCALE, 630 * SCALE), "#edf1f5")
draw = ImageDraw.Draw(image)
fonts = Path("/System/Library/Fonts/Supplemental")

def text(position, value, size, color, bold=False):
    font = ImageFont.truetype(str(fonts / ("Arial Rounded Bold.ttf" if bold else "Arial.ttf")), size * SCALE)
    draw.text(tuple(v * SCALE for v in position), value, font=font, fill=color)

draw.rounded_rectangle((76*SCALE, 72*SCALE, 256*SCALE, 252*SCALE), radius=24*SCALE, fill="#2467a6")
text((98, 125), "TME", 62, "#f7f9fb", True)
text((300, 91), "The Microstructure", 58, "#19232d", True)
text((300, 163), "Exchange", 58, "#19232d", True)
text((78, 341), "Market structure webinars", 48, "#2467a6", True)
text((80, 416), "Research. Discussion. A connected community.", 30, "#526171")
text((80, 538), "microstructure.exchange", 26, "#526171")
image.resize((1200, 630), Image.Resampling.LANCZOS).save(ROOT / "social-preview.png", optimize=True)

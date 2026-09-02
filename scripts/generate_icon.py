from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "build"
OUT.mkdir(parents=True, exist_ok=True)

S = 1024
canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))

# Soft shadow under the rounded app tile.
shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow)
sd.rounded_rectangle((74, 88, 950, 964), radius=220, fill=(16, 45, 120, 96))
shadow = shadow.filter(ImageFilter.GaussianBlur(30))
canvas.alpha_composite(shadow)

# Diagonal blue gradient, clipped to the rounded square.
gradient = Image.new("RGBA", (S, S), (0, 0, 0, 0))
gp = gradient.load()
stops = ((91, 140, 255), (51, 112, 255), (30, 79, 214))
for y in range(S):
    for x in range(S):
        t = max(0.0, min(1.0, ((x - 68) + (y - 68)) / 1776))
        if t < 0.5:
            u = t * 2
            a, b = stops[0], stops[1]
        else:
            u = (t - 0.5) * 2
            a, b = stops[1], stops[2]
        gp[x, y] = tuple(round(a[i] * (1 - u) + b[i] * u) for i in range(3)) + (255,)
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle((68, 68, 956, 956), radius=218, fill=255)
canvas.alpha_composite(Image.composite(gradient, Image.new("RGBA", (S, S)), mask))

# Subtle highlight for depth.
highlight = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(highlight).arc((105, 95, 675, 560), 195, 300, fill=(255, 255, 255, 42), width=24)
canvas.alpha_composite(highlight)

# Paper shadow and folded document.
paper_shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
pd = ImageDraw.Draw(paper_shadow)
pd.polygon([(276, 184), (633, 184), (766, 317), (766, 840), (276, 840)], fill=(12, 42, 116, 100))
paper_shadow = paper_shadow.filter(ImageFilter.GaussianBlur(24))
shifted = Image.new("RGBA", (S, S), (0, 0, 0, 0))
shifted.alpha_composite(paper_shadow, (0, 24))
canvas.alpha_composite(shifted)

d = ImageDraw.Draw(canvas)
d.polygon([(276, 184), (633, 184), (766, 317), (766, 840), (276, 840)], fill=(255, 255, 255, 255))
d.polygon([(633, 184), (633, 317), (766, 317)], fill=(220, 232, 255, 255))

# Bold M and down arrow: remains recognizable at 16px.
blue = (36, 91, 219, 255)
d.line([(354, 640), (354, 476), (425, 555), (496, 476), (496, 640)], fill=blue, width=42, joint="curve")
d.line([(617, 476), (617, 621)], fill=blue, width=42)
d.line([(552, 557), (617, 624), (682, 557)], fill=blue, width=42, joint="curve")
for point in [(354, 640), (354, 476), (496, 640), (496, 476), (617, 476), (617, 621), (552, 557), (682, 557)]:
    d.ellipse((point[0] - 21, point[1] - 21, point[0] + 21, point[1] + 21), fill=blue)

png = canvas.resize((256, 256), Image.Resampling.LANCZOS)
png.save(OUT / "icon.png", optimize=True)
png.save(OUT / "icon.ico", format="ICO", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print(OUT / "icon.png")
print(OUT / "icon.ico")

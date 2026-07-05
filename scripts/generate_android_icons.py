from pathlib import Path

from PIL import Image, ImageDraw


project_root = Path(__file__).resolve().parents[1]
android_root = project_root / 'android' / 'app' / 'src' / 'main' / 'res'
public_root = project_root / 'public'

android_sizes = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
}

base_size = 512
base = Image.new('RGBA', (base_size, base_size), (7, 16, 40, 255))
draw = ImageDraw.Draw(base)

for y in range(base_size):
    t = y / (base_size - 1)
    r = int(14 * (1 - t) + 6 * t)
    g = int(165 * (1 - t) + 182 * t)
    b = int(164 * (1 - t) + 212 * t)
    draw.line([(0, y), (base_size, y)], fill=(r, g, b, 255))

card = [48, 48, 464, 464]
draw.rounded_rectangle(card, radius=64, fill=(7, 16, 40, 255))

bar_width = 64
gap = 24
x0 = 80
heights = [0.78, 0.56, 0.32, 0.49, 0.24]

for index, height in enumerate(heights):
    x = x0 + index * (bar_width + gap)
    y2 = 436
    y1 = y2 - int((card[3] - card[1] - 80) * height)
    draw.rounded_rectangle([x, y1, x + bar_width, y2], radius=18, fill=(255, 255, 255, 220))

for folder, size in android_sizes.items():
    dest_dir = android_root / folder
    dest_dir.mkdir(parents=True, exist_ok=True)
    out = base.resize((size, size), Image.LANCZOS)

    for name in ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']:
        out.save(dest_dir / name, optimize=True)
        print('wrote', dest_dir / name, size)

for name, size in {
    'apple-touch-icon.png': 180,
    'icon-192.png': 192,
    'icon-512.png': 512,
}.items():
    out = base.resize((size, size), Image.LANCZOS)
    out.save(public_root / name, optimize=True)
    print('wrote', public_root / name, size)

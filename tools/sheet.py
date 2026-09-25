# Usage: python3 tools/sheet.py out.png cols img1 img2 ...  (labels = file stem)
import sys
from PIL import Image, ImageDraw
out, cols, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
ims = [Image.open(f).convert('RGB') for f in files]
w, h = ims[0].size
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (w * cols, h * rows), (40, 40, 40))
for i, (im, f) in enumerate(zip(ims, files)):
    x, y = (i % cols) * w, (i // cols) * h
    sheet.paste(im.resize((w, h)), (x, y))
    ImageDraw.Draw(sheet).text((x + 6, y + 4), f.split('/')[-1].rsplit('.', 1)[0], fill=(255, 255, 0))
sheet.save(out)
print(out, sheet.size)

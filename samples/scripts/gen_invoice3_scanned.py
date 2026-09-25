import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import img2pdf, io, random

random.seed(42)
np.random.seed(42)

W, H = 1700, 2200  # ~200 dpi letter
img = Image.new("L", (W, H), color=255)
draw = ImageDraw.Draw(img)

font_reg = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", 30)
font_bold = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", 40)
font_small = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", 24)

y = 120
draw.text((110, y), "BluePeak Services", font=font_bold, fill=0); y += 60
draw.text((110, y), "HVAC & Facilities Maintenance", font=font_small, fill=40); y += 40
draw.text((110, y), "77 Harbor Loop, Tacoma, WA 98402", font=font_small, fill=40); y += 70

draw.text((110, y), "SERVICE INVOICE", font=font_bold, fill=0); y += 70
draw.text((110, y), "Invoice #: BP-5521", font=font_reg, fill=0); y += 45
draw.text((110, y), "Date: 03/28/2026", font=font_reg, fill=0); y += 45
draw.text((110, y), "Customer: Coastal Retail Group", font=font_reg, fill=0); y += 80

# table header
draw.line((110, y, 1580, y), fill=0, width=2); y += 15
draw.text((110, y), "Description", font=font_reg, fill=0)
draw.text((950, y), "Qty", font=font_reg, fill=0)
draw.text((1120, y), "Unit Price", font=font_reg, fill=0)
draw.text((1380, y), "Total", font=font_reg, fill=0)
y += 45
draw.line((110, y, 1580, y), fill=0, width=2); y += 30

rows = [
    ("On-site HVAC Inspection", "1", "180.00", "180.00"),
    ("Filter Replacement (20x25x1)", "4", "14.75", "59.00"),
    ("Emergency Call-Out Fee", "1", "120.00", "120.00"),
]
for desc, qty, price, tot in rows:
    draw.text((110, y), desc, font=font_reg, fill=0)
    draw.text((950, y), qty, font=font_reg, fill=0)
    draw.text((1120, y), "$" + price, font=font_reg, fill=0)
    draw.text((1380, y), "$" + tot, font=font_reg, fill=0)
    y += 55

y += 20
draw.line((1000, y, 1580, y), fill=0, width=2); y += 25
draw.text((1000, y), "Subtotal:", font=font_reg, fill=0)
draw.text((1380, y), "$359.00", font=font_reg, fill=0); y += 45
draw.text((1000, y), "Grand Total:", font=font_bold, fill=0)
draw.text((1380, y), "$359.00", font=font_bold, fill=0); y += 80

draw.text((110, y), "Please remit payment within 15 days. Thank you.", font=font_small, fill=60)

# ---- degrade to simulate a poor scan ----
# 1. slight rotation
img = img.rotate(3.4, expand=True, fillcolor=255, resample=Image.BICUBIC)

# 2. add gaussian noise
arr = np.array(img).astype(np.float32)
noise = np.random.normal(0, 18, arr.shape)
arr = arr + noise
arr = np.clip(arr, 0, 255).astype(np.uint8)
img = Image.fromarray(arr, mode="L")

# 3. slight blur (simulate poor focus)
img = img.blur = img.filter(ImageFilter.GaussianBlur(radius=1.1))

# 4. reduce contrast slightly + add faint uneven shading (vignette-ish)
arr = np.array(img).astype(np.float32)
h, w = arr.shape
yy, xx = np.mgrid[0:h, 0:w]
cx, cy = w/2, h/2
dist = np.sqrt((xx-cx)**2 + (yy-cy)**2) / np.sqrt(cx**2+cy**2)
shade = 1 - 0.18*dist
arr = arr * shade
arr = np.clip(arr*0.92 + 15, 0, 255).astype(np.uint8)
img = Image.fromarray(arr, mode="L")

# 5. heavy JPEG re-compression to add artifacts
buf = io.BytesIO()
img.convert("RGB").save(buf, format="JPEG", quality=35)
buf.seek(0)
img = Image.open(buf).convert("RGB")

jpg_path = "samples/input/_scanned_tmp.jpg"
img.save(jpg_path, format="JPEG", quality=35)

pdf_bytes = img2pdf.convert(jpg_path)
with open("samples/input/invoice-03-scanned-low-quality.pdf", "wb") as f:
    f.write(pdf_bytes)

print("wrote samples/input/invoice-03-scanned-low-quality.pdf")

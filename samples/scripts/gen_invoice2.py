from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch

path = "samples/input/invoice-02-modern-layout.pdf"
c = canvas.Canvas(path, pagesize=letter)
width, height = letter

# Right-aligned header block, unusual layout
c.setFont("Helvetica-Bold", 20)
c.drawRightString(7.5*inch, height-1*inch, "NORTHSTAR COMPONENTS")
c.setFont("Helvetica", 9)
c.drawRightString(7.5*inch, height-1.2*inch, "Industrial Parts & Fabrication")
c.drawRightString(7.5*inch, height-1.35*inch, "4410 Foundry Rd, Unit 12, Akron, OH 44306")

c.setFillGray(0.9)
c.rect(1*inch, height-2.3*inch, 6.5*inch, 0.05*inch, fill=1, stroke=0)
c.setFillGray(0)

# Unusual field labels
c.setFont("Helvetica-Bold", 11)
c.drawString(1*inch, height-2.6*inch, "BILLING DOCUMENT")
c.setFont("Helvetica", 10)
c.drawString(1*inch, height-2.85*inch, "Doc Ref#:  NC-88213")
c.drawString(1*inch, height-3.05*inch, "Doc Date:  2026-04-02")
c.drawString(1*inch, height-3.25*inch, "Terms:  Net 15")

c.drawString(4.7*inch, height-2.85*inch, "Ship To / Client:")
c.drawString(4.7*inch, height-3.05*inch, "Delta Machine Works")
c.drawString(4.7*inch, height-3.25*inch, "902 Industrial Pkwy, Canton, OH 44702")

# Table with different column order: Qty, Item, Rate, Amount
top = height - 3.8*inch
c.setFont("Helvetica-Bold", 9)
c.setFillGray(0.15)
c.rect(1*inch, top-0.05*inch, 6.5*inch, 0.28*inch, fill=1, stroke=0)
c.setFillGray(1)
c.drawString(1.1*inch, top+0.05*inch, "QTY")
c.drawString(1.8*inch, top+0.05*inch, "ITEM")
c.drawString(5.4*inch, top+0.05*inch, "RATE (USD)")
c.drawString(6.6*inch, top+0.05*inch, "AMOUNT")
c.setFillGray(0)

rows = [
    ("15", "M3x10 Hex Bolt, Pack of 100", "12.40", "186.00"),
    ("8", "Aluminum Mounting Bracket, Type-B", "34.50", "276.00"),
    ("3", "CNC Assembly Service, Line 2", "95.00", "285.00"),
]

c.setFont("Helvetica", 9)
y = top - 0.28*inch
for qty, desc, rate, amt in rows:
    c.drawString(1.1*inch, y, qty)
    c.drawString(1.8*inch, y, desc)
    c.drawRightString(6.15*inch, y, rate)
    c.drawRightString(7.4*inch, y, amt)
    y -= 0.28*inch

y -= 0.2*inch
c.line(5.0*inch, y+0.18*inch, 7.4*inch, y+0.18*inch)
c.setFont("Helvetica-Bold", 11)
c.drawString(5.0*inch, y, "TOTAL DUE (USD)")
c.drawRightString(7.4*inch, y, "747.00")

c.setFont("Helvetica-Oblique", 8)
c.drawString(1*inch, 0.75*inch, "Remit payment to Northstar Components via ACH. Reference Doc Ref# NC-88213.")

c.save()
print("wrote", path)

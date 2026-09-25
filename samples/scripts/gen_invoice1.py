from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch

path = "samples/input/invoice-01-standard.pdf"
c = canvas.Canvas(path, pagesize=letter)
width, height = letter

c.setFont("Helvetica-Bold", 18)
c.drawString(1*inch, height-1*inch, "Apex Office Supplies")
c.setFont("Helvetica", 10)
c.drawString(1*inch, height-1.2*inch, "142 Commerce Way, Springfield, IL 62701")
c.drawString(1*inch, height-1.35*inch, "Phone: (217) 555-0148  |  billing@apexofficesupplies.example")

c.setFont("Helvetica-Bold", 14)
c.drawString(1*inch, height-1.8*inch, "INVOICE")

c.setFont("Helvetica", 10)
c.drawString(1*inch, height-2.1*inch, "Invoice Number: INV-2026-0417")
c.drawString(1*inch, height-2.3*inch, "Invoice Date: 03/12/2026")
c.drawString(1*inch, height-2.5*inch, "Due Date: 04/11/2026")

c.drawString(4.5*inch, height-2.1*inch, "Bill To:")
c.drawString(4.5*inch, height-2.3*inch, "Rivertown School District")
c.drawString(4.5*inch, height-2.5*inch, "88 Elm Street, Springfield, IL 62702")

# Table header
top = height - 3.1*inch
c.setFont("Helvetica-Bold", 10)
c.drawString(1*inch, top, "Description")
c.drawString(4.3*inch, top, "Qty")
c.drawString(5.0*inch, top, "Unit Price")
c.drawString(6.2*inch, top, "Total")
c.line(1*inch, top-0.08*inch, 7.5*inch, top-0.08*inch)

rows = [
    ("Multipurpose Copy Paper (500-ct ream)", "40", "6.25", "250.00"),
    ("Black Toner Cartridge - HP Compatible", "6", "42.00", "252.00"),
    ("Standard Stapler, Heavy Duty", "10", "8.50", "85.00"),
    ("Ballpoint Pens, Box of 12", "20", "3.75", "75.00"),
]

c.setFont("Helvetica", 10)
y = top - 0.3*inch
for desc, qty, price, tot in rows:
    c.drawString(1*inch, y, desc)
    c.drawString(4.3*inch, y, qty)
    c.drawString(5.0*inch, y, "$" + price)
    c.drawString(6.2*inch, y, "$" + tot)
    y -= 0.25*inch

y -= 0.15*inch
c.line(4.9*inch, y+0.15*inch, 7.5*inch, y+0.15*inch)
c.setFont("Helvetica", 10)
c.drawString(5.0*inch, y, "Subtotal:")
c.drawString(6.2*inch, y, "$662.00")
y -= 0.22*inch
c.drawString(5.0*inch, y, "Sales Tax (0%):")
c.drawString(6.2*inch, y, "$0.00")
y -= 0.25*inch
c.setFont("Helvetica-Bold", 11)
c.drawString(5.0*inch, y, "Grand Total:")
c.drawString(6.2*inch, y, "$662.00")

c.setFont("Helvetica-Oblique", 8)
c.drawString(1*inch, 0.75*inch, "Thank you for your business. Payment due within 30 days.")

c.save()
print("wrote", path)

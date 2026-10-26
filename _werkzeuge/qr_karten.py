"""QR-Kärtchen für Klientinnen einer Fachfrau (A4, 10 Visitenkarten 85x55 mm je Seite).
Aufruf: python3 qr_karten.py "Praxis-Name" ausgabe.pdf CODE1 CODE2 ...  (Praxis-Name "" = ohne Absenderzeile, z. B. fuer Ralphs eigene Codes)
Jede Karte: QR -> https://root-index.de/klientin.html?code=CODE, Code als Text zum Abtippen.
"""
import sys, io, os
DAUER = os.environ.get("DAUER", "3 Monate")  # z. B. DAUER="1 Jahr" fuer Jahrescodes
import qrcode
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

DUNKEL = (0x13/255, 0x35/255, 0x21/255)
HELL = (0x7C/255, 0xFF/255, 0x9B/255)
CREME = (0xF3/255, 0xEE/255, 0xDC/255)
LOGO = "/home/claude/root-index/logo-mark.png"

def qr_bild(url):
    q = qrcode.QRCode(border=1, box_size=10, error_correction=qrcode.constants.ERROR_CORRECT_M)
    q.add_data(url); q.make(fit=True)
    img = q.make_image(fill_color="black", back_color="white")
    b = io.BytesIO(); img.save(b, format="PNG"); b.seek(0)
    return ImageReader(b)

def karte(c, x, y, praxis, code):
    w, h = 85*mm, 55*mm
    c.setFillColorRGB(*DUNKEL); c.roundRect(x, y, w, h, 3*mm, stroke=0, fill=1)
    # QR rechts auf weissem Feld
    qs = 36*mm
    c.setFillColorRGB(1, 1, 1); c.roundRect(x+w-qs-5*mm, y+(h-qs)/2, qs, qs, 2*mm, stroke=0, fill=1)
    c.drawImage(qr_bild("https://root-index.de/klientin.html?code=" + code), x+w-qs-4*mm, y+(h-qs)/2+1*mm, qs-2*mm, qs-2*mm)
    # Text links
    tx = x+5*mm
    try:
        c.drawImage(LOGO, tx, y+h-13*mm, 8*mm, 8*mm, mask='auto')
    except Exception:
        pass
    c.setFillColorRGB(*CREME); c.setFont("Helvetica-Bold", 10); c.drawString(tx+10*mm, y+h-10*mm, "Root Index")
    c.setFillColorRGB(1, 1, 1); c.setFont("Helvetica-Bold", 12)
    c.drawString(tx, y+h-20*mm, DAUER + " Premium")
    c.setFillColorRGB(*HELL); c.setFont("Helvetica-Bold", 12); c.drawString(tx, y+h-25*mm, "geschenkt")
    c.setFillColorRGB(*CREME); c.setFont("Helvetica", 6.5)
    if praxis.strip():
        c.drawString(tx, y+h-30*mm, "von " + praxis[:30])
    # Code
    c.setFillColorRGB(*CREME); c.roundRect(tx, y+9*mm, 36*mm, 7*mm, 1.5*mm, stroke=0, fill=1)
    c.setFillColorRGB(*DUNKEL); c.setFont("Helvetica-Bold", 9.5 if len(code) <= 12 else 8.5); c.drawCentredString(tx+18*mm, y+11.3*mm, code)
    c.setFillColorRGB(*CREME); c.setFont("Helvetica", 6)
    c.drawString(tx, y+4.5*mm, "QR scannen · root-index.de/klientin.html")

def main():
    praxis, aus, codes = sys.argv[1], sys.argv[2], sys.argv[3:]
    c = canvas.Canvas(aus, pagesize=A4)
    W, H = A4
    rand_x, rand_y = (W - 2*85*mm - 6*mm)/2, (H - 5*55*mm - 4*5*mm)/2
    for i, code in enumerate(codes):
        if i and i % 10 == 0: c.showPage()
        p = i % 10; col, row = p % 2, p // 2
        karte(c, rand_x + col*(85*mm+6*mm), H - rand_y - (row+1)*55*mm - row*5*mm, praxis, code)
    c.save()

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Generate a 1200x848 certificate background PNG using only Python stdlib."""
import struct, zlib, math, os

W, H = 1200, 848

# Colors (R,G,B)
BG         = (253, 248, 235)   # ivory
GOLD       = (183, 121, 31)    # gold border
NAVY       = (26, 54, 93)      # navy text
GOLD_LIGHT = (212, 175, 55)    # bright gold
WHITE      = (255, 255, 255)

def clamp(v): return max(0, min(255, int(v)))

# Build pixel grid  [y][x] = (R,G,B)
pixels = [[list(BG) for _ in range(W)] for _ in range(H)]

def set_px(x, y, color, alpha=1.0):
    if 0 <= x < W and 0 <= y < H:
        r,g,b = color
        pr,pg,pb = pixels[y][x]
        pixels[y][x] = [
            clamp(pr*(1-alpha) + r*alpha),
            clamp(pg*(1-alpha) + g*alpha),
            clamp(pb*(1-alpha) + b*alpha),
        ]

def fill_rect(x0,y0,x1,y1, color, alpha=1.0):
    for y in range(max(0,y0), min(H,y1)):
        for x in range(max(0,x0), min(W,x1)):
            set_px(x, y, color, alpha)

def draw_hline(y, x0, x1, color, thick=1):
    for dy in range(thick):
        for x in range(max(0,x0), min(W,x1)):
            set_px(x, y+dy, color)

def draw_vline(x, y0, y1, color, thick=1):
    for dx in range(thick):
        for y in range(max(0,y0), min(H,y1)):
            set_px(x+dx, y, color)

def draw_circle_outline(cx, cy, r, color, thick=2):
    for angle_deg in range(0, 3600):
        a = angle_deg * math.pi / 1800
        for dr in range(thick):
            rx = int(cx + (r+dr)*math.cos(a))
            ry = int(cy + (r+dr)*math.sin(a))
            set_px(rx, ry, color)

def draw_diamond(cx, cy, size, color):
    for i in range(-size, size+1):
        h = size - abs(i)
        for j in range(-h, h+1):
            set_px(cx+i, cy+j, color)

# ── 1. Subtle warm gradient background ──────────────────────────────────────
for y in range(H):
    t = y / H
    r = clamp(253 - t*8)
    g = clamp(248 - t*6)
    b = clamp(235 - t*4)
    for x in range(W):
        pixels[y][x] = [r,g,b]

# ── 2. Outer gold border (thick) ────────────────────────────────────────────
for t in range(6):
    draw_hline(t,       0, W, GOLD)
    draw_hline(H-1-t,   0, W, GOLD)
    draw_vline(t,       0, H, GOLD)
    draw_vline(W-1-t,   0, H, GOLD)

# ── 3. Inner double border ───────────────────────────────────────────────────
M = 18
for t in range(2):
    draw_hline(M+t,     M, W-M, GOLD_LIGHT)
    draw_hline(H-M-t,   M, W-M, GOLD_LIGHT)
    draw_vline(M+t,     M, H-M, GOLD_LIGHT)
    draw_vline(W-M-t,   M, H-M, GOLD_LIGHT)
M2 = 24
for t in range(1):
    draw_hline(M2+t,    M2, W-M2, GOLD)
    draw_hline(H-M2-t,  M2, W-M2, GOLD)
    draw_vline(M2+t,    M2, H-M2, GOLD)
    draw_vline(W-M2-t,  M2, H-M2, GOLD)

# ── 4. Corner ornaments (diamond clusters) ───────────────────────────────────
corners = [(30,30),(W-30,30),(30,H-30),(W-30,H-30)]
for cx,cy in corners:
    draw_diamond(cx, cy, 10, GOLD)
    draw_diamond(cx, cy, 5, GOLD_LIGHT)
    for angle in [0, 90, 180, 270]:
        a = angle * math.pi / 180
        dx2 = int(18 * math.cos(a))
        dy2 = int(18 * math.sin(a))
        draw_diamond(cx+dx2, cy+dy2, 4, GOLD)

# ── 5. Top decorative band ──────────────────────────────────────────────────
fill_rect(M2+2, M2+2, W-M2-2, M2+55, (245, 225, 180), alpha=0.4)
draw_hline(M2+57, M2+2, W-M2-2, GOLD, thick=1)

# ── 6. Emblem circle at top-center ──────────────────────────────────────────
EX, EY, ER = W//2, 130, 52
draw_circle_outline(EX, EY, ER, GOLD, thick=3)
draw_circle_outline(EX, EY, ER-8, GOLD_LIGHT, thick=1)
# Fill circle ivory
for y in range(EY-ER, EY+ER+1):
    for x in range(EX-ER, EX+ER+1):
        if (x-EX)**2 + (y-EY)**2 <= (ER-3)**2:
            set_px(x, y, (250, 240, 200))
# Star in center
for i in range(8):
    a = i * math.pi / 4
    for r2 in range(2, 26):
        sx = int(EX + r2*math.cos(a))
        sy = int(EY + r2*math.sin(a))
        set_px(sx, sy, GOLD if r2 < 18 else GOLD_LIGHT)
# Small center dot
draw_diamond(EX, EY, 6, GOLD)

# ── 7. Laurel arcs (simple dot arcs) ────────────────────────────────────────
for side in [-1, 1]:
    for i in range(9):
        a = (90 + side*20 + side*i*14) * math.pi / 180
        for dr in range(3):
            lx = int(EX + (ER+14+dr)*math.cos(a))
            ly = int(EY + (ER+14+dr)*math.sin(a))
            set_px(lx, ly, GOLD)
        # leaf dot
        lx2 = int(EX + (ER+22)*math.cos(a))
        ly2 = int(EY + (ER+22)*math.sin(a))
        draw_diamond(lx2, ly2, 4, (100, 140, 60))

# ── 8. Title bar below emblem ───────────────────────────────────────────────
fill_rect(M2+2, 210, W-M2-2, 255, (230, 200, 120), alpha=0.25)
draw_hline(210, M2+2, W-M2-2, GOLD, thick=1)
draw_hline(254, M2+2, W-M2-2, GOLD, thick=1)

# ── 9. Bottom signature area lines ──────────────────────────────────────────
# Left signature line
draw_hline(H-70, 100, 360, NAVY, thick=1)
# Right signature line
draw_hline(H-70, W-360, W-100, NAVY, thick=1)

# ── 10. Bottom center seal circle ───────────────────────────────────────────
SX, SY, SR = W//2, H-80, 30
draw_circle_outline(SX, SY, SR, GOLD, thick=2)
draw_circle_outline(SX, SY, SR-5, GOLD_LIGHT, thick=1)
for y in range(SY-SR, SY+SR+1):
    for x in range(SX-SR, SX+SR+1):
        if (x-SX)**2 + (y-SY)**2 <= (SR-3)**2:
            set_px(x, y, (245, 225, 170))
draw_diamond(SX, SY, 8, GOLD)

# ── 11. Side decorative dots ─────────────────────────────────────────────────
for i in range(5):
    dy_off = 350 + i*40
    draw_diamond(M2+8, dy_off, 4, GOLD_LIGHT)
    draw_diamond(W-M2-8, dy_off, 4, GOLD_LIGHT)

# ── Write PNG ──────────────────────────────────────────────────────────────
def make_png(pixels, w, h):
    def chunk(name, data):
        c = name + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    
    ihdr_data = struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)
    raw = b''
    for row in pixels:
        raw += b'\x00' + bytes([clamp(v) for px in row for v in px])
    
    return (b'\x89PNG\r\n\x1a\n' +
            chunk(b'IHDR', ihdr_data) +
            chunk(b'IDAT', zlib.compress(raw, 6)) +
            chunk(b'IEND', b''))

os.makedirs('assets', exist_ok=True)
png_data = make_png(pixels, W, H)
with open('assets/cert-bg-mau1.png', 'wb') as f:
    f.write(png_data)

print(f'Done: assets/cert-bg-mau1.png ({len(png_data)//1024} KB, {W}x{H})')

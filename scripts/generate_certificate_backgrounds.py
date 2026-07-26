from pathlib import Path
import math
import struct
import zlib

OUT = Path('assets/certificate-backgrounds')
OUT.mkdir(parents=True, exist_ok=True)
W, H = 1200, 848

def clamp(v): return max(0, min(255, int(v)))
def mix(a,b,t): return tuple(clamp(a[i]*(1-t)+b[i]*t) for i in range(3))

def png_save(path, pixels):
    raw = bytearray()
    for y in range(H):
        raw.append(0)
        row = pixels[y]
        for r,g,b,a in row:
            raw.extend([r,g,b,a])
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n'
    data += chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0))
    data += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    data += chunk(b'IEND', b'')
    path.write_bytes(data)

def blend(px, color, alpha):
    r,g,b,a = px
    cr,cg,cb = color
    t = alpha/255
    return (clamp(r*(1-t)+cr*t), clamp(g*(1-t)+cg*t), clamp(b*(1-t)+cb*t), 255)

def rect(pixels, x0,y0,x1,y1,color,alpha=255,border=False):
    x0,x1=max(0,int(x0)),min(W,int(x1)); y0,y1=max(0,int(y0)),min(H,int(y1))
    for y in range(y0,y1):
        for x in range(x0,x1):
            if border and not (x-x0<4 or x1-x<=4 or y-y0<4 or y1-y<=4):
                continue
            pixels[y][x]=blend(pixels[y][x],color,alpha)

def circle(pixels,cx,cy,rad,color,alpha=255):
    r2=rad*rad
    for y in range(max(0,int(cy-rad)), min(H,int(cy+rad)+1)):
        for x in range(max(0,int(cx-rad)), min(W,int(cx+rad)+1)):
            if (x-cx)**2+(y-cy)**2 <= r2:
                pixels[y][x]=blend(pixels[y][x],color,alpha)

def line_wave(pixels, color, alpha, y_base, amp, phase, width=3):
    for x in range(W):
        y = int(y_base + amp*math.sin((x+phase)/75))
        for dy in range(-width,width+1):
            yy=y+dy
            if 0<=yy<H:
                pixels[yy][x]=blend(pixels[yy][x],color,alpha)

def base(c1,c2):
    pixels=[]
    for y in range(H):
        row=[]
        for x in range(W):
            t=(x/W)*0.35+(y/H)*0.65
            row.append((*mix(c1,c2,t),255))
        pixels.append(row)
    return pixels

def common_frame(p, accent, soft):
    rect(p,92,80,W-92,H-80,(255,255,255),225)
    rect(p,92,80,W-92,H-80,accent,255,True)
    rect(p,126,114,W-126,H-114,accent,180,True)
    circle(p,W//2,270,42,accent,230)
    circle(p,W//2,270,22,(255,255,255),240)
    # content-safe pale panel
    rect(p,210,300,W-210,510,soft,90)
    rect(p,210,640,W-210,765,(255,255,255),120)
    # signature lines
    rect(p,210,735,420,738,(145,150,165),180)
    rect(p,780,735,990,738,(145,150,165),180)

def template1():
    p=base((255,250,230),(239,246,255))
    gold=(236,170,42)
    for cx,cy in [(120,100),(1080,100),(120,748),(1080,748)]: circle(p,cx,cy,14,gold,230)
    for r in [80,110,140]:
        circle(p,105,100,r,gold,16); circle(p,1095,100,r,gold,16)
        circle(p,105,748,r,gold,16); circle(p,1095,748,r,gold,16)
    common_frame(p,gold,(255,248,220))
    return p

def template2():
    p=base((236,253,245),(239,246,255))
    teal=(20,184,166)
    for i,y in enumerate([135,270,585,710]): line_wave(p,teal,55,y,18,i*60,4)
    for cx,cy,r in [(180,190,70),(1040,620,95),(980,210,45),(240,650,55)]: circle(p,cx,cy,r,teal,35)
    common_frame(p,teal,(220,252,245))
    return p

def template3():
    p=base((248,250,252),(245,243,255))
    purple=(124,58,237)
    colors=[purple,(245,158,11),(14,165,233),(16,185,129)]
    for i in range(130):
        x=(i*137)%W; y=(i*83)%H; c=colors[i%4]
        rect(p,x,y,x+14,y+5,c,90)
    for cx,cy,r in [(155,160,90),(1045,165,75),(980,690,105),(220,700,70)]: circle(p,cx,cy,r,purple,24)
    common_frame(p,purple,(245,243,255))
    return p

for i,pix in enumerate([template1(),template2(),template3()],1):
    path=OUT/f'mau-{i}.png'
    png_save(path,pix)
    print(path, path.stat().st_size)

"""Render the catalogue's geographic display paths over attributed OSM tiles.
Run from any directory; requires Pillow. Tiles are cached outside the repository.
"""
from PIL import Image, ImageDraw, ImageFont, ImageEnhance
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import math, urllib.request, json, tempfile
ROOT = Path(__file__).resolve().parents[2]
CACHE = Path(tempfile.gettempdir()) / 'sb78-osm-tiles'
CACHE.mkdir(exist_ok=True)
W, H = 2000, 1600
LIME = '#c6ff00'
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

def render(route):
    z = 16
    n = 256 * 2**z
    def pixel(lng, lat):
        return ((lng+180)/360*n, (1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n)
    xy = [pixel(p['lng'], p['lat']) for p in route['displayPath']]
    xs, ys = zip(*xy)
    # Reserve header and footer while filling the whole card with geographic context.
    scale = min((W-360)/(max(xs)-min(xs)), (H-600)/(max(ys)-min(ys)))
    cx, cy = (min(xs)+max(xs))/2, (min(ys)+max(ys))/2
    x0, y0 = cx-W/scale/2, cy-(H/2+35)/scale
    bw, bh = math.ceil(W/scale), math.ceil(H/scale)
    base = Image.new('RGB', (bw, bh))
    tiles = [(x,y) for x in range(math.floor(x0/256),math.ceil((x0+bw)/256)) for y in range(math.floor(y0/256),math.ceil((y0+bh)/256))]
    def fetch(t):
        x,y=t; path=CACHE/f'{z}-{x}-{y}.png'
        if not path.exists():
            req=urllib.request.Request(f'https://tile.openstreetmap.org/{z}/{x}/{y}.png',headers={'User-Agent':'SportBuddy78 route card renderer; one-off catalogue previews'})
            path.write_bytes(urllib.request.urlopen(req,timeout=30).read())
        return x,y,path
    with ThreadPoolExecutor(max_workers=3) as pool:
        for x,y,path in pool.map(fetch, tiles):
            with Image.open(path) as tile:base.paste(tile.convert('RGB'),(round(x*256-x0),round(y*256-y0)))
    base=base.resize((W,H),Image.Resampling.LANCZOS)
    base=ImageEnhance.Color(base).enhance(.48)
    base=Image.blend(base,Image.new('RGB',(W,H),'#0b1b2c'),.57).convert('RGBA')
    overlay=Image.new('RGBA',(W,H));od=ImageDraw.Draw(overlay)
    for y in range(H):
        alpha=int(240*max(0,1-y/360)) if y<360 else int(245*max(0,(y-(H-290))/290))
        if alpha:od.line((0,y,W,y),fill=(6,13,22,alpha))
    base=Image.alpha_composite(base,overlay);d=ImageDraw.Draw(base)
    def text(x,y,s,size=24,color='#f4f7fa',bold=False):d.text((x,y),s,font=ImageFont.truetype(BOLD if bold else FONT,size),fill=color)
    line=[((x-x0)*scale,(y-y0)*scale) for x,y in xy]
    d.line(line,fill='#122310',width=25,joint='curve');d.line(line,fill=LIME,width=11,joint='curve')
    # Evenly spaced direction arrows, independent of source point density.
    walked=0;next_arrow=260
    for a,b in zip(line,line[1:]):
        length=math.dist(a,b)
        while walked+length>=next_arrow and length:
            t=(next_arrow-walked)/length;x=a[0]+t*(b[0]-a[0]);y=a[1]+t*(b[1]-a[1]);ang=math.atan2(b[1]-a[1],b[0]-a[0])
            d.polygon([(x+16*math.cos(ang),y+16*math.sin(ang)),(x+14*math.cos(ang+2.5),y+14*math.sin(ang+2.5)),(x+14*math.cos(ang-2.5),y+14*math.sin(ang-2.5))],fill='#ffffff');next_arrow+=260
        walked+=length
    x,y=line[0]
    d.ellipse((x-19,y-19,x+19,y+19),fill=LIME,outline='#07111c',width=5)
    label='СТАРТ / ФИНИШ';tx=min(W-380,max(50,x+32));ty=max(255,y-58)
    d.rounded_rectangle((tx-14,ty-10,tx+325,ty+42),radius=14,fill='#0b1521');text(tx,ty,label,29,LIME,True)
    if math.dist(line[0],line[-1])>25:
        fx,fy=line[-1];d.ellipse((fx-12,fy-12,fx+12,fy+12),fill='white',outline='#07111c',width=4)
    text(70,45,'SPORTBUDDY78',30,LIME,True)
    title=route['name'].upper();size=60 if len(title)<24 else 53
    text(70,103,title,size,bold=True);text(73,183,route['city'].upper(),25,'#b8c9d7')
    d.rounded_rectangle((1570,45,1930,222),radius=26,fill=LIME)
    text(1600,65,route['distanceLabel'].upper(),66,'#0b1521',True);text(1603,151,'ДИСТАНЦИЯ',25,'#0b1521',True)
    text(70,H-145,'1 КРУГ',30,LIME,True)
    caption={'park300':'АЛЛЕИ И ФИНСКИЙ ЗАЛИВ','alexandriysky':'ПАРКОВЫЕ ДОРОЖКИ','neva-bridges':'ДВОРЦОВЫЙ + БЛАГОВЕЩЕНСКИЙ'}[route['id']]
    text(265,H-145,caption,29,bold=True)
    text(70,H-62,'© OpenStreetMap contributors',21,'#bccad2')
    if route['id']=='alexandriysky':text(650,H-62,'Трасса: 5 вёрст Петергоф',21,'#bccad2')
    text(1875,270,'С',28,bold=True);d.polygon([(1887,312),(1874,344),(1887,336),(1900,344)],fill='white')
    base.convert('RGB').save(ROOT/'public'/route['mapImage'].lstrip('/'),quality=91)
    print(route['id'],route['distanceLabel'],flush=True)

if __name__=='__main__':
    for route in json.loads((ROOT/'shared/running-routes.json').read_text()):
        render(route)

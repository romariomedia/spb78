from PIL import Image,ImageDraw,ImageFont,ImageEnhance
from pathlib import Path
import math,xml.etree.ElementTree as E,urllib.request,io,json
root=Path(__file__).resolve().parents[2]
route=next(r for r in json.loads((root/'shared/running-routes.json').read_text()) if r['id']=='alexandriysky')
pts=[(p['lng'],p['lat']) for p in route['displayPath']]
z=15
N=256*2**z
def pixel(p):
 lng,lat=p;v=math.radians(lat)
 return (lng+180)/360*N,(1-math.asinh(math.tan(v))/math.pi)/2*N
xy=[pixel(p) for p in pts]
xs,ys=zip(*xy)
x0=int(min(xs))-100;y0=int(min(ys))-65;x1=int(max(xs))+100;y1=int(max(ys))+65
im=Image.new('RGB',(x1-x0,y1-y0))
for x in range(x0//256,x1//256+1):
 for y in range(y0//256,y1//256+1):
  req=urllib.request.Request(f'https://tile.openstreetmap.org/{z}/{x}/{y}.png',headers={'User-Agent':'SportBuddy78 route preview (one-off map composition)'})
  data=urllib.request.urlopen(req,timeout=25).read()
  tile=Image.open(io.BytesIO(data)).convert('RGB');im.paste(tile,(x*256-x0,y*256-y0))
W,H=1600,1200
canvas=Image.new('RGB',(W,H),'#080e15');d=ImageDraw.Draw(canvas)
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';bold='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def text(x,y,t,size=24,fill='#e9f0f4',weight=False):d.text((x,y),t,font=ImageFont.truetype(bold if weight else font,size),fill=fill)
text(64,36,'SPORTBUDDY',34,weight=True);text(337,36,'78',34,'#c6ff00',True)
text(64,105,'АЛЕКСАНДРИЙСКИЙ ПАРК',48,weight=True)
text(65,169,'ПЕТЕРГОФ  /  ВИД СВЕРХУ',23,'#91a2ae')
d.rounded_rectangle((1245,42,1536,191),radius=28,fill='#c6ff00');text(1288,60,'5 КМ',56,'#0b1419',True);text(1288,135,'ДИСТАНЦИЯ',19,'#0b1419',True)
# Map background retains real roads, buildings and park geometry, muted for high-contrast route.
mapw,maph=1472,800
scale=min(mapw/im.width,maph/im.height)
im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
im=ImageEnhance.Color(im).enhance(.45);im=ImageEnhance.Brightness(im).enhance(.42)
left=(W-im.width)//2;top=232+(maph-im.height)//2
canvas.paste(im,(left,top));d=ImageDraw.Draw(canvas)
line=[((x-x0)*scale+left,(y-y0)*scale+top) for x,y in xy]
d.line(line,fill='#14210d',width=17,joint='curve');d.line(line,fill='#c6ff00',width=7,joint='curve')
# Arrowheads give direction, rather than inventing an illustrative route shape.
for i in [6,14,24,34,46,58,66]:
 a,b=line[i-1],line[i];ang=math.atan2(b[1]-a[1],b[0]-a[0]);cx,cy=b
 tri=[(cx+10*math.cos(ang),cy+10*math.sin(ang)),(cx+9*math.cos(ang+2.5),cy+9*math.sin(ang+2.5)),(cx+9*math.cos(ang-2.5),cy+9*math.sin(ang-2.5))]
 d.polygon(tri,fill='#f4ffd6')
for point,label,offset,color in [(line[0],'СТАРТ',(26,-50),'#c6ff00'),(line[-1],'ФИНИШ',(26,20),'#ffffff')]:
 x,y=point;d.ellipse((x-11,y-11,x+11,y+11),fill=color,outline='#080e15',width=3)
 tx,ty=x+offset[0],y+offset[1];d.line([(x,y),(tx,ty+18)],fill=color,width=2)
 d.rounded_rectangle((tx-5,ty-2,tx+120,ty+35),radius=8,fill='#080e15');text(tx,ty,label,22,color,True)
text(1458,245,'С',20,'#ffffff',True);d.line((1470,310,1470,276),fill='#ffffff',width=3);d.polygon([(1470,263),(1464,278),(1476,278)],fill='#ffffff')
text(64,1054,'1 КРУГ   •   ГРУНТ   •   ПРОТИВ ЧАСОВОЙ СТРЕЛКИ',24,'#c6ff00',True)
text(64,1100,'5 км — замер организаторов; линия карты ≈ 4,93 км. Рейтинг ожидает проверки.',20,'#b3c0c9')
text(64,1142,'Трасса: 5 вёрст Петергоф / Google My Maps  ·  Подложка: © OpenStreetMap contributors',17,'#8b9aa5')
canvas.save(root/'public/running/alexandriysky-map.webp',quality=90)
print('Created',canvas.size,'points',len(pts))

export type PhotoFilter = 'original' | 'warm' | 'cool' | 'mono';
export interface PhotoEdits { aspect: 'original' | 'square' | 'portrait' | 'story'; turn: number; zoom: number; x: number; y: number; brightness: number; contrast: number; filter: PhotoFilter }
export const defaultEdits: PhotoEdits = { aspect: 'original', turn: 0, zoom: 1, x: 50, y: 50, brightness: 100, contrast: 100, filter: 'original' };
export const filterCss = (e: PhotoEdits) => `brightness(${e.brightness}%) contrast(${e.contrast}%) ${e.filter === 'warm' ? 'sepia(25%) saturate(115%)' : e.filter === 'cool' ? 'saturate(85%) hue-rotate(12deg)' : e.filter === 'mono' ? 'grayscale(1)' : ''}`;
export function cropRect(width: number, height: number, e: PhotoEdits) {
  const ratio = e.aspect === 'square' ? 1 : e.aspect === 'portrait' ? 4/5 : e.aspect === 'story' ? 9/16 : width/height;
  let w = width, h = w/ratio;
  if (h > height) { h = height; w = h*ratio; }
  w /= e.zoom; h /= e.zoom;
  return { x: (width-w)*e.x/100, y: (height-h)*e.y/100, w, h };
}
export async function loadPhoto(file: File): Promise<HTMLImageElement> {
  if (!file.type.startsWith('image/') || file.size > 20*1024*1024) throw new Error('Выберите фото размером до 20 МБ.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    if (!img.naturalWidth || img.naturalWidth * img.naturalHeight > 50_000_000) throw new Error('Слишком большое разрешение. Выберите фото до 50 Мп.');
    return img;
  } finally { URL.revokeObjectURL(url); }
}
export function renderPhoto(img: HTMLImageElement, e: PhotoEdits, maxSide = 1600): HTMLCanvasElement {
  const rotated = document.createElement('canvas');
  const turn = ((e.turn % 4)+4)%4;
  // Downsample before rotation to bound mobile memory usage.
  const scale = Math.min(1, 2400/Math.max(img.naturalWidth,img.naturalHeight));
  const iw = Math.round(img.naturalWidth*scale), ih = Math.round(img.naturalHeight*scale);
  rotated.width = turn%2 ? ih : iw; rotated.height = turn%2 ? iw : ih;
  const r = rotated.getContext('2d'); if (!r) throw new Error('Редактор недоступен в этом браузере');
  r.translate(rotated.width/2, rotated.height/2); r.rotate(turn*Math.PI/2); r.drawImage(img,-iw/2,-ih/2,iw,ih);
  const crop = cropRect(rotated.width, rotated.height, e);
  const out = document.createElement('canvas'), outputScale = Math.min(1,maxSide/Math.max(crop.w,crop.h));
  out.width=Math.max(1,Math.round(crop.w*outputScale)); out.height=Math.max(1,Math.round(crop.h*outputScale));
  const ctx=out.getContext('2d'); if(!ctx) throw new Error('Редактор недоступен');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,out.width,out.height);
  ctx.drawImage(rotated,crop.x,crop.y,crop.w,crop.h,0,0,out.width,out.height);
  // Pixel processing works on mobile browsers that ignore canvas.filter.
  const pixels=ctx.getImageData(0,0,out.width,out.height), d=pixels.data;
  const brightness=e.brightness/100, contrast=e.contrast/100;
  for(let i=0;i<d.length;i+=4){
    let red=d[i]!,green=d[i+1]!,blue=d[i+2]!;
    if(e.filter==='mono'){red=green=blue=.299*red+.587*green+.114*blue;}
    if(e.filter==='warm'){red*=1.10;green*=1.02;blue*=.90;}
    if(e.filter==='cool'){red*=.91;green*=1.02;blue*=1.10;}
    d[i]=((red*brightness)-128)*contrast+128;d[i+1]=((green*brightness)-128)*contrast+128;d[i+2]=((blue*brightness)-128)*contrast+128;
  }
  ctx.putImageData(pixels,0,0);rotated.width=rotated.height=1;
  return out;
}
export async function exportPhoto(img: HTMLImageElement, edits: PhotoEdits): Promise<File> {
 const canvas=renderPhoto(img,edits,1600);
 try { const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Не удалось сохранить фото')),'image/jpeg',.82));
 return new File([blob],'sportbuddy-photo.jpg',{type:'image/jpeg'});
 } finally {canvas.width=canvas.height=1;}
}

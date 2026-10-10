import sharp from 'sharp';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { SPORTBUDDY_PUBLIC_URL } from '../shared/share-links.js';

const safeId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,200}$/.test(value)?value:'';
const clean=(value,max=180)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const html=value=>clean(value,500).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const xml=value=>html(value);
const formatDate=value=>{
  const raw=typeof value==='number'?value:Date.parse(String(value||''));
  return Number.isFinite(raw)?new Intl.DateTimeFormat('ru-RU',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Moscow'}).format(raw)+' МСК':'';
};

function ensureFirebase(){
  if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
  return getFirestore();
}

export function shareTarget(kind,id){
  const campaign=kind==='training'?'training_share':'leisure_share';
  return `${SPORTBUDDY_PUBLIC_URL}/?utm_source=sportbuddy&utm_medium=share&utm_campaign=${campaign}#${kind}=${encodeURIComponent(id)}`;
}

async function readModel(kind,id){
  const db=ensureFirebase();
  if(kind==='training'){
    const snap=await db.collection('trainings').doc(id).get();
    if(!snap.exists)return null;
    const item=snap.data()||{};
    const when=clean(item.dateLabel,100)||[clean(item.dateKey,10),clean(item.time,5)].filter(Boolean).join(' · ');
    return {
      kind,id,
      eyebrow:item.isOfficial===true?'ОФИЦИАЛЬНАЯ ТРЕНИРОВКА SPORTBUDDY78':'ТРЕНИРОВКА SPORTBUDDY78',
      title:clean(item.title,120)||'Тренировка',
      subtitle:[clean(item.sport,60),clean(item.locationName||item.venueName,120)].filter(Boolean).join(' · ')||'Санкт-Петербург',
      when,
      description:`Присоединяйтесь к тренировке в SportBuddy78${when?' · '+when:''}.`
    };
  }
  const snap=await db.collection('leisureEvents').doc(id).get();
  if(!snap.exists)return null;
  const item=snap.data()||{};
  let destination='';
  const destinationId=clean(item.destinationId,100);
  if(destinationId){
    const place=await db.collection('leisureDestinations').doc(destinationId).get().catch(()=>null);
    destination=place?.exists?clean(place.data()?.name,120):destinationId;
  }
  const when=formatDate(item.startsAt)||[clean(item.date,10),clean(item.time,5)].filter(Boolean).join(' · ');
  return {
    kind,id,
    eyebrow:'АКТИВНЫЙ ОТДЫХ · SPORTBUDDY78',
    title:clean(item.title,120)||'Активный отдых',
    subtitle:[destination,clean(item.meetingPoint,120)].filter(Boolean).join(' · ')||'Санкт-Петербург',
    when,
    description:`Собираем компанию в SportBuddy78${when?' · '+when:''}.`
  };
}

export function buildSharePreviewHtml(model){
  const pageUrl=`${SPORTBUDDY_PUBLIC_URL}/share/${model.kind}/${encodeURIComponent(model.id)}`;
  const imageUrl=`${SPORTBUDDY_PUBLIC_URL}/share/image/${model.kind}/${encodeURIComponent(model.id)}.png`;
  const target=shareTarget(model.kind,model.id);
  const title=`${model.title} — SportBuddy78`;
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${html(title)}</title>
<meta name="description" content="${html(model.description)}">
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="${html(pageUrl)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="SportBuddy78">
<meta property="og:title" content="${html(title)}">
<meta property="og:description" content="${html(model.description)}">
<meta property="og:url" content="${html(pageUrl)}">
<meta property="og:image" content="${html(imageUrl)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${html(title)}">
<meta name="twitter:description" content="${html(model.description)}">
<meta name="twitter:image" content="${html(imageUrl)}">
<meta http-equiv="refresh" content="1;url=${html(target)}">
<style>html,body{margin:0;background:#020617;color:#f8fafc;font-family:Arial,sans-serif}main{min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center}a{color:#a3e635}</style>
</head><body><main><div><strong>SportBuddy78</strong><p>${html(model.title)}</p><a href="${html(target)}">Открыть активность</a></div></main>
<script>setTimeout(()=>location.replace(${JSON.stringify(target)}),180)</script></body></html>`;
}

function wrap(value,maxChars=28,maxLines=3){
  const words=clean(value,160).split(' ').filter(Boolean),lines=[];
  for(const word of words){
    const current=lines.at(-1)||'';
    if(!current)lines.push(word);
    else if(current.length+1+word.length<=maxChars)lines[lines.length-1]=current+' '+word;
    else if(lines.length<maxLines)lines.push(word);
    else { lines[maxLines-1]=(lines[maxLines-1]+'…').slice(0,maxChars); break; }
  }
  return lines.length?lines:['SportBuddy78'];
}

export async function renderSharePreviewImage(model){
  const titleLines=wrap(model.title,28,3);
  const titleSvg=titleLines.map((line,index)=>`<text x="72" y="${188+index*70}" font-family="DejaVu Sans,Arial,sans-serif" font-size="62" font-weight="900" fill="#f8fafc">${xml(line)}</text>`).join('');
  const subtitle=xml(clean(model.subtitle,110));
  const when=xml(clean(model.when,80));
  const eyebrow=xml(model.eyebrow);
  const svg=`<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#020617"/><stop offset="1" stop-color="#172033"/></linearGradient><radialGradient id="glow" cx="0.8" cy="0.2" r="0.8"><stop stop-color="#a3e635" stop-opacity=".28"/><stop offset="1" stop-color="#a3e635" stop-opacity="0"/></radialGradient></defs>
<rect width="1200" height="630" rx="44" fill="url(#bg)"/><rect width="1200" height="630" rx="44" fill="url(#glow)"/>
<circle cx="1035" cy="112" r="52" fill="#a3e635"/><text x="1035" y="129" text-anchor="middle" font-family="DejaVu Sans,Arial,sans-serif" font-size="42" font-weight="900" fill="#020617">78</text>
<text x="72" y="86" font-family="DejaVu Sans,Arial,sans-serif" font-size="25" font-weight="800" fill="#a3e635" letter-spacing="2">${eyebrow}</text>
${titleSvg}
<text x="72" y="422" font-family="DejaVu Sans,Arial,sans-serif" font-size="30" font-weight="700" fill="#cbd5e1">${subtitle}</text>
<text x="72" y="500" font-family="DejaVu Sans,Arial,sans-serif" font-size="28" font-weight="800" fill="#f8fafc">${when}</text>
<rect x="72" y="546" width="330" height="54" rx="27" fill="#a3e635"/><text x="237" y="582" text-anchor="middle" font-family="DejaVu Sans,Arial,sans-serif" font-size="22" font-weight="900" fill="#020617">ПРИСОЕДИНИТЬСЯ</text>
<text x="1128" y="584" text-anchor="end" font-family="DejaVu Sans,Arial,sans-serif" font-size="28" font-weight="900" fill="#f8fafc">SportBuddy78</text>
</svg>`;
  return sharp(Buffer.from(svg)).png({compressionLevel:9}).toBuffer();
}

export async function sharePreviewPage(req,res){
  const kind=req.params.kind;
  const id=safeId(req.params.id);
  if(!['training','leisure'].includes(kind)||!id)return res.status(404).send('Not found');
  try{
    const model=await readModel(kind,id);
    if(!model)return res.status(404).send('Activity not found');
    res.setHeader('Cache-Control','public, max-age=60, stale-while-revalidate=300');
    res.type('html').send(buildSharePreviewHtml(model));
  }catch(error){
    console.error('[share-preview-page]',error?.code||error?.name||'error');
    res.status(503).send('Preview unavailable');
  }
}

export async function sharePreviewImage(req,res){
  const kind=req.params.kind;
  const raw=String(req.params.id||'').replace(/\.png$/,'');
  const id=safeId(raw);
  if(!['training','leisure'].includes(kind)||!id)return res.status(404).send('Not found');
  try{
    const model=await readModel(kind,id);
    if(!model)return res.status(404).send('Activity not found');
    const image=await renderSharePreviewImage(model);
    res.setHeader('Cache-Control','public, max-age=300, stale-while-revalidate=3600');
    res.type('png').send(image);
  }catch(error){
    console.error('[share-preview-image]',error?.code||error?.name||'error');
    res.status(503).send('Preview unavailable');
  }
}

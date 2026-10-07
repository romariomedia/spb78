const clean=(value,max=500)=>typeof value==='string'?value.trim().slice(0,max):'';
const mediaTypes=new Set(['image','video','none']);

function safeHttpsUrl(value,max=1800){
  const url=clean(value,max);
  if(!url)return '';
  try{
    const parsed=new URL(url);
    return parsed.protocol==='https:'?url:'';
  }catch{return '';}
}

function dateValue(value){
  const raw=clean(value,40);
  if(!raw)return '';
  const ms=Date.parse(raw);
  if(!Number.isFinite(ms))throw Object.assign(new Error('Некорректная дата публикации.'),{status:400});
  return new Date(ms).toISOString();
}

export function sanitizePartner(input={},existing={}){
  const name=clean(input.name??existing.name,100);
  if(name.length<2)throw Object.assign(new Error('Укажите название партнёра.'),{status:400});
  const offerTitle=clean(input.offerTitle??existing.offerTitle,120);
  if(offerTitle.length<2)throw Object.assign(new Error('Укажите заголовок акции или рекламы.'),{status:400});
  const description=clean(input.description??existing.description,700);
  if(description.length<2)throw Object.assign(new Error('Укажите описание предложения.'),{status:400});

  const logoUrl=safeHttpsUrl(input.logoUrl??existing.logoUrl);
  const coverUrl=safeHttpsUrl(input.coverUrl??existing.coverUrl);
  const mediaUrl=safeHttpsUrl(input.mediaUrl??existing.mediaUrl);
  const ctaUrl=safeHttpsUrl(input.ctaUrl??existing.ctaUrl);
  if((input.logoUrl??existing.logoUrl)&&!logoUrl)throw Object.assign(new Error('Логотип должен иметь корректный https URL.'),{status:400});
  if((input.coverUrl??existing.coverUrl)&&!coverUrl)throw Object.assign(new Error('Обложка должна иметь корректный https URL.'),{status:400});
  if((input.mediaUrl??existing.mediaUrl)&&!mediaUrl)throw Object.assign(new Error('Медиа должно иметь корректный https URL.'),{status:400});
  if((input.ctaUrl??existing.ctaUrl)&&!ctaUrl)throw Object.assign(new Error('Ссылка партнёра должна использовать https.'),{status:400});

  const requestedType=clean(input.mediaType??existing.mediaType,20);
  const mediaType=mediaTypes.has(requestedType)?requestedType:(mediaUrl?'image':'none');
  const startAt=dateValue(input.startAt??existing.startAt);
  const endAt=dateValue(input.endAt??existing.endAt);
  if(startAt&&endAt&&Date.parse(endAt)<=Date.parse(startAt))throw Object.assign(new Error('Дата окончания должна быть позже даты начала.'),{status:400});

  return {
    name,
    partnerLabel:clean(input.partnerLabel??existing.partnerLabel,60)||'Партнёр SportBuddy78',
    offerTitle,
    description,
    promoCode:clean(input.promoCode??existing.promoCode,60),
    ctaLabel:clean(input.ctaLabel??existing.ctaLabel,50)||'Подробнее',
    ctaUrl,
    logoUrl,
    coverUrl,
    mediaUrl,
    mediaType,
    startAt,
    endAt,
    priority:Math.max(0,Math.min(100,Number.isFinite(Number(input.priority))?Math.round(Number(input.priority)):Number(existing.priority||50))),
    isActive:input.isActive===undefined?existing.isActive!==false:input.isActive===true
  };
}

export function partnerIsPublished(item,now=Date.now()){
  if(!item||item.isActive===false)return false;
  const start=Date.parse(item.startAt||'');
  if(Number.isFinite(start)&&start>now)return false;
  const end=Date.parse(item.endAt||'');
  if(Number.isFinite(end)&&end<=now)return false;
  return true;
}

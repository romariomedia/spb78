const clean=(value,max=500)=>typeof value==='string'?value.trim().slice(0,max):'';
const mediaTypes=new Set(['image','video','none']);
const digits=(value,max=20)=>clean(value,max).replace(/\D/g,'').slice(0,max);

function safeHttpsUrl(value,max=1800){
  const url=clean(value,max);
  if(!url)return '';
  try{
    const parsed=new URL(url);
    return parsed.protocol==='https:' && !parsed.username && !parsed.password ? url : '';
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
  if(!input || typeof input!=='object' || Array.isArray(input))throw Object.assign(new Error('Некорректная карточка партнёра.'),{status:400});
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
  const mediaType=mediaUrl?(mediaTypes.has(requestedType)&&requestedType!=='none'?requestedType:'image'):'none';
  const startAt=dateValue(input.startAt??existing.startAt);
  const endAt=dateValue(input.endAt??existing.endAt);
  if(startAt&&endAt&&Date.parse(endAt)<=Date.parse(startAt))throw Object.assign(new Error('Дата окончания должна быть позже даты начала.'),{status:400});

  const isActive=input.isActive===undefined?existing.isActive!==false:input.isActive===true;
  const isAdvertising=input.isAdvertising===undefined?(existing.isAdvertising!==false):input.isAdvertising===true;
  const advertiserName=clean(input.advertiserName??existing.advertiserName,180);
  const advertiserInn=digits(input.advertiserInn??existing.advertiserInn,12);
  const erid=clean(input.erid??existing.erid,180);
  const ordName=clean(input.ordName??existing.ordName,120);
  const adContractNumber=clean(input.adContractNumber??existing.adContractNumber,120);
  const adContractDate=dateValue(input.adContractDate??existing.adContractDate);
  if(isAdvertising&&isActive){
    if(advertiserName.length<2)throw Object.assign(new Error('Для рекламной карточки укажите рекламодателя.'),{status:400,code:'ADVERTISER_REQUIRED'});
    if(!/^\d{10}$|^\d{12}$/.test(advertiserInn))throw Object.assign(new Error('Для рекламной карточки укажите ИНН рекламодателя (10 или 12 цифр).'),{status:400,code:'ADVERTISER_INN_REQUIRED'});
    if(erid.length<5)throw Object.assign(new Error('Для публикации рекламы укажите ERID, полученный через ОРД.'),{status:400,code:'ERID_REQUIRED'});
    if(ordName.length<2)throw Object.assign(new Error('Укажите оператора рекламных данных (ОРД).'),{status:400,code:'ORD_REQUIRED'});
  }

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
    isActive,
    isAdvertising,
    advertiserName,
    advertiserInn,
    erid,
    ordName,
    adContractNumber,
    adContractDate
  };
}

export function partnerAdComplianceReady(item={}){
  if(item.isAdvertising===false)return true;
  return clean(item.advertiserName,180).length>=2
    && /^\d{10}$|^\d{12}$/.test(digits(item.advertiserInn,12))
    && clean(item.erid,180).length>=5
    && clean(item.ordName,120).length>=2;
}

export function partnerIsPublished(item,now=Date.now()){
  if(!item||item.isActive!==true)return false;
  if(!partnerAdComplianceReady(item))return false;
  if((item.startAt&&!Number.isFinite(Date.parse(item.startAt)))||(item.endAt&&!Number.isFinite(Date.parse(item.endAt))))return false;
  const start=Date.parse(item.startAt||'');
  if(Number.isFinite(start)&&start>now)return false;
  const end=Date.parse(item.endAt||'');
  if(Number.isFinite(end)&&end<=now)return false;
  return true;
}

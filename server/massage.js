const fail=message=>{throw Object.assign(new Error(message),{status:400});};
const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
function url(value,booking=false){
 const raw=text(value,1800);if(!raw)return '';
 if(booking&&/^tel:\+?[\d ()-]{5,25}$/.test(raw))return raw;
 try{const u=new URL(raw);if(u.protocol==='https:'&&!u.username&&!u.password)return u.href;}catch{}
 fail(booking?'Укажите ссылку https:// на запись или tel:+7…':'Медиа должно использовать https://');
}
export function sanitizeMassage(input={},existing={}){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('Некорректное объявление');
 const value={...existing,...input};
 const providerType=value.providerType??'salon';if(!['salon','private'].includes(providerType))fail('Выберите салон или частного специалиста');
 const media=value.media??[];if(!Array.isArray(media)||media.length>8)fail('Не более 8 медиафайлов');
 const result={
  providerType,name:text(value.name,100),description:text(value.description,5000),
  services:text(value.services,2000),priceText:text(value.priceText,1500),
  address:text(value.address,300),district:text(value.district,100),hours:text(value.hours,300),
  phone:text(value.phone,40),bookingUrl:url(value.bookingUrl,true),
  media:media.map(item=>{if(!item||!['image','video'].includes(item.type))fail('Неизвестный тип медиа');const src=url(item.url);if(!src)fail('Добавьте ссылку медиа');return {type:item.type,url:src};}),
  isPublished:value.isPublished===true
 };
 if(result.name.length<2)fail('Укажите название салона или имя специалиста');
 if(result.isPublished&&(!result.bookingUrl||result.description.length<10||!result.priceText||!result.address))fail('Для публикации заполните описание, цены, адрес/условия выезда и ссылку на запись');
 if(value.research!=null){
  const r=value.research;
  if(typeof r!=='object'||!Number.isFinite(r.rating)||r.rating<0||r.rating>5||!Number.isInteger(r.reviewCount)||r.reviewCount<0||!/^\d{4}-\d{2}-\d{2}$/.test(r.checkedAt||''))fail('Проверьте рейтинг, количество отзывов и дату источника');
  const reviewUrl=url(r.reviewUrl),officialUrl=url(r.officialUrl),photoSourceUrl=url(r.photoSourceUrl);
  if(!reviewUrl||!officialUrl)fail('Добавьте источники подборки');
  result.research={rating:r.rating,reviewCount:r.reviewCount,checkedAt:r.checkedAt,reviewUrl,officialUrl,photoSourceUrl};
 }
 return result;
}
export function publicMassage(id,data){
 if(data.isPublished!==true)return null;
 const clean=sanitizeMassage(data);
 return {id,...clean};
}

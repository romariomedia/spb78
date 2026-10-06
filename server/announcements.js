const clean=(value,max=300)=>typeof value==='string'?value.trim().slice(0,max):'';
const placements=new Set(['global','discover','trainings','leisure','feed','profile']);
const audiences=new Set(['all','verified','district','sport']);

export function sanitizeAnnouncement(input={},existing={}){
  const placement=placements.has(input.placement)?input.placement:(existing.placement||'global');
  const audienceType=audiences.has(input.audienceType)?input.audienceType:(existing.audienceType||'all');
  const title=clean(input.title??existing.title,120);
  const text=clean(input.text??existing.text,500);
  if(title.length<2)throw Object.assign(new Error('Укажите заголовок объявления.'),{status:400});
  if(text.length<2)throw Object.assign(new Error('Укажите текст объявления.'),{status:400});
  const buttonLabel=clean(input.buttonLabel??existing.buttonLabel,60);
  const buttonLink=clean(input.buttonLink??existing.buttonLink,300);
  if(buttonLink&&!/^#[A-Za-z0-9_?=&%+\-:./]*$/.test(buttonLink))throw Object.assign(new Error('Кнопка может вести только на внутренний раздел SportBuddy78.'),{status:400});
  const startAt=clean(input.startAt??existing.startAt,40);
  const endAt=clean(input.endAt??existing.endAt,40);
  const startMs=startAt?Date.parse(startAt):0,endMs=endAt?Date.parse(endAt):0;
  if(startAt&&!Number.isFinite(startMs))throw Object.assign(new Error('Некорректная дата начала.'),{status:400});
  if(endAt&&!Number.isFinite(endMs))throw Object.assign(new Error('Некорректная дата окончания.'),{status:400});
  if(startMs&&endMs&&endMs<=startMs)throw Object.assign(new Error('Дата окончания должна быть позже даты начала.'),{status:400});
  return {
    title,text,imageUrl:clean(input.imageUrl??existing.imageUrl,1500),buttonLabel,buttonLink,
    placement,audienceType,audienceValue:clean(input.audienceValue??existing.audienceValue,100),
    startAt:startMs?new Date(startMs).toISOString():'',endAt:endMs?new Date(endMs).toISOString():'',
    priority:Math.max(0,Math.min(100,Number.isFinite(Number(input.priority))?Math.round(Number(input.priority)):Number(existing.priority||0))),
    isActive:input.isActive===undefined?existing.isActive!==false:input.isActive===true,
    dismissible:input.dismissible===undefined?existing.dismissible!==false:input.dismissible===true
  };
}

export function announcementMatchesUser(item,user,placement='global',now=Date.now()){
  if(!item||item.isActive===false)return false;
  if(item.placement!=='global'&&item.placement!==placement)return false;
  const start=Date.parse(item.startAt||'');if(Number.isFinite(start)&&start>now)return false;
  const end=Date.parse(item.endAt||'');if(Number.isFinite(end)&&end<=now)return false;
  if(item.audienceType==='verified'&&user?.isVerified!==true)return false;
  if(item.audienceType==='district'&&user?.districtId!==item.audienceValue)return false;
  if(item.audienceType==='sport'&&!(Array.isArray(user?.sports)&&user.sports.includes(item.audienceValue)))return false;
  return true;
}

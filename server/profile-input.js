// Validate client-editable fields before entering a Firestore transaction.
const fail = field => { throw Object.assign(new Error(`Некорректное поле профиля: ${field}`), {status:400}); };
export function isPhotoUrl(value) {
  if(typeof value !== 'string' || value.length > 2048) return false;
  try { const url=new URL(value); return url.protocol==='https:' && Boolean(url.hostname) && !url.username && !url.password; }
  catch { return false; }
}
export function validateProfileInput(input, now=Date.now()) {
  if(!input || typeof input!=='object' || Array.isArray(input)) fail('profile');
  const out={...input};
  const strings={bio:1000,locationName:200,phone:40,deviceId:200,themeAccent:40,themeSurface:40};
  for(const [key,max] of Object.entries(strings)) if(key in out){
    if(typeof out[key]!=='string' || out[key].length>max) fail(key);
    out[key]=out[key].trim();
  }
  for(const key of ['genderSet','activeLooking','hidePhone','hideBirthDate','hasUsedGeolocation'])
    if(key in out && typeof out[key]!=='boolean') fail(key);
  if('age' in out && (!Number.isInteger(out.age) || out.age<18 || out.age>100)) fail('age');
  if('gender' in out && !['male','female'].includes(out.gender)) fail('gender');
  if('sports' in out){
    if(!Array.isArray(out.sports) || out.sports.length>20 || out.sports.some(v=>typeof v!=='string'||!v.trim()||v.length>80)) fail('sports');
    out.sports=[...new Set(out.sports.map(v=>v.trim()))];
  }
  if('avatar' in out && out.avatar!=='' && !isPhotoUrl(out.avatar)) fail('avatar');
  if('photoPortfolio' in out && (!Array.isArray(out.photoPortfolio) || out.photoPortfolio.length>5 || out.photoPortfolio.some(v=>!isPhotoUrl(v)))) fail('photoPortfolio');
  if('birthDate' in out && out.birthDate!==''){
    if(typeof out.birthDate!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(out.birthDate)) fail('birthDate');
    const dob=new Date(out.birthDate+'T00:00:00Z');
    if(!Number.isFinite(dob.getTime()) || dob.toISOString().slice(0,10)!==out.birthDate) fail('birthDate');
    const today=new Date(now+3*3600000).toISOString().slice(0,10);
    const age=Number(today.slice(0,4))-dob.getUTCFullYear()-(today.slice(5)<out.birthDate.slice(5)?1:0);
    if(age<18||age>100) fail('birthDate');
    out.age=age;
  }
  if('legalAcceptedAt' in out){
    if(typeof out.legalAcceptedAt!=='string' || !Number.isFinite(Date.parse(out.legalAcceptedAt))) fail('legalAcceptedAt');
    out.legalAcceptedAt=new Date(now).toISOString();
  }
  if('lastSeenAt' in out) out.lastSeenAt=now;
  return out;
}

export const BUSINESS_SUBJECT_TYPES = Object.freeze(['trainer','venue','massage']);
export const COMMERCIAL_LAUNCH_AT = '2027-01-01T00:00:00+03:00';

export const DEFAULT_BILLING_CONFIG = Object.freeze({
  enabled: false,
  commercialLaunchAt: COMMERCIAL_LAUNCH_AT,
  plans: {
    trainer: { label:'Персональный тренер', monthlyRub:500, yearlyRub:5000 },
    venue: { label:'Спортивная площадка / студия', monthlyRub:1000, yearlyRub:10000 },
    massage: { label:'Массаж / wellness', monthlyRub:1500, yearlyRub:15000 }
  }
});

const clean = (value,max=300) => typeof value === 'string' ? value.trim().slice(0,max) : '';
const integer = (value,min,max,fallback) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
};
const millis = value => {
  const raw = value?.toDate ? value.toDate().getTime() : Date.parse(String(value || ''));
  return Number.isFinite(raw) ? raw : 0;
};
const iso = value => {
  const raw = millis(value);
  return raw ? new Date(raw).toISOString() : '';
};

export function validBusinessSubjectType(value){
  return typeof value === 'string' && BUSINESS_SUBJECT_TYPES.includes(value);
}
export function validBusinessSubjectId(value){
  return typeof value === 'string' && /^[a-zA-Z0-9_:-]{1,180}$/.test(value) && !value.includes('/');
}
export function businessSubscriptionId(subjectType,subjectId){
  if(!validBusinessSubjectType(subjectType) || !validBusinessSubjectId(subjectId)) throw Object.assign(new Error('Некорректная коммерческая услуга.'),{status:400});
  return `${subjectType}:${subjectId}`;
}
export function sanitizeBillingConfig(input={},previous=DEFAULT_BILLING_CONFIG){
  const sourcePlans=input.plans||{};
  const nextPlans={};
  for(const type of BUSINESS_SUBJECT_TYPES){
    const base=previous.plans?.[type]||DEFAULT_BILLING_CONFIG.plans[type];
    const source=sourcePlans[type]||{};
    nextPlans[type]={
      label:DEFAULT_BILLING_CONFIG.plans[type].label,
      monthlyRub:integer(source.monthlyRub,0,1_000_000,base.monthlyRub),
      yearlyRub:integer(source.yearlyRub,0,10_000_000,base.yearlyRub)
    };
  }
  return {
    enabled:input.enabled===true,
    // Commercial charging is intentionally pinned to the 2027 launch.
    commercialLaunchAt:COMMERCIAL_LAUNCH_AT,
    plans:nextPlans
  };
}
export async function getBillingConfig(db){
  const snap=await db.collection('billingConfig').doc('main').get();
  return sanitizeBillingConfig(snap.exists?snap.data():DEFAULT_BILLING_CONFIG,DEFAULT_BILLING_CONFIG);
}
export function billingIsOpen(config,now=Date.now()){
  return config?.enabled===true && now>=Date.parse(COMMERCIAL_LAUNCH_AT);
}
export function planFor(config,subjectType,interval){
  if(!validBusinessSubjectType(subjectType))return null;
  const plan=config?.plans?.[subjectType];
  if(!plan)return null;
  if(interval==='monthly')return {interval,months:1,amountRub:plan.monthlyRub,label:plan.label};
  if(interval==='yearly')return {interval,months:12,amountRub:plan.yearlyRub,label:plan.label};
  return null;
}
export function addCalendarMonths(value,months){
  const date=new Date(value);
  const day=date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth()+months);
  const lastDay=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
  date.setUTCDate(Math.min(day,lastDay));
  return date;
}
export function effectiveBusinessUntil(subscription={},extraUntil=''){
  return Math.max(millis(subscription.activeUntil),millis(extraUntil));
}
export function publicBusinessSubscription(subscription={},extraUntil='',now=Date.now()){
  const effective=effectiveBusinessUntil(subscription,extraUntil);
  return {
    subjectType:clean(subscription.subjectType,30),
    subjectId:clean(subscription.subjectId,180),
    subjectLabel:clean(subscription.subjectLabel,180),
    ownerUserId:clean(subscription.ownerUserId,180),
    activeUntil:effective?new Date(effective).toISOString():'',
    paidUntil:iso(subscription.paidUntil),
    complimentaryUntil:iso(subscription.complimentaryUntil),
    status:effective>now?'active':'inactive',
    lastPaymentAt:iso(subscription.lastPaymentAt),
    lastGrantedAt:iso(subscription.lastGrantedAt)
  };
}
export async function resolveBusinessSubject(db,subjectType,subjectId){
  businessSubscriptionId(subjectType,subjectId);
  if(subjectType==='trainer'){
    const snap=await db.collection('users').doc(subjectId).get();
    if(!snap.exists)throw Object.assign(new Error('Профиль тренера не найден.'),{status:404});
    const data=snap.data()||{};
    if(data.personalTrainer?.enabled!==true)throw Object.assign(new Error('Сначала включите профиль персонального тренера.'),{status:409});
    return {subjectType,subjectId,label:clean(data.name,120)||'Персональный тренер',defaultOwnerUserId:subjectId};
  }
  const collection=subjectType==='venue'?'venues':'massageServices';
  const snap=await db.collection(collection).doc(subjectId).get();
  if(!snap.exists)throw Object.assign(new Error(subjectType==='venue'?'Площадка не найдена.':'Объявление массажа не найдено.'),{status:404});
  const data=snap.data()||{};
  if(data.archived===true)throw Object.assign(new Error('Объект архивирован.'),{status:409});
  return {subjectType,subjectId,label:clean(data.name,160)||DEFAULT_BILLING_CONFIG.plans[subjectType].label,defaultOwnerUserId:''};
}
export async function foundingCoachUntil(db,subjectType,subjectId){
  if(subjectType!=='trainer')return '';
  const snap=await db.collection('userAdmin').doc(subjectId).get();
  if(!snap.exists||snap.data()?.foundingCoach!==true)return '';
  return iso(snap.data()?.foundingCoachFreeUntil);
}
export function businessPaymentMatches(remote,expected,paymentId){
  return remote?.id===paymentId && remote?.status==='succeeded' && remote?.paid===true
    && (remote?.test!==true || process.env.YOOKASSA_ALLOW_TEST_PAYMENTS==='true')
    && expected?.product==='business_subscription'
    && remote?.metadata?.product==='sportbuddy78_business_subscription'
    && remote?.metadata?.userId===expected.ownerUserId
    && remote?.metadata?.subjectType===expected.subjectType
    && remote?.metadata?.subjectId===expected.subjectId
    && remote?.metadata?.interval===expected.interval
    && String(remote?.metadata?.months)===String(expected.months)
    && Number.isInteger(expected.months) && expected.months>0 && expected.months<=12
    && String(remote?.amount?.value)===String(expected.amount)
    && remote?.amount?.currency==='RUB' && expected.currency==='RUB';
}

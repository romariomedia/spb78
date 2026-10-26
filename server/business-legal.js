export const LEGAL_VERSION = '2026-10-26';
export const BUSINESS_OFFER_VERSION = 'SB78-B2B-2026-10-26';

export const SPORTBUDDY_OPERATOR = Object.freeze({
  legalName: 'Индивидуальный предприниматель Сайдашев Роман Витальевич',
  shortName: 'ИП Сайдашев Роман Витальевич',
  inn: '272199019189',
  ogrnip: '326784700311389',
  website: 'https://sportbuddy78.pro',
  legalEmail: 'romariomedia@yandex.ru',
  supportEmail: 'support@sportbuddy78.ru',
  region: 'г. Санкт-Петербург',
  settlementAccount: '40802810300010024999',
  bankName: 'АО «ТБанк»',
  bankInn: '7710140679',
  bankBik: '044525974',
  correspondentAccount: '30101810145250000974'
});

export const BUSINESS_ENTITY_TYPES = Object.freeze(['ip','self_employed','legal_entity','individual_professional']);

const clean=(value,max=300)=>typeof value==='string'?value.trim().replace(/\s+/g,' ').slice(0,max):'';
const email=value=>{
  const v=clean(value,180).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)?v:'';
};
const digits=(value,max=20)=>clean(value,max).replace(/\D/g,'').slice(0,max);

export function sanitizeBusinessLegalProfile(input={}){
  const entityType=BUSINESS_ENTITY_TYPES.includes(input.entityType)?input.entityType:'';
  return {
    entityType,
    legalName:clean(input.legalName,220),
    inn:digits(input.inn,12),
    ogrn:digits(input.ogrn,15),
    address:clean(input.address,300),
    email:email(input.email),
    phone:clean(input.phone,40),
    representative:clean(input.representative,180),
    basis:clean(input.basis,180)
  };
}

export function businessLegalProfileErrors(profile={}){
  const p=sanitizeBusinessLegalProfile(profile);
  const errors=[];
  if(!BUSINESS_ENTITY_TYPES.includes(p.entityType))errors.push('Выберите статус заказчика.');
  if(p.legalName.length<5)errors.push('Укажите полное имя или наименование заказчика.');
  if(!/^\d{10}$|^\d{12}$/.test(p.inn))errors.push('ИНН должен содержать 10 или 12 цифр.');
  if(!p.email)errors.push('Укажите корректный e-mail для договора и кассового чека.');
  if(p.entityType==='ip'&&!/^\d{15}$/.test(p.ogrn))errors.push('Для ИП укажите ОГРНИП из 15 цифр.');
  if(p.entityType==='legal_entity'&&!/^\d{13}$/.test(p.ogrn))errors.push('Для юридического лица укажите ОГРН из 13 цифр.');
  if(p.entityType==='legal_entity'&&p.address.length<5)errors.push('Для юридического лица укажите юридический адрес.');
  return errors;
}

export function businessLegalProfileReady(profile={}){
  return businessLegalProfileErrors(profile).length===0;
}

export function publicBusinessLegalProfile(profile={}){
  const value=sanitizeBusinessLegalProfile(profile);
  return {...value,ready:businessLegalProfileReady(value),errors:businessLegalProfileErrors(value)};
}

export function requireBusinessLegalProfile(profile={}){
  const value=sanitizeBusinessLegalProfile(profile),errors=businessLegalProfileErrors(value);
  if(errors.length){
    throw Object.assign(new Error(errors[0]),{status:409,code:'LEGAL_PROFILE_REQUIRED',details:errors});
  }
  return value;
}

const iso=value=>{
  const d=value instanceof Date?value:new Date(String(value||''));
  return Number.isFinite(d.getTime())?d.toISOString():'';
};
const money=value=>Number.isFinite(Number(value))?Number(value):0;
const subjectTypeLabel=type=>type==='trainer'?'персонального тренера':type==='venue'?'спортивной площадки / студии':'массажной / wellness-карточки';

export function businessContractNumber(paymentId,createdAt=new Date()){
  const date=new Date(createdAt);
  const day=Number.isFinite(date.getTime())
    ? date.toISOString().slice(0,10).replaceAll('-','')
    : new Date().toISOString().slice(0,10).replaceAll('-','');
  const suffix=String(paymentId||'PAYMENT').replace(/[^a-zA-Z0-9]/g,'').slice(-10).toUpperCase()||'PAYMENT';
  return `SB78-${day}-${suffix}`;
}

export function buildBusinessContractSnapshot({
  payment,
  serviceStart,
  serviceUntil,
  createdAt=new Date()
}){
  if(!payment||!['business_subscription','business_promotion'].includes(payment.product)){
    throw new Error('Unsupported contract product');
  }
  const customer=requireBusinessLegalProfile(payment.legalProfileSnapshot||{});
  const created=iso(createdAt)||new Date().toISOString();
  const promotion=payment.product==='business_promotion';
  const number=businessContractNumber(payment.paymentId||payment.id||'',created);
  const serviceName=promotion
    ? `приоритетное размещение и продвижение ${subjectTypeLabel(payment.subjectType)} «${clean(payment.subjectLabel,180)}» в SportBuddy78`
    : `размещение ${subjectTypeLabel(payment.subjectType)} «${clean(payment.subjectLabel,180)}» и доступ к функциям SportBuddy78 Business`;
  return {
    id:clean(payment.paymentId||payment.id,180),
    contractNumber:number,
    contractVersion:BUSINESS_OFFER_VERSION,
    legalVersion:LEGAL_VERSION,
    ownerUserId:clean(payment.ownerUserId,180),
    subjectType:clean(payment.subjectType,30),
    subjectId:clean(payment.subjectId,180),
    subjectLabel:clean(payment.subjectLabel,180),
    product:payment.product,
    interval:clean(payment.interval,20),
    months:Number(payment.months||0),
    days:Number(payment.days||0),
    amountRub:money(payment.amount),
    currency:'RUB',
    paymentId:clean(payment.paymentId||payment.id,180),
    acceptedAt:iso(payment.offerAcceptedAt)||created,
    createdAt:created,
    serviceStart:iso(serviceStart)||created,
    serviceUntil:iso(serviceUntil),
    serviceName,
    provider:{...SPORTBUDDY_OPERATOR},
    customer,
    conclusionMethod:'Акцепт электронной оферты в авторизованном кабинете SportBuddy78 и последующая оплата через YooKassa.',
    electronicSignature:'Действия, совершенные после аутентификации в аккаунте заказчика, признаются простой электронной подписью в порядке, установленном договором-офертой.'
  };
}

const unicodeRtf=text=>{
  let out='';
  for(let i=0;i<String(text??'').length;i++){
    const code=String(text)[i].charCodeAt(0),ch=String(text)[i];
    if(ch==='\\'||ch==='{'||ch==='}')out+='\\'+ch;
    else if(code===10)out+='\\line ';
    else if(code>=32&&code<=126)out+=ch;
    else out+=`\\u${code>32767?code-65536:code}?`;
  }
  return out;
};
const rtfP=(text,bold=false)=>`\\pard\\sa120 ${bold?'\\b ':''}${unicodeRtf(text)}${bold?'\\b0':''}\\par\n`;
const formatRuDate=value=>{
  const d=new Date(value);
  return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('ru-RU',{dateStyle:'long',timeZone:'Europe/Moscow'}).format(d):'—';
};

export function renderBusinessContractRtf(contract){
  const c=contract||{},provider=c.provider||SPORTBUDDY_OPERATOR,customer=c.customer||{};
  const isPromotion=c.product==='business_promotion';
  const servicePeriod=`${formatRuDate(c.serviceStart)} — ${formatRuDate(c.serviceUntil)}`;
  const customerStatus=customer.entityType==='ip'?'Индивидуальный предприниматель'
    :customer.entityType==='legal_entity'?'Юридическое лицо'
    :customer.entityType==='self_employed'?'Плательщик налога на профессиональный доход'
    :'Физическое лицо, приобретающее услугу для профессиональной деятельности';
  const lines=[
    ['ДОГОВОР ОКАЗАНИЯ ИНФОРМАЦИОННЫХ И ЦИФРОВЫХ УСЛУГ',true],
    [`№ ${c.contractNumber}`,true],
    [`г. Санкт-Петербург                                      ${formatRuDate(c.createdAt)}`,false],
    ['',false],
    ['1. СТОРОНЫ И СПОСОБ ЗАКЛЮЧЕНИЯ',true],
    [`${provider.legalName}, ИНН ${provider.inn}, ОГРНИП ${provider.ogrnip}, далее «Исполнитель», и ${customer.legalName}, статус: ${customerStatus}, ИНН ${customer.inn}${customer.ogrn?', ОГРН/ОГРНИП '+customer.ogrn:''}, далее «Заказчик», заключили настоящий договор в электронной форме.`,false],
    [`Договор заключен путем полного и безоговорочного акцепта Заказчиком договора-оферты SportBuddy78 Business редакции ${c.contractVersion} в авторизованном кабинете и оплаты услуги. Акцепт зафиксирован ${formatRuDate(c.acceptedAt)}. Идентификатор платежа YooKassa: ${c.paymentId}.`,false],
    ['2. ПРЕДМЕТ ДОГОВОРА',true],
    [`Исполнитель оказывает Заказчику услугу: ${c.serviceName}.`,false],
    [isPromotion
      ? 'Продвижение означает предоставление повышенного приоритета отображения коммерческой карточки в пределах соответствующего раздела SportBuddy78. Исполнитель не гарантирует определенное количество просмотров, обращений, клиентов, продаж или иной коммерческий результат.'
      : 'Размещение включает техническое опубликование коммерческой карточки, доступ к предусмотренным тарифом функциям кабинета SportBuddy78 Business и статистике взаимодействий пользователей.',false],
    [`Период оказания услуги: ${servicePeriod}.`,false],
    ['3. СТОИМОСТЬ И РАСЧЕТЫ',true],
    [`Стоимость услуги: ${Number(c.amountRub||0).toLocaleString('ru-RU')} рублей. Налоговый режим и НДС Исполнителя определяются применимым законодательством и данными фискального чека. Оплата произведена через YooKassa.`,false],
    ['Кассовый чек направляется на электронную почту Заказчика в порядке, предусмотренном законодательством о применении ККТ и выбранной Исполнителем схемой фискализации.',false],
    ['4. ОБЯЗАННОСТИ И ГАРАНТИИ ЗАКАЗЧИКА',true],
    ['Заказчик гарантирует достоверность предоставленных реквизитов и сведений, наличие необходимых прав на тексты, фотографии, товарные знаки и иные материалы коммерческой карточки, а также соответствие своей деятельности требованиям законодательства Российской Федерации.',false],
    ['Заказчик обязан незамедлительно сообщать Исполнителю об изменении реквизитов, статуса деятельности, лицензий или иных сведений, существенных для законного размещения информации.',false],
    ['Если размещаемый материал признается рекламой, его распространение допускается только после выполнения обязательных требований к маркировке интернет-рекламы, включая получение идентификатора рекламы и передачу необходимых сведений оператору рекламных данных, когда это требуется законом.',false],
    ['5. ПРАВА И ОБЯЗАННОСТИ ИСПОЛНИТЕЛЯ',true],
    ['Исполнитель обеспечивает техническую доступность оплаченной функции в пределах штатной работы сервиса, вправе проводить профилактические работы, модерировать материалы и приостанавливать размещение при наличии признаков нарушения закона, прав третьих лиц или правил SportBuddy78.',false],
    ['При приостановлении по причинам, зависящим от Заказчика, последствия для оплаченного периода определяются договором-офертой и применимым законодательством. При технической невозможности оказания услуги по вине Исполнителя стороны применяют соразмерное продление либо возврат за неоказанный период.',false],
    ['6. ИНТЕЛЛЕКТУАЛЬНЫЕ ПРАВА И КОНТЕНТ',true],
    ['Права на платформу SportBuddy78 остаются у Исполнителя. Заказчик предоставляет Исполнителю простое неисключительное право использовать переданные материалы только в объеме, необходимом для размещения, модерации, технической обработки и продвижения карточки в рамках заказанной услуги.',false],
    ['7. ПЕРСОНАЛЬНЫЕ ДАННЫЕ И ЭЛЕКТРОННОЕ ВЗАИМОДЕЙСТВИЕ',true],
    ['Стороны обрабатывают персональные данные в объеме, необходимом для заключения и исполнения договора, бухгалтерского и налогового учета, претензионной работы и исполнения требований законодательства. Порядок обработки данных SportBuddy78 определяется опубликованной Политикой обработки персональных данных.',false],
    ['Документы, уведомления и юридически значимые сообщения могут направляться через авторизованный кабинет и по адресам электронной почты, указанным сторонами. Действия Заказчика после аутентификации признаются простой электронной подписью в соответствии с договором-офертой.',false],
    ['8. ОТВЕТСТВЕННОСТЬ И СПОРЫ',true],
    ['Стороны несут ответственность в соответствии с законодательством Российской Федерации. До обращения в суд сторона направляет претензию по электронной почте; срок ответа — 10 рабочих дней, если обязательный иной срок не установлен законом.',false],
    ['К отношениям сторон применяется право Российской Федерации. Подсудность определяется в соответствии с применимыми нормами процессуального законодательства.',false],
    ['9. РЕКВИЗИТЫ ИСПОЛНИТЕЛЯ',true],
    [provider.legalName,false],
    [`ИНН ${provider.inn}; ОГРНИП ${provider.ogrnip}`,false],
    [`Сайт: ${provider.website}; e-mail: ${provider.legalEmail}; поддержка: ${provider.supportEmail}`,false],
    [`Расчетный счет: ${provider.settlementAccount}`,false],
    [`Банк: ${provider.bankName}; ИНН банка ${provider.bankInn}; БИК ${provider.bankBik}; корр. счет ${provider.correspondentAccount}`,false],
    ['10. РЕКВИЗИТЫ ЗАКАЗЧИКА',true],
    [customer.legalName,false],
    [`ИНН ${customer.inn}${customer.ogrn?'; ОГРН/ОГРНИП '+customer.ogrn:''}`,false],
    [customer.address?`Адрес: ${customer.address}`:'Адрес: не указан',false],
    [`E-mail: ${customer.email}${customer.phone?'; телефон: '+customer.phone:''}`,false],
    ['',false],
    [`Версия правовых условий: ${c.legalVersion}. Договор сформирован автоматически SportBuddy78 и хранится в кабинете Заказчика.`,false]
  ];
  return '{\\rtf1\\ansi\\ansicpg1251\\deff0{\\fonttbl{\\f0 Arial;}}\\viewkind4\\uc1\\fs22\n'
    +lines.map(([text,bold])=>rtfP(text,bold)).join('')
    +'}';
}

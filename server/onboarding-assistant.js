import {isBetaActive} from '../shared/access-policy.js';
const topics = [
 ['trainings','Найти компанию для тренировки','Выбери вид спорта, район и подходящую тренировку. Открой карточку и запишись. Можно создать свою встречу и выбрать площадку; учитывай условия участия и количество мест.','trainings'],
 ['leisure','Посмотреть активный отдых','В разделе «Отдых» можно выбрать место для прогулки или поездки и найти встречи сообщества. В карточках услуг запись ведёт к исполнителю: SportBuddy не оформляет бронь.','leisure'],
 ['discover','Как работают знакомства','Заполни профиль и интересы, просматривай анкеты. Взаимная симпатия создаёт мэтч. Первую встречу планируйте в общественном месте на совместной тренировке.','discover'],
 ['profile','Фото и верификация','Добавь личное фото и фото в портфолио, заполни профиль и район. Статус подтверждает сервер после сохранения. Если статус не обновился, обнови данные; если проблема остаётся, обратись в поддержку.','profile'],
 ['friends','Друзья и общение','Отправь заявку человеку из его профиля. После принятия вы сможете найти друг друга во вкладке друзей в чатах. Доступ к общению зависит от действующих условий тарифа.','chats'],
 ['feed','Лента и события города','В «Ленте» смотри публикации, истории и спортивную афишу. «Иду» помогает найти компанию и не заменяет билет: билеты покупаются на сайте организатора.','feed'],
 ['rewards','Медали и прогресс','За ежедневный вход можно получить медаль. Условия текущего цикла и награды показаны в профиле. Спортивный ID отдельно хранит подтверждённые спортивные достижения, а не медали за вход.','profile'],
 ['premium','Premium и тестовый период','','profile'],
 ['support','Нужна помощь человека','Если что-то не работает, напиши в support@sportbuddy78.ru. Укажи раздел, устройство и текст ошибки. Не отправляй пароль, код входа или платёжные реквизиты. Я виртуальный помощник с готовыми ответами, не сотрудник поддержки.','support']
];
export function assistantTopics(now=Date.now()) {
 return topics.map(([id,label,text,target])=>({id,label,target,text:id==='premium'?(isBetaActive(now)?'До конца 2026 года действует тестовый период с бесплатным доступом к Premium-функциям. SportBuddy BOX в бета-период не выдаётся. Накопленные промокоды сохраняются. С 1 января 2027 года действуют условия тарифа — посмотри их в профиле.':'Тестовый период завершён. Актуальные возможности, стоимость Premium и накопленные промокоды доступны в профиле. Проверь условия выбранной награды перед активацией.'):text}));
}
export function assistantTransition(previous, body, now=Date.now(), registeredAt) {
 const state=previous || {createdAt:now, welcomeRead:!Number.isFinite(Date.parse(registeredAt)) || now-Date.parse(registeredAt)>7*86400000, muted:false, history:[]};
 const action=body.action || 'state';
 if(!['state','read','mute','ask'].includes(action))throw Object.assign(new Error('Неизвестное действие'),{status:400});
 if(action==='read')return {...state,welcomeRead:true};
 if(action==='mute'){
  if(typeof body.muted!=='boolean')throw Object.assign(new Error('Некорректная настройка'),{status:400});
  return {...state,muted:body.muted,welcomeRead:true};
 }
 if(action==='ask') {
  if(!assistantTopics(now).some(t=>t.id===body.topicId))throw Object.assign(new Error('Выберите вопрос из списка'),{status:400});
  if(typeof body.requestId!=='string'|| !/^[a-zA-Z0-9-]{8,80}$/.test(body.requestId))throw Object.assign(new Error('Некорректный запрос'),{status:400});
  const history=Array.isArray(state.history)?state.history:[];
  if(history.some(t=>t.id===body.requestId))return state;
  return {...state,welcomeRead:true,history:[...history,{id:body.requestId,topicId:body.topicId,at:now}].slice(-20)};
 }
 return state;
}

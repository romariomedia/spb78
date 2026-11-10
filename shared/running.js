// Shared deterministic GPS calculations. Never trust a client-provided distance/time.
export const MAX_POINTS = 12000;
export const MAX_DURATION_MS = 6 * 60 * 60 * 1000;
export function distanceM(a, b) {
  const r = Math.PI / 180, dlat = (b.lat-a.lat)*r, dlng = (b.lng-a.lng)*r;
  const h = Math.sin(dlat/2)**2 + Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlng/2)**2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(Math.min(1,h)),Math.sqrt(Math.max(0,1-h)));
}
export function validPoint(p) {
  return p && ['lat','lng','timestamp','accuracy','segment'].every(k=>typeof p[k]==='number' && Number.isFinite(p[k]))
    && Math.abs(p.lat)<=90 && Math.abs(p.lng)<=180 && p.accuracy>=0 && p.accuracy<=50
    && Number.isInteger(p.segment) && p.segment>=0;
}
export function trackDistance(points) {
  let total=0;
  for(let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i],dt=(b.timestamp-a.timestamp)/1000,d=distanceM(a,b);
    if(a.segment===b.segment && dt>0 && dt<=30 && d/dt<=12) total+=d;
  }
  return total;
}
export function validateRun(input, route, now=Date.now()) {
  const fail = message=>{throw Object.assign(new Error(message),{status:400});};
  const {startedAt,endedAt,points}=input||{};
  if(!Number.isFinite(startedAt)||!Number.isFinite(endedAt)||endedAt<=startedAt||endedAt-startedAt>MAX_DURATION_MS
    ||endedAt>now+60000||startedAt<now-30*86400000) fail('Некорректное время пробежки (максимум 6 часов, отправка в течение 30 дней).');
  if(!Array.isArray(points)||points.length<2||points.length>MAX_POINTS) fail('Для сохранения нужны от 2 до 12000 точек GPS.');
  let previous=null,gaps=false,speed=false;
  for(const p of points) {
    if(!validPoint(p)||p.timestamp<startedAt||p.timestamp>endedAt) fail('Некорректные точки GPS.');
    if(previous) {
      const dt=(p.timestamp-previous.timestamp)/1000;
      if(dt<=0||p.segment<previous.segment) fail('Нарушен порядок GPS-точек.');
      if(dt>30||p.segment!==previous.segment) gaps=true;
      if(p.segment===previous.segment && distanceM(previous,p)/dt>12) speed=true;
    }
    previous=p;
  }
  const meters=Math.round(trackDistance(points));
  if(meters<20) fail('Слишком короткая запись: нужно хотя бы 20 метров с GPS.');
  const elapsedMs=endedAt-startedAt;
  let reason='Маршрут ещё не прошёл проверку точной трассы.';
  let eligible=false;
  if(route?.verified===true && route.path?.length>=2 && route.distanceM>0) {
    // Ordered dense checkpoints prevent shortcuts/backtracking and opposite-direction runs.
    const path=route.path;
    const dense=path.every((p,i)=>!i||distanceM(path[i-1],p)<=50);
    let cursor=0;
    for(const p of points) if(cursor<path.length && distanceM(p,path[cursor])<=35) cursor++;
    const nearPath=points.every(p=>path.some(q=>distanceM(p,q)<=60));
    eligible=dense && !gaps && !speed && cursor===path.length && nearPath
      && distanceM(points[0],path[0])<=35 && distanceM(points.at(-1),path.at(-1))<=35
      && Math.abs(meters-route.distanceM)<=route.distanceM*0.08
      && points[0].timestamp-startedAt<=15000 && endedAt-points.at(-1).timestamp<=15000;
    reason=eligible?'GPS-проверка пройдена.':'Трек не соответствует трассе или содержит паузы, разрывы GPS, скачки скорости.';
  }
  return {distanceM:meters,elapsedMs,paceSecPerKm:Math.round(elapsedMs/meters),eligible,reason,hasGaps:gaps,hasSpeedJumps:speed};
}

const clean=(value,max=300)=>typeof value==='string'?value.trim().slice(0,max):'';
const levels=new Set(['beginner','amateur','advanced','competitive','pro']);

export function sanitizeSportPassportDraft(input={},sports=[]){
  const mainSport=clean(input.mainSport,80);
  if(mainSport && !sports.includes(mainSport))throw Object.assign(new Error('Основной вид спорта должен быть выбран из профиля.'),{status:400});
  const level=levels.has(input.level)?input.level:'beginner';
  const rankTitle=clean(input.rankTitle,120);
  const yearsExperience=Math.max(0,Math.min(80,Math.floor(Number(input.yearsExperience)||0)));
  const achievements=Array.isArray(input.declaredAchievements)?input.declaredAchievements.slice(0,10).map((item,index)=>({
    id:clean(item?.id,80)||`declared-${index+1}`,
    title:clean(item?.title,180),
    date:clean(item?.date,10),
    sport:clean(item?.sport,80),
    verification:'declared'
  })).filter(x=>x.title.length>=2):[];
  return {mainSport,level,rankTitle,yearsExperience,declaredAchievements:achievements};
}

export function levelLabel(level){
  return ({beginner:'Начинающий',amateur:'Любитель',advanced:'Продвинутый',competitive:'Соревновательный',pro:'Профессионал'})[level]||'Начинающий';
}

export function buildAutomaticAchievements(user={}){
  const out=[];
  const workouts=Number(user.totalWorkouts||0);
  if(workouts>=1)out.push({id:'first-workout',title:'Первая подтверждённая тренировка',verification:'sportbuddy'});
  if(workouts>=5)out.push({id:'workouts-5',title:'5 подтверждённых тренировок',verification:'sportbuddy'});
  if(workouts>=10)out.push({id:'workouts-10',title:'10 подтверждённых тренировок',verification:'sportbuddy'});
  if(workouts>=25)out.push({id:'workouts-25',title:'25 подтверждённых тренировок',verification:'sportbuddy'});
  if(Number(user.ratingCount||0)>=5&&Number(user.rating||0)>=4.5)out.push({id:'rating-45',title:'Рейтинг 4.5+ по итогам тренировок',verification:'sportbuddy'});
  if(Number(user.totalDailyMedals||0)>=7)out.push({id:'medals-7',title:'7 дней спортивной активности',verification:'sportbuddy'});
  return out;
}

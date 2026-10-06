const clean=(value,max=300)=>typeof value==='string'?value.trim().slice(0,max):'';
const levels=new Set(['beginner','amateur','advanced','competitive','pro']);
const placementWin=/^(1|1-е|1 место|первое место|победитель|winner)$/i;
const placementPodium=/^(1|2|3|1-е|2-е|3-е|[123] место|первое место|второе место|третье место|победитель|winner)$/i;

export function sanitizeSportPassportDraft(input={},sports=[]){
  const mainSport=clean(input.mainSport,80);
  if(mainSport && !sports.includes(mainSport))throw Object.assign(new Error('Основной вид спорта должен быть выбран из профиля.'),{status:400});
  const level=levels.has(input.level)?input.level:'beginner';
  const rankTitle=clean(input.rankTitle,120);
  const yearsExperience=Math.max(0,Math.min(80,Math.floor(Number(input.yearsExperience)||0)));
  const achievements=Array.isArray(input.declaredAchievements)?input.declaredAchievements.slice(0,30).map((item,index)=>({
    id:clean(item?.id,80)||`declared-${index+1}`,
    title:clean(item?.title,180),
    date:clean(item?.date,10),
    sport:clean(item?.sport,80),
    placement:clean(item?.placement,80),
    verification:'declared'
  })).filter(x=>x.title.length>=2):[];
  return {mainSport,level,rankTitle,yearsExperience,declaredAchievements:achievements,publicEnabled:input.publicEnabled===true,publicSlug:clean(input.publicSlug,80)};
}

export function levelLabel(level){
  return ({beginner:'Начинающий',amateur:'Любитель',advanced:'Продвинутый',competitive:'Соревновательный',pro:'Профессионал'})[level]||'Начинающий';
}

export function competitionStats(results=[]){
  let wins=0,podiums=0;
  for(const result of results){
    const placement=clean(result?.placement,80);
    if(placementWin.test(placement))wins++;
    if(placementPodium.test(placement))podiums++;
  }
  return {wins,podiums};
}

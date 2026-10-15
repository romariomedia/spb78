import {callServer} from './serverApi';
export async function loadActivities<T>(kind: 'events' | 'trainings'): Promise<T[]> {
  const items:T[]=[]; const seen=new Set<string>(); let cursor:string|undefined;
  do {
    const page=await callServer<{items:T[];nextCursor:string|null}>('/api/activities-list',{kind,...(cursor?{cursor}:{})});
    if(!Array.isArray(page.items))throw new Error('Не удалось загрузить каталог');
    items.push(...page.items); cursor=page.nextCursor||undefined;
    if(cursor&&seen.has(cursor))throw new Error('Повтор страницы каталога');
    if(cursor)seen.add(cursor);
  } while(cursor);
  return items;
}

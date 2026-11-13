import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {DashboardSections} from '../../src/components/DashboardSections';
import {RouteCarousel} from '../../src/components/RouteCarousel';
import {FeedComposer,type FeedComposition} from '../../src/components/FeedComposer';
import routes from '../../shared/running-routes.json';
import '../../src/index.css';
function PersistentRun(){const [value,setValue]=useState(0);useEffect(()=>{(window as any).__runMounts=((window as any).__runMounts||0)+1;},[]);return <button onClick={()=>setValue(v=>v+1)}>Черновик {value}</button>;}
function Preview(){
 const [user,setUser]=useState('alice'),[visible,setVisible]=useState(true),[composer,setComposer]=useState(false);
 const route=routes[1];
 const publish=async(data:FeedComposition)=>{if((window as any).__rejectPost)throw Error('Связь прервана. Повторите.');(window as any).__posts=[...((window as any).__posts||[]),data];};
 return <main className="mx-auto max-w-lg space-y-5 p-4 pb-24 text-white">
  <h1 className="text-xl font-black text-lime-300">SportBuddy78</h1>
  <nav className="flex flex-wrap gap-3"><button onClick={()=>setUser(user==='alice'?'bob':'alice')}>Сменить аккаунт</button><button onClick={()=>setVisible(v=>!v)}>Сменить вкладку</button><button onClick={()=>setComposer(true)}>Что нового?</button></nav>
  <DashboardSections key={user} userId={user} visible={visible} sections={[
   {id:'running',title:'Пробежки и маршруты',content:<PersistentRun/>},
   {id:'events',title:'Мероприятия',content:<p>Мероприятия SportBuddy</p>},
   {id:'calendar',title:'Календарь',content:<p>Календарь тренировок</p>},
   {id:'trainers',title:'Тренеры',content:<p>Персональные тренеры</p>},
   {id:'leaderboard',title:'Рейтинг',content:<p>Таблица лидеров</p>},
   {id:'community',title:'Тренировки',content:<p>Спортивные тренировки</p>}
  ]}/>
  <RouteCarousel images={route.images} name={route.name}/>
  {composer&&<FeedComposer key={user} name="Александр" sports={['Бег','Велоспорт']} onClose={()=>setComposer(false)} onPublish={publish}/>}
 </main>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);

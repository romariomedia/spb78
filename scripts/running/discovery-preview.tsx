import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {DiscoverySettings} from '../../src/components/DiscoverySettings';
import {useDiscoveryHistory} from '../../src/hooks/useDiscoveryHistory';
import {DEFAULT_DISCOVERY_FILTERS,matchesDiscoveryFilters} from '../../src/services/discoveryPolicy';
import type {UserProfile} from '../../src/lib/types';
import '../../src/index.css';
const candidate={id:'athlete',name:'Анна',trainingLevel:'beginner',trainingTimes:['evening'],hasUsedGeolocation:true,lat:59.94,lng:30.31} as UserProfile;
function Preview(){
 const [uid,setUid]=useState('a'),[filters,setFilters]=useState(DEFAULT_DISCOVERY_FILTERS),[located,setLocated]=useState(false);
 const [fail,setFail]=useState(false),[saved,setSaved]=useState('');
 const history=useDiscoveryHistory(uid);
 const user={id:uid,trainingLevel:'',trainingTimes:[]} as UserProfile;
 const visible=!history.ids.includes(candidate.id)&&matchesDiscoveryFilters(candidate,filters,located?{lat:59.93,lng:30.31}:null);
 return <main className="mx-auto max-w-lg space-y-4 p-4 text-white">
 <h1 className="text-2xl font-black">Знакомства</h1>
 <DiscoverySettings key={uid} user={user} filters={filters} onFilters={setFilters} hasLocation={located} onLocate={()=>setLocated(true)} onSave={async updates=>{if(fail)throw Error('Нет связи. Повторите сохранение');return {...user,...updates};}} onSaved={u=>setSaved(JSON.stringify(u))}/>
 <p data-testid="candidate">{visible?'Анна':'Нет анкет'}</p>
 <button onClick={()=>history.hide(candidate.id,true)}>Пропустить</button>
 <button disabled={!history.canUndo} onClick={history.undo}>Вернуть</button>
 <button onClick={()=>setUid(uid==='a'?'b':'a')}>Сменить аккаунт</button>
 <button onClick={()=>setFail(!fail)}>Ошибка сохранения</button>
 <output data-testid="saved">{saved}</output>
 </main>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);

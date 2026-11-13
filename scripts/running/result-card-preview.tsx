// Development-only fixture. Not an entry point in the production build.
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import RunningResultCard from '../../src/components/RunningResultCard';
import '../../src/index.css';
const sample = {id:'sample', routeId:'neva-bridges', endedAt:1794391200000, distanceM:3200, elapsedMs:1200000, paceSecPerKm:375, reason:'', eligible:false};
function Preview() {
  const [result, setResult] = useState(sample);
  const [saved, setSaved] = useState(true);
  return <main style={{maxWidth:520,margin:'24px auto',padding:12}}>
    <p style={{color:'#94a3b8',fontSize:12,marginBottom:12}}>Предпросмотр · тестовые данные</p>
    <RunningResultCard result={result} saved={saved}/>
    <div style={{display:'flex',gap:12,color:'white',padding:16}}>
      <button onClick={()=>setResult({...sample,id:'zero',routeId:'free',distanceM:0,elapsedMs:123000,paceSecPerKm:0})}>Без GPS</button>
      <button onClick={()=>setSaved(false)}>Не сохранён</button>
      <button onClick={()=>setResult({...sample,id:'park',routeId:'alexandriysky'})}>Другой маршрут</button>
    </div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Preview/></React.StrictMode>);

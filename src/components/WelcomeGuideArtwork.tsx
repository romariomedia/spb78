import { useState } from 'react';
import { Heart, Dumbbell, Compass, MapPin, MessagesSquare, Camera, Trophy, Zap } from 'lucide-react';

const formats = [
 { label: 'Знакомства', Icon: Heart },
 { label: 'Тренировки', Icon: Dumbbell },
 { label: 'Активный отдых', Icon: Compass },
 { label: 'Площадки', Icon: MapPin },
 { label: 'Общение', Icon: MessagesSquare },
 { label: 'Лента и истории', Icon: Camera },
];

export function WelcomeGuideArtwork({ art }: { art: string }) {
 const [statistics, setStatistics] = useState(false);
 if (art === 'overview') return <div className="sb-guide-collage" aria-label="Возможности SportBuddy78">
  <span className="sb-guide-visual-eyebrow">СПОРТ. ЛЮДИ. ПИТЕР.</span>
  <div className="sb-guide-visual-title">Целый город.<br/><em>Твоя компания.</em></div>
  <div className="sb-guide-orbit"><Zap size={36} fill="currentColor"/><span>SportBuddy<b>78</b></span></div>
  <div className="sb-guide-mosaic">{formats.map(({label,Icon})=><div key={label}><Icon size={28} strokeWidth={1.6}/><span>{label}</span></div>)}</div>
  <div className="sb-guide-collage-reward"><Trophy size={20}/> Встречи. Движение. Достижения.</div>
  <svg className="sb-guide-skyline" viewBox="0 0 360 64" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M0 57h360M15 53V35h30v18m7 0V27h22v26m9 0V38h35v15m14 0V31h9V19h5V5h2v14h5v12h9v22m15 0V40h12V30h42v10h12v13m-48-23q18-27 36 0m-18-14V7m39 46V35h29v18m11 0V29h24v24m9 0V40h29v13"/></svg>
 </div>;
 if (art === 'chats' || art === 'feed' || art === 'progress') {
  const progress = art === 'progress';
  const file = progress ? (statistics ? 'stats-screen' : 'medals-screen') : art+'-screen';
  return <div className={'sb-guide-screen-art sb-guide-screen-art--'+art}>
   <span className="sb-guide-visual-eyebrow">ТВОЙ SPORTBUDDY78</span>
   <div className="sb-guide-visual-title">{art==='chats'?'Ближе друг к другу.':art==='feed'?'Твой спорт в кадре.':'Каждый шаг важен.'}</div>
   {progress && <div className="sb-guide-screen-tabs" role="group" aria-label="Примеры прогресса">
    <button type="button" aria-pressed={!statistics} onClick={()=>setStatistics(false)}>Медали</button>
    <button type="button" aria-pressed={statistics} onClick={()=>setStatistics(true)}>Статистика</button>
   </div>}
   <div className={'sb-guide-phone-window sb-guide-phone-window--'+art}>
    <img key={file} src={'/guide/'+file+'.jpg'} alt={progress ? (statistics?'Пример статистики активности в профиле':'Пример коллекции медалей и цикла наград') : art==='chats'?'Раздел чатов: мэтчи, друзья и группы':'Спортивная лента с историями и публикациями'} width={948} height={2048} decoding="async"/>
   </div>
   <p className="sb-guide-screen-caption">Реальный экран проекта{progress?' · пример личного прогресса':''}</p>
  </div>;
 }
 return <><img src={'/guide/'+art+'.webp'} alt="" width={941} height={1672} decoding="async"/><span className="sb-guide-art-note">Визуальная иллюстрация</span></>;
}

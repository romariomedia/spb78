import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, X, Zap, MapPin, BookOpen } from 'lucide-react';
import { triggerHapticImpact, triggerHapticNotification } from '../services/native';
import { guideChapters } from './welcomeGuideContent';
import './WelcomeGuide.css';
import { WelcomeGuideArtwork } from './WelcomeGuideArtwork';

const GUIDE_SEEN_KEY='sportbuddy_welcome_guide_v2';
export function hasSeenWelcomeGuide():boolean {try{return localStorage.getItem(GUIDE_SEEN_KEY)==='1';}catch{return false;}}
export function markWelcomeGuideSeen():void {try{localStorage.setItem(GUIDE_SEEN_KEY,'1');}catch{/* Optional device preference. */}}
interface WelcomeGuideProps {isOpen:boolean;onClose:()=>void;userName?:string;onStart?:()=>void;initialSlide?:number}
export function WelcomeGuide({isOpen,onClose,userName,onStart,initialSlide=0}:WelcomeGuideProps){
 const slides=guideChapters();
 const [index,setIndex]=useState(0);
 const dialog=useRef<HTMLDivElement>(null),scroll=useRef<HTMLDivElement>(null),closeButton=useRef<HTMLButtonElement>(null);
 const close=useCallback(()=>{triggerHapticImpact('light');onClose();},[onClose]);
 useEffect(()=>{
  if(!isOpen)return;
  setIndex(Math.max(0,Math.min(Number.isFinite(initialSlide)?Math.floor(initialSlide):0,slides.length-1)));
  const previous=document.activeElement as HTMLElement|null;
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  closeButton.current?.focus();
  return()=>{document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();};
 },[isOpen,initialSlide,slides.length]);
 useEffect(()=>{scroll.current?.scrollTo({top:0});dialog.current?.querySelector('[aria-current="step"]')?.scrollIntoView({block:'nearest',inline:'nearest'});},[index]);
 useEffect(()=>{
  if(!isOpen)return;
  const listener=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();close();}
   if(event.key==='Tab'){
    const elements=dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex="0"]');
    if(!elements?.length)return;
    const first=elements[0],last=elements[elements.length-1];
    if(event.shiftKey&&(document.activeElement===first||!dialog.current?.contains(document.activeElement))){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&(document.activeElement===last||!dialog.current?.contains(document.activeElement))){event.preventDefault();first?.focus();}
   }
  };
  document.addEventListener('keydown',listener);return()=>document.removeEventListener('keydown',listener);
 },[isOpen,close]);
 if(!isOpen)return null;
 const slide=slides[index]??slides[0]!;
 const last=index===slides.length-1;
 const go=(value:number)=>{setIndex(Math.max(0,Math.min(value,slides.length-1)));triggerHapticImpact('light');};
 const finish=()=>{triggerHapticNotification('success');if(onStart)onStart();else onClose();};
 return <div className="sb-guide-overlay" onClick={e=>{if(e.target===e.currentTarget)close();}}>
  <div ref={dialog} className="sb-guide" role="dialog" aria-modal="true" aria-labelledby="sb-guide-title">
   <header className="sb-guide-header">
    <div className="sb-guide-brand"><span className="sb-guide-bolt"><Zap size={22} fill="currentColor"/></span><div><strong>SportBuddy<span>78</span></strong><small>ТВОЙ ГИД ПО ПРОЕКТУ</small></div></div>
    <button ref={closeButton} onClick={close} className="sb-guide-close" aria-label="Закрыть инструкцию"><X size={21}/></button>
   </header>
   <nav className="sb-guide-chapters" aria-label="Разделы инструкции">
    {slides.map((item,i)=><button key={item.id} aria-current={i===index?'step':undefined} onClick={()=>go(i)}><span>{String(i+1).padStart(2,'0')}</span>{item.label}</button>)}
   </nav>
   <div className="sb-guide-body" ref={scroll}>
    <figure className="sb-guide-art" key={'art-'+slide.id}>
     <WelcomeGuideArtwork key={slide.id} art={slide.art}/>
     <div className="sb-guide-art-shade"/>
     <figcaption><MapPin size={13}/> Санкт-Петербург и дальше</figcaption>
    </figure>
    <article key={slide.id} className="sb-guide-copy">
     <p className="sb-guide-kicker">{index===0&&userName?`Привет, ${userName.split(' ')[0]}!`:slide.eyebrow}</p>
     <h2 id="sb-guide-title" aria-live="polite">{slide.title}<em>{slide.accent}</em></h2>
     <p className="sb-guide-lead">{slide.lead}</p>
     {slide.points.length > 0 && <ol className="sb-guide-steps">{slide.points.map(([title,detail],i)=><li key={title}><span className="sb-guide-number">0{i+1}</span><div><h3>{title}</h3><p>{detail}</p></div></li>)}</ol>}
     <aside className="sb-guide-tip"><BookOpen size={17}/><p>{slide.tip}</p></aside>
    </article>
   </div>
   <footer className="sb-guide-footer">
    <div className="sb-guide-progress" role="progressbar" aria-label="Прогресс инструкции" aria-valuemin={1} aria-valuemax={slides.length} aria-valuenow={index+1}><span style={{width:`${(index+1)/slides.length*100}%`}}/></div>
    <div className="sb-guide-actions"><button className="sb-guide-back" onClick={()=>index?go(index-1):close()}>{index?<><ChevronLeft size={18}/>Назад</>:'Позже'}</button><span className="sb-guide-count">{String(index+1).padStart(2,'0')} <span>/ {slides.length}</span></span><button className="sb-guide-next" onClick={()=>last?finish():go(index+1)}>{last?'Начать':'Далее'}{last?<ArrowRight size={20}/>:<ChevronRight size={20}/>}</button></div>
    <p className="sb-guide-motto">Культ спорта и здоровых отношений</p>
   </footer>
  </div>
 </div>;
}

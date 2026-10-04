import { useEffect, useRef, useState } from 'react';
import { RotateCw, Undo2, Check } from 'lucide-react';
import { defaultEdits, loadPhoto, renderPhoto, exportPhoto, type PhotoEdits } from '../services/photoEditor';
import { MediaDialog } from './MediaDialog';
export function PhotoEditor({file,onSave,onClose,story=false}:{file:File;onSave:(file:File)=>void;onClose:()=>void;story?:boolean}) {
 const [edits,setEdits]=useState<PhotoEdits>({...defaultEdits,aspect:story?'story':'original'});
 const [img,setImg]=useState<HTMLImageElement|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const preview=useRef<HTMLDivElement>(null);
 useEffect(()=>{let active=true;loadPhoto(file).then(value=>{if(active)setImg(value);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[file]);
 useEffect(()=>{if(!img)return;const frame=requestAnimationFrame(()=>{try{const canvas=renderPhoto(img,edits,640);canvas.setAttribute('aria-label','Предпросмотр фотографии');preview.current?.replaceChildren(canvas);}catch(e){setError(e instanceof Error?e.message:'Ошибка редактора');}});return()=>cancelAnimationFrame(frame);},[img,edits]);
 const update=<K extends keyof PhotoEdits>(key:K,value:PhotoEdits[K])=>setEdits(old=>({...old,[key]:value}));
 async function save(){if(!img||busy)return;setBusy(true);setError('');try{const result=await exportPhoto(img,edits);onSave(result);}catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить');}finally{setBusy(false);}}
 return <MediaDialog title="Твой кадр. Твой момент." onClose={onClose} busy={busy}>
  <div className="sb-editor-content">
   <div className="sb-photo-preview" ref={preview}>{!img&&<p>Загружаем фотографию…</p>}</div>
   <div className="sb-editor-controls">
    <div className="sb-editor-row"><strong>Кадрирование</strong><button onClick={()=>update('turn',edits.turn+1)}><RotateCw size={16}/> Повернуть</button></div>
    <div className="sb-photo-options" aria-label="Формат кадра">{(['original','square','portrait','story'] as const).map((id,i)=><button key={id} aria-pressed={edits.aspect===id} onClick={()=>update('aspect',id)}>{['Оригинал','1:1','4:5','9:16'][i]}</button>)}</div>
    <div className="sb-photo-options" aria-label="Фильтры">{(['original','warm','cool','mono'] as const).map((id,i)=><button key={id} aria-pressed={edits.filter===id} onClick={()=>update('filter',id)}>{['Без фильтра','Тепло','Прохлада','Ч/Б'][i]}</button>)}</div>
    {([{key:'zoom',title:'Масштаб',min:1,max:3,step:.05},{key:'x',title:'Сдвиг по горизонтали',min:0,max:100,step:1},{key:'y',title:'Сдвиг по вертикали',min:0,max:100,step:1},{key:'brightness',title:'Яркость',min:60,max:140,step:1},{key:'contrast',title:'Контраст',min:60,max:140,step:1}] as const).map(c=><label key={c.key} className="sb-photo-slider"><span>{c.title}</span><input type="range" min={c.min} max={c.max} step={c.step} value={edits[c.key]} onChange={e=>update(c.key,Number(e.target.value))}/></label>)}
    <button className="sb-photo-reset" onClick={()=>setEdits({...defaultEdits,aspect:story?'story':'original'})}><Undo2 size={14}/> Сбросить изменения</button>
    <p className="sb-media-hint">Оригинал останется в галерее. Сохраним обработанную копию.</p>
   </div>
  </div>
  {error&&<p role="alert" className="sb-media-error">{error}</p>}
  <footer><button disabled={!img||busy} className="sb-media-primary" onClick={()=>void save()}><Check size={18}/>{busy?'Сохраняем…':'Готово — к публикации'}</button></footer>
 </MediaDialog>;
}

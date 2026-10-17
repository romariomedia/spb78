import {useCallback, useEffect, useState} from 'react';
import type {FeedPost} from '../lib/types';
import {CURRENT_USER_ID, loadFeedPosts} from './repository';

/** Keep invalidations cheap offscreen; collapse a burst before reading history. */
export function useDeferredFeed(uid: string | null, enabled: boolean, onPosts: (posts: FeedPost[]) => void) {
  const [revision,setRevision]=useState(0);
  const [visible,setVisible]=useState(()=>document.visibilityState!=='hidden');
  const [feedLoading,setLoading]=useState(false);
  const [feedError,setError]=useState('');
  const refreshFeed=useCallback(()=>setRevision(value=>value+1),[]);
  useEffect(()=>{
    const change=()=>setVisible(document.visibilityState!=='hidden');
    document.addEventListener('visibilitychange',change);
    return()=>document.removeEventListener('visibilitychange',change);
  },[]);
  useEffect(()=>{
    setLoading(false);setError('');
    if(!uid||!enabled||!visible)return;
    let cancelled=false;
    setLoading(true);
    const timer=setTimeout(()=>{
      void loadFeedPosts({strict:true}).then(posts=>{
        if(!cancelled&&CURRENT_USER_ID===uid)onPosts(posts);
      }).catch(()=>{
        if(!cancelled&&CURRENT_USER_ID===uid)setError('Не удалось обновить публикации. Сохранённые записи могут быть устаревшими.');
      }).finally(()=>{if(!cancelled)setLoading(false);});
    },300);
    return()=>{cancelled=true;clearTimeout(timer);};
  },[uid,enabled,visible,revision,onPosts]);
  return {feedLoading,feedError,refreshFeed};
}

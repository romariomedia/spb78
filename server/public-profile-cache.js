// Only public projections; auth and suspension checks run on every request.
export function createPageCache({ttlMs=30000,maxEntries=64,maxBytes=16*1024*1024,now=Date.now}={}) {
  const entries=new Map(); let bytes=0;
  const counters={hits:0,misses:0,coalesced:0,failures:0};
  function remove(key){bytes-=entries.get(key)?.bytes||0;entries.delete(key);}
  return {
    clear(){entries.clear();bytes=0;},
    stats(){return {...counters,entries:entries.size,bytes};},
    async get(key,loader){
      const old=entries.get(key);
      if(old?.pending){counters.coalesced++;return old.pending;}
      if(old && old.expiresAt>now()){counters.hits++;entries.delete(key);entries.set(key,old);return old.value;}
      remove(key);counters.misses++;
      for(const [k,e] of entries)if(!e.pending && e.expiresAt<=now())remove(k);
      while(entries.size>=maxEntries)remove(entries.keys().next().value);
      const entry={bytes:0};entries.set(key,entry);
      entry.pending=Promise.resolve().then(loader).then(value=>{
        const size=Buffer.byteLength(JSON.stringify(value),'utf8');
        // Evicted/in-flight invalidated pages must not resurrect the cache.
        if(entries.get(key)===entry){
          if(size>maxBytes)remove(key);
          else{
            while(bytes+size>maxBytes && entries.size>1)remove([...entries.keys()].find(k=>k!==key));
            entry.value=value;entry.bytes=size;bytes+=size;entry.expiresAt=now()+ttlMs;delete entry.pending;
          }
        }
        return value;
      }).catch(error=>{counters.failures++;if(entries.get(key)===entry)remove(key);throw error;});
      return entry.pending;
    }
  };
}
const caches=new WeakMap();let generation=0;
export function invalidatePublicProfiles(){generation++;}
export function publicProfileCache(db){
  let state=caches.get(db);
  if(!state){state={generation,cache:createPageCache()};caches.set(db,state);}
  if(state.generation!==generation){state.cache.clear();state.generation=generation;}
  return state.cache;
}
export function affectsPublicProfiles(route,body={}){
  if(route==='admin-sport-id-verification' || (route==='sport-id-verification' && ['trainerServices','trainerSave','trainerSubmit','trainerCancel'].includes(body?.action)))return true;
  if(['admin-users','admin-user-lifecycle','verify-profile','delete-expired-profile'].includes(route))return true;
  return route==='sportbuddy-mutation' && ['profile','bootstrapProfile','syncIdentity'].includes(body?.action);
}

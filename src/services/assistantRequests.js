// Serialize operations and retry the original body, including its idempotency key.
export function createAssistantRequests(call, handlers) {
 let busy=false, active=true, failed=null;
 async function run(body) {
  if(!active||busy)return;
  busy=true;handlers.busy(true);handlers.error('');
  try {
   const result=await call(body);
   if(!active)return;
   failed=null;handlers.result(result,body);
  } catch {
   if(active){failed=body;handlers.error('Не удалось сохранить или загрузить данные. Проверьте соединение и повторите попытку.');}
  } finally {busy=false;if(active)handlers.busy(false);}
 }
 return {run,retry:()=>run(failed||{action:'state'}),dispose:()=>{active=false;}};
}

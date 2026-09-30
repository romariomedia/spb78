import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
globalThis.__paymentAuth={currentUser:{uid:'client',getIdToken:async()=> 'token'}};
globalThis.window={setTimeout,clearTimeout};
const result=await build({entryPoints:['src/services/payments.ts'],bundle:true,format:'esm',platform:'node',write:false,define:{'import.meta.env.VITE_API_BASE_URL':'""'},plugins:[{name:'auth',setup(b){
  b.onResolve({filter:/\.\/firebaseAuth$/},()=>({path:'auth',namespace:'fake'}));
  b.onLoad({filter:/.*/,namespace:'fake'},()=>({contents:'export const auth=globalThis.__paymentAuth;',loader:'js'}));
}}]});
const {createPremiumPayment}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text+'\n//# sourceURL=payments-client-fixture.js').toString('base64')}`);
test('client reuses request after network failure even when storage is disabled',async()=>{
  globalThis.sessionStorage={getItem(){throw new Error('disabled');},setItem(){throw new Error('disabled');},removeItem(){throw new Error('disabled');}};
  const requests=[];let fail=true;
  globalThis.fetch=async(_url,options)=>{requests.push(JSON.parse(options.body));if(fail)throw new Error('network');return {ok:true,json:async()=>({confirmationUrl:'https://yookassa.ru/checkout',paymentId:'p1',amount:'490.00'})};};
  await assert.rejects(createPremiumPayment('monthly'),/network/);fail=false;
  await createPremiumPayment('monthly');assert.equal(requests[0].requestId,requests[1].requestId);
  await createPremiumPayment('monthly');assert.notEqual(requests[1].requestId,requests[2].requestId);
});

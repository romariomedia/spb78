import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const artifacts='artifacts/interface-polish';await mkdir(artifacts,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4179','--strictPort'],{stdio:'pipe'});
let logs='',browser,page;server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
try{
 let ready=false;for(let i=0;i<120;i++){try{if((await fetch('http://127.0.0.1:4179/scripts/running/polish-preview.html')).ok){ready=true;break;}}catch{}if(server.exitCode!==null)throw Error(logs);await new Promise(r=>setTimeout(r,250));}assert.ok(ready,logs);
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});
 page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let uploads=0,failUpload=false;
 await page.route('https://api.cloudinary.com/**',async route=>{
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST, OPTIONS'};
  if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
  uploads++;
  const video=route.request().url().includes('/video/');
  await route.fulfill({status:failUpload?400:200,headers,contentType:'application/json',body:JSON.stringify(failUpload?{error:{message:'Медиа не загружено'}}:{secure_url:`https://example.test/feed.${video?'webm':'webp'}`,resource_type:video?'video':'image',public_id:'test',bytes:1000})});
 });
 await page.goto('http://127.0.0.1:4179/scripts/running/polish-preview.html');
 const order=()=>page.locator('[data-dashboard-section]').evaluateAll(nodes=>nodes.map(n=>n.dataset.dashboardSection));
 await page.getByRole('button',{name:'Черновик 0',exact:true}).click();
 await page.getByRole('button',{name:'Настроить главную'}).click();
 await page.getByRole('button',{name:'Мероприятия: вверх',exact:true}).click();
 assert.equal((await order())[0],'events');
 assert.equal(await page.getByRole('button',{name:'Черновик 1',exact:true}).count(),1);
 assert.equal(await page.evaluate(()=>window.__runMounts),1,'reorder must not restart recorder');
 await page.waitForTimeout(400); // Let the preceding arrow-driven layout animation settle.
 // Real touch drag via the handle, without dragging the scrollable page.
 const from=await page.getByRole('button',{name:'Перетащить: Календарь',exact:true}).boundingBox();
 const to=await page.getByRole('button',{name:'Перетащить: Мероприятия',exact:true}).boundingBox();
 const cdp=await context.newCDPSession(page),x=from.x+from.width/2,y=from.y+from.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(let i=1;i<=15;i++){
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+(to.y-y)*i/15}]});
  await page.waitForTimeout(24); // Pointer movement must span actual animation frames.
 }
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForFunction(()=>document.querySelector('[data-dashboard-section]').dataset.dashboardSection==='calendar');
 await page.screenshot({path:`${artifacts}/dashboard-order.png`,fullPage:true});
 await page.reload();await page.waitForSelector('[data-dashboard-section]');assert.equal((await order())[0],'calendar');
 await page.getByRole('button',{name:'Сменить вкладку',exact:true}).click();await page.getByRole('button',{name:'Сменить вкладку',exact:true}).click();assert.equal(await page.evaluate(()=>window.__runMounts),1);
 await page.getByRole('button',{name:'Сменить аккаунт',exact:true}).click();assert.equal((await order())[0],'running');
 await page.getByRole('button',{name:'Сменить аккаунт',exact:true}).click();assert.equal((await order())[0],'calendar');
 await page.getByRole('button',{name:'Следующее фото маршрута',exact:true}).click();await page.getByText('2 / 3',{exact:true}).waitFor();
 await page.getByRole('region',{name:/Фотографии:/}).screenshot({path:`${artifacts}/route-carousel.png`});
 assert.equal(await page.getByRole('button',{name:'Вид 1',exact:true}).count(),0);
 const open=()=>page.getByRole('button',{name:'Что нового?',exact:true}).click();
 await open();
 const publish=page.getByRole('button',{name:'Опубликовать',exact:true}),text=page.getByRole('textbox',{name:'Текст записи'}),file=page.getByLabel('Добавить фото или видео'),consent=page.getByRole('checkbox');
 assert.equal(await publish.isDisabled(),true);
 await text.fill('После тренировки — к заливу');await consent.check();await publish.click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(uploads,0);
 assert.equal(await page.evaluate(()=>window.__posts.length),1);
 await open();await file.setInputFiles({name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('not media')});await page.getByRole('alert').filter({hasText:'фотографию или видео'}).waitFor();
 await file.setInputFiles('public/running/park300-1.webp');assert.equal(uploads,0,'selecting media does not upload');assert.equal(await publish.isDisabled(),true);
 await consent.check();
 for(const width of [320,390,768]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${artifacts}/composer-${width}.png`,fullPage:true});}
 await page.setViewportSize({width:390,height:844});
 failUpload=true;await publish.click();await page.getByRole('alert').filter({hasText:'Медиа не загружено'}).waitFor();assert.equal(await page.evaluate(()=>window.__posts.length),1,'failed upload must not publish text only');
 failUpload=false;await page.evaluate(()=>window.__rejectPost=true);await publish.click();await page.getByRole('alert').filter({hasText:'Связь прервана'}).waitFor();const uploadedCount=uploads;
 await page.evaluate(()=>window.__rejectPost=false);await publish.click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(uploads,uploadedCount,'retry post must reuse uploaded file');
 assert.equal(await page.evaluate(()=>window.__posts[1].text),'');assert.equal(await page.evaluate(()=>window.__posts[1].mediaType),'image');
 // Real, short video fixture, generated locally; no camera or real upload.
 const video=await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const stream=canvas.captureStream(10),chunks=[];
  const recorder=new MediaRecorder(stream,{mimeType:'video/webm'});recorder.ondataavailable=e=>chunks.push(e.data);
  const done=new Promise(resolve=>recorder.onstop=async()=>{const b=await new Blob(chunks).arrayBuffer();resolve(btoa(String.fromCharCode(...new Uint8Array(b))));});
  recorder.start();canvas.getContext('2d').fillRect(0,0,64,64);await new Promise(r=>setTimeout(r,300));recorder.stop();stream.getTracks().forEach(t=>t.stop());return done;
 });
 await open();await file.setInputFiles({name:'run.webm',mimeType:'video/webm',buffer:Buffer.from(video,'base64')});await consent.check();await publish.click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>window.__posts[2].mediaType),'video');
 await open();await file.setInputFiles('public/running/park300-1.webp');await page.getByRole('button',{name:'Убрать вложение'}).click();await consent.check();assert.equal(await publish.isDisabled(),true);
 assert.deepEqual(errors,[]);
 console.log('PASS: touch reorder, persistence/account isolation, recorder mount, carousel, composer sizes, text/photo/video, consent, upload failure and retry');
}catch(error){if(page){await page.screenshot({path:`${artifacts}/failure.png`,fullPage:true});console.error('DOM order at failure:',await page.locator('[data-dashboard-section]').evaluateAll(nodes=>nodes.map(n=>n.dataset.dashboardSection)));}throw error;}
finally{await browser?.close();server.kill();}

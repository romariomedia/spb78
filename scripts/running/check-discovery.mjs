import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const artifacts='artifacts/discovery';await mkdir(artifacts,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4181','--strictPort'],{stdio:'pipe'});
let logs='',browser,page;server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
try{
 let ready=false;for(let i=0;i<120;i++){try{if((await fetch('http://127.0.0.1:4181/scripts/running/discovery-preview.html')).ok){ready=true;break;}}catch{}if(server.exitCode!==null)throw Error(logs);await new Promise(r=>setTimeout(r,250));}assert.ok(ready,logs);
 browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4181/scripts/running/discovery-preview.html');
 const candidate=page.getByTestId('candidate');await candidate.waitFor();
 await page.getByRole('button',{name:'Пропустить',exact:true}).click();assert.equal(await candidate.textContent(),'Нет анкет');
 await page.getByRole('button',{name:'Вернуть',exact:true}).click();assert.equal(await candidate.textContent(),'Анна');
 await page.getByRole('button',{name:'Пропустить',exact:true}).click();await page.getByRole('button',{name:'Сменить аккаунт',exact:true}).click();assert.equal(await candidate.textContent(),'Анна');assert.equal(await page.getByRole('button',{name:'Вернуть',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Сменить аккаунт',exact:true}).click();assert.equal(await candidate.textContent(),'Нет анкет');
 await page.reload();await candidate.waitFor();assert.equal(await candidate.textContent(),'Нет анкет');
 await page.getByRole('button',{name:'Сменить аккаунт',exact:true}).click();
 await page.locator('summary').click();
 await page.getByLabel('Уровень подготовки',{exact:true}).selectOption('advanced');assert.equal(await candidate.textContent(),'Нет анкет');
 await page.getByLabel('Уровень подготовки',{exact:true}).selectOption('beginner');assert.equal(await candidate.textContent(),'Анна');
 await page.getByLabel('Время тренировок',{exact:true}).selectOption('morning');assert.equal(await candidate.textContent(),'Нет анкет');
 await page.getByLabel('Время тренировок',{exact:true}).selectOption('evening');assert.equal(await candidate.textContent(),'Анна');
 await page.getByLabel('Расстояние',{exact:true}).selectOption('5');assert.equal(await candidate.textContent(),'Нет анкет');
 await page.getByRole('button',{name:'Определить местоположение для поиска рядом'}).click();assert.equal(await candidate.textContent(),'Анна');
 await page.getByLabel('Мой уровень',{exact:true}).selectOption('amateur');await page.getByRole('button',{name:'Вечер',exact:true}).click();
 await page.getByRole('button',{name:'Ошибка сохранения'}).click();await page.getByRole('button',{name:'Сохранить мои предпочтения'}).click();await page.getByRole('status').getByText('Нет связи. Повторите сохранение').waitFor();
 assert.equal(await page.getByLabel('Мой уровень',{exact:true}).inputValue(),'amateur');
 await page.getByRole('button',{name:'Ошибка сохранения'}).click();await page.getByRole('button',{name:'Сохранить мои предпочтения'}).click();await page.getByRole('status').getByText('Настройки анкеты сохранены').waitFor();
 assert.deepEqual(JSON.parse(await page.getByTestId('saved').textContent()).trainingTimes,['evening']);
 for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:artifacts+'/settings-'+width+'.png',fullPage:true});}
 assert.deepEqual(errors,[]);console.log('PASS discovery: undo, history isolation and reload, radius/level/time filters, preference errors/retry, 320/390/768 layouts');
}catch(error){if(page)await page.screenshot({path:artifacts+'/failure.png',fullPage:true});throw error;}finally{await browser?.close();server.kill();}

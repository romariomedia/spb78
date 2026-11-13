// Run with PLAYWRIGHT_PACKAGE pointing to an external Playwright installation.
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const artifacts = path.resolve(process.env.CARD_ARTIFACTS || 'artifacts/running-cards');
await mkdir(artifacts, {recursive:true});
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4178','--strictPort'], {stdio:'pipe'});
let logs = '';
server.stdout.on('data', d => { logs += d; }); server.stderr.on('data', d => { logs += d; });
let browser;
try {
  let listening = false;
  for (let i=0;i<120;i++) {
    try { if ((await fetch('http://127.0.0.1:4178/scripts/running/result-card-preview.html')).ok) {listening=true;break;} } catch {}
    if (server.exitCode !== null) throw new Error(logs);
    await new Promise(r=>setTimeout(r,250));
  }
  assert.ok(listening, logs);
  browser = await chromium.launch({headless:true, ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
  const page = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
  const errors = [], uploads = [];
  page.on('pageerror', e=>errors.push(e.message));
  page.on('request', r=>{if(r.method()==='POST')uploads.push(r.url());});
  await page.goto('http://127.0.0.1:4178/scripts/running/result-card-preview.html');
  const save = page.getByRole('button',{name:'Скачать PNG',exact:true});
  const preview = page.locator('img[src^="blob:"]');
  async function ready() { await save.waitFor(); await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Скачать PNG'&&!b.disabled)); }
  async function download(name) {
    await ready(); const event = page.waitForEvent('download'); await save.click(); const d = await event;
    const target = path.join(artifacts,name); await d.saveAs(target); return target;
  }
  const landscape = await download('landscape.png');
  assert.match(await preview.getAttribute('alt'),/средняя скорость 9,6 км\/ч с учётом пауз/);
  const meta = await sharp(landscape).metadata(); assert.equal(meta.width,1080); assert.equal(meta.height,1350);
  await page.screenshot({path:path.join(artifacts,'editor-mobile.png'),fullPage:true});
  const first = await preview.getAttribute('src');
  await page.getByRole('button',{name:'Пейзаж 2',exact:true}).click(); await ready();
  assert.notEqual(await preview.getAttribute('src'),first);
  await page.getByRole('button',{name:'Без фона',exact:true}).click();
  const transparent = await download('transparent.png');
  const {data,info} = await sharp(transparent).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(data[3],0); assert.equal(data[(400*info.width+540)*4+3],0);
  let painted=0; for(let i=3;i<data.length;i+=4)if(data[i]>0)painted++;
  assert.ok(painted>10000 && painted<info.width*info.height*.3,'transparent card must contain text with no background');
  await page.getByRole('button',{name:'Тёмный текст',exact:true}).click(); await download('transparent-dark.png');
  await page.getByRole('button',{name:'Моё фото',exact:true}).click(); assert.equal(await save.isDisabled(),true);
  await page.getByLabel('Добавить своё фото',{exact:true}).setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('broken')});
  await page.getByRole('status').filter({hasText:'Не удалось открыть'}).waitFor(); assert.equal(await save.isDisabled(),true);
  // Reuse a bundled landscape as a local user-upload fixture, without a server upload.
  await page.getByLabel('Добавить своё фото',{exact:true}).setInputFiles('public/running/park300-1.webp');
  await download('own-photo.png');
  await page.getByText('Кадрирование и свет',{exact:true}).click();
  const beforeCrop = await preview.getAttribute('src');
  await page.getByRole('slider',{name:'Масштаб',exact:true}).fill('1.5');
  await page.getByRole('slider',{name:'По горизонтали',exact:true}).fill('20');
  await page.getByRole('slider',{name:'Затемнение',exact:true}).fill('35'); await ready();
  assert.notEqual(await preview.getAttribute('src'),beforeCrop);
  await download('own-photo-cropped.png');
  await page.getByRole('button',{name:'Сбросить настройки',exact:true}).click(); await ready();
  assert.equal(await page.getByRole('slider',{name:'Масштаб',exact:true}).inputValue(),'1');
  await page.getByRole('button',{name:'Удалить фото',exact:true}).click(); assert.equal(await save.isDisabled(),true);
  await page.getByLabel('Добавить своё фото',{exact:true}).setInputFiles('public/running/park300-1.webp'); await ready();
  // Browser sharing uses a prebuilt File; cancellation must not trigger a download or error.
  await page.evaluate(()=>{ navigator.canShare=()=>true; navigator.share=async options=>{window.__shared=options.files[0].type;throw new DOMException('Cancelled','AbortError');}; });
  await page.getByRole('button',{name:'Поделиться',exact:true}).click();
  await page.waitForFunction(()=>window.__shared==='image/png');
  assert.ok(!(await page.getByRole('status').textContent()).includes('Не удалось'));
  for (const width of [320,390,768]) {
    await page.setViewportSize({width,height:900});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);
  }
  await page.getByRole('button',{name:'Не сохранён',exact:true}).click(); await ready();
  assert.match(await preview.getAttribute('alt'),/ещё не сохранён/);
  await page.getByRole('button',{name:'Без GPS',exact:true}).click(); await ready();
  assert.equal(await page.getByRole('button',{name:'Пейзаж',exact:true}).isDisabled(),true);
  assert.match(await preview.getAttribute('alt'),/0.00 км.*— мин/);
  assert.match(await preview.getAttribute('alt'),/средняя скорость — км\/ч/);
  await page.getByRole('button',{name:'Другой маршрут',exact:true}).click(); await ready();
  assert.match(await preview.getAttribute('alt'),/Александрийский парк/);
  assert.deepEqual(uploads,[]); assert.deepEqual(errors,[]);
  await writeFile(path.join(artifacts,'checks.json'),JSON.stringify({passed:true,checks:['landscape switching','PNG dimensions','true alpha transparency','dark ink','corrupt photo','local photo upload','crop and dim','reset','photo removal and reselect','share cancellation','320/390/768 responsive','unsaved result','zero GPS','route reset','no uploads','no browser errors']},null,2));
  console.log('Result card browser checks passed. Artifacts:', artifacts);
} catch(e) { await writeFile(path.join(artifacts,'server.log'),logs); throw e; }
finally { await browser?.close(); server.kill(); }

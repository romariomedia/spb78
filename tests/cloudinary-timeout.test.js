import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const built=await build({
  entryPoints:['src/services/cloudinary.ts'],
  bundle:true,
  write:false,
  format:'esm',
  platform:'browser',
  define:{'import.meta.env':'{}'}
});
const api=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));

class FakeFormData { append(){} }
globalThis.FormData=FakeFormData;

function installTimeoutXhr(){
  const instances=[];
  globalThis.XMLHttpRequest=class {
    constructor(){this.upload={};this.status=0;this.responseText='';instances.push(this);}
    open(){}
    send(){queueMicrotask(()=>this.ontimeout?.());}
    abort(){this.onabort?.();}
  };
  return instances;
}

test('image upload has a bounded timeout and reports timeout instead of hanging',async()=>{
  const instances=installTimeoutXhr();
  const file={size:1024,type:'image/jpeg'};
  await assert.rejects(
    api.uploadMedia(file,{retries:0,timeoutMs:12_345}),
    error=>error?.status===408&&/превысила допустимое время/.test(error.message)
  );
  assert.equal(instances[0].timeout,12_345);
});

test('video and remote uploads receive safe default timeouts',async()=>{
  let instances=installTimeoutXhr();
  await assert.rejects(api.uploadMedia({size:1024,type:'video/mp4'},{retries:0}),error=>error?.status===408);
  assert.equal(instances[0].timeout,api.DEFAULT_VIDEO_UPLOAD_TIMEOUT_MS);

  instances=installTimeoutXhr();
  await assert.rejects(api.uploadRemoteUrl('https://example.test/photo.jpg',{retries:0}),error=>error?.status===408);
  assert.equal(instances[0].timeout,api.DEFAULT_IMAGE_UPLOAD_TIMEOUT_MS);
});

test('custom upload timeout is clamped to safe bounds',async()=>{
  let instances=installTimeoutXhr();
  await assert.rejects(api.uploadMedia({size:1024,type:'image/jpeg'},{retries:0,timeoutMs:1}),error=>error?.status===408);
  assert.equal(instances[0].timeout,5_000);

  instances=installTimeoutXhr();
  await assert.rejects(api.uploadMedia({size:1024,type:'image/jpeg'},{retries:0,timeoutMs:999_999}),error=>error?.status===408);
  assert.equal(instances[0].timeout,300_000);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,readlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

for (const fails of [false,true]) test(`release activation ${fails?'restores previous version on failed health':'switches after matching health'}`,()=>{
  const root=mkdtempSync(join(tmpdir(),'sb-deploy-'));
  try {
    const bin=join(root,'bin');mkdirSync(bin);
    const previous=join(root,'previous'),next=join(root,'next');
    for(const [dir,id] of [[previous,'old'],[next,'new']]){
      mkdirSync(join(dir,'dist'),{recursive:true});
      for(const [file,content] of [['server.js',''],['dist/index.html','ok'],['.env',''],['.release-ready',''],['RELEASE_ID',id]])writeFileSync(join(dir,file),content);
    }
    const current=join(root,'current');symlinkSync(previous,current);
    const script=(name,body)=>writeFileSync(join(bin,name),'#!/bin/bash\n'+body,{mode:0o755});
    script('nginx','exit 0');script('sleep','exit 0');
    script('pm2',`if [[ $1 == jlist ]]; then echo '[]'; fi\nif [[ $1 == startOrRestart ]]; then printf '%s' "$SB_RELEASE_ID" > "$MOCK_HEALTH"; fi\nexit 0`);
    script('curl',`id=$(cat "$MOCK_HEALTH")\nif [[ $MOCK_FAIL == 1 && $id == new ]]; then exit 22; fi\nprintf '{"status":"ok","release":"%s"}' "$id"`);
    const result=spawnSync('bash',[resolve('ops/activate-release.sh'),next],{encoding:'utf8',env:{...process.env,PATH:bin+':'+process.env.PATH,SB_CURRENT_LINK:current,SB_DEPLOY_STATE:join(root,'state'),MOCK_HEALTH:join(root,'health'),MOCK_FAIL:fails?'1':'0'},timeout:30000});
    assert.equal(result.status,fails?1:0,result.stdout+result.stderr);
    assert.equal(readlinkSync(current),fails?previous:next);
  } finally {rmSync(root,{recursive:true,force:true});}
});

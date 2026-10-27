import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,existsSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

function fixture(t){
 const root=mkdtempSync(join(tmpdir(),'sb-retention-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const base=join(root,'releases'),state=join(root,'state'),bin=join(root,'bin');for(const p of [base,state,bin])mkdirSync(p);
 const releases=Array.from({length:7},(_,i)=>join(base,String(i+1).repeat(40)));
 for(const p of releases){mkdirSync(p);writeFileSync(join(p,'RELEASE_ID'),p.split('/').at(-1));writeFileSync(join(p,'.release-ready'),'');writeFileSync(join(p,'server.js'),'');}
 const current=join(root,'current');symlinkSync(releases[6],current);
 writeFileSync(join(state,'previous-release'),releases[5]);writeFileSync(join(state,'successful-releases.json'),JSON.stringify([releases[5],releases[4],releases[3]]));
 const apps=[{name:'sportbuddy-api',pm2_env:{status:'online',pm_cwd:releases[6],pm_exec_path:join(releases[6],'server.js')}},{name:'worker',pm2_env:{status:'stopped',pm_cwd:releases[1],pm_exec_path:join(releases[1],'server.js')}}];
 const inventory=join(root,'pm2.json'),health=join(root,'health.json');writeFileSync(inventory,JSON.stringify(apps));writeFileSync(health,JSON.stringify({status:'ok',release:'7'.repeat(40)}));
 for(const [name,path] of [['pm2',inventory],['curl',health]])writeFileSync(join(bin,name),'#!/bin/sh\ncat "'+path+'"\n',{mode:0o755});
 const env={...process.env,PATH:bin+':'+process.env.PATH,SB_RELEASES_ROOT:base,SB_DEPLOY_STATE:state,SB_CURRENT_LINK:current};
 const run=(args=[])=>spawnSync('python3',[resolve('ops/prune-releases.py'),...args],{env,encoding:'utf8',timeout:15000});
 return {root,base,state,releases,apps,inventory,health,run,env};
}
const linux={skip:process.platform!=='linux'};
test('retention dry-run is non-destructive; apply preserves current, two rollback versions and every PM2 path',linux,t=>{
 const f=fixture(t);
 const outside=join(f.root,'outside');mkdirSync(outside);writeFileSync(join(outside,'important'),'keep');symlinkSync(outside,join(f.base,'a'.repeat(40)));
 mkdirSync(join(f.base,'incomplete-test'));mkdirSync(join(f.base,'b'.repeat(40))); // no ready marker
 assert.equal(f.run().status,0);assert.ok(f.releases.every(existsSync));
 const result=f.run(['--apply']);assert.equal(result.status,0,result.stderr);
 for(const i of [1,4,5,6])assert.ok(existsSync(f.releases[i]));for(const i of [0,2,3])assert.equal(existsSync(f.releases[i]),false);
 assert.ok(existsSync(join(outside,'important')));assert.ok(existsSync(join(f.base,'incomplete-test')));assert.ok(existsSync(join(f.base,'b'.repeat(40))));
 assert.deepEqual(JSON.parse(readFileSync(join(f.state,'successful-releases.json'),'utf8')), [f.releases[6],f.releases[5],f.releases[4]]);
 assert.equal(f.run(['--apply']).status,0);
});
for(const fault of ['bad-json','missing-path','api-mismatch','health','history'])test('retention fails closed: '+fault,linux,t=>{
 const f=fixture(t);
 if(fault==='bad-json')writeFileSync(f.inventory,'not json');
 if(fault==='missing-path'){delete f.apps[1].pm2_env.pm_cwd;writeFileSync(f.inventory,JSON.stringify(f.apps));}
 if(fault==='api-mismatch'){f.apps[0].pm2_env.pm_cwd=f.releases[0];writeFileSync(f.inventory,JSON.stringify(f.apps));}
 if(fault==='health')writeFileSync(f.health,JSON.stringify({status:'ok',release:'old'}));
 if(fault==='history')writeFileSync(join(f.state,'successful-releases.json'),'{}');
 assert.equal(f.run(['--apply']).status,1);assert.ok(f.releases.every(existsSync));
});
test('retention refuses cleanup while prepare or deploy lock is held',linux,t=>{
 const f=fixture(t);
 for(const lock of [join(f.base,'.prepare.lock'),join(f.state,'deploy.lock')]){
 const result=spawnSync('flock',['-n',lock,'python3',resolve('ops/prune-releases.py'),'--apply'],{env:f.env,encoding:'utf8',timeout:15000});assert.equal(result.status,1);assert.ok(f.releases.every(existsSync));
 }
});
test('activation can pass its held deployment lock to cleanup safely',linux,t=>{
 const f=fixture(t);
 const code=`import fcntl,subprocess,sys\nf=open(sys.argv[1],'a')\nfcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB)\nsys.exit(subprocess.call(['python3',sys.argv[2],'--apply','--deploy-lock-fd',str(f.fileno())],pass_fds=(f.fileno(),)))`;
 const result=spawnSync('python3',['-c',code,join(f.state,'deploy.lock'),resolve('ops/prune-releases.py')],{env:f.env,encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,result.stderr);assert.equal(existsSync(f.releases[0]),false);assert.ok(existsSync(f.releases[6]));
});

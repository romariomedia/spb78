#!/usr/bin/env node
// A local coverage probe ONLY. No DB writes, no scheduling, no art or images.
import { SPORTSDB_REQUIRED_TEAMS, sportsDbTeamSearchUrl, sportsDbNextEventsUrl, assessTeamResults, assessEventResults } from '../server/sportsdb-coverage.js';
const key=process.env.SPORTSDB_API_KEY||'123';
async function readJson(url){
  const abort=new AbortController(), timer=setTimeout(()=>abort.abort(),10000);
  try{
    const response=await fetch(url,{signal:abort.signal,redirect:'error',headers:{accept:'application/json'}});
    if(!response.ok)throw new Error('HTTP '+response.status);
    if(!String(response.headers.get('content-type')).includes('json'))throw new Error('Not JSON');
    const raw=await response.text();
    if(raw.length>200000)throw new Error('Payload too large');
    return JSON.parse(raw);
  }finally{clearTimeout(timer);}
}
const reports=[];
for(const required of SPORTSDB_REQUIRED_TEAMS){
  try{
    const teams=assessTeamResults(await readJson(sportsDbTeamSearchUrl(required.label,key)),required);
    const team=teams[0];
    const events=team?assessEventResults(await readJson(sportsDbNextEventsUrl(team.id,key))):[];
    reports.push({club:required.club,teamFound:Boolean(team),teamId:team?.id||null,league:team?.league||null,upcomingEvents:events.length,sample:events.slice(0,2)});
  }catch(error){reports.push({club:required.club,error:String(error.message||error)});}
}
process.stdout.write(JSON.stringify({mode:'diagnostic-only',licence:'commercial-use-not-authorized-by-this-probe',reports},null,2)+'\n');

import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
async function bundle(entry,plugins=[]){const b=await build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'esm',plugins});return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));}
const {socialIdentityKey,leisureIdentityKey}=await bundle('src/services/identityLoading.ts');
const user={id:'me',friendIds:['friend'],matchIds:['match'],friendRequestsReceived:['incoming'],friendRequestsSent:['outgoing']};
const group={id:'group',kind:'training',participantIds:['me','member'],companionId:'',messages:[{senderId:'former'},{senderId:'latest'}],typingAt:{typing:1},lastMessageAt:3};
test('identity selection includes live relationships and previews without loading unopened group roster',()=>{
 const ids=JSON.parse(socialIdentityKey(user,[group],null));
 assert.deepEqual(ids,['friend','incoming','latest','match','outgoing']);
 const opened=JSON.parse(socialIdentityKey(user,[group],'group'));
 for(const id of ['member','former','typing','latest'])assert.ok(opened.includes(id));
 assert.ok(!opened.includes('me'));
 const reports=JSON.parse(socialIdentityKey(user,[group],null,true));
 assert.ok(reports.includes('member'));
});
test('same authors and reordered friends have a stable key; new request changes it',()=>{
 const before=socialIdentityKey(user,[group],null);
 assert.equal(before,socialIdentityKey(user,[{...group,messages:[...group.messages,{senderId:'latest'}]}],null));
 assert.notEqual(before,socialIdentityKey({...user,friendRequestsReceived:['new']},[group],null));
 assert.equal(socialIdentityKey(null,[group],null),'[]');
 assert.deepEqual(JSON.parse(socialIdentityKey({id:'other'},[group],null)),[]);
});
const chats=await bundle('src/services/chats.ts',[{name:'fake',setup(b){
 b.onResolve({filter:/^(firebase\/firestore|\.\/repository|\.\/serverApi|\.\.\/lib\/firebase)$/},a=>({path:a.path,namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},a=>({loader:'js',contents:{
 'firebase/firestore':'export const collection=()=>{},onSnapshot=()=>()=>{},query=()=>{},where=()=>{};',
 './repository':"export const CURRENT_USER_ID='me';",'./serverApi':'export const callServer=async()=>{};','../lib/firebase':'export const db={};'
 }[a.path]}));
}}]);
test('friends and matches remain listed without display profiles, with storage disabled',()=>{
 globalThis.localStorage={getItem(){throw Error('disabled')},setItem(){throw Error('disabled')}};
 const threads=chats.loadChatThreads(user,[],'friends');
 assert.equal(threads.length,1);assert.equal(threads[0].companionId,'friend');
 const merged=chats.mergeKnownChatThreads('me',threads,[group,{...group,id:'foreign',participantIds:['other']}]);
 assert.equal(merged.length,2);
 assert.deepEqual(chats.chatThreadsForCategory(user,'trainings',merged).map(t=>t.id),['group']);
 assert.equal(chats.chatThreadsForCategory(user,'friends',merged).length,1);
});
test('identity refresh keeps the latest live messages and unread metadata',()=>{
 const live={...group,messages:[{id:'new',senderId:'member'}],unreadCount:{me:7}};
 const merged=chats.mergeKnownChatThreads('me',[group],[live]);
 assert.equal(merged.length,1);assert.equal(merged[0].unreadCount.me,7);
 assert.equal(merged[0].messages[0].id,'new');
});

test('leisure reads only opened meeting identities, excluding self and invalid IDs',()=>{
 assert.equal(leisureIdentityKey('me',null),'[]');
 const event={createdBy:'organizer',participantIds:['me','friend','friend','bad/id','',null]};
 assert.deepEqual(JSON.parse(leisureIdentityKey('me',event)),['friend','organizer']);
 assert.equal(leisureIdentityKey('me',event),leisureIdentityKey('me',{...event,participantIds:[...event.participantIds].reverse(),title:'changed'}));
 assert.notEqual(leisureIdentityKey('me',event),leisureIdentityKey('me',{...event,participantIds:['new']}));
});

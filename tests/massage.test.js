import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeMassage,publicMassage} from '../server/massage.js';
const base={name:'Салон',description:'Описание услуги',priceText:'От 2000 ₽',address:'По записи, выезд',bookingUrl:'https://t.me/example',isPublished:true};
test('massage publication requires complete offer and safe direct contact, draft stays private',()=>{
 const draft=sanitizeMassage({name:'Специалист'});assert.equal(draft.isPublished,false);assert.equal(publicMassage('id',draft),null);
 for(const key of ['description','priceText','address','bookingUrl'])assert.throws(()=>sanitizeMassage({...base,[key]:''}),{status:400});
 for(const bookingUrl of ['javascript:alert(1)','http://example.com','https://user:pass@example.com','tel:abc'])assert.throws(()=>sanitizeMassage({...base,bookingUrl}),{status:400});
 assert.equal(sanitizeMassage({...base,bookingUrl:'tel:+79991234567'}).bookingUrl,'tel:+79991234567');
});
test('massage media is bounded and public output excludes arbitrary admin fields',()=>{
 assert.throws(()=>sanitizeMassage({...base,media:Array(9).fill({type:'image',url:'https://example.com/a.jpg'})}),{status:400});
 assert.throws(()=>sanitizeMassage({...base,media:[{type:'image',url:'data:text/html,test'}]}),{status:400});
 assert.throws(()=>sanitizeMassage({...base,providerType:'unknown'}),{status:400});
 const item=publicMassage('id',{...base,internalNotes:'private',createdBy:'secret',media:[{type:'image',url:'https://example.com/a.jpg'},{type:'video',url:'https://example.com/a.mp4'}]});
 assert.equal(item.internalNotes,undefined);assert.equal(item.createdBy,undefined);assert.equal(item.media.length,2);
});

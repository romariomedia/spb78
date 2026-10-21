#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {initializeApp,cert,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {seedMassageCatalog} from '../server/massage-seed.js';
const entries=JSON.parse(readFileSync(new URL('../data/massage-spb.json',import.meta.url),'utf8'));
const apply=process.argv.includes('--apply');
if(process.argv.some(arg=>arg.startsWith('--')&&arg!=='--apply'))throw new Error('Supported option: --apply');
if(!process.env.FIREBASE_SERVICE_ACCOUNT_KEY)throw new Error('Load the server .env with node --env-file=.env');
const key=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
if(key.project_id!=='sportbuddy-spb')throw new Error('Unexpected Firebase project; import stopped');
const app=initializeApp({credential:cert(key)});
try{
 console.log(apply?'Importing SPA catalog (create-only)':'Dry run: no database changes');
 const result=await seedMassageCatalog(getFirestore(app),entries,{apply});
 for(const row of result)console.log(`${row.id}: ${row.status}`);
 console.log('Existing edits, hidden cards and previously imported deletions are preserved.');
}finally{await deleteApp(app);}

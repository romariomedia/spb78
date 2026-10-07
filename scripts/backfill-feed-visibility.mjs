import 'dotenv/config';
import {initializeApp,cert} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {backfillFeedVisibility} from '../server/feed-visibility.js';
initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
console.log(JSON.stringify(await backfillFeedVisibility(getFirestore(),{apply:process.argv.includes('--apply')})));

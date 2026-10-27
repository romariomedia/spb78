import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {businessListingStates,getBillingConfig} from '../server/business-billing.js';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')) });
}

export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  try{
    const db=getFirestore();
    const snap=await db.collection('venues').get();
    const billingConfig=await getBillingConfig(db);
    const states=await businessListingStates(db,'venue',snap.docs.map(doc=>doc.id),billingConfig);
    const venues=snap.docs.map(doc=>{
      const data=doc.data()||{};
      if(data.archived===true || data.isPublished===false){
        return {id:doc.id,isPublished:false,archived:data.archived===true};
      }
      const state=states.get(doc.id);
      if(state?.allowed!==true)return {id:doc.id,isPublished:false,commercialInactive:true};
      const venue={id:doc.id};
      for(const key of 'name networkId checkedAt sports address coordinates phone hours priceText rating reviews website status note photos isVerified isPublished contactName amenities updatedAt'.split(' '))if(data[key]!==undefined)venue[key]=data[key];
      if(state?.isPromoted)venue.isPromoted=true;
      return venue;
    });
    return res.status(200).json({venues});
  }catch(error){
    console.error('[venues]',error);
    return res.status(500).json({error:'Venue catalog unavailable.'});
  }
}

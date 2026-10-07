import { initializeApp,getApps,cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { officialCompetitionSummary,levelLabel,readSportPassport } from '../server/sport-passport.js';
import { applyVerifiedClaims } from '../server/sport-id-verification.js';

if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});

const clean=(value,max=300)=>typeof value==='string'?value.trim().slice(0,max):'';

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  try{
    const slug=clean(req.query?.slug,80);
    if(!/^[A-Za-z0-9_-]{12,80}$/.test(slug))return res.status(404).json({error:'SportBuddy78 ID не найден.'});
    const db=getFirestore();
    const snap=await db.collection('users').where('sportPassport.publicSlug','==',slug).limit(1).get();
    if(snap.empty)return res.status(404).json({error:'SportBuddy78 ID не найден.'});
    const doc=snap.docs[0],user=doc.data()||{};
    if(user.isSuspended===true||user.sportPassport?.publicEnabled!==true)return res.status(404).json({error:'SportBuddy78 ID не найден.'});

    const [resultSnap,claimsSnap]=await Promise.all([
      db.collection('sportPassportResults').where('userId','==',doc.id).get(),
      db.collection('sportVerifiedClaims').where('userId','==',doc.id).get()
    ]);
    const summary=officialCompetitionSummary((resultSnap?.docs||[]).map(doc=>({id:doc.id,...doc.data()})));
    const officialResults=summary.results
      .map(x=>({
        id:String(x.id),title:clean(x.title,180),sport:clean(x.sport,80),placement:clean(x.placement,80),
        eventTitle:clean(x.eventTitle,180),achievedAt:Number(x.achievedAt||0),verification:'sportbuddy'
      }));
    const comp=summary.stats;
    const profile=readSportPassport(user.sportPassport||{},Array.isArray(user.sports)?user.sports:[]);
    const verified=applyVerifiedClaims(profile,(claimsSnap?.docs||[]).map(item=>item.data()||{}));

    res.setHeader('Cache-Control','no-store');
    return res.json({sportId:{
      identity:{
        name:clean(user.name,120)||'Спортсмен',avatar:clean(user.avatar,2000),
        districtId:clean(user.districtId,80),locationName:clean(user.locationName,180),isVerified:user.isVerified===true
      },
      profile:{
        mainSport:profile.mainSport,level:profile.level,levelLabel:levelLabel(profile.level),
        rankTitle:profile.rankTitle,rankVerification:verified.rankVerification,yearsExperience:profile.yearsExperience,
        declaredAchievements:verified.achievements
      },
      stats:{
        totalWorkouts:Number(user.totalWorkouts||0),rating:Number(user.rating||0),ratingCount:Number(user.ratingCount||0),
        sportBuddyWins:comp.wins,sportBuddyPodiums:comp.podiums
      },
      achievements:verified.achievements,
      officialResults,
      public:{enabled:true,slug}
    }});
  }catch(error){
    console.error('[public-sport-id]',error);
    return res.status(500).json({error:'SportBuddy78 ID временно недоступен.'});
  }
}

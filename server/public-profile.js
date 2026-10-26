import { publicTrainer } from './personal-trainer.js';
import {consentedPublicProfile,publicConsentState} from './public-consent.js';

// Generic safe projection used by authenticated/internal API responses.
// It excludes private database fields by default but does NOT decide whether
// a profile is eligible for discovery. Discovery boundaries must use
// publicDiscoveryProfile().
const fields=['name','age','gender','avatar','bio','sports','districtId','locationName',
  'lat','lng','rating','ratingCount','totalWorkouts','totalDailyMedals','medalTier',
  'activeLooking','photoPortfolio','hasRealPhoto','isVerified','hasUsedGeolocation','lastSeenAt','lastGeoAt'];

export function publicProfile(id,user={}) {
  const result={id};
  const trainer=publicTrainer(user);
  if(trainer)result.personalTrainer=trainer;
  for(const key of fields)if(user[key]!==undefined)result[key]=user[key];
  return result;
}

// Discovery/recommendation projection. No athlete is discoverable without the
// current separate dissemination consent. The consent model also minimizes
// fields and coarsens coordinates.
export function publicDiscoveryProfile(id,user={}){
  const result=consentedPublicProfile(id,user);
  if(!result)return null;
  const consent=publicConsentState(user);
  if(consent.groups.includes('trainer')){
    const trainer=publicTrainer(user);
    if(trainer)result.personalTrainer=trainer;
  }
  return result;
}

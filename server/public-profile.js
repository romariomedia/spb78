import { publicTrainer } from './personal-trainer.js';
import { consentedPublicProfile,publicConsentState } from './public-consent.js';

// Explicit public projection. No user is discoverable without an active,
// separately recorded dissemination consent. New database fields are private by default.
export function publicProfile(id,user={}) {
  const result=consentedPublicProfile(id,user);
  if(!result)return null;
  const consent=publicConsentState(user);
  if(consent.groups.includes('trainer')){
    const trainer=publicTrainer(user);
    if(trainer)result.personalTrainer=trainer;
  }
  return result;
}

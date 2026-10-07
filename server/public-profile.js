// Explicit public projection: new database fields are private by default.
const fields=['name','age','gender','avatar','bio','sports','districtId','locationName',
  'lat','lng','rating','ratingCount','totalWorkouts','totalDailyMedals','medalTier',
  'activeLooking','photoPortfolio','hasRealPhoto','isVerified','hasUsedGeolocation','lastSeenAt','lastGeoAt'];
export function publicProfile(id, user) {
  const result={id};
  for(const key of fields) if(user[key]!==undefined) result[key]=user[key];
  // A public Sport ID is served by its own endpoint; never expose its draft.
  return result;
}

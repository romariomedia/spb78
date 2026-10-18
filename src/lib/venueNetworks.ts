import type { SportVenue } from './venues';
export const VENUE_NETWORKS: Record<string,string> = {ddx:'DDX Fitness', 'fitness-house':'Fitness House', urbanfit:'URBANFIT', 'alex-fitness':'ALEX FITNESS'};
/** Input must already exclude hidden/archived branches. Networks cannot be training venues. */
export function venueNetworkGroups(venues: SportVenue[]) {
  return Object.entries(VENUE_NETWORKS).flatMap(([id,name]) => {
    const branches=venues.filter(v=>v.networkId===id);
    return branches.length ? [{id,name,branches}] : [];
  });
}

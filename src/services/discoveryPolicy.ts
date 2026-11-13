import {UserProfile} from '../lib/types';
import {calculateDistanceKm, Coords} from './geolocation';
export interface DiscoveryFilters {radius:number;level:string;time:string}
export const DEFAULT_DISCOVERY_FILTERS:DiscoveryFilters={radius:0,level:'',time:''};
export function matchesDiscoveryFilters(user:UserProfile,filters:DiscoveryFilters,coords:Coords|null){
  if(filters.level&&user.trainingLevel!==filters.level)return false;
  if(filters.time&&!user.trainingTimes?.includes(filters.time))return false;
  if(filters.radius){
    if(!coords||!user.hasUsedGeolocation||![user.lat,user.lng].every(Number.isFinite))return false;
    if(calculateDistanceKm(coords.lat,coords.lng,user.lat,user.lng)>filters.radius)return false;
  }
  return true;
}

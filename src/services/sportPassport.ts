import { SportPassportLevel } from '../lib/types';
import { auth } from './firebaseAuth';

export interface SportPassportAchievement {
  id:string;
  title:string;
  date?:string;
  sport?:string;
  placement?:string;
  verification:'declared'|'verified'|'sportbuddy';
}
export interface SportPassportHistoryItem {
  id:string;trainingId:string;title:string;sport:string;dateKey:string;locationName:string;timestamp:number;verified:boolean;
}
export interface SportPassportResult {
  id:string;title:string;sport:string;placement:string;eventTitle:string;achievedAt:number;verification:'sportbuddy';
}
export interface SportPassportSnapshot {
  identity:{
    id:string;name:string;avatar:string;districtId:string;locationName:string;isVerified:boolean;registeredAt:string;
  };
  profile:{
    mainSport:string;level:SportPassportLevel;levelLabel:string;rankTitle:string;yearsExperience:number;
    declaredAchievements:Array<{id:string;title:string;date?:string;sport?:string;placement?:string;verification:'declared'|'verified'}>;
    rankVerification:'declared'|'verified';
  };
  stats:{
    totalWorkouts:number;verifiedCheckins:number;organizedTrainings:number;rating:number;ratingCount:number;sportBuddyWins:number;sportBuddyPodiums:number;
  };
  public:{enabled:boolean;slug:string};
  achievements:SportPassportAchievement[];
  officialResults:SportPassportResult[];
  history:SportPassportHistoryItem[];
}
export interface SportPassportDraft {
  mainSport:string;level:SportPassportLevel;rankTitle:string;yearsExperience:number;
  declaredAchievements:Array<{id:string;title:string;date?:string;sport?:string;placement?:string;verification:'declared'|'verified'}>;
}

async function call<T>(body:Record<string,unknown>):Promise<T>{
  const token=await auth.currentUser?.getIdToken();
  if(!token)throw new Error('Требуется повторный вход');
  const response=await fetch('/api/sport-passport',{
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
    body:JSON.stringify(body)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
  return data as T;
}

export async function loadSportPassport():Promise<SportPassportSnapshot>{
  const data=await call<{sportId:SportPassportSnapshot}>({action:'read'});
  return data.sportId;
}
export async function saveSportPassport(sportId:SportPassportDraft):Promise<SportPassportSnapshot>{
  const data=await call<{sportId:SportPassportSnapshot}>({action:'update',sportId});
  return data.sportId;
}
export async function setSportIdPublic(enabled:boolean):Promise<SportPassportSnapshot>{
  const data=await call<{sportId:SportPassportSnapshot}>({action:'setPublic',enabled});
  return data.sportId;
}
export async function loadPublicSportId(slug:string):Promise<SportPassportSnapshot>{
  const response=await fetch('/api/public-sport-id?slug='+encodeURIComponent(slug));
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
  return data.sportId as SportPassportSnapshot;
}
export function publicSportIdUrl(slug:string):string{
  return `https://sportbuddy78.pro/#/id/${encodeURIComponent(slug)}`;
}
export async function publicSportIdQrUrl(slug:string):Promise<string>{
  const {toDataURL}=await import('qrcode');
  return toDataURL(publicSportIdUrl(slug),{width:320,margin:4,errorCorrectionLevel:'M'});
}

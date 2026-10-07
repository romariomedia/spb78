import { getAdminSession } from './adminAuth';

export interface AnalyticsDailyPoint{
  day:string;registrations:number;dau:number;activeSeconds:number;sessions:number;avgMinutesPerActiveUser:number;
}
export interface AdminAnalyticsData{
  generatedAt:string;timezone:string;observedWindowStartedAt:string;coverageDays:number;
  metrics:{
    registrations7d:number;registrationsPrev7d:number;registrationsDelta:number;registrationsChangePct:number|null;
    dau:number;dauYesterday:number;dauDelta:number;wau:number;
    retentionD7:number|null;retentionDay:string;retentionCohort:number;retentionReturned:number;
    avgActiveMinutes7d:number;avgSessionMinutes7d:number;activeUserDays7d:number;
  };
  daily:AnalyticsDailyPoint[];
}

export async function loadAdminAnalytics():Promise<AdminAnalyticsData>{
  const session=getAdminSession();if(!session)throw new Error('admin-otp-required');
  const response=await fetch('/api/admin-analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:session.sessionId})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
  return data as AdminAnalyticsData;
}

export const SPORTBUDDY_PUBLIC_URL: string;
export function buildSportBuddyShareUrl(kind:'training'|'leisure',id:string):string;
export function trainingShareCopy(input:{id:string;title:string;sport:string;locationName:string;dateLabel:string;isOfficial?:boolean}):{title:string;text:string;url:string};
export function leisureShareCopy(input:{id:string;title:string;destinationName?:string;meetingPoint:string;startsAt:number}):{title:string;text:string;url:string};

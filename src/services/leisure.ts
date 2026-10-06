import { callServer } from './serverApi';
export interface LeisureEvent {
 id:string; destinationId:string; region:string; title:string; date:string; time:string; startsAt:number;
 meetingPoint:string; description:string; transport:string; costs:string; capacity:number; participantGender:'any'|'male'|'female';
 createdBy:string; organizerName:string; participantIds:string[]; status:'open'|'cancelled'; createdAt:number; updatedAt:number;
}
export type LeisureDraft = Pick<LeisureEvent,'destinationId'|'title'|'date'|'time'|'meetingPoint'|'description'|'transport'|'costs'|'capacity'|'participantGender'>;
export const listLeisureEvents = (cursor?:string) => callServer<{events:LeisureEvent[];next:string|null}>('/api/leisure',{action:'list',cursor});
export const readLeisureEvent = (id:string) => callServer<{event:LeisureEvent}>('/api/leisure',{action:'read',id});
export const createLeisureEvent = (draft:LeisureDraft,requestId:string) => callServer<{event:LeisureEvent}>('/api/leisure',{action:'create',...draft,requestId});
export const changeLeisureEvent = (id:string,action:'join'|'leave'|'cancel') => callServer<{event:LeisureEvent}>('/api/leisure',{action,id});

export interface LeisureDestination {
 id:string;name:string;region:'spb'|'lo'|'karelia';category?:'destination'|'rink';season?:string;format:string;pace:string;
 description:string;plan:string;access:string;source:string;photo:string;photoCredit:string;
 rinkType?:'outdoor'|'indoor'|'';rental?:boolean;address?:string;phone?:string;website?:string;hours?:string;
 priceText?:string;priceStatus?:string;priceCheckedAt?:string;seasonStatus?:'upcoming'|'open'|'closed'|'unknown'|'';
 isPublished?:boolean;checkedAt?:string;
}
export const listLeisureDestinations = () => callServer<{destinations:LeisureDestination[]}>('/api/leisure',{action:'catalog'});

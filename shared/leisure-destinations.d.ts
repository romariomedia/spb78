export type LeisureRegion = 'spb' | 'lo' | 'karelia';
export interface LeisureDestination { id:string; name:string; region:LeisureRegion; format:string; pace:string; description:string; plan:string; access:string; source:string; photoCredit:string; photo:string; checkedAt:string }
export const LEISURE_REGIONS: Record<LeisureRegion,string>;
export const LEISURE_DESTINATIONS: LeisureDestination[];
export function getLeisureDestination(id: unknown): LeisureDestination | undefined;

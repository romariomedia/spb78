export interface RunPoint {lat:number;lng:number;timestamp:number;accuracy:number;segment:number}
export const MAX_POINTS:number;
export const MAX_DURATION_MS:number;
export function distanceM(a:{lat:number;lng:number},b:{lat:number;lng:number}):number;
export function validPoint(p:unknown):boolean;
export function trackDistance(points:RunPoint[]):number;

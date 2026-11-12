export interface RunPoint {lat:number;lng:number;timestamp:number;accuracy:number;segment:number}
export const MAX_POINTS:number;
export const MAX_DURATION_MS:number;
export const START_RADIUS_M:number;
export function assertRunStart(point:RunPoint,route:{start:{lat:number;lng:number}}|null,now?:number):void;
export function distanceM(a:{lat:number;lng:number},b:{lat:number;lng:number}):number;
export function validPoint(p:unknown):boolean;
export function trackDistance(points:RunPoint[]):number;

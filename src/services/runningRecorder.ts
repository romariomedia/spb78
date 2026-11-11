import {Capacitor,registerPlugin} from '@capacitor/core';
import type {RunPoint} from '../../shared/running.js';
export type RunDraft={id:string;routeId:string;routeVersion?:number;startedAt:number;endedAt?:number;points:RunPoint[];segment:number;publish?:boolean};
export type RecorderSnapshot={draft:RunDraft|null;recording:boolean;error:string};
interface Recorder {
 shareCard(options:{data:string}):Promise<void>;
 snapshot(options:{owner:string}):Promise<RecorderSnapshot>;
 start(options:{owner:string;draft:RunDraft}):Promise<RecorderSnapshot>;
 pause(options:{owner:string}):Promise<RecorderSnapshot>;
 finish(options:{owner:string}):Promise<RecorderSnapshot>;
 discard(options:{owner:string}):Promise<RecorderSnapshot>;
}
export const runningRecorder=registerPlugin<Recorder>('RunningRecorder');
export const hasBackgroundRecorder=()=>Capacitor.getPlatform()==='android'&&Capacitor.isPluginAvailable('RunningRecorder');

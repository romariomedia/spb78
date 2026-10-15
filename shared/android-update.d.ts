export type AndroidUpdatePolicy = {minimumAndroidVersion:string; ruStoreUrl:string};
export function androidUpdatePolicy(value?:unknown):AndroidUpdatePolicy;
export function needsAndroidUpdate(build:unknown,value:AndroidUpdatePolicy):boolean;

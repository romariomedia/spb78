export interface FeatureFlags {
 assistantEnabled:boolean;activeLeisureEnabled:boolean;datingEnabled:boolean;pushEnabled:boolean;
 storiesEnabled:boolean;sportPassportEnabled:boolean;boxEnabled:boolean;
}
export interface Operations {featureFlags:FeatureFlags;maintenanceMode:boolean;maintenanceMessage:string}
export const LIVE_FEATURE_FLAGS:Readonly<FeatureFlags>;
export function effectiveOperations(data?:Record<string,unknown>):Operations;
export function operationDenial(config:Operations,route:string,action?:string):null|{status:number;code:string;error:string};

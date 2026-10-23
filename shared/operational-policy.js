// Legacy switches were stored but never enforced. Only explicitly saved v1 flags apply.
export const LIVE_FEATURE_FLAGS = Object.freeze({
 assistantEnabled:true, activeLeisureEnabled:true, datingEnabled:true, pushEnabled:true,
 storiesEnabled:true, sportPassportEnabled:true, boxEnabled:true
});
export function effectiveOperations(data = {}) {
 return {
  featureFlags: data.operationsVersion === 1 ? Object.fromEntries(Object.entries(LIVE_FEATURE_FLAGS).map(([key,value])=>[key,typeof data.featureFlags?.[key]==='boolean'?data.featureFlags[key]:value])) : {...LIVE_FEATURE_FLAGS},
  maintenanceMode:data.operationsVersion === 1 && data.product?.maintenanceMode === true,
  maintenanceMessage:String(data.product?.maintenanceMessage || 'SportBuddy78 временно на техническом обслуживании.')
 };
}
export function operationDenial(config, route, action='') {
 if(route.startsWith('admin-') || ['app-config','health','payment-webhook'].includes(route))return null;
 if(config.maintenanceMode)return {status:503,code:'MAINTENANCE',error:config.maintenanceMessage};
 const flag = route==='notifications' && ['register','test'].includes(action) ? 'pushEnabled'
  : (route==='leisure'||(route==='guest-catalog'&&action==='leisure')) ? 'activeLeisureEnabled'
  : route==='stories' ? 'storiesEnabled'
  : ['sport-passport','sport-id-verification','public-sport-id'].includes(route) ? 'sportPassportEnabled'
  : route==='sportbuddy-mutation' && action==='match' ? 'datingEnabled'
  : route==='sportbuddy-mutation' && action==='openBox' ? 'boxEnabled'
  : null;
 return flag && config.featureFlags[flag]===false ? {status:403,code:'FEATURE_DISABLED',error:'Этот раздел временно отключён администратором.'} : null;
}

// No external URLs, private message bodies or account-crossing navigation.
export function nativePushDestination(data,uid){
 if(!uid||!data||data.recipient!==uid||typeof data.link!=='string')return '';
 return /^(#(chat|training|event|leisure)=[A-Za-z0-9_%.-]{1,300}|#profile-friends|#events|#notifications)$/.test(data.link)?data.link:'';
}
export function notificationPayload(device,job,uid){
 const data={title:job.title,body:job.message,link:job.link,eventId:job.eventId,tag:job.kind==='message'?job.link:job.eventId,recipient:uid};
 if(device.platform==='android')return {token:device.token,
  notification:{title:'SportBuddy78',body:'У вас новое уведомление. Откройте приложение.'},
  data:{link:job.link,eventId:job.eventId,recipient:uid},
  android:{priority:'high',ttl:3600000,notification:{channelId:'sportbuddy',icon:'ic_stat_sportbuddy',color:'#BEF264',tag:job.eventId,visibility:'private'}}};
 return {token:device.token,data,webpush:{headers:{TTL:'3600',Urgency:'normal'}}};
}

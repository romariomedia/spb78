const fields=['title','dateKey','time','locationName','address','lat','lng','venueId','description','sport','level','participantGender','participantsMax'];
export function officialTrainingNotification(before,after,id,revision) {
  const recipients=[...new Set((before?.participantIds||[]).filter(x=>typeof x==='string'&&x))];
  if(!recipients.length||!after)return null;
  let title,kind;
  if(after.officialStatus==='cancelled'&&before.officialStatus!=='cancelled'){title='Тренировка отменена';kind='training_cancelled';}
  else if(after.isCompleted===true&&before.isCompleted!==true){title='Тренировка завершена';kind='training_completed';}
  else if(after.officialStatus==='draft'&&before.officialStatus==='published'){title='Тренировка снята с публикации';kind='training_hidden';}
  else if(after.officialStatus==='published'&&(before.officialStatus!=='published'||fields.some(k=>JSON.stringify(before[k]??null)!==JSON.stringify(after[k]??null)))){title='Изменения в вашей тренировке';kind='training_update';}
  else return null;
  const visible=after.officialStatus==='published'&&!after.isCompleted;
  return {id:`official-training:${id}:${revision}`,actorId:'',recipients,broadcast:false,category:'trainings',kind,entityId:id,title,
    message:visible?`${after.title} · ${after.dateKey}, ${after.time} МСК · ${after.locationName||after.address||'Проверьте место встречи'}`:String(after.title||before.title),
    link:visible?'#training='+encodeURIComponent(id):'#trainings'};
}

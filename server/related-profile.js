/** Identity needed to recognize an existing correspondent, not a public directory entry. */
export async function relatedProfile(db, uid, caller, id, user) {
  if (!caller || id === uid || user.isSuspended === true || user.isDemo === true) return null;
  const includes = (list, value) => Array.isArray(list) && list.includes(value);
  if (includes(caller.blockedUserIds, id) || includes(user.blockedUserIds, uid)) return null;
  let related = [caller.friendIds, caller.matchIds, caller.friendRequestsReceived, caller.friendRequestsSent]
    .some(list => includes(list, id));
  if (!related) {
    const chat = await db.collection('chats').doc(`chat_${[uid,id].sort().join('__')}`).get();
    const participants = chat.exists ? chat.data().participantIds : [];
    related = Array.isArray(participants) && participants.length === 2
      && participants.includes(uid) && participants.includes(id);
  }
  if (!related) return null;
  return {id, name:typeof user.name === 'string' ? user.name.slice(0,150) : 'Спортсмен',
    avatar:typeof user.avatar === 'string' ? user.avatar.slice(0,4096) : '',
    relationshipOnly:true, activeLooking:false};
}

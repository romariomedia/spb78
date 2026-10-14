import {FieldPath} from 'firebase-admin/firestore';
const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
export async function readAdminUserPage(db, auth, userRow, query = '', cursor = '') {
  const needle = text(query,120).toLowerCase();
  let exactId='';
  if(needle && !needle.includes('/')){
    const direct=await db.collection('users').doc(text(query,120)).get();
    if(direct.exists)exactId=direct.id;
    else if(needle.includes('@')){
      try{exactId=(await auth.getUserByEmail(needle)).uid;}
      catch(error){if(error.code!=='auth/user-not-found')throw error;}
    }
  }
  let page=db.collection('users').orderBy(FieldPath.documentId()).limit(100);
  if(cursor){
    if(typeof cursor!=='string'||cursor.includes('/')||cursor.length>180)throw Object.assign(new Error('Invalid cursor'),{status:400});
    page=page.startAfter(cursor);
  }
  const exact=exactId?await db.collection('users').doc(exactId).get():null;
  const snap=exactId?{docs:exact.exists?[exact]:[]}:await page.get();
  const [privateSnaps, adminSnaps] = await Promise.all([
    Promise.all(snap.docs.map(doc => db.collection('usersPrivate').doc(doc.id).get())),
    Promise.all(snap.docs.map(doc => db.collection('userAdmin').doc(doc.id).get()))
  ]);
  const rows = snap.docs.map((doc,index) => userRow(
    doc,
    privateSnaps[index]?.exists ? privateSnaps[index].data() || {} : {},
    adminSnaps[index]?.exists ? adminSnaps[index].data() || {} : {}
  ));

  const filtered = needle && !exactId ? rows.filter(row =>
    row.id.toLowerCase().includes(needle) ||
    row.name.toLowerCase().includes(needle) ||
    row.email.toLowerCase().includes(needle) ||
    row.districtId.toLowerCase().includes(needle) ||
    row.sports.some(sport => sport.toLowerCase().includes(needle))
  ) : rows;
  return {users:filtered, nextCursor:!exactId && snap.docs.length===100?snap.docs.at(-1).id:null, scanned:snap.docs.length};
}


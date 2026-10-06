import { auth } from './firebaseAuth';
export async function submitComplaint(input:{targetUserId:string;chatId:string;reason:'unsafe'|'harassment'|'spam'|'fake'|'other';details?:string}):Promise<void>{
  const token=await auth.currentUser?.getIdToken();
  if(!token)throw new Error('Требуется повторный вход');
  const response=await fetch('/api/report',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(input)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
}

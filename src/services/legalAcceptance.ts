import {apiFetch} from './apiEndpoint';
import {auth} from './firebaseAuth';

export const USER_LEGAL_VERSION='2026-10-26';

export async function recordRegistrationLegalAcceptance(authProvider:'email'|'vk'):Promise<void>{
  const user=auth.currentUser;
  if(!user)throw new Error('Не удалось подтвердить авторизацию для фиксации согласий.');
  const token=await user.getIdToken(true);
  const response=await apiFetch('/api/legal-acceptance',{
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
    body:JSON.stringify({
      version:USER_LEGAL_VERSION,
      source:'registration',
      authProvider,
      acceptances:['terms','personal_data']
    })
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'Не удалось зафиксировать юридические согласия.');
}

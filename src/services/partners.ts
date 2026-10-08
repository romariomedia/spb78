import { apiBase } from './serverApi';
import { auth } from './firebaseAuth';

export interface FeedPartner{
  id:string;name:string;partnerLabel:string;offerTitle:string;description:string;promoCode:string;
  ctaLabel:string;ctaUrl:string;logoUrl:string;coverUrl:string;mediaUrl:string;
  mediaType:'none'|'image'|'video';startAt:string;endAt:string;priority:number;
}

export async function loadFeedPartners():Promise<{visible:boolean;partners:FeedPartner[]}>{
  const token=await auth.currentUser?.getIdToken();
  if(!token)return {visible:false,partners:[]};
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try {
  const response=await fetch(`${apiBase()}/api/partners`,{signal:controller.signal,cache:'no-store',headers:{Authorization:`Bearer ${token}`}});
  if(!response.ok)return {visible:false,partners:[]};
  const data=await response.json().catch(()=>({}));
  return {visible:data.visible===true,partners:Array.isArray(data.partners)?data.partners:[]};
  } finally {clearTimeout(timer);}
}

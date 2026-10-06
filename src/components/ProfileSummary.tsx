import { districtLabel } from '../../shared/districts.js';
import { AvatarImage } from './AvatarImage';
import {Camera,Crown,MapPin,Star,Users,Heart,Dumbbell,Medal} from 'lucide-react';
import {UserProfile} from '../lib/types';
import {MEDAL_TIERS} from '../lib/medals';
interface Props {user:UserProfile;friendsCount:number;isPremium:boolean;avatar:string;birthday?:string;onUpdateAvatar:()=>void}
const count=(value:number)=>Math.max(0,Number.isFinite(value)?Math.floor(value):0).toLocaleString('ru-RU');
export function ProfileSummary({user,friendsCount,isPremium,avatar,birthday,onUpdateAvatar}:Props){
  const tier=MEDAL_TIERS[user.medalTier||'bronze'];
  const stats=[
    {label:'Рейтинг',value:Number.isFinite(user.rating)?user.rating.toFixed(1):'0.0',icon:Star,accent:true},
    {label:'Тренировки',value:count(user.totalWorkouts),icon:Dumbbell},
    {label:'Друзья',value:count(friendsCount),icon:Users},
    {label:'Мэтчи',value:count(user.matchIds.length),icon:Heart}
  ];
  return <div className="sb-profile-summary">
    <div className="sb-profile-identity">
      <div className="sb-profile-avatar">
        <AvatarImage src={avatar} width={72} height={72} decoding="async" alt={user.name}/>
        <button onClick={onUpdateAvatar} aria-label="Обновить фото профиля"><Camera size={16}/></button>
      </div>
      <div className="sb-profile-name">
        {isPremium&&<span className="sb-profile-premium"><Crown size={11}/> Premium</span>}
        <h3>{user.name}<span className="sb-profile-age">, {user.age}</span></h3>
        <p className="sb-profile-location"><MapPin size={13}/><span>{districtLabel(user.districtId) || user.locationName}</span></p>
        {birthday&&<p className="sb-profile-birthday">{birthday}</p>}
      </div>
    </div>
    <dl className="sb-profile-stats" aria-label="Статистика профиля">
      {stats.map(({label,value,icon:Icon,accent})=><div key={label} className={accent?'sb-profile-stat sb-profile-stat-rating':'sb-profile-stat'}>
        <dt><Icon size={13}/><span>{label}</span></dt><dd>{value}</dd>
      </div>)}
    </dl>
    <div className="sb-profile-medals">
      <span className="sb-profile-medal-icon" aria-hidden="true" style={{color:tier.accent}}><Medal size={26}/></span>
      <div><span className="sb-profile-caption">Уровень медалей</span><strong>{tier.name}</strong></div>
      <div className="sb-profile-medal-total"><strong>{count(user.totalDailyMedals)}</strong><span className="sb-profile-caption">Медали за вход</span></div>
    </div>
  </div>;
}

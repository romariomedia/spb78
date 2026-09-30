import { MedalTier, MedalProgress, DEFAULT_MEDAL_PROGRESS } from '../lib/medals';
import { UserProfile, PromoCode } from '../lib/types';
import { callServer } from './serverApi';
import { triggerHapticNotification } from './native';

export const medalDayKey = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function profileMedals(user: UserProfile): MedalProgress {
  return user.medalProgress || structuredClone(DEFAULT_MEDAL_PROGRESS);
}
export const totalMedals = (p: MedalProgress) => p.totals.bronze + p.totals.silver + p.totals.gold;
export interface ClaimResult {
  ok: boolean; progress: MedalProgress; tierEarned?: MedalTier;
  cycleCompleted: boolean; promoted: boolean; newTier?: MedalTier;
  promo?: PromoCode; message: string; rewardGiven?: boolean;
}
export async function claimDailyMedal(user: UserProfile): Promise<ClaimResult> {
  try {
    const r = await callServer<{progress:MedalProgress;promoted:boolean;newTier?:MedalTier;tierEarned?:MedalTier;promo?:PromoCode;rewardGiven:boolean}>('/api/sportbuddy-mutation',{action:'dailyMedal'});
    if (r.rewardGiven) triggerHapticNotification('success');
    return {ok:true, ...r, cycleCompleted:Boolean(r.promo), message:!r.rewardGiven ? 'Медаль за сегодня уже в коллекции' : r.promo ? `Цикл завершён! Промокод на ${r.promo.days} дней Premium.` : 'Ежедневная медаль — в вашей коллекции!'};
  } catch(error) { return {ok:false,progress:profileMedals(user),cycleCompleted:false,promoted:false,message:error instanceof Error ? error.message : 'Не удалось получить медаль'}; }
}
export function syncProfileMedals(user: UserProfile): UserProfile {
  if (!user.medalProgress) return user;
  const progress = user.medalProgress;
  return {...user,lastClaimedDate:progress.lastClaimDayKey || user.lastClaimedDate,totalDailyMedals:totalMedals(progress),dailyMedalStreak:progress.cycleDays,medalTier:progress.tier};
}

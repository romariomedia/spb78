const PLACEHOLDERS = /ui-avatars|placeholder|dicebear|gravatar\.com\/avatar\/00000/i;
export function hasVerificationPhotos(user) {
  const avatar = typeof user.avatar === 'string' ? user.avatar.trim() : '';
  return Boolean(avatar && !PLACEHOLDERS.test(avatar) && Array.isArray(user.photoPortfolio)
    && user.photoPortfolio.some(photo => typeof photo === 'string' && photo.trim()));
}
export function verificationExpired(user, now = Date.now()) {
  const registered = user.registeredAt?.toDate ? user.registeredAt.toDate().getTime()
    : Date.parse(String(user.registeredAt || ''));
  return Number.isFinite(registered) && now - registered >= 24 * 60 * 60 * 1000;
}
export function photoVerificationPatch(user, now = Date.now()) {
  if (user.isVerified || !hasVerificationPhotos(user) || verificationExpired(user, now)) return {};
  const patch = { isVerified: true, hasRealPhoto: true, verifiedAt: new Date(now).toISOString() };
  const currentEnd = user.premiumUntil?.toDate ? user.premiumUntil.toDate().getTime() : Date.parse(String(user.premiumUntil || ''));
  if (!user.welcomeTrialGrantedAt && !(currentEnd > now) && user.subscriptionPlan !== 'premium') {
    const end = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
    Object.assign(patch, { subscriptionPlan: 'premium', premiumUntil: end,
      trialPremiumEndsAt: end, rewardPremiumEndsAt: end, welcomeTrialGrantedAt: new Date(now).toISOString() });
  }
  return patch;
}

import type { Training, UserProfile } from './types';

export const trainingGenderLabel = (gender: Training['participantGender']) =>
  gender === 'female' ? 'Только женщины' : gender === 'male' ? 'Только мужчины' : 'Любой пол';

export function trainingGenderError(training: Training, user?: Pick<UserProfile, 'gender' | 'genderSet'> | null): string | null {
  if (!training.participantGender || training.participantGender === 'any') return null;
  if (!user?.gender || user.genderSet === false) return 'Укажите пол в профиле для записи';
  return user.gender === training.participantGender ? null : trainingGenderLabel(training.participantGender);
}

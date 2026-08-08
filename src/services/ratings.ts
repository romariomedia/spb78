import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Training, TrainingRating, UserProfile } from '../lib/types';
import { CURRENT_USER_ID } from './repository';
import { triggerHapticImpact, triggerHapticNotification } from './native';
import { getTrainingDayKey, getTrainingStart, hasValidTrainingDate } from './schedule';
import { getDayKey } from './workoutLog';

const RATINGS_KEY = 'sportbuddy_ratings_spb_v1';
const WRITE_TIMEOUT_MS = 3500;

function backgroundWrite(action: () => Promise<unknown>): void {
  try {
    void Promise.race([
      action(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), WRITE_TIMEOUT_MS))
    ]).catch(() => {
      /* offline — local store is the source of truth */
    });
  } catch {
    /* ignore */
  }
}

/* ------------------------------- local store ------------------------------- */

function readAll(): TrainingRating[] {
  try {
    const raw = localStorage.getItem(RATINGS_KEY);
    return raw ? (JSON.parse(raw) as TrainingRating[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: TrainingRating[]): void {
  try {
    localStorage.setItem(RATINGS_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota */
  }
}

/* ------------------------------- computations ------------------------------ */

/** Average of the base profile rating and all organizer reviews */
export function computeAverageRating(user: UserProfile): number {
  const count = user.ratingCount || 0;
  if (count === 0) return user.rating || 0;
  const sum = user.ratingSum || 0;
  return Number((sum / count).toFixed(1));
}

export function getRatingsFor(userId: string): TrainingRating[] {
  return readAll()
    .filter((r) => (r.targetUserId ?? r.participantId) === userId)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function getRatingsGivenBy(organizerId: string): TrainingRating[] {
  return readAll().filter((r) => (r.reviewerId ?? r.organizerId) === organizerId);
}

/** Distribution of stars 5→1 for the profile histogram */
export function getStarDistribution(userId: string): Record<number, number> {
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  getRatingsFor(userId).forEach((r) => {
    dist[r.stars] = (dist[r.stars] || 0) + 1;
  });
  return dist;
}

export function hasRatedParticipant(training: Training, participantId: string): boolean {
  return (training.ratedParticipantIds || []).includes(participantId);
}

export function isOrganizer(training: Training, userId: string): boolean {
  return training.createdBy === userId;
}

/** Participants the organizer still has to rate (excluding themselves) */
export function pendingRatings(training: Training): string[] {
  const rated = training.ratedParticipantIds || [];
  // Only verified attendees deserve a rating — mere registration does not.
  const checkedIn = training.checkedInUserIds || [];
  return training.participantIds.filter(
    (id) => id !== training.createdBy && checkedIn.includes(id) && !rated.includes(id)
  );
}

/** Checked-in attendees who still need to answer "Как прошла тренировка?" */
export function pendingOrganizerRatings(training: Training): string[] {
  const rated = training.organizerRatedByParticipantIds || [];
  const checkedIn = training.checkedInUserIds || [];
  return checkedIn.filter((id) => id !== training.createdBy && !rated.includes(id));
}

/* --------------------------------- actions --------------------------------- */

/** Organizer marks the training as finished → rating flow becomes available */
export async function completeTraining(training: Training): Promise<Training> {
  if (!hasValidTrainingDate(training)) {
    throw new Error('missing-training-date');
  }
  if (getTrainingDayKey(training) !== getDayKey()) {
    throw new Error('not-training-day');
  }
  if (getTrainingStart(training).getTime() > Date.now()) {
    throw new Error('training-not-started');
  }
  if (!(training.checkedInUserIds || []).includes(training.createdBy)) {
    throw new Error('organizer-not-checked-in');
  }
  triggerHapticNotification('success');
  const updated: Training = {
    ...training,
    isCompleted: true,
    completedAt: new Date().toISOString(),
    ratedParticipantIds: training.ratedParticipantIds || [],
    organizerRatedByParticipantIds: training.organizerRatedByParticipantIds || []
  };
  backgroundWrite(() =>
    updateDoc(doc(db, 'trainings', training.id), {
      isCompleted: true,
      completedAt: updated.completedAt,
      organizerRatedByParticipantIds: updated.organizerRatedByParticipantIds
    })
  );
  return updated;
}

export interface SubmitRatingResult {
  training: Training;
  participant: UserProfile;
  rating: TrainingRating;
}

/** Organizer rates one participant of a finished training */
export async function submitRating(
  training: Training,
  organizer: UserProfile,
  participant: UserProfile,
  stars: 1 | 2 | 3 | 4 | 5,
  tags: string[],
  comment?: string
): Promise<SubmitRatingResult> {
  triggerHapticImpact('medium');

  const timestamp = Date.now();
  const rating: TrainingRating = {
    id: `rate_${training.id}_${participant.id}_${timestamp}`,
    trainingId: training.id,
    trainingTitle: training.title,
    sport: training.sport,
    organizerId: organizer.id,
    organizerName: organizer.name,
    organizerAvatar: organizer.avatar,
    participantId: participant.id,
    stars,
    tags,
    comment: comment?.trim() || undefined,
    createdAt: new Date(timestamp).toLocaleDateString('ru-RU'),
    timestamp
    ,kind: 'organizer_to_participant'
    ,reviewerId: organizer.id
    ,reviewerName: organizer.name
    ,reviewerAvatar: organizer.avatar
    ,targetUserId: participant.id
  };

  writeAll([rating, ...readAll()]);

  // Update the training's rated list
  const ratedIds = [...(training.ratedParticipantIds || []), participant.id];
  const updatedTraining: Training = { ...training, ratedParticipantIds: ratedIds };

  // Update participant aggregates
  const nextCount = (participant.ratingCount || 0) + 1;
  const nextSum = (participant.ratingSum || 0) + stars;
  const updatedParticipant: UserProfile = {
    ...participant,
    ratingCount: nextCount,
    ratingSum: nextSum,
    rating: Number((nextSum / nextCount).toFixed(1)),
    ratingsReceived: [rating, ...(participant.ratingsReceived || [])]
  };

  backgroundWrite(() =>
    updateDoc(doc(db, 'trainings', training.id), { ratedParticipantIds: ratedIds })
  );
  backgroundWrite(() =>
    updateDoc(doc(db, 'users', participant.id), {
      ratingCount: nextCount,
      ratingSum: nextSum,
      rating: updatedParticipant.rating
    })
  );
  backgroundWrite(() => setDoc(doc(db, 'ratings', rating.id), rating));

  triggerHapticNotification('success');
  return { training: updatedTraining, participant: updatedParticipant, rating };
}

export interface SubmitOrganizerRatingResult {
  training: Training;
  organizer: UserProfile;
  rating: TrainingRating;
}

/**
 * A GPS-confirmed attendee rates the organizer after the training ends.
 * One immutable review per attendee/training, counted towards the organizer's
 * public profile rating.
 */
export async function submitOrganizerRating(
  training: Training,
  participant: UserProfile,
  organizer: UserProfile,
  stars: 1 | 2 | 3 | 4 | 5,
  tags: string[],
  comment?: string
): Promise<SubmitOrganizerRatingResult> {
  if (!training.isCompleted) throw new Error('training-not-completed');
  if (!training.participantIds.includes(participant.id)) throw new Error('not-registered');
  if (!(training.checkedInUserIds || []).includes(participant.id)) throw new Error('not-checked-in');
  if ((training.organizerRatedByParticipantIds || []).includes(participant.id)) {
    throw new Error('already-rated');
  }

  triggerHapticImpact('medium');
  const timestamp = Date.now();
  const rating: TrainingRating = {
    id: `rate_org_${training.id}_${participant.id}_${timestamp}`,
    trainingId: training.id,
    trainingTitle: training.title,
    sport: training.sport,
    organizerId: organizer.id,
    organizerName: organizer.name,
    organizerAvatar: organizer.avatar,
    participantId: participant.id,
    stars,
    tags,
    comment: comment?.trim() || undefined,
    createdAt: new Date(timestamp).toLocaleDateString('ru-RU'),
    timestamp,
    kind: 'participant_to_organizer',
    reviewerId: participant.id,
    reviewerName: participant.name,
    reviewerAvatar: participant.avatar,
    targetUserId: organizer.id
  };

  writeAll([rating, ...readAll()]);
  const ratedBy = [...(training.organizerRatedByParticipantIds || []), participant.id];
  const updatedTraining: Training = { ...training, organizerRatedByParticipantIds: ratedBy };

  const nextCount = (organizer.ratingCount || 0) + 1;
  const nextSum = (organizer.ratingSum || 0) + stars;
  const updatedOrganizer: UserProfile = {
    ...organizer,
    ratingCount: nextCount,
    ratingSum: nextSum,
    rating: Number((nextSum / nextCount).toFixed(1)),
    ratingsReceived: [rating, ...(organizer.ratingsReceived || [])]
  };

  backgroundWrite(() => updateDoc(doc(db, 'trainings', training.id), {
    organizerRatedByParticipantIds: ratedBy
  }));
  backgroundWrite(() => updateDoc(doc(db, 'users', organizer.id), {
    ratingCount: nextCount,
    ratingSum: nextSum,
    rating: updatedOrganizer.rating
  }));
  backgroundWrite(() => setDoc(doc(db, 'ratings', rating.id), rating));

  triggerHapticNotification('success');
  return { training: updatedTraining, organizer: updatedOrganizer, rating };
}

/** Trainings where the current user is the organizer and ratings are pending */
export function getTrainingsAwaitingRating(trainings: Training[]): Training[] {
  return trainings.filter(
    (t) => isOrganizer(t, CURRENT_USER_ID) && t.isCompleted && pendingRatings(t).length > 0
  );
}

export function starsLabel(stars: number): string {
  switch (stars) {
    case 5: return 'Отлично';
    case 4: return 'Хорошо';
    case 3: return 'Нормально';
    case 2: return 'Слабо';
    case 1: return 'Плохо';
    default: return 'Без оценки';
  }
}

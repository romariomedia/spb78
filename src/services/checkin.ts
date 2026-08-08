import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Training, TrainingCheckIn, UserProfile,
  CHECKIN_RADIUS_METERS, AppNotification
} from '../lib/types';
import { getCurrentCoords, calculateDistanceKm } from './geolocation';
import { triggerHapticNotification, triggerHapticImpact } from './native';
import { getTrainingDayKey, hasValidTrainingDate } from './schedule';
import { getDayKey } from './workoutLog';

const CHECKINS_KEY = 'sportbuddy_checkins_spb_v1';
const WRITE_TIMEOUT_MS = 3500;

function backgroundWrite(action: () => Promise<unknown>): void {
  try {
    void Promise.race([
      action(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), WRITE_TIMEOUT_MS))
    ]).catch(() => {
      /* offline — local store stays authoritative */
    });
  } catch {
    /* ignore */
  }
}

function readAll(): TrainingCheckIn[] {
  try {
    const raw = localStorage.getItem(CHECKINS_KEY);
    return raw ? (JSON.parse(raw) as TrainingCheckIn[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: TrainingCheckIn[]): void {
  try {
    localStorage.setItem(CHECKINS_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota */
  }
}

export function getCheckInsFor(trainingId: string): TrainingCheckIn[] {
  return readAll()
    .filter((c) => c.trainingId === trainingId)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function hasCheckedIn(trainingId: string, userId: string): boolean {
  return readAll().some((c) => c.trainingId === trainingId && c.userId === userId);
}

export function getMyCheckIn(trainingId: string, userId: string): TrainingCheckIn | undefined {
  return readAll().find((c) => c.trainingId === trainingId && c.userId === userId);
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} м`;
  return `${(meters / 1000).toFixed(1)} км`;
}

export interface CheckInResult {
  ok: boolean;
  error?: string;
  checkIn?: TrainingCheckIn;
  training?: Training;
  distanceMeters?: number;
}

/**
 * Verifies the athlete is physically at the training location using GPS
 * and registers the arrival so the organizer gets notified.
 */
export async function checkInToTraining(
  training: Training,
  user: UserProfile,
  note?: string
): Promise<CheckInResult> {
  triggerHapticImpact('medium');

  if (training.isCompleted) {
    return { ok: false, error: 'Тренировка уже завершена — отметка недоступна' };
  }

  if (!hasValidTrainingDate(training)) {
    return { ok: false, error: 'У тренировки не указана корректная календарная дата' };
  }

  if (getTrainingDayKey(training) !== getDayKey()) {
    return { ok: false, error: 'Отметиться можно только в календарный день тренировки' };
  }

  if (!training.participantIds.includes(user.id) && training.createdBy !== user.id) {
    return { ok: false, error: 'Отметка доступна только записанным участникам и организатору' };
  }

  if (hasCheckedIn(training.id, user.id)) {
    return { ok: false, error: 'Вы уже отметились на этой тренировке' };
  }

  let coords;
  try {
    coords = await getCurrentCoords();
  } catch {
    return { ok: false, error: 'Не удалось определить геолокацию. Включите GPS в настройках.' };
  }

  const distanceKm = calculateDistanceKm(coords.lat, coords.lng, training.lat, training.lng);
  const distanceMeters = Math.round(distanceKm * 1000);

  if (distanceMeters > CHECKIN_RADIUS_METERS) {
    return {
      ok: false,
      error: `Вы слишком далеко от места тренировки — ${formatDistance(distanceMeters)}. Подойдите ближе (не более ${CHECKIN_RADIUS_METERS} м).`,
      distanceMeters
    };
  }

  const timestamp = Date.now();
  const checkIn: TrainingCheckIn = {
    id: `chk_${training.id}_${user.id}_${timestamp}`,
    trainingId: training.id,
    userId: user.id,
    userName: user.name,
    userAvatar: user.avatar,
    lat: coords.lat,
    lng: coords.lng,
    distanceMeters,
    arrivedAt: new Date(timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    timestamp,
    note: note?.trim() || undefined,
    verified: true
  };

  writeAll([checkIn, ...readAll()]);

  const checkedIds = [...(training.checkedInUserIds || []), user.id];
  const updatedTraining: Training = { ...training, checkedInUserIds: checkedIds };

  backgroundWrite(() => setDoc(doc(db, 'checkins', checkIn.id), checkIn));
  backgroundWrite(() =>
    updateDoc(doc(db, 'trainings', training.id), { checkedInUserIds: checkedIds })
  );

  triggerHapticNotification('success');
  return { ok: true, checkIn, training: updatedTraining, distanceMeters };
}

/** Builds the push-style notification the organizer receives */
export function buildArrivalNotification(
  checkIn: TrainingCheckIn,
  training: Training
): AppNotification {
  return {
    id: `notif_chk_${checkIn.id}`,
    title: `${checkIn.userName} прибыл(а) на тренировку 📍`,
    message: `«${training.title}» • ${formatDistance(checkIn.distanceMeters)} от точки сбора${
      checkIn.note ? ` • ${checkIn.note}` : ''
    }`,
    type: 'checkin',
    time: checkIn.arrivedAt,
    read: false,
    link: `#training=${training.id}`
  };
}

/** How far the current user is from the training right now */
export async function getDistanceToTraining(training: Training): Promise<number> {
  const coords = await getCurrentCoords();
  return Math.round(calculateDistanceKm(coords.lat, coords.lng, training.lat, training.lng) * 1000);
}

import {
  Training, TrainingCheckIn, UserProfile,
  AppNotification
} from '../lib/types';
import { getCurrentCoords, calculateDistanceKm } from './geolocation';
import { triggerHapticNotification, triggerHapticImpact } from './native';
import { getTrainingDayKey, hasValidTrainingDate } from './schedule';
import { getDayKey } from './workoutLog';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { callServer } from './serverApi';

const CHECKINS_KEY = 'sportbuddy_checkins_spb_v1';

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

/** Firestore is authoritative; localStorage is only a rendering cache. */
export async function refreshMyCheckIns(userId: string): Promise<TrainingCheckIn[]> {
  const snap = await getDocs(query(collection(db,'checkins'), where('userId','==',userId)));
  const list = snap.docs.map(d => d.data() as TrainingCheckIn);
  writeAll([...list, ...readAll().filter(c => c.userId !== userId)]);
  return list;
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
export async function checkInToTraining(training: Training, user: UserProfile, note?: string): Promise<CheckInResult> {
  triggerHapticImpact('medium');
  if (training.isCompleted) return { ok:false, error:'Тренировка уже завершена — отметка недоступна' };
  if (!hasValidTrainingDate(training)) return { ok:false, error:'У тренировки не указана корректная календарная дата' };
  if (getTrainingDayKey(training) !== getDayKey()) return { ok:false, error:'Отметиться можно только в календарный день тренировки' };
  if (!training.participantIds.includes(user.id) && training.createdBy !== user.id) return { ok:false, error:'Отметка доступна только записанным участникам и организатору' };
  if (hasCheckedIn(training.id,user.id)) return { ok:false, error:'Вы уже отметились на этой тренировке' };
  let coords; try { coords = await getCurrentCoords(); } catch { return { ok:false, error:'Не удалось определить геолокацию. Включите GPS в настройках.' }; }
  try {
    const result = await callServer<{ checkIn:TrainingCheckIn; training:Training; distanceMeters:number }>('/api/sportbuddy-mutation', { action:'checkin', trainingId:training.id, lat:coords.lat, lng:coords.lng, note });
    writeAll([result.checkIn, ...readAll().filter(c => c.id !== result.checkIn.id)]); triggerHapticNotification('success'); return { ok:true, checkIn:result.checkIn, training:result.training, distanceMeters:result.distanceMeters };
  } catch(error) { return { ok:false, error:error instanceof Error ? error.message : 'Не удалось подтвердить присутствие' }; }
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

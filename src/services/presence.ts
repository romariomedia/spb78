import {
  UserProfile, NearbyAthlete, PresenceStatus,
  NEARBY_RADIUS_KM, ONLINE_WINDOW_MS, RECENT_WINDOW_MS
} from '../lib/types';
import { calculateDistanceKm, Coords } from './geolocation';
import { updateProfile } from './repository';

const DEVICE_KEY = 'sportbuddy_device_id_v1';
const PRESENCE_KEY = 'sportbuddy_presence_v1';

/* ------------------------------ device registry ----------------------------- */

/** Stable per-device identifier assigned on first launch */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'dev_unknown';
  }
}

interface PresenceRecord {
  lastSeenAt: number;
  lastGeoAt: number;
  lat: number;
  lng: number;
}

function readPresence(): Record<string, PresenceRecord> {
  try {
    const raw = localStorage.getItem(PRESENCE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, PresenceRecord>) : {};
  } catch {
    return {};
  }
}

function writePresence(map: Record<string, PresenceRecord>): void {
  try {
    localStorage.setItem(PRESENCE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/**
 * Seeds realistic presence for the demo community: some athletes are online
 * right now, others were nearby within the last 24 hours.
 */
export function seedPresence(users: UserProfile[], myCoords: Coords): UserProfile[] {
  const stored = readPresence();
  const now = Date.now();
  let changed = false;

  // Minutes since last activity for each seeded athlete
  const offsets = [1, 3, 42, 180, 600, 1320, 2100];

  const result = users.map((u, index) => {
    // Real accounts keep their own coordinates and presence from Firestore —
    // only local sample profiles get synthetic positions around the user.
    if (!u.isDemo) return u;

    let record = stored[u.id];

    if (!record) {
      const minutesAgo = offsets[index % offsets.length] ?? 60;
      // Scatter athletes around the current position (0.3 .. 9 km)
      const spreadKm = 0.3 + (index % 7) * 1.4;
      const angle = (index * 47) % 360;
      const rad = (angle * Math.PI) / 180;
      record = {
        lastSeenAt: now - minutesAgo * 60_000,
        lastGeoAt: now - minutesAgo * 60_000,
        lat: myCoords.lat + (spreadKm / 111) * Math.cos(rad),
        lng: myCoords.lng + (spreadKm / (111 * Math.cos((myCoords.lat * Math.PI) / 180))) * Math.sin(rad)
      };
      stored[u.id] = record;
      changed = true;
    }

    return {
      ...u,
      lat: record.lat,
      lng: record.lng,
      lastSeenAt: record.lastSeenAt,
      lastGeoAt: record.lastGeoAt,
      hasUsedGeolocation: true
    };
  });

  if (changed) writePresence(stored);
  return result;
}

/** Marks the current user as online and registers the device geolocation usage */
export async function registerMyPresence(
  user: UserProfile,
  coords: Coords
): Promise<UserProfile> {
  const now = Date.now();
  const stored = readPresence();
  stored[user.id] = { lastSeenAt: now, lastGeoAt: now, lat: coords.lat, lng: coords.lng };
  writePresence(stored);

  const patch = {
    hasUsedGeolocation: true,
    lastSeenAt: now,
    lastGeoAt: now,
    deviceId: getDeviceId(),
    lat: coords.lat,
    lng: coords.lng
  };

  await updateProfile(patch);
  return { ...user, ...patch };
}

/* -------------------------------- presence ---------------------------------- */

export function getPresenceStatus(user: UserProfile): PresenceStatus {
  const last = user.lastSeenAt ?? 0;
  if (!last) return 'offline';
  const diff = Date.now() - last;
  if (diff <= ONLINE_WINDOW_MS) return 'online';
  if (diff <= RECENT_WINDOW_MS) return 'recent';
  return 'offline';
}

export function lastSeenLabel(user: UserProfile): string {
  const last = user.lastSeenAt ?? 0;
  if (!last) return 'давно не заходил';
  const diff = Date.now() - last;
  if (diff <= ONLINE_WINDOW_MS) return 'в сети сейчас';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `был(а) ${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `был(а) ${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'был(а) вчера' : `был(а) ${days} дн. назад`;
}

/**
 * Finds registered devices that shared their geolocation at least once
 * and are currently within the given radius.
 */
export function findNearbyAthletes(
  users: UserProfile[],
  myCoords: Coords,
  currentUserId: string,
  radiusKm: number = NEARBY_RADIUS_KM
): NearbyAthlete[] {
  return users
    .filter((u) => u.id !== currentUserId && u.hasUsedGeolocation)
    .map((user) => ({
      user,
      distanceKm: calculateDistanceKm(myCoords.lat, myCoords.lng, user.lat, user.lng),
      presence: getPresenceStatus(user),
      lastSeenLabel: lastSeenLabel(user)
    }))
    .filter((entry) => entry.distanceKm <= radiusKm)
    .sort((a, b) => {
      const order: Record<PresenceStatus, number> = { online: 0, recent: 1, offline: 2 };
      const byPresence = order[a.presence] - order[b.presence];
      if (byPresence !== 0) return byPresence;
      return a.distanceKm - b.distanceKm;
    });
}

export function countByPresence(list: NearbyAthlete[]) {
  return {
    online: list.filter((a) => a.presence === 'online').length,
    recent: list.filter((a) => a.presence === 'recent').length,
    offline: list.filter((a) => a.presence === 'offline').length
  };
}

import { DailyWatchRecord } from '../types';

export const STORAGE_KEY_WATCH_RECORDS = 'lingopulse_watch_records_v1';

export function getTodayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function generateSeedWatchRecords(): DailyWatchRecord[] {
  const records: DailyWatchRecord[] = [];
  const now = new Date();

  // Seed last 14 days
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    // Seed realistic daily immersion between 8 and 28 minutes, with a couple of peaks
    const baseMinutes = i === 0 ? 18 : (10 + (Math.sin(i * 1.3) * 6 + 6) + (i % 3 === 0 ? 8 : 0));
    const watchTimeSeconds = Math.round(baseMinutes * 60);
    const videosWatched = Math.max(1, Math.round(baseMinutes / 4));

    records.push({
      date: dateStr,
      watchTimeSeconds,
      videosWatched,
    });
  }

  return records;
}

export function loadWatchRecords(): DailyWatchRecord[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_WATCH_RECORDS);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure today is present
        const todayStr = getTodayKey();
        const hasToday = parsed.some((r) => r.date === todayStr);
        if (!hasToday) {
          parsed.push({
            date: todayStr,
            watchTimeSeconds: 120, // 2 mins default initial session
            videosWatched: 1,
          });
        }
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load watch records:', e);
  }

  const seeded = generateSeedWatchRecords();
  try {
    localStorage.setItem(STORAGE_KEY_WATCH_RECORDS, JSON.stringify(seeded));
  } catch (_) {}
  return seeded;
}

export function saveWatchRecords(records: DailyWatchRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_WATCH_RECORDS, JSON.stringify(records));
  } catch (e) {
    console.warn('Failed to save watch records:', e);
  }
}

export function addWatchTimeToToday(seconds: number, records: DailyWatchRecord[]): DailyWatchRecord[] {
  const todayStr = getTodayKey();
  let updated = false;

  const newRecords = records.map((record) => {
    if (record.date === todayStr) {
      updated = true;
      return {
        ...record,
        watchTimeSeconds: record.watchTimeSeconds + seconds,
        videosWatched: record.videosWatched + (seconds > 10 ? 1 : 0),
      };
    }
    return record;
  });

  if (!updated) {
    newRecords.push({
      date: todayStr,
      watchTimeSeconds: seconds,
      videosWatched: 1,
    });
  }

  saveWatchRecords(newRecords);
  return newRecords;
}

export function calculateStreak(records: DailyWatchRecord[]): number {
  if (!records || records.length === 0) return 0;

  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < sorted.length; i++) {
    const recordDate = new Date(sorted[i].date);
    recordDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((today.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === streak || (streak === 0 && diffDays <= 1)) {
      if (sorted[i].watchTimeSeconds > 60) {
        streak++;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  return streak;
}

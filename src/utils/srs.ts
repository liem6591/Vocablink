import { VocabularyItem, VideoItem } from '../types';

export type SRSGrade = 1 | 2 | 3 | 4; // 1: Again, 2: Hard, 3: Good, 4: Easy

/**
 * SuperMemo SM-2 Algorithm for vocabulary cards
 */
export function calculateNextVocabSRS(
  item: VocabularyItem,
  grade: SRSGrade
): {
  interval: number;
  repetition: number;
  easeFactor: number;
  nextReviewDate: string;
  status: 'new' | 'learning' | 'review' | 'mastered';
} {
  let { repetition, interval, easeFactor } = item;
  easeFactor = easeFactor || 2.5;
  interval = interval || 1;
  repetition = repetition || 0;

  // Update ease factor: EF' = EF + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
  // We map 1..4 grade to standard 2..5 quality
  const quality = grade + 1; // 2, 3, 4, 5
  easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  if (grade === 1) {
    // Again / Failed
    repetition = 0;
    interval = 1;
  } else if (grade === 2) {
    // Hard
    repetition = Math.max(1, repetition);
    interval = Math.max(1, Math.round(interval * 1.2));
  } else if (grade === 3) {
    // Good
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 4;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetition += 1;
  } else {
    // Easy
    if (repetition === 0) {
      interval = 3;
    } else if (repetition === 1) {
      interval = 7;
    } else {
      interval = Math.round(interval * easeFactor * 1.3);
    }
    repetition += 1;
  }

  const nextDate = new Date(Date.now() + interval * 24 * 60 * 60 * 1000);

  let status: 'new' | 'learning' | 'review' | 'mastered' = 'learning';
  if (interval >= 21) {
    status = 'mastered';
  } else if (repetition >= 2) {
    status = 'review';
  } else {
    status = 'learning';
  }

  return {
    interval,
    repetition,
    easeFactor: Number(easeFactor.toFixed(2)),
    nextReviewDate: nextDate.toISOString(),
    status,
  };
}

/**
 * Spaced Repetition calculation for Comprehensible Input Video review
 */
export function calculateNextVideoSRS(
  video: VideoItem,
  stageCompleted: number
): {
  srsStage: number;
  srsInterval: number;
  srsRepetition: number;
  srsNextReviewDate: string;
} {
  const currentRep = video.srsRepetition || 0;
  let nextStage = Math.min(4, stageCompleted + 1);
  let daysUntilNext = 1;

  switch (stageCompleted) {
    case 1:
      daysUntilNext = 1; // Stage 2 after 1 day (Listen without sub)
      break;
    case 2:
      daysUntilNext = 3; // Stage 3 after 3 days (Shadowing)
      break;
    case 3:
      daysUntilNext = 7; // Stage 4 after 7 days (Consolidation & Retell)
      break;
    case 4:
    default:
      daysUntilNext = 14; // Recurring long-term retention
      nextStage = 4;
      break;
  }

  const nextDate = new Date(Date.now() + daysUntilNext * 24 * 60 * 60 * 1000);

  return {
    srsStage: nextStage,
    srsInterval: daysUntilNext,
    srsRepetition: currentRep + 1,
    srsNextReviewDate: nextDate.toISOString(),
  };
}

/**
 * Check if a date is due for review
 */
export function isDueForReview(isoDateString?: string): boolean {
  if (!isoDateString) return true;
  return new Date(isoDateString).getTime() <= Date.now();
}

/**
 * Format relative review time
 */
export function formatRelativeReview(isoDateString?: string): string {
  if (!isoDateString) return 'Hôm nay';
  const diff = new Date(isoDateString).getTime() - Date.now();
  if (diff <= 0) return 'Đến hạn hôm nay';
  const hours = Math.round(diff / (1000 * 60 * 60));
  if (hours < 24) return `Sau ${hours} giờ`;
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  return `Sau ${days} ngày`;
}

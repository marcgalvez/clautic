import type { ReviewItem } from '@/lib/storage/types';

/** Interval ladder in days (orientative; adapted by performance). */
export const INTERVALS = [1, 3, 7, 14, 30, 60];
const DAY = 24 * 60 * 60 * 1000;

/**
 * Updates the review state of a concept after it was practised.
 * - quality ≥ 0.8: move one stage up the ladder.
 * - 0.5 ≤ quality < 0.8: repeat the current interval.
 * - quality < 0.5: back to the first interval (1 day).
 */
export function scheduleReview(prev: ReviewItem | undefined, conceptId: string, quality: number, now = new Date()): ReviewItem {
  let stage: number;
  if (!prev) stage = quality >= 0.8 ? 1 : 0;
  else if (quality >= 0.8) stage = Math.min(prev.stage + 1, INTERVALS.length - 1);
  else if (quality >= 0.5) stage = prev.stage;
  else stage = 0;
  const intervalDays = INTERVALS[stage];
  return {
    conceptId,
    stage,
    intervalDays,
    dueAt: new Date(now.getTime() + intervalDays * DAY).toISOString(),
    lastReviewedAt: now.toISOString(),
    lastQuality: quality,
    reviews: (prev?.reviews ?? 0) + 1,
  };
}

export function isDue(item: ReviewItem, now = new Date()): boolean {
  return new Date(item.dueAt).getTime() <= now.getTime();
}

export function dueReviews(items: ReviewItem[], now = new Date()): ReviewItem[] {
  return items.filter((i) => isDue(i, now)).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

/** Merges a list of per-concept qualities from one session into the review set. */
export function applySessionToReviews(
  reviews: ReviewItem[],
  conceptQualities: Record<string, number>,
  now = new Date(),
): ReviewItem[] {
  const map = new Map(reviews.map((r) => [r.conceptId, r]));
  for (const [conceptId, q] of Object.entries(conceptQualities)) {
    map.set(conceptId, scheduleReview(map.get(conceptId), conceptId, q, now));
  }
  return [...map.values()];
}

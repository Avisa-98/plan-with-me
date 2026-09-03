import type { Item } from "./storage";
import { addDays, startOfWeek } from "./schedule.ts";

/**
 * Pure logic for the daily and weekly reflection screens: which items count
 * as "done today" or "done this week," and how to rank items you could swap
 * in for one you're dropping. No DOM, no storage - all tested directly.
 */

// Same local calendar day, not "within the last 24 hours" - so an item you
// finished at 11:58pm and one you finished at 12:02am the next day land in
// different days' reflections, matching how a person thinks about "today."
function isSameCalendarDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isDoneToday(item: Item, now: Date) {
  return !!item.done && isSameCalendarDay(new Date(item.updatedAt), now);
}

// The real Monday-through-Sunday calendar week, same range shown on This
// Week - not "the last 7 days," so this always lines up with what the app
// already displays as the current week.
export function isDoneThisWeek(item: Item, now: Date) {
  if (!item.done) return false;
  const doneAt = new Date(item.updatedAt);
  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);
  return doneAt >= weekStart && doneAt < weekEnd;
}

export type RankedCandidate = { item: Item; longer: boolean };

// Candidates for swapping in when you Replace an item: anything else that's
// still open (not done) and already has a time estimate - without an
// estimate there is nothing to compare against the item you're dropping,
// so it can't be ranked as "fits" or "takes longer."
export function rankReplacementCandidates(original: Item, pool: Item[]): RankedCandidate[] {
  const originalEstimate = original.estimateMinutes ?? 0;
  return pool
    .filter((candidate) => candidate.id !== original.id && !candidate.done && candidate.estimateMinutes != null)
    .map((item) => ({ item, longer: (item.estimateMinutes ?? 0) > originalEstimate }))
    .sort((a, b) => (a.item.estimateMinutes ?? 0) - (b.item.estimateMinutes ?? 0));
}

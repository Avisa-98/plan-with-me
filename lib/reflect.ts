import type { Item } from "./storage";

/**
 * Pure logic for the daily reflection screen: which items count as "done
 * today," and how to rank items you could swap in for one you're dropping.
 * No DOM, no storage - all tested directly.
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

export type RankedCandidate = { item: Item; longer: boolean };

// Candidates for swapping in when you Replace an item: anything else that's
// still open (not done, not archived) and already has a time estimate -
// without an estimate there is nothing to compare against the item you're
// dropping, so it can't be ranked as "fits" or "takes longer."
export function rankReplacementCandidates(original: Item, pool: Item[]): RankedCandidate[] {
  const originalEstimate = original.estimateMinutes ?? 0;
  return pool
    .filter((candidate) => candidate.id !== original.id && !candidate.done && !candidate.archived && candidate.estimateMinutes != null)
    .map((item) => ({ item, longer: (item.estimateMinutes ?? 0) > originalEstimate }))
    .sort((a, b) => (a.item.estimateMinutes ?? 0) - (b.item.estimateMinutes ?? 0));
}

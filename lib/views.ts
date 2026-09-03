import type { Item } from "./storage";

/**
 * One predicate per surface the app renders.
 *
 * Every item must satisfy exactly one of these, or it is either stranded
 * (on no screen the user can reach) or duplicated (shown on two screens at
 * once, so it looks unresolved and resolved simultaneously).
 *
 * `isIdea` is checked first and overrides everything else - an idea
 * belongs only in the Idea Log, however it got a status or bucket.
 * `isUnresolved` is the residual of everything else - anything the other
 * surfaces do not claim falls back to the inbox. Together these make
 * stranding and duplication impossible by construction rather than by
 * remembering to keep the predicates in sync.
 *
 * `isWeekItem` covers the Today/This Week buckets (the Overview Today/Week
 * views); `isMonthItem` covers This Month on its own (the Overview Month
 * view); `isLater` covers Later (Saved for Later).
 *
 * `lib/views.test.ts` enforces this over every status/bucket/type
 * combination.
 */

export function isIdea(item: Item) {
  return item.type === "idea";
}

export function isWeekItem(item: Item) {
  return !isIdea(item) && item.status === "Planned" && (item.bucket === "Today" || item.bucket === "This Week");
}

export function isMonthItem(item: Item) {
  return !isIdea(item) && item.status === "Planned" && item.bucket === "This Month";
}

export function isLater(item: Item) {
  return !isIdea(item) && item.status === "Planned" && item.bucket === "Later";
}

export function isUnresolved(item: Item) {
  return !isIdea(item) && !isWeekItem(item) && !isMonthItem(item) && !isLater(item);
}

// Not-done items first, done items after - keeping each group in whatever
// order it already had (Array.sort is stable), so finishing something moves
// it out of the way without shuffling anything else around it. Returns a
// new array; the one passed in is left untouched.
export function sortDoneLast(items: Item[]): Item[] {
  return [...items].sort((a, b) => Number(!!a.done) - Number(!!b.done));
}

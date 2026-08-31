import type { Item } from "./storage";

/**
 * One predicate per surface the app renders.
 *
 * Every item must satisfy at least one of these, or it is stranded: stored, but
 * on no screen the user can reach. `isUnresolved` is therefore defined as the
 * residual - anything the planning surfaces do not claim falls back to the
 * inbox, where the user can give it a home. That makes stranding impossible by
 * construction rather than by remembering to keep the predicates in sync.
 *
 * `lib/views.test.ts` enforces this over every status/bucket combination.
 */

export function isWeekItem(item: Item) {
  return item.status === "Planned" && (item.bucket === "Today" || item.bucket === "This Week");
}

export function isLater(item: Item) {
  return item.status === "Planned" && item.bucket === "Later";
}

export function isUnresolved(item: Item) {
  return !isWeekItem(item) && !isLater(item);
}

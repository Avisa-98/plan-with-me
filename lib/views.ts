import type { Item } from "./storage";

/**
 * One predicate per surface the app renders.
 *
 * Every item must satisfy exactly one of these, or it is either stranded
 * (on no screen the user can reach) or duplicated (shown on two screens at
 * once, so it looks unresolved and resolved simultaneously).
 *
 * `isArchived` is checked first and overrides every other state: once a
 * braindump is archived it belongs only in the Archive, regardless of what
 * its status or bucket happen to say. `isUnresolved` is the residual of
 * everything else - anything the other surfaces do not claim falls back to
 * the inbox. Together these make stranding and duplication impossible by
 * construction rather than by remembering to keep the predicates in sync.
 *
 * `lib/views.test.ts` enforces this over every status/bucket/archived
 * combination.
 */

export function isArchived(item: Item) {
  return !!item.archived;
}

export function isWeekItem(item: Item) {
  return !isArchived(item) && item.status === "Planned" && (item.bucket === "Today" || item.bucket === "This Week");
}

export function isLater(item: Item) {
  return !isArchived(item) && item.status === "Planned" && item.bucket === "Later";
}

export function isUnresolved(item: Item) {
  return !isArchived(item) && !isWeekItem(item) && !isLater(item);
}

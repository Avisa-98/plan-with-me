import type { Item } from "./storage";

/**
 * Date math for the Day / Week-by-day / Month views. An item only lands on
 * a specific day if it already has a due date or event start - nothing new
 * to fill in. Everything else is unscheduled, not lost: it still shows in
 * Inbox, This week, or Later, just not pinned to a calendar day.
 *
 * All dates here are local calendar dates, not UTC - "today" means the day
 * on the device's own clock.
 */

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function itemDateKey(item: Item): string | undefined {
  if (item.dueDate) return item.dueDate;
  if (item.eventStart) return toDateKey(new Date(item.eventStart));
  return undefined;
}

export function itemsOnDate(items: Item[], key: string): Item[] {
  return items.filter((item) => itemDateKey(item) === key);
}

export function unscheduledItems(items: Item[]): Item[] {
  return items.filter((item) => !itemDateKey(item));
}

// Strips the time of day so later date arithmetic only ever deals in whole
// days, regardless of what time it currently is.
function atMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const result = atMidnight(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Monday-based week start. JS's getDay() is 0 (Sunday) through 6 (Saturday);
// Sunday needs to shift back 6 days to reach that same week's Monday, every
// other day shifts back to the most recent Monday.
export function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

// Day 0 of next month is the last day of this month - a small trick that
// avoids hand-rolling a month-length lookup table (and its leap-year bug).
export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

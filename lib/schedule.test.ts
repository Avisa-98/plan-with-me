import { test } from "node:test";
import assert from "node:assert/strict";
import type { Item } from "./storage.ts";
import { toDateKey, itemDateKey, itemsOnDate, unscheduledItems, startOfWeek, addDays, startOfMonth, daysInMonth } from "./schedule.ts";

function item(over: Partial<Item> = {}): Item {
  const now = new Date().toISOString();
  return { id: "1", text: "t", status: "Inbox", createdAt: now, updatedAt: now, ...over };
}

test("toDateKey formats with zero-padded month and day", () => {
  assert.equal(toDateKey(new Date(2026, 0, 5)), "2026-01-05"); // month is 0-indexed in JS Date
});

test("itemDateKey prefers a due date over an event start", () => {
  const i = item({ dueDate: "2026-09-03", eventStart: "2026-09-10T09:00:00.000Z" });
  assert.equal(itemDateKey(i), "2026-09-03");
});

test("itemDateKey falls back to the event start's date when there is no due date", () => {
  const i = item({ eventStart: "2026-09-10T09:00:00.000Z" });
  assert.equal(itemDateKey(i), toDateKey(new Date("2026-09-10T09:00:00.000Z")));
});

test("itemDateKey is undefined when neither is set - this item is unscheduled", () => {
  assert.equal(itemDateKey(item()), undefined);
});

test("itemsOnDate returns only items whose date key matches", () => {
  const a = item({ id: "a", dueDate: "2026-09-03" });
  const b = item({ id: "b", dueDate: "2026-09-04" });
  const c = item({ id: "c", dueDate: "2026-09-03" });
  assert.deepEqual(itemsOnDate([a, b, c], "2026-09-03").map((i) => i.id), ["a", "c"]);
});

test("unscheduledItems returns only items with no due date or event start", () => {
  const dated = item({ id: "dated", dueDate: "2026-09-03" });
  const undated = item({ id: "undated" });
  assert.deepEqual(unscheduledItems([dated, undated]).map((i) => i.id), ["undated"]);
});

test("startOfWeek returns the Monday of that week for a mid-week date", () => {
  // Wednesday, September 2, 2026
  assert.equal(toDateKey(startOfWeek(new Date(2026, 8, 2))), "2026-08-31");
});

test("startOfWeek treats Sunday as the end of its week, not the start", () => {
  // Sunday, September 6, 2026 -> the Monday six days earlier
  assert.equal(toDateKey(startOfWeek(new Date(2026, 8, 6))), "2026-08-31");
});

test("addDays rolls over a month boundary correctly", () => {
  assert.equal(toDateKey(addDays(new Date(2026, 0, 30), 3)), "2026-02-02");
});

test("startOfMonth returns the 1st of the given month", () => {
  assert.equal(toDateKey(startOfMonth(new Date(2026, 8, 17))), "2026-09-01");
});

test("daysInMonth handles a leap-year February", () => {
  assert.equal(daysInMonth(new Date(2028, 1, 1)), 29);
});

test("daysInMonth handles a non-leap-year February", () => {
  assert.equal(daysInMonth(new Date(2026, 1, 1)), 28);
});

test("daysInMonth handles a 31-day month", () => {
  assert.equal(daysInMonth(new Date(2026, 0, 1)), 31);
});

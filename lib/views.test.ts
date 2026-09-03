import { test } from "node:test";
import assert from "node:assert/strict";
import type { Item } from "./storage.ts";
import { isUnresolved, isWeekItem, isMonthItem, isLater, isIdea, sortDoneLast } from "./views.ts";

function item(over: Partial<Item> = {}): Item {
  const now = new Date().toISOString();
  return { id: "1", text: "t", status: "Inbox", createdAt: now, updatedAt: now, ...over };
}

// An item is reachable if at least one of the app's views will render it.
// Every item MUST appear somewhere, or the user has no way to reach it again.
function reachable(i: Item) {
  return isUnresolved(i) || isWeekItem(i) || isMonthItem(i) || isLater(i) || isIdea(i);
}

// An item should appear on exactly one surface, never two - otherwise the
// same thing looks done in Reflect and still waiting in the inbox.
function surfaceCount(i: Item) {
  return [isUnresolved(i), isWeekItem(i), isMonthItem(i), isLater(i), isIdea(i)].filter(Boolean).length;
}

test("a freshly captured note shows in Inbox", () => {
  assert.equal(isUnresolved(item()), true);
});

test("an item committed to Today shows in the week", () => {
  assert.equal(isWeekItem(item({ status: "Planned", bucket: "Today" })), true);
});

test("an item committed to This Week shows in the week", () => {
  assert.equal(isWeekItem(item({ status: "Planned", bucket: "This Week" })), true);
});

test("an item committed to This Month shows in the month view, and leaves the inbox once it does", () => {
  const monthItem = item({ status: "Planned", bucket: "This Month" });
  assert.equal(isMonthItem(monthItem), true);
  assert.equal(isUnresolved(monthItem), false, "a committed This Month item must not still clutter the inbox");
});

test("an item committed to Later is still reachable somewhere", () => {
  const later = item({ status: "Planned", bucket: "Later" });
  assert.equal(reachable(later), true, "Later item is not rendered by any view - it is stranded");
});

test("an idea shows only in the Idea Log, regardless of status or bucket", () => {
  const idea = item({ type: "idea", status: "Planned", bucket: "Today" });
  assert.equal(isIdea(idea), true);
  assert.equal(isUnresolved(idea), false, "an idea must not also clutter the inbox");
  assert.equal(isWeekItem(idea), false, "an idea must not also show up in the week");
});

test("no item in any valid state is unreachable, and none appears on two surfaces at once", () => {
  const buckets = [undefined, "Today", "This Week", "This Month", "Later"] as const;
  const statuses = ["Inbox", "Planned"] as const;
  const types = [undefined, "task", "idea"] as const;
  for (const status of statuses) {
    for (const bucket of buckets) {
      for (const type of types) {
        const i = item({ status, bucket, type });
        const label = `status=${status} bucket=${bucket} type=${type}`;
        assert.equal(reachable(i), true, `unreachable: ${label}`);
        assert.equal(surfaceCount(i), 1, `shown on ${surfaceCount(i)} surfaces, expected exactly 1: ${label}`);
      }
    }
  }
});

test("sortDoneLast keeps every not-done item ahead of every done item", () => {
  const a = item({ id: "a", done: false });
  const b = item({ id: "b", done: true });
  const c = item({ id: "c", done: false });
  const d = item({ id: "d", done: true });
  const sorted = sortDoneLast([a, b, c, d]);
  assert.deepEqual(sorted.map((i) => i.id), ["a", "c", "b", "d"]);
});

test("sortDoneLast does not reorder items within the not-done group or the done group", () => {
  // b and d are both done, in that order - they must stay in that order,
  // not get shuffled just because they moved to the back.
  const a = item({ id: "a", done: false });
  const b = item({ id: "b", done: true });
  const c = item({ id: "c", done: false });
  const d = item({ id: "d", done: true });
  const sorted = sortDoneLast([b, a, d, c]);
  assert.deepEqual(sorted.map((i) => i.id), ["a", "c", "b", "d"]);
});

test("sortDoneLast does not mutate the array it was given", () => {
  const original = [item({ id: "a", done: true }), item({ id: "b", done: false })];
  const copy = [...original];
  sortDoneLast(original);
  assert.deepEqual(original, copy);
});

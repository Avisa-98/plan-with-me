import { test } from "node:test";
import assert from "node:assert/strict";
import type { Item } from "./storage.ts";
import { isUnresolved, isWeekItem, isLater } from "./views.ts";

function item(over: Partial<Item> = {}): Item {
  const now = new Date().toISOString();
  return { id: "1", text: "t", status: "Unprocessed", createdAt: now, updatedAt: now, ...over };
}

// An item is reachable if at least one of the app's views will render it.
// Every item MUST appear somewhere, or the user has no way to reach it again.
function reachable(i: Item) {
  return isUnresolved(i) || isWeekItem(i) || isLater(i);
}

test("a freshly captured note shows in Unprocessed", () => {
  assert.equal(isUnresolved(item()), true);
});

test("an item committed to Today shows in the week", () => {
  assert.equal(isWeekItem(item({ status: "Planned", bucket: "Today" })), true);
});

test("an item committed to This Week shows in the week", () => {
  assert.equal(isWeekItem(item({ status: "Planned", bucket: "This Week" })), true);
});

test("an item committed to Later is still reachable somewhere", () => {
  const later = item({ status: "Planned", bucket: "Later" });
  assert.equal(reachable(later), true, "Later item is not rendered by any view - it is stranded");
});

test("no item in any valid state is unreachable", () => {
  const buckets = [undefined, "Today", "This Week", "Later"] as const;
  const statuses = ["Unprocessed", "Planned"] as const;
  for (const status of statuses) {
    for (const bucket of buckets) {
      const i = item({ status, bucket });
      assert.equal(reachable(i), true, `unreachable: status=${status} bucket=${bucket}`);
    }
  }
});

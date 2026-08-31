import { test } from "node:test";
import assert from "node:assert/strict";
import type { Item } from "./storage.ts";
import { isUnresolved, isWeekItem, isLater, isArchived, isIdea } from "./views.ts";

function item(over: Partial<Item> = {}): Item {
  const now = new Date().toISOString();
  return { id: "1", text: "t", status: "Inbox", createdAt: now, updatedAt: now, ...over };
}

// An item is reachable if at least one of the app's views will render it.
// Every item MUST appear somewhere, or the user has no way to reach it again.
function reachable(i: Item) {
  return isUnresolved(i) || isWeekItem(i) || isLater(i) || isArchived(i) || isIdea(i);
}

// An item should appear on exactly one surface, never two - otherwise the
// same thing looks "done" in the Archive and still "waiting" in the inbox.
function surfaceCount(i: Item) {
  return [isUnresolved(i), isWeekItem(i), isLater(i), isArchived(i), isIdea(i)].filter(Boolean).length;
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

test("an item committed to Later is still reachable somewhere", () => {
  const later = item({ status: "Planned", bucket: "Later" });
  assert.equal(reachable(later), true, "Later item is not rendered by any view - it is stranded");
});

test("an archived braindump shows only in the Archive", () => {
  const archived = item({ archived: true });
  assert.equal(isArchived(archived), true);
  assert.equal(isUnresolved(archived), false, "an archived note must not also clutter the inbox");
});

test("archiving wins even if an item is also Planned somehow", () => {
  // Should never happen through the UI, but the rule must hold regardless of
  // how an item got into this state - archived always means archived.
  const archived = item({ status: "Planned", bucket: "Today", archived: true });
  assert.equal(isArchived(archived), true);
  assert.equal(isWeekItem(archived), false, "an archived item must not still show up in the week");
});

test("an idea shows only in the Idea Log, regardless of status or bucket", () => {
  const idea = item({ type: "idea", status: "Planned", bucket: "Today" });
  assert.equal(isIdea(idea), true);
  assert.equal(isUnresolved(idea), false, "an idea must not also clutter the inbox");
  assert.equal(isWeekItem(idea), false, "an idea must not also show up in the week");
});

test("archiving wins even over an idea", () => {
  const both = item({ type: "idea", archived: true });
  assert.equal(isArchived(both), true);
  assert.equal(isIdea(both), false, "an archived item belongs only in the Archive");
});

test("no item in any valid state is unreachable, and none appears on two surfaces at once", () => {
  const buckets = [undefined, "Today", "This Week", "Later"] as const;
  const statuses = ["Inbox", "Planned"] as const;
  const archivedFlags = [false, true] as const;
  const types = [undefined, "task", "idea"] as const;
  for (const status of statuses) {
    for (const bucket of buckets) {
      for (const archived of archivedFlags) {
        for (const type of types) {
          const i = item({ status, bucket, archived, type });
          const label = `status=${status} bucket=${bucket} archived=${archived} type=${type}`;
          assert.equal(reachable(i), true, `unreachable: ${label}`);
          assert.equal(surfaceCount(i), 1, `shown on ${surfaceCount(i)} surfaces, expected exactly 1: ${label}`);
        }
      }
    }
  }
});

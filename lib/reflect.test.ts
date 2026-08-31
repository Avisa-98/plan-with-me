import { test } from "node:test";
import assert from "node:assert/strict";
import type { Item } from "./storage.ts";
import { isDoneToday, rankReplacementCandidates } from "./reflect.ts";

function item(over: Partial<Item> = {}): Item {
  const now = new Date().toISOString();
  return { id: "1", text: "t", status: "Unprocessed", createdAt: now, updatedAt: now, ...over };
}

test("an item marked done today counts as done today", () => {
  const now = new Date("2026-08-31T14:00:00.000Z");
  const done = item({ done: true, updatedAt: "2026-08-31T09:00:00.000Z" });
  assert.equal(isDoneToday(done, now), true);
});

test("an item marked done on a different day does not count as done today", () => {
  const now = new Date("2026-08-31T14:00:00.000Z");
  const done = item({ done: true, updatedAt: "2026-08-29T09:00:00.000Z" });
  assert.equal(isDoneToday(done, now), false);
});

test("an item that is not done does not count as done today, however recently touched", () => {
  const now = new Date("2026-08-31T14:00:00.000Z");
  const notDone = item({ done: false, updatedAt: "2026-08-31T13:59:00.000Z" });
  assert.equal(isDoneToday(notDone, now), false);
});

test("replacement candidates exclude the item itself, done items, archived items, and items with no estimate", () => {
  const original = item({ id: "orig", estimateMinutes: 60 });
  const pool = [
    original,
    item({ id: "no-estimate" }),
    item({ id: "done", estimateMinutes: 30, done: true }),
    item({ id: "archived", estimateMinutes: 30, archived: true }),
    item({ id: "keeper-a", estimateMinutes: 30 }),
    item({ id: "keeper-b", estimateMinutes: 90 }),
  ];
  const ranked = rankReplacementCandidates(original, pool);
  assert.deepEqual(ranked.map((r) => r.item.id), ["keeper-a", "keeper-b"]);
});

test("candidates that fit in the same time or less come before ones that take longer", () => {
  const original = item({ id: "orig", estimateMinutes: 60 });
  const pool = [
    item({ id: "much-longer", estimateMinutes: 180 }),
    item({ id: "fits", estimateMinutes: 45 }),
    item({ id: "exact-fit", estimateMinutes: 60 }),
    item({ id: "slightly-longer", estimateMinutes: 75 }),
  ];
  const ranked = rankReplacementCandidates(original, pool);
  assert.deepEqual(ranked.map((r) => r.item.id), ["fits", "exact-fit", "slightly-longer", "much-longer"]);
});

test("each candidate is flagged as longer only when it actually takes more time than the original", () => {
  const original = item({ id: "orig", estimateMinutes: 60 });
  const pool = [item({ id: "fits", estimateMinutes: 45 }), item({ id: "longer", estimateMinutes: 90 })];
  const ranked = rankReplacementCandidates(original, pool);
  assert.equal(ranked.find((r) => r.item.id === "fits")?.longer, false);
  assert.equal(ranked.find((r) => r.item.id === "longer")?.longer, true);
});

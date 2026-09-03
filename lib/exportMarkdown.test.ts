import { test } from "node:test";
import assert from "node:assert/strict";
import type { StoredData, Item } from "./storage.ts";
import { exportMarkdown } from "./exportMarkdown.ts";

function item(over: Partial<Item> = {}): Item {
  const now = new Date().toISOString();
  return { id: Math.random().toString(36).slice(2), text: "t", status: "Inbox", createdAt: now, updatedAt: now, ...over };
}

function data(items: Item[] = []): StoredData {
  return { deviceKey: "d", items, targets: {} };
}

test("an idea appears as a plain bullet under Idea Log", () => {
  const md = exportMarkdown(data([item({ text: "learn pottery", type: "idea" })]));
  assert.match(md, /## Idea Log/);
  assert.match(md, /- learn pottery/);
});

test("a done task shows a checked box, an open task an unchecked one", () => {
  const md = exportMarkdown(data([
    item({ text: "call the bank", status: "Planned", bucket: "Today", done: true }),
    item({ text: "buy milk", status: "Planned", bucket: "Today", done: false }),
  ]));
  assert.match(md, /- \[x\] call the bank/);
  assert.match(md, /- \[ \] buy milk/);
});

test("category, estimate, and due date are annotated inline when present", () => {
  const md = exportMarkdown(data([
    item({ text: "zoom w/ client", status: "Planned", bucket: "Today", category: "Work", estimateMinutes: 90, dueDate: "2026-09-05" }),
  ]));
  assert.match(md, /- \[ \] zoom w\/ client \(Work · 1h 30m · due 2026-09-05\)/);
});

test("a task with no category, estimate, or due date shows with no parentheses at all", () => {
  const md = exportMarkdown(data([item({ text: "bare task", status: "Planned", bucket: "Today" })]));
  assert.match(md, /- \[ \] bare task\n/);
  assert.doesNotMatch(md, /bare task \(/);
});

test("Today, This Week, This Month, and Later each get their own heading with only their own items", () => {
  const md = exportMarkdown(data([
    item({ text: "today item", status: "Planned", bucket: "Today" }),
    item({ text: "week item", status: "Planned", bucket: "This Week" }),
    item({ text: "month item", status: "Planned", bucket: "This Month" }),
    item({ text: "later item", status: "Planned", bucket: "Later" }),
  ]));
  assert.match(md, /## Today[\s\S]*today item/);
  assert.match(md, /## This Week[\s\S]*week item/);
  assert.match(md, /## This Month[\s\S]*month item/);
  assert.match(md, /## Later[\s\S]*later item/);
});

test("an unorganized note appears under Inbox", () => {
  const md = exportMarkdown(data([item({ text: "raw thought" })]));
  assert.match(md, /## Inbox[\s\S]*- raw thought/);
});

test("an empty section produces no heading at all - no blank ## Later with nothing under it", () => {
  const md = exportMarkdown(data([item({ text: "only in today", status: "Planned", bucket: "Today" })]));
  assert.doesNotMatch(md, /## Later/);
  assert.doesNotMatch(md, /## This Week/);
  assert.doesNotMatch(md, /## Idea Log/);
});

test("completely empty data produces a readable file, not a crash or a blank string", () => {
  const md = exportMarkdown(data());
  assert.equal(typeof md, "string");
  assert.ok(md.length > 0);
  assert.match(md, /Bunko/);
});

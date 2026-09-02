import { test } from "node:test";
import assert from "node:assert/strict";
import type { Item, Project } from "./storage.ts";
import { subtasksOf, subtaskTotalMinutes, sortProjectsDoneLast, effectiveCategory } from "./projects.ts";

function item(over: Partial<Item> = {}): Item {
  const now = new Date().toISOString();
  return { id: "1", text: "t", status: "Inbox", createdAt: now, updatedAt: now, ...over };
}

function project(over: Partial<Project> = {}): Project {
  const now = new Date().toISOString();
  return { id: "p1", name: "Project", done: false, createdAt: now, updatedAt: now, ...over };
}

test("subtasksOf returns only items pointing at that project", () => {
  const a = item({ id: "a", projectId: "p1" });
  const b = item({ id: "b", projectId: "p2" });
  const c = item({ id: "c", projectId: "p1" });
  assert.deepEqual(subtasksOf("p1", [a, b, c]).map((i) => i.id), ["a", "c"]);
});

test("subtaskTotalMinutes sums estimates across all subtasks, done or not", () => {
  const items = [
    item({ id: "a", projectId: "p1", estimateMinutes: 60 }),
    item({ id: "b", projectId: "p1", estimateMinutes: 30, done: true }),
    item({ id: "c", projectId: "p2", estimateMinutes: 999 }), // different project - excluded
  ];
  assert.equal(subtaskTotalMinutes("p1", items), 90);
});

test("subtaskTotalMinutes treats a subtask with no estimate as zero, not a crash", () => {
  const items = [item({ id: "a", projectId: "p1" }), item({ id: "b", projectId: "p1", estimateMinutes: 20 })];
  assert.equal(subtaskTotalMinutes("p1", items), 20);
});

test("subtaskTotalMinutes is zero for a project with no subtasks", () => {
  assert.equal(subtaskTotalMinutes("empty-project", []), 0);
});

test("sortProjectsDoneLast keeps not-done projects ahead of done ones, each group in order", () => {
  const a = project({ id: "a", done: false });
  const b = project({ id: "b", done: true });
  const c = project({ id: "c", done: false });
  const d = project({ id: "d", done: true });
  const sorted = sortProjectsDoneLast([b, a, d, c]);
  assert.deepEqual(sorted.map((p) => p.id), ["a", "c", "b", "d"]);
});

test("effectiveCategory returns a standalone item's own category when it has no project", () => {
  const solo = item({ category: "Work" });
  assert.equal(effectiveCategory(solo, []), "Work");
});

test("effectiveCategory ignores a subtask's own category field and uses its project's instead", () => {
  const proj = project({ id: "p1", category: "Personal" });
  // Stale category left over from before this item had a project - must be
  // ignored, never shown or counted.
  const subtask = item({ projectId: "p1", category: "Work" });
  assert.equal(effectiveCategory(subtask, [proj]), "Personal");
});

test("effectiveCategory is undefined when the project itself has no category set yet", () => {
  const proj = project({ id: "p1" });
  const subtask = item({ projectId: "p1" });
  assert.equal(effectiveCategory(subtask, [proj]), undefined);
});

test("effectiveCategory is undefined if the item's project can't be found", () => {
  const subtask = item({ projectId: "missing-project" });
  assert.equal(effectiveCategory(subtask, []), undefined);
});

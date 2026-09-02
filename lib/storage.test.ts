import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { loadData, emptyData, saveData, exportData, parseImport } from "./storage.ts";

// Minimal localStorage stand-in so the real adapter can run outside a browser.
// A plain static import above is safe here: loadData/saveData only touch
// `window` when a test actually calls them, not at import time - so this
// mock only needs to exist before the test bodies run, which it does.
const store = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  },
};

beforeEach(() => store.clear());

test("targets survive a save/reload round trip", () => {
  const data = { ...emptyData(), targets: { Work: 20, Health: 5 } };
  saveData(data);
  assert.deepEqual(loadData().targets, { Work: 20, Health: 5 });
});

test("items and reflections survive a save/reload round trip", () => {
  const now = new Date().toISOString();
  const data = {
    ...emptyData(),
    items: [{ id: "a", text: "call the bank", status: "Planned" as const, bucket: "Later" as const, createdAt: now, updatedAt: now }],
    reflections: [{ id: "r", type: "daily" as const, text: "good day", createdAt: now }],
  };
  saveData(data);
  const back = loadData();
  assert.equal(back.items[0].text, "call the bank");
  assert.equal(back.items[0].bucket, "Later");
  assert.equal(back.reflections[0].text, "good day");
});

test("the device key is stable across reloads", () => {
  const data = emptyData();
  saveData(data);
  assert.equal(loadData().deviceKey, data.deviceKey);
});

test("corrupt storage falls back to empty data instead of crashing", () => {
  store.set("plan-with-me:v1", "{ not json");
  const back = loadData();
  assert.deepEqual(back.items, []);
  assert.ok(back.deviceKey);
});

test("exportData produces JSON that parseImport reads back exactly", () => {
  const now = new Date().toISOString();
  const data = {
    deviceKey: "device-1",
    items: [{ id: "a", text: "call the bank", status: "Inbox" as const, createdAt: now, updatedAt: now }],
    reflections: [],
    targets: { Work: 10 },
    projects: [],
  };
  assert.deepEqual(parseImport(exportData(data)), data);
});

// "Unprocessed" was the status value before this screen was renamed to
// Inbox. Anyone with data saved before the rename has that old string
// sitting in their browser - it must come back as "Inbox", not as a status
// the current app no longer recognizes.
test("loadData migrates a legacy 'Unprocessed' status to 'Inbox'", () => {
  const now = new Date().toISOString();
  store.set("plan-with-me:v1", JSON.stringify({
    deviceKey: "device-3",
    items: [{ id: "a", text: "old item", status: "Unprocessed", createdAt: now, updatedAt: now }],
    reflections: [],
    targets: {},
  }));
  assert.equal(loadData().items[0].status, "Inbox");
});

test("parseImport migrates a legacy 'Unprocessed' status in an imported backup file too", () => {
  const now = new Date().toISOString();
  const raw = JSON.stringify({
    deviceKey: "device-4",
    items: [{ id: "a", text: "old item", status: "Unprocessed", createdAt: now, updatedAt: now }],
    reflections: [],
    targets: {},
  });
  assert.equal(parseImport(raw)?.items[0].status, "Inbox");
});

// "Entertainment" was the category name before this rename too. Anyone with
// an item already filed under it, or a weekly target set for it, must see
// "Personal" after the rename, not have that item or target vanish.
test("loadData migrates a legacy 'Entertainment' category on an item to 'Personal'", () => {
  const now = new Date().toISOString();
  store.set("plan-with-me:v1", JSON.stringify({
    deviceKey: "device-6",
    items: [{ id: "a", text: "watch a film", status: "Planned", bucket: "Today", category: "Entertainment", createdAt: now, updatedAt: now }],
    reflections: [],
    targets: {},
  }));
  assert.equal(loadData().items[0].category, "Personal");
});

test("loadData migrates a legacy 'Entertainment' weekly target to 'Personal', keeping the number", () => {
  store.set("plan-with-me:v1", JSON.stringify({
    deviceKey: "device-7",
    items: [],
    reflections: [],
    targets: { Work: 20, Entertainment: 6 },
  }));
  const targets = loadData().targets;
  assert.equal(targets.Personal, 6);
  assert.equal(targets.Work, 20);
  assert.equal("Entertainment" in targets, false);
});

test("parseImport migrates a legacy 'Entertainment' category and target too", () => {
  const now = new Date().toISOString();
  const raw = JSON.stringify({
    deviceKey: "device-8",
    items: [{ id: "a", text: "watch a film", status: "Planned", bucket: "Today", category: "Entertainment", createdAt: now, updatedAt: now }],
    reflections: [],
    targets: { Entertainment: 6 },
  });
  const back = parseImport(raw);
  assert.equal(back?.items[0].category, "Personal");
  assert.equal(back?.targets.Personal, 6);
});

test("migration leaves a Work category and target untouched", () => {
  const now = new Date().toISOString();
  store.set("plan-with-me:v1", JSON.stringify({
    deviceKey: "device-9",
    items: [{ id: "a", text: "write proposal", status: "Planned", bucket: "Today", category: "Work", createdAt: now, updatedAt: now }],
    reflections: [],
    targets: { Work: 10 },
  }));
  const back = loadData();
  assert.equal(back.items[0].category, "Work");
  assert.equal(back.targets.Work, 10);
});

// Projects used to be a free-text field on the item ("project: 'MIS
// Rollout'") before they became real entities you create and attach tasks
// to. Anything saved with that old text field must turn into a real project
// on the way in, not silently lose the grouping.
test("loadData turns a legacy free-text project into a real project entity", () => {
  const now = new Date().toISOString();
  store.set("plan-with-me:v1", JSON.stringify({
    deviceKey: "device-10",
    items: [{ id: "a", text: "draft the SOW", status: "Planned", bucket: "Today", project: "MIS Rollout", createdAt: now, updatedAt: now }],
    reflections: [],
    targets: {},
  }));
  const back = loadData();
  assert.equal(back.projects.length, 1);
  assert.equal(back.projects[0].name, "MIS Rollout");
  assert.equal(back.items[0].projectId, back.projects[0].id);
  assert.equal("project" in back.items[0], false, "the old text field should not linger on the migrated item");
});

test("two items with the same legacy project name are grouped into one project, not two", () => {
  const now = new Date().toISOString();
  store.set("plan-with-me:v1", JSON.stringify({
    deviceKey: "device-11",
    items: [
      { id: "a", text: "draft the SOW", status: "Planned", bucket: "Today", project: "MIS Rollout", createdAt: now, updatedAt: now },
      { id: "b", text: "book the kickoff call", status: "Planned", bucket: "Today", project: "MIS Rollout", createdAt: now, updatedAt: now },
    ],
    reflections: [],
    targets: {},
  }));
  const back = loadData();
  assert.equal(back.projects.length, 1);
  assert.equal(back.items[0].projectId, back.items[1].projectId);
});

test("items with different legacy project names get separate projects", () => {
  const now = new Date().toISOString();
  store.set("plan-with-me:v1", JSON.stringify({
    deviceKey: "device-12",
    items: [
      { id: "a", text: "draft the SOW", status: "Planned", project: "MIS Rollout", createdAt: now, updatedAt: now },
      { id: "b", text: "book flights", status: "Planned", project: "Trip planning", createdAt: now, updatedAt: now },
    ],
    reflections: [],
    targets: {},
  }));
  const back = loadData();
  assert.equal(back.projects.length, 2);
  assert.notEqual(back.items[0].projectId, back.items[1].projectId);
});

test("an item with no legacy project field is left without a projectId", () => {
  const now = new Date().toISOString();
  store.set("plan-with-me:v1", JSON.stringify({
    deviceKey: "device-13",
    items: [{ id: "a", text: "no project here", status: "Inbox", createdAt: now, updatedAt: now }],
    reflections: [],
    targets: {},
  }));
  const back = loadData();
  assert.equal(back.items[0].projectId, undefined);
  assert.equal(back.projects.length, 0);
});

test("an item that already has a projectId is not migrated again", () => {
  const now = new Date().toISOString();
  store.set("plan-with-me:v1", JSON.stringify({
    deviceKey: "device-14",
    items: [{ id: "a", text: "already grouped", status: "Planned", project: "Should be ignored", projectId: "existing-project", createdAt: now, updatedAt: now }],
    reflections: [],
    targets: {},
    projects: [{ id: "existing-project", name: "Real project", done: false, createdAt: now, updatedAt: now }],
  }));
  const back = loadData();
  assert.equal(back.items[0].projectId, "existing-project");
  assert.equal(back.projects.length, 1);
});

test("migration leaves a Planned item's status untouched", () => {
  const now = new Date().toISOString();
  store.set("plan-with-me:v1", JSON.stringify({
    deviceKey: "device-5",
    items: [{ id: "a", text: "committed item", status: "Planned", bucket: "Today", createdAt: now, updatedAt: now }],
    reflections: [],
    targets: {},
  }));
  const item = loadData().items[0];
  assert.equal(item.status, "Planned");
  assert.equal(item.bucket, "Today");
});

test("parseImport rejects text that isn't valid JSON", () => {
  assert.equal(parseImport("not json at all"), null);
});

test("parseImport rejects JSON with no items array - not a backup file", () => {
  assert.equal(parseImport(JSON.stringify({ foo: "bar" })), null);
});

test("parseImport fills in any missing fields with defaults, but keeps the file's own device key", () => {
  const back = parseImport(JSON.stringify({ items: [], deviceKey: "device-2" }));
  assert.deepEqual(back?.reflections, []);
  assert.deepEqual(back?.targets, {});
  assert.equal(back?.deviceKey, "device-2");
});

test("migrate maps old categories onto the new three-category set, for items and projects", () => {
  const now = new Date().toISOString();
  const raw = {
    deviceKey: "d",
    items: [
      { id: "1", text: "a", status: "Inbox", category: "Family", createdAt: now, updatedAt: now },
      { id: "2", text: "b", status: "Inbox", category: "Friends", createdAt: now, updatedAt: now },
      { id: "3", text: "c", status: "Inbox", category: "Health", createdAt: now, updatedAt: now },
      { id: "4", text: "d", status: "Inbox", category: "Work", createdAt: now, updatedAt: now },
    ],
    reflections: [],
    targets: {},
    projects: [{ id: "p1", name: "P", category: "Friends", done: false, createdAt: now, updatedAt: now }],
  };
  const result = parseImport(JSON.stringify(raw));
  assert.equal(result?.items.find((i) => i.id === "1")?.category, "Social");
  assert.equal(result?.items.find((i) => i.id === "2")?.category, "Social");
  assert.equal(result?.items.find((i) => i.id === "3")?.category, "Personal");
  assert.equal(result?.items.find((i) => i.id === "4")?.category, "Work");
  assert.equal(result?.projects.find((p) => p.id === "p1")?.category, "Social");
});

test("migrate leaves This Month and Later buckets untouched, and This Month is a valid new bucket", () => {
  const now = new Date().toISOString();
  const raw = {
    deviceKey: "d",
    items: [{ id: "1", text: "a", status: "Planned", bucket: "This Month", createdAt: now, updatedAt: now }],
    reflections: [],
    targets: {},
    projects: [],
  };
  const result = parseImport(JSON.stringify(raw));
  assert.equal(result?.items[0].bucket, "This Month");
});

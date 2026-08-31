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

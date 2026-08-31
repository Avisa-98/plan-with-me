import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Minimal localStorage stand-in so the real adapter can run outside a browser.
const store = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  },
};

const { loadData, emptyData, saveData } = await import("./storage.ts");

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

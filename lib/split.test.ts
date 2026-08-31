import { test } from "node:test";
import assert from "node:assert/strict";
import { segmentText, joinSelected } from "./split.ts";

test("splits on commas, semicolons, and sentence punctuation", () => {
  const segments = segmentText("plan bday party for mom, zoom w/ client thursday.");
  assert.deepEqual(segments.map((s) => s.text), ["plan bday party for mom", "zoom w/ client thursday"]);
});

test("splits on line breaks too", () => {
  const segments = segmentText("buy cable\nemail landlord");
  assert.deepEqual(segments.map((s) => s.text), ["buy cable", "email landlord"]);
});

test("collapses runs of punctuation and drops empty pieces", () => {
  const segments = segmentText("call mom,, , buy cable...");
  assert.deepEqual(segments.map((s) => s.text), ["call mom", "buy cable"]);
});

test("text with no separators at all is a single segment", () => {
  const segments = segmentText("call mom buy cable email landlord");
  assert.deepEqual(segments.map((s) => s.text), ["call mom buy cable email landlord"]);
});

test("each segment's start/end are real offsets into the original text", () => {
  const text = "call mom, buy cable";
  const segments = segmentText(text);
  for (const s of segments) {
    assert.equal(text.slice(s.start, s.end), s.text);
  }
});

test("joinSelected combines chosen segments in document order regardless of click order", () => {
  const segments = segmentText("buy her a cake, order flowers too, and book the hall");
  // Simulate clicking segment 2 first, then segment 0 - order of clicks must not matter.
  const joined = joinSelected(segments, new Set([2, 0]));
  assert.equal(joined, "buy her a cake and book the hall");
});

test("joinSelected with one id returns just that segment's text", () => {
  const segments = segmentText("buy cable, email landlord");
  assert.equal(joinSelected(segments, new Set([1])), "email landlord");
});

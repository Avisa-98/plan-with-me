# Plan With Me v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a phone-first, no-login planning app that captures thoughts into an Unprocessed inbox and turns selected items into a draft weekly plan.

**Architecture:** A Next.js App Router frontend hosted on Vercel uses a small, versioned browser-storage adapter for anonymous same-device persistence. The adapter boundary leaves room for Convex when server storage, metrics, or cross-device access become necessary. No paid AI or external integrations are used in v1.

**Tech Stack:** Next.js, React, TypeScript, browser storage, CSS, Vercel, GitHub. Convex is deferred until it is needed.

**Spec:** `IDEA_SCOPE.md`, especially “Clarified product scope — 31 August”.

## Global Constraints

- No account, password, WhatsApp, voice, photo/OCR, paid AI, calendar, email, or source imports in v1.
- The user makes category, estimate, priority, and trade-off decisions.
- Capture must be immediate; missing fields stay blank and do not block capture.
- The live flow must work on a phone without an explanation.
- Keep the visual design calm, compact, and recognizably derived from a paper planning ritual.

---

### Task 1: Scaffold the web app

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

- [ ] Create the Next.js app shell with a single client page and mobile-first CSS tokens.
- [ ] Add the Vercel-compatible build and dev scripts.
- [ ] Render a static shell with navigation for Capture, Unprocessed, This Week, and Reflections.
- [ ] Run the build and confirm the shell loads.

### Task 2: Add anonymous Convex persistence

**Files:**
- Create: `convex/schema.ts`, `convex/items.ts`, `convex/reflections.ts`
- Modify: `app/page.tsx`

- [ ] Define item fields: anonymous device key, text, status, bucket, category, estimate minutes, effort, due date, event start/end, project ID, actual minutes, timestamps.
- [ ] Define reflection fields: device key, type, text, submitted time.
- [ ] Add mutations for capture, update organization, mark complete, delete all device data, and save reflection.
- [ ] Add queries for Unprocessed, This Week, and weekly time totals.
- [ ] Persist a random device key in versioned browser storage and pass it to every Convex call.
- [ ] Run Convex type generation and verify queries/mutations compile.

### Task 3: Build immediate capture and Unprocessed inbox

**Files:**
- Create: `components/CaptureForm.tsx`, `components/UnprocessedList.tsx`
- Modify: `app/page.tsx`, `app/globals.css`

- [ ] Add the concise-writing hint and a single text input with an Add button.
- [ ] Save immediately to Unprocessed and clear the form after success.
- [ ] Warn before saving an identical note twice; allow cancel or keep.
- [ ] Show empty, loading, error, and saved states.
- [ ] Let the user open any Unprocessed item for organization.

### Task 4: Build organization and project/event fields

**Files:**
- Create: `components/OrganizePanel.tsx`, `components/Field.tsx`
- Modify: `app/page.tsx`, `convex/items.ts`, `app/globals.css`

- [ ] Add category buttons for Work, Family, Friends, Health, and Entertainment with no automatic suggestion.
- [ ] Add optional estimate hours/minutes, effort, due date, event start/end, and project name/link fields.
- [ ] Keep blank fields blank and allow save without forcing a decision.
- [ ] Move an item into the planning pipeline only when Atul taps Commit.
- [ ] Add edit, cancel, delete, and duplicate-warning states.

### Task 5: Build weekly draft and reflections

**Files:**
- Create: `components/WeekView.tsx`, `components/ReflectionPanel.tsx`, `lib/schedule.ts`
- Modify: `app/page.tsx`, `convex/items.ts`, `convex/reflections.ts`, `app/globals.css`

- [ ] Sum This Week estimates and display them by category and overall.
- [ ] Place fixed events first, then dated and committed items, into a draft week.
- [ ] Show conflicts without deciding which item to remove.
- [ ] Let Atul choose drop, defer, replace, or reprioritize and preview the resulting split.
- [ ] Add end-of-day prompts: Done, Carry forward, Drop or replace, plus free text.
- [ ] Add end-of-week prompts: What went well?, What stayed unfinished?, What should change next week?, What are next week’s priorities?
- [ ] Add actual-time entry when marking an item done.

### Task 6: Polish, verify, and deploy

**Files:**
- Modify: `app/globals.css`, `app/layout.tsx`, `README.md`

- [ ] Verify keyboard focus, 44px touch targets, reduced motion, and phone layout.
- [ ] Verify no-login reload behavior on the same browser.
- [ ] Test empty input, duplicate input, missing fields, failed save, delete data, and conflicting schedule states.
- [ ] Run the production build.
- [ ] Push the public repository and deploy to Vercel.
- [ ] Test the live URL on a phone and record the link and observed numbers.

## V2 note

The AI parsing layer is intentionally deferred: one explicit, batched parse call per brain dump, no automatic reprocessing, no AI category or priority decisions, and summaries computed from stored data. Track it in `Life_Management_Platform_Scope.md`.

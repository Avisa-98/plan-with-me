# V1 Flow Redesign — Design Spec

Date: 2026-09-02

## Problem

The app currently has too many top-level tabs (Today, Capture, Split, Week,
Month, Reflection) and each item asks for too many typed decisions before it
can be saved. The result: too much jumping between screens, too much
scrolling, too much typing. The core promise of the app — capture fast,
organize fast during a short daily window, reflect more slowly later — gets
lost in the navigation.

This redesign strips the app down to its essential loop: **Capture, Review,
Commit, Reflect** — borrowing the two-step "capture → review → schedule"
shape from Google Tasks-style inboxes and the "carry forward / reflect on a
cadence" shape from the bullet journal method, combined into one
streamlined flow.

Everything here is V1 polish — no AI, no voice input, no animations. Those
are explicitly deferred to V2/V3 (see Non-goals).

## Goals

- Cut the app down to **two tabs**: Plan and Overview.
- Make organizing a batch of captured items fast: select from chips, don't
  type.
- Reduce categories from 5 to 3, matching "the three areas of your life."
- Make picking a rough date effortless and *optional* — a bucket alone is a
  valid, complete decision.
- Every item, everywhere it's shown, can be checked off inline.
- Nothing in the UI without a purpose — remove decorative/nonfunctional
  elements.

## Non-goals (deferred)

- AI-assisted splitting/suggestions, daily briefing — already built,
  currently on hold, will plug into this new Plan-page flow later, not
  part of this redesign.
- Voice input, "personal assistant" behavior — V2/V3.
- Habit tracker (Atomic Habits-style) — V3.
- An animated/state-aware "Capture · Review · Commit · Reflect" strap line
  that highlights the current step — good idea, revisit in V2. For now it's
  static text.

## Information architecture

Two tabs, replacing today's six:

1. **Plan** — pure doing. This is the 2–3 minute daily window.
   - A capture box (braindump, unchanged from today).
   - Below it, every item still in Inbox/uncommitted status, shown as an
     **organize list**: multiple items visible and editable at once, each
     with quick chips. No auto-advance/one-at-a-time card flow — the user
     asked to see items side by side so they can plan one against another.
   - Inline split: breaking one braindump line into several items happens
     right here, in the list, not on a separate screen.
2. **Overview** — pure seeing/reflecting. One page; a small segmented
   toggle at the top switches between five views, in this order:
   **Today · Week · Month · Projects · Reflect**. Defaults to Today.
   - Every view shows a checkbox per item. Checking it strikes the item
     through and drops it into a "done" list at the bottom of that same
     view (this pattern already exists for Today/Reflect; it needs to
     extend to Week/Month/Projects too).
   - "Saved for later" is a section/dropdown reachable from any view here,
     listing every item with bucket = Later (see below).
   - Reflect keeps its existing mechanics (dropdowns instead of free text,
     auto-populated Done) exactly as built — it just moves under this
     toggle instead of being its own tab.

A small static strap line sits at the top of the app (both tabs):
**"Capture · Review · Commit · Reflect"** — a constant reminder of the
cycle. Plain text, not interactive, not state-aware, for V1.

## The organize list (Plan page)

Each item in the list gets, as tap-to-select chips (no typing):

- **Type**: Task / Idea. Idea skips everything below (existing rule,
  unchanged).
- **Category**: Work / Social / Personal (see Data model changes).
- **Bucket + date**, combined into one control — four buttons:
  - **Today** — no further date needed.
  - **This Week** — optionally tap a day of the current week. Skippable.
  - **This Month** — optionally tap a day off a mini calendar of the
    current month (no need to also pick the month — "this month" already
    told us that). Skippable.
  - **Later** — for anything beyond this month. Optionally pick a
    month, then a day within a grid for that month (not restricted to the
    current month). Fully skippable — a Later item can carry no date at
    all, and that's a normal, expected state, not an error state.
- **Estimate**: unchanged from today (quick number/preset).
- **Project**: hidden behind a "more" affordance. Tapping it offers
  "add to an existing project" (pick from a list) or "create a new project"
  (name it, optionally give it a category) and assigns the item to it in
  the same step.

Committing an item (leaving the organize list) does not require a bucket —
type + category alone is enough to commit. An item with no bucket picked
still moves out of Plan and shows up in Overview under "Saved for later"
alongside dated Later items, so nothing gets stuck in Plan forever.

## Stale "Later" items

At the end of each month, surface a nudge (on the Month view, or folded
into the monthly Reflect flow — implementation detail, decide during
planning) calling out Later items that still have no date, so they don't
get silently forgotten. This is a passive callout, not a blocking modal.

## Data model changes

- `Category`: `"Work" | "Family" | "Friends" | "Health" | "Personal"` →
  `"Work" | "Social" | "Personal"`.
  - One-time migration on load: `Family` → `Social`, `Friends` → `Social`,
    `Health` → `Personal`. Applies to both `Item.category` and
    `Project.category`. Runs alongside the existing
    `statusAndCategoryFixed`-style normalization already in
    `lib/storage.ts`, so it's a data-load-time fixup, not a one-off script.
- `Bucket`: `"Today" | "This Week" | "Later"` →
  `"Today" | "This Week" | "This Month" | "Later"`.
  - No migration needed for existing `"Today"` / `"This Week"` / `"Later"`
    values — they're still valid buckets. `"This Month"` is simply a new
    option going forward.
- No changes to `ItemType`, `ItemStatus`, or the idea-skips-schedule rule.

## What gets removed

- The Today / Capture / Split / Week / Month / Reflection six-tab nav.
- Any nonfunctional/decorative UI elements uncovered while rebuilding these
  screens (evaluate case by case during implementation — the standing rule
  is "everything has to have a purpose").
- The Split screen as a standalone destination (its function moves inline
  into the Plan page's organize list).

## Open implementation details (for the planning phase, not blocking design approval)

- Exact placement of the end-of-month stale-Later nudge (Month view vs.
  Reflect).
- Exact interaction for the "create new project" mini-flow inside the
  project "more" affordance.
- Whether Week/Month/Projects views need their own "done" list styling or
  can reuse the existing Today/Reflect done-list pattern as-is.

# V1 Flow Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the app's four-tab nav (Today / Inbox / This week / Reflections) into two: **Plan** (capture + fast chip-based organizing) and **Overview** (Today/Week/Month/Projects/Reflect, all checkbox-driven) — with categories cut to three and a new optional-date bucket picker — and give desktop a single all-in-one dashboard instead of tabs.

**Architecture:** Extract the reusable pieces currently duplicated or buried inside `app/page.tsx` (`ItemRow`, `formatMinutes`, date-grid math) into small focused modules, add two new pure-logic helpers to `lib/schedule.ts` for date-grid generation, build the new chip-based date/bucket picker and project quick-assign as standalone components, then assemble `PlanPage` and `OverviewPage` from those pieces and wire them into a slimmed-down `app/page.tsx` that switches between mobile tabs and a desktop dashboard via a viewport hook.

**Tech Stack:** Next.js 14.2.5 App Router, React (client component), TypeScript, `node --test` for `lib/*.test.ts`, no component-testing framework (UI is verified via `npx tsc --noEmit`, `npm run build`, and manual dev-server checks — this matches how every UI change in this codebase has been verified so far).

**Spec:** `docs/superpowers/specs/2026-09-02-v1-flow-redesign-design.md`

## Global Constraints

- Categories become exactly `"Work" | "Social" | "Personal"`. Existing data: `Family`→`Social`, `Friends`→`Social`, `Health`→`Personal`, on both `Item.category` and `Project.category`.
- Bucket gains a fourth value: `"Today" | "This Week" | "This Month" | "Later"`. No migration needed — existing values stay valid.
- A bucket alone is always a complete, valid choice — no date is ever required to commit an item.
- No AI/voice changes, no animation work, no habit tracker — out of scope per the spec's Non-goals.
- `npm test` runs `node --test lib/*.test.ts` — every new pure-logic function needs a test there.
- No component-testing framework exists in this repo — new/changed React components are verified with `npx tsc --noEmit`, `npm run build`, and a manual dev-server pass, not automated component tests.
- Follow existing code style: dense arrow-function components, `className`-driven layout with the existing `globals.css` tokens (`var(--ink)`, `.card`, `.chip`, `.tag`, etc.), inline `style={{}}` only for one-off spacing exactly as the current file does.

---

### Task 1: Data model — three categories, four buckets

**Files:**
- Modify: `lib/storage.ts:1-2` (types), `lib/storage.ts:59-94` (`migrate`)
- Test: `lib/storage.test.ts`

**Interfaces:**
- Produces: `Category = "Work" | "Social" | "Personal"`; `Bucket = "Today" | "This Week" | "This Month" | "Later"`; `migrate()` now also maps `Family`/`Friends`/`Health` category values to `Social`/`Social`/`Personal` on both items and projects.
- Consumes: nothing new.

- [ ] **Step 1: Write the failing tests**

Add to `lib/storage.test.ts` (follow the existing `migrate`-via-`loadData`/`parseImport` test pattern already in that file):

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `category` still comes back as `"Family"`/`"Friends"`/`"Health"` (no mapping exists yet), since `"Social"` isn't even a valid `Category` value yet.

- [ ] **Step 3: Update the types and migration**

In `lib/storage.ts`, replace line 1-2:

```ts
export type Category = "Work" | "Social" | "Personal";
export type Bucket = "Today" | "This Week" | "This Month" | "Later";
```

In `migrate()` (`lib/storage.ts:59-94`), extend the category-fixing logic. Replace the `statusAndCategoryFixed` block (lines 64-69) with:

```ts
  const CATEGORY_MIGRATION: Record<string, Category> = { Family: "Social", Friends: "Social", Health: "Personal" };
  const statusAndCategoryFixed = data.items.map((item) => {
    const fix: Partial<Item> = {};
    if ((item.status as string) === "Unprocessed") fix.status = "Inbox";
    if ((item.category as string) === "Entertainment") fix.category = "Personal";
    if (item.category && (item.category as string) in CATEGORY_MIGRATION) fix.category = CATEGORY_MIGRATION[item.category as string];
    return Object.keys(fix).length ? { ...item, ...fix } : item;
  });
```

And after the `projects` array is built (right after line 77, before it's used by `projectByName`), map the same migration onto project categories:

```ts
  const projects = data.projects.map((project) => {
    if (project.category && (project.category as string) in CATEGORY_MIGRATION) return { ...project, category: CATEGORY_MIGRATION[project.category as string] };
    return project;
  });
```

(This replaces the existing `const projects = [...data.projects];` line — keep everything below it, which still reads from this same `projects` array.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, all tests including the two new ones.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors in `app/page.tsx` and `app/api/smart-split/route.ts` wherever the old 5-value `CATEGORIES`/`categories` array or `Bucket` union is referenced (`app/page.tsx:13`, `app/api/smart-split/route.ts:14`). Leave these failing for now — Task 7 and Task 4 replace those usages. Confirm the *only* errors are in those two known spots, nothing in `lib/`.

- [ ] **Step 6: Commit**

```bash
git add lib/storage.ts lib/storage.test.ts
git commit -m "Reduce categories to Work/Social/Personal, add This Month bucket"
```

---

### Task 2: Fix the smart-split API's category list (keeps the build green)

**Files:**
- Modify: `app/api/smart-split/route.ts:14`

**Interfaces:**
- Consumes: `Category` from Task 1.
- Produces: nothing new — just keeps this file compiling against the new type.

- [ ] **Step 1: Update the category list**

In `app/api/smart-split/route.ts`, change:

```ts
const CATEGORIES: Category[] = ["Work", "Family", "Friends", "Health", "Personal"];
```

to:

```ts
const CATEGORIES: Category[] = ["Work", "Social", "Personal"];
```

- [ ] **Step 2: Typecheck just this file's error is gone**

Run: `npx tsc --noEmit`
Expected: the `app/api/smart-split/route.ts` error from Task 1 Step 5 is gone. `app/page.tsx` errors remain (expected — fixed in Task 7).

- [ ] **Step 3: Commit**

```bash
git add app/api/smart-split/route.ts
git commit -m "Update Smart Split category list to match the new three categories"
```

---

### Task 3: Date-grid helpers — `weekDays` and `monthGridCells`

**Files:**
- Modify: `lib/schedule.ts`
- Test: `lib/schedule.test.ts`

**Interfaces:**
- Produces: `weekDays(start: Date): Date[]` (7 consecutive days starting at `start`); `monthGridCells(month: Date): (Date | null)[]` (Monday-first calendar grid for `month`, `null` for the leading blanks before day 1 — same shape `MonthPlanView` already builds inline at `app/page.tsx:1017-1020`).
- Consumes: `startOfWeek`, `startOfMonth`, `addDays` (all already in `lib/schedule.ts`).

- [ ] **Step 1: Write the failing tests**

Add to `lib/schedule.test.ts`:

```ts
test("weekDays returns 7 consecutive days starting at the given date", () => {
  const start = new Date(2026, 8, 7); // Mon Sep 7 2026
  const days = weekDays(start);
  assert.equal(days.length, 7);
  assert.equal(toDateKey(days[0]), "2026-09-07");
  assert.equal(toDateKey(days[6]), "2026-09-13");
});

test("monthGridCells pads leading blanks so the grid starts on Monday", () => {
  // September 2026 starts on a Tuesday, so exactly 1 leading blank.
  const cells = monthGridCells(new Date(2026, 8, 1));
  assert.equal(cells[0], null);
  assert.equal(cells[1] !== null && toDateKey(cells[1]), "2026-09-01");
  assert.equal(cells.length, 1 + 30); // 1 leading blank + 30 days in September
});

test("monthGridCells has no leading blanks when the 1st is already a Monday", () => {
  // June 2026 starts on a Monday.
  const cells = monthGridCells(new Date(2026, 5, 1));
  assert.equal(cells[0] !== null && toDateKey(cells[0]), "2026-06-01");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL with "weekDays is not defined" / "monthGridCells is not defined".

- [ ] **Step 3: Implement**

Add to `lib/schedule.ts`, after `daysInMonth`:

```ts
export function weekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

// Monday-first calendar grid for a given month: leading `null` cells for the
// days before the 1st that belong to the previous month, then one Date per
// day of the month. Shared by the "This Month" bucket-date picker and the
// Overview Month view, so both render the exact same layout.
export function monthGridCells(month: Date): (Date | null)[] {
  const first = startOfMonth(month);
  const total = daysInMonth(month);
  const leadingBlanks = first.getDay() === 0 ? 6 : first.getDay() - 1;
  return [...Array(leadingBlanks).fill(null), ...Array.from({ length: total }, (_, index) => addDays(first, index))];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/schedule.ts lib/schedule.test.ts
git commit -m "Add weekDays and monthGridCells date-grid helpers"
```

---

### Task 4: Extract shared item-display pieces into `app/components/shared.tsx`

**Files:**
- Create: `app/components/shared.tsx`
- Modify: `app/page.tsx` (remove the extracted definitions, import from the new file instead)

**Interfaces:**
- Produces: `formatMinutes(minutes?: number): string`, `estimateTag(minutes?: number): string`, `ItemRow` (same props as today, but the "Mark done" ghost button becomes a real `<input type="checkbox">` so every list that renders `ItemRow` gets checkbox-to-done for free), `DoneModal` (unchanged, just relocated).
- Consumes: `Item`, `Project` from `lib/storage`; `effectiveCategory` from `lib/projects`.

- [ ] **Step 1: Create the file**

Create `app/components/shared.tsx` with `formatMinutes`, `estimateTag` (copy verbatim from `app/page.tsx:17-29`), and `DoneModal` (copy verbatim from `app/page.tsx:553-569`, adding the needed imports: `useState` from `react`, `Item` from `../../lib/storage`).

Then add `ItemRow`, rewritten so the done-toggle is a real checkbox instead of a ghost button:

```tsx
export function ItemRow({ item, projects, onOpen, action, footer, onDone }: { item: Item; projects: Project[]; onOpen: (item: Item) => void; action: string; footer?: React.ReactNode; onDone?: (item: Item) => void }) {
  const category = effectiveCategory(item, projects);
  return <div className="item-row-wrap">
    <div className={`item-row${item.done ? " item-row-done" : ""}`}>
      {onDone && <input type="checkbox" className="item-checkbox" checked={!!item.done} onChange={() => onDone(item)} aria-label={item.done ? "Mark not done" : "Mark done"} />}
      <div className="item-main">
        <div className="item-text">{item.text}</div>
        <div className="item-meta">
          {item.splitFrom && <span className="tag subtle">↗ from a braindump</span>}
          {category && <span className="tag">{category}</span>}
          {item.bucket && <span className="tag">{item.bucket}</span>}
          {item.estimateMinutes ? <span className="tag accent">{formatMinutes(item.estimateMinutes)}</span> : <span className="tag">Estimate needed</span>}
        </div>
      </div>
      <button className="ghost small-button" onClick={() => onOpen(item)}>{action}</button>
    </div>
    {footer}
  </div>;
}
```

(The `{item.done && <span className="tag accent">Done</span>}` tag is dropped — the strikethrough from `.item-row-done .item-text` plus the checked checkbox already communicate "done"; a redundant tag next to a checked checkbox is exactly the kind of nonfunctional element the spec asks to remove.)

- [ ] **Step 2: Add the checkbox style**

In `app/globals.css`, near `.item-row` (around line 124), add:

```css
.item-checkbox { flex: 0 0 auto; align-self: flex-start; margin-top: 3px; width: 18px; height: 18px; accent-color: var(--ink); }
```

- [ ] **Step 3: Update `app/page.tsx` to import instead of define**

Remove `formatMinutes`, `estimateTag`, `ItemRow`, `DoneModal` from `app/page.tsx` (lines 17-29, 532-535, 553-569) and add to the top import block:

```ts
import { formatMinutes, estimateTag, ItemRow, DoneModal } from "./components/shared";
```

- [ ] **Step 4: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS (this task is a pure extraction plus a markup tweak — no behavior change beyond the checkbox rendering).

- [ ] **Step 5: Manual check**

Run: `npm run dev`, open http://localhost:3000, go to Today (once an item is committed there) and confirm the row now shows a checkbox instead of a "Mark done" button, and checking it strikes the text through.

- [ ] **Step 6: Commit**

```bash
git add app/components/shared.tsx app/page.tsx app/globals.css
git commit -m "Extract ItemRow/formatMinutes/DoneModal into shared.tsx, make done a real checkbox"
```

---

### Task 5: `BucketDateChips` — the combined bucket + optional-date picker

**Files:**
- Create: `app/components/BucketDateChips.tsx`

**Interfaces:**
- Produces: `BucketDateChips({ bucket, dueDate, onChange }: { bucket: Bucket | undefined; dueDate: string | undefined; onChange: (next: { bucket: Bucket | undefined; dueDate: string | undefined }) => void })` — a self-contained control. Picking a bucket button sets that bucket and clears any date from a different bucket's picker; picking a day within the sub-picker sets `dueDate` without changing `bucket`; picking the same bucket again toggles it off (clears both). "Later" additionally offers a month selector before its day grid.
- Consumes: `Bucket` from `lib/storage`; `toDateKey`, `weekDays`, `monthGridCells`, `startOfWeek`, `startOfMonth`, `addDays` from `lib/schedule`.

- [ ] **Step 1: Implement the component**

```tsx
"use client";

import { useState } from "react";
import type { Bucket } from "../../lib/storage";
import { addDays, monthGridCells, startOfMonth, startOfWeek, toDateKey, weekDays } from "../../lib/schedule";

const BUCKETS: Bucket[] = ["Today", "This Week", "This Month", "Later"];

export function BucketDateChips({ bucket, dueDate, onChange }: { bucket: Bucket | undefined; dueDate: string | undefined; onChange: (next: { bucket: Bucket | undefined; dueDate: string | undefined }) => void }) {
  // Later's own month picker starts on the current month and moves
  // independently of any date already picked, so browsing around doesn't
  // require first landing back on today's month.
  const [laterMonth, setLaterMonth] = useState(() => startOfMonth(new Date()));

  function pick(next: Bucket) {
    if (bucket === next) { onChange({ bucket: undefined, dueDate: undefined }); return; }
    onChange({ bucket: next, dueDate: undefined });
  }

  function pickDate(date: Date) {
    onChange({ bucket, dueDate: toDateKey(date) });
  }

  return <div>
    <div className="chips">
      {BUCKETS.map((option) => <button type="button" key={option} className={`chip ${bucket === option ? "selected" : ""}`} onClick={() => pick(option)}>{option}</button>)}
    </div>

    {bucket === "This Week" && <div className="week-grid" style={{ marginTop: 8 }}>
      {weekDays(startOfWeek(new Date())).map((day) => {
        const key = toDateKey(day);
        return <button type="button" key={key} className={`week-day-item ${dueDate === key ? "chunk-pending" : ""}`} onClick={() => pickDate(day)}>{day.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</button>;
      })}
    </div>}

    {bucket === "This Month" && <div className="month-grid" style={{ marginTop: 8 }}>
      {monthGridCells(new Date()).map((cellDate, index) => {
        if (!cellDate) return <div className="month-cell month-cell-blank" key={`blank-${index}`} />;
        const key = toDateKey(cellDate);
        return <button type="button" key={key} className={`month-cell ${dueDate === key ? "chunk-pending" : ""}`} onClick={() => pickDate(cellDate)}><span className="month-cell-num">{cellDate.getDate()}</span></button>;
      })}
    </div>}

    {bucket === "Later" && <div style={{ marginTop: 8 }}>
      <div className="row-footer" style={{ margin: "0 0 8px" }}>
        <button type="button" className="ghost small-button" onClick={() => setLaterMonth(new Date(laterMonth.getFullYear(), laterMonth.getMonth() - 1, 1))}>←</button>
        <span className="hint">{laterMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
        <button type="button" className="ghost small-button" onClick={() => setLaterMonth(new Date(laterMonth.getFullYear(), laterMonth.getMonth() + 1, 1))}>→</button>
      </div>
      <div className="month-grid">
        {monthGridCells(laterMonth).map((cellDate, index) => {
          if (!cellDate) return <div className="month-cell month-cell-blank" key={`blank-${index}`} />;
          const key = toDateKey(cellDate);
          return <button type="button" key={key} className={`month-cell ${dueDate === key ? "chunk-pending" : ""}`} onClick={() => pickDate(cellDate)}><span className="month-cell-num">{cellDate.getDate()}</span></button>;
        })}
      </div>
      <p className="hint" style={{ marginTop: 6 }}>No exact date yet? Leave it on "Later" with no day picked — it'll wait in Saved for Later.</p>
    </div>}
  </div>;
}
```

`addDays` is imported for parity with the rest of the codebase's date-math imports even though this particular file only calls it transitively through `weekDays`/`monthGridCells` — remove the unused import if `tsc` flags it as unused.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS, no errors in the new file (this component isn't imported anywhere yet, so it can't break the build — this step just confirms the file itself is valid).

- [ ] **Step 3: Commit**

```bash
git add app/components/BucketDateChips.tsx
git commit -m "Add BucketDateChips: combined bucket + optional-date quick picker"
```

---

### Task 6: `ProjectQuickAssign` — the hidden project "more" control

**Files:**
- Create: `app/components/ProjectQuickAssign.tsx`

**Interfaces:**
- Produces: `ProjectQuickAssign({ projectId, projects, onChange, onCreate }: { projectId: string | undefined; projects: Project[]; onChange: (projectId: string | undefined) => void; onCreate: (project: Project) => void })` — collapsed by default behind a "+ Project" / "{project name} ▾" toggle button; expanded, shows a project picker plus a "new project" name field.
- Consumes: `Project`, `makeId` from `lib/storage`.

- [ ] **Step 1: Implement the component**

```tsx
"use client";

import { useState } from "react";
import type { Project } from "../../lib/storage";
import { makeId } from "../../lib/storage";

export function ProjectQuickAssign({ projectId, projects, onChange, onCreate }: { projectId: string | undefined; projects: Project[]; onChange: (projectId: string | undefined) => void; onCreate: (project: Project) => void }) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const attached = projects.find((project) => project.id === projectId);

  function createAndAssign() {
    const name = newName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const project: Project = { id: makeId(), name, done: false, createdAt: now, updatedAt: now };
    onCreate(project);
    onChange(project.id);
    setNewName("");
    setOpen(false);
  }

  if (!open) {
    return <button type="button" className="ghost small-button" onClick={() => setOpen(true)}>{attached ? `Project: ${attached.name}` : "+ Project"}</button>;
  }

  return <div className="field" style={{ marginTop: 8 }}>
    <label>Project</label>
    <div style={{ display: "flex", gap: 8 }}>
      <select style={{ flex: 1 }} value={projectId ?? ""} onChange={(event) => onChange(event.target.value || undefined)}>
        <option value="">No project</option>
        {projects.map((project) => <option key={project.id} value={project.id}>{project.name}{project.done ? " (done)" : ""}</option>)}
      </select>
      <button type="button" className="ghost small-button" onClick={() => setOpen(false)}>Done</button>
    </div>
    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
      <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Or create a new project…" style={{ flex: 1 }} onKeyDown={(event) => { if (event.key === "Enter") createAndAssign(); }} />
      <button type="button" className="ghost small-button" onClick={createAndAssign}>Create & assign</button>
    </div>
  </div>;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/components/ProjectQuickAssign.tsx
git commit -m "Add ProjectQuickAssign: hidden project pick/create control"
```

---

### Task 7: `PlanPage` — capture + fast organize list

**Files:**
- Create: `app/components/PlanPage.tsx`
- Modify: `app/page.tsx` (remove `CaptureForm`, `Inbox`, `OrganizableList`, `OrganizePanel`, `SplitPanel` — their jobs move into `PlanPage`; wire `PlanPage` in from `Home()`)

**Interfaces:**
- Produces: `PlanPage({ items, allItems, projects, onCommitItem, onSaveItem, onDeleteItem, onCreateProject, onSplitInline, onArchive }: {...})` rendering the capture textarea plus, below it, one row per Inbox item with: Type toggle (Task/Idea), Category toggle (Work/Social/Personal, hidden when idea), `BucketDateChips` (hidden when idea), an estimate field (hidden when idea), `ProjectQuickAssign` (hidden when idea), and an inline "Split" affordance that expands the existing chunk-tapping UI in place (reusing `segmentText`/`joinSelected` from `lib/split`) rather than opening a separate modal.
- Consumes: `Item`, `ItemType`, `Category`, `Project`, `makeId` from `lib/storage`; `ItemRow` from `./shared`; `BucketDateChips` from `./BucketDateChips`; `ProjectQuickAssign` from `./ProjectQuickAssign`; `segmentText`, `joinSelected` from `lib/split`.

This is the biggest single UI task in the plan — it replaces three existing components (`Inbox`, `OrganizableList`+`OrganizePanel` for the Inbox case, and `SplitPanel`'s manual half) with one row-based editor.

- [ ] **Step 1: Build the capture box**

At the top of the new file, reuse the existing `CaptureForm` JSX verbatim (copy from `app/page.tsx:31-43`) but rename it to a local, non-exported function since it's now only used here:

```tsx
function CaptureBox({ capture, setCapture, onSubmit }: { capture: string; setCapture: (value: string) => void; onSubmit: () => void }) {
  return <section className="card capture-card">
    <div className="card-header"><div><h2>Add a thought</h2></div><span className="tag">No decision needed</span></div>
    <textarea id="capture" value={capture} onChange={(event) => setCapture(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) onSubmit(); }} placeholder="Write a concise thought, task, event, or idea…" aria-label="Add a thought" />
    <div className="capture-footer">
      <p className="hint">Save it, then organize it below whenever you have a couple minutes.</p>
      <button className="primary" onClick={onSubmit}>Add a thought</button>
    </div>
  </section>;
}
```

- [ ] **Step 2: Build one organize row**

```tsx
function PlanRow({ item, projects, onSave, onDelete, onCreateProject, expanded, onToggleExpand }: { item: Item; projects: Project[]; onSave: (item: Item) => void; onDelete: () => void; onCreateProject: (project: Project) => void; expanded: boolean; onToggleExpand: () => void }) {
  const [draft, setDraft] = useState<Item>(item);
  const [showSplit, setShowSplit] = useState(false);
  const set = (changes: Partial<Item>) => setDraft((current) => { const next = { ...current, ...changes }; onSave(next); return next; });
  const isIdea = (draft.type ?? "task") === "idea";

  if (!expanded) return <ItemRow item={item} projects={projects} onOpen={onToggleExpand} action="Organize" />;

  return <div className="item-row-wrap">
    <div className="card" style={{ boxShadow: "none", padding: 14 }}>
      <div className="item-text" style={{ marginBottom: 10 }}>{draft.text}</div>
      <div className="chips">
        <button type="button" className={`chip ${!isIdea ? "selected" : ""}`} onClick={() => set({ type: "task" })}>Task</button>
        <button type="button" className={`chip ${isIdea ? "selected" : ""}`} onClick={() => set({ type: "idea" })}>Idea</button>
      </div>
      {!isIdea && <>
        <div className="chips" style={{ marginTop: 8 }}>
          {(["Work", "Social", "Personal"] as Category[]).map((category) => <button type="button" key={category} className={`chip ${draft.category === category ? "selected" : ""}`} onClick={() => set({ category })}>{category}</button>)}
        </div>
        <div style={{ marginTop: 8 }}><BucketDateChips bucket={draft.bucket} dueDate={draft.dueDate} onChange={({ bucket, dueDate }) => set({ bucket, status: bucket ? "Planned" : "Inbox", dueDate })} /></div>
        <div className="row-footer" style={{ marginTop: 8 }}>
          <input inputMode="numeric" value={draft.estimateMinutes ?? ""} onChange={(event) => set({ estimateMinutes: event.target.value ? Number(event.target.value) : undefined })} placeholder="Estimate (min)" style={{ width: 140 }} />
          <ProjectQuickAssign projectId={draft.projectId} projects={projects} onChange={(projectId) => set({ projectId, category: projectId ? undefined : draft.category })} onCreate={onCreateProject} />
          <button type="button" className="ghost small-button" onClick={() => setShowSplit((current) => !current)}>Split</button>
        </div>
      </>}
      <div className="actions">
        <button className="danger" onClick={onDelete}>Delete</button>
        <button className="ghost" onClick={onToggleExpand}>Collapse</button>
      </div>
      {showSplit && <SplitInline item={item} />}
    </div>
  </div>;
}
```

- [ ] **Step 3: Build the inline split sub-component**

Reuse the chunk-tapping logic from the existing `SplitPanel` (`app/page.tsx:606-703`), stripped of the modal wrapper and the AI-suggestion half (that stays exactly as it was — see note below):

```tsx
function SplitInline({ item, onAddChild }: { item: Item; onAddChild: (text: string, type: ItemType) => void }) {
  const segments = useMemo(() => segmentText(item.text), [item.text]);
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [splitType, setSplitType] = useState<ItemType>("task");

  function toggle(id: number) {
    setPending((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function create() {
    if (pending.size === 0) return;
    onAddChild(joinSelected(segments, pending), splitType);
    setPending(new Set());
  }

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  segments.forEach((segment) => {
    if (segment.start > cursor) nodes.push(item.text.slice(cursor, segment.start));
    nodes.push(<span key={segment.id} className={`chunk chunk-c${segment.id % 6} ${pending.has(segment.id) ? "chunk-pending" : ""}`} onClick={() => toggle(segment.id)}>{segment.text}</span>);
    cursor = segment.end;
  });
  if (cursor < item.text.length) nodes.push(item.text.slice(cursor));

  return <div className="field full" style={{ marginTop: 12 }}>
    <p className="split-source">{nodes}</p>
    <div className="chips" style={{ marginTop: 8 }}>
      <button type="button" className={`chip ${splitType === "task" ? "selected" : ""}`} onClick={() => setSplitType("task")}>Task</button>
      <button type="button" className={`chip ${splitType === "idea" ? "selected" : ""}`} onClick={() => setSplitType("idea")}>Idea</button>
    </div>
    <button className="primary" style={{ marginTop: 8 }} onClick={create} disabled={pending.size === 0}>Create item{pending.size > 1 ? ` from ${pending.size} chunks` : ""}</button>
  </div>;
}
```

**Note on AI split:** `requestAISplit`/`aiSuggestions`/`commitSuggestedItems` (currently `app/page.tsx:302-337, 625-672, 742-767`) are on hold per the earlier pause and are out of scope for this plan (the spec's Non-goals lists AI work as deferred, plugging in later). Leave `commitSuggestedItems` and the `/api/smart-split` route exactly as they are in `app/page.tsx` and `lib/aiSuggestions.ts` — don't delete them, just don't wire the AI button into `SplitInline` in this task. A follow-up task (not part of this plan) reconnects it once AI work resumes.

- [ ] **Step 4: Assemble `PlanPage`**

```tsx
export function PlanPage({ items, projects, capture, setCapture, onAddThought, onSaveItem, onDeleteItem, onCreateProject }: { items: Item[]; projects: Project[]; capture: string; setCapture: (value: string) => void; onAddThought: () => void; onSaveItem: (item: Item) => void; onDeleteItem: (id: string) => void; onCreateProject: (project: Project) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  return <div className="stack">
    <CaptureBox capture={capture} setCapture={setCapture} onSubmit={onAddThought} />
    <section className="card">
      <div className="card-header"><div><div className="section-label">Organize</div><h2>{items.length ? `${items.length} to organize` : "Nothing waiting"}</h2></div></div>
      {items.length ? <div className="item-list">{items.map((item) => <PlanRow key={item.id} item={item} projects={projects} onSave={onSaveItem} onDelete={() => onDeleteItem(item.id)} onCreateProject={onCreateProject} expanded={expandedId === item.id} onToggleExpand={() => setExpandedId((current) => current === item.id ? null : item.id)} />)}</div> : <p className="empty">Add a thought above — it'll show up here to organize.</p>}
    </section>
  </div>;
}
```

- [ ] **Step 5: Give chip taps a silent save path (no toast-per-tap)**

`PlanRow`'s `set` helper calls `onSave` on every chip tap, matching the spec's "tap a chip and move on" goal — no separate Save button. But the existing `saveItem` in `Home()` (`app/page.tsx:219-223`) calls `showToast(...)` on every call, so wiring it straight to `PlanRow` would pop a toast on every single chip tap (Type, then Category, then Bucket, then estimate — four toasts for one item). Add a second, silent update path in `Home()`, right after `saveItem`:

```ts
// Same write as saveItem, minus the toast - PlanRow calls this once per
// chip tap, and a toast per tap would be noise, not feedback. Organize's
// modal-based edit paths (ProjectPanel's inline subtask editor) keep using
// saveItem, where one toast per explicit Save action is the right amount.
function updateItemSilently(updated: Item) {
  updateData((current) => ({ ...current, items: current.items.map((item) => item.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : item) }));
}
```

Pass `onSaveItem={updateItemSilently}` (not `saveItem`) into `PlanPage` from both the mobile and desktop render branches in Task 9. `PlanPage`'s prop type stays `onSaveItem: (item: Item) => void` either way — only the function passed in changes.



- [ ] **Step 6: Update `app/page.tsx`**

Remove `CaptureForm`, `Inbox`, `OrganizableList`, `SplitPanel`, and the standalone modal usage of `OrganizePanel` for Inbox items (`OrganizePanel` itself stays — it's still used by `ProjectPanel`'s subtask list per Task 9). Replace the `tab === "inbox"` render branch with:

```tsx
{tab === "plan" && <PlanPage items={unresolved} projects={data.projects} capture={capture} setCapture={setCapture} onAddThought={addThought} onSaveItem={updateItemSilently} onDeleteItem={deleteItem} onCreateProject={createProject} />}
```

Import `PlanPage` from `./components/PlanPage`. Remove the `captureExpanded` state and the `CaptureForm`/`capture-compact` conditional block above the tab content (lines 422-432) — capture now lives only inside `PlanPage`.

- [ ] **Step 7: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS. Some errors will remain from `app/page.tsx` still referencing `tab === "today"`/`"week"`/`"reflections"` with the old nav — that's expected until Task 9 finishes the nav rewrite. If this task is executed standalone, temporarily keep the old nav array including `"plan"` as a fifth entry so the build stays green; Task 9 replaces the whole nav.

- [ ] **Step 8: Manual check**

Run: `npm run dev`, add a thought, open it to organize, tap through Type/Category/BucketDateChips/estimate/Project, confirm each tap updates the row immediately (no separate Save button needed), tap Split and confirm chunk-tapping still creates child items.

- [ ] **Step 9: Commit**

```bash
git add app/components/PlanPage.tsx app/page.tsx
git commit -m "Add PlanPage: capture + chip-based organize list with inline split"
```

---

### Task 8: `OverviewPage` — Today/Week/Month/Projects/Reflect toggle with checkboxes everywhere

**Files:**
- Create: `app/components/OverviewPage.tsx`
- Modify: `app/page.tsx` (remove `TodayView`, `BriefingCard` relocation, `PlanTab`, `WeekView`, `DayPlanView`, `WeekByDayView`, `MonthPlanView`, `UnscheduledCard` — folded into `OverviewPage`; `ReflectionPanel`/`ProjectPanel` stay as-is and are rendered from inside `OverviewPage`)

**Interfaces:**
- Produces: `OverviewPage({ layout, ...allTheHandlersAndData }: { layout: "tabs" | "dashboard"; ... })`. When `layout === "tabs"` (mobile), a segmented toggle switches between five sub-sections. When `layout === "dashboard"` (desktop), all five render at once as separate cards, no toggle.
- Consumes: everything `Home()` already computes (`todayItems`, `thisWeekItems`, `weekItems`, `laterItems`, `committedItems`, `data.projects`, etc.) — passed straight through, no new derived state inside this component beyond the Day/Week/Month navigation cursors (`day`, `weekStart`, `month`) that already existed in `PlanTab`.

- [ ] **Step 1: Move `TodayView` and `BriefingCard` in, unchanged except for checkbox already covered by Task 4**

Copy `TodayView` (`app/page.tsx:461-475`) and `BriefingCard` (`app/page.tsx:477-530`) into the new file verbatim (their `onDone`-driven `ItemRow` already got a checkbox from Task 4 — no further change needed here).

- [ ] **Step 2: Move the Week/Month/Day views in, adding checkboxes where they were missing**

Copy `WeekView` (`app/page.tsx:928-939`), `DayPlanView` (`app/page.tsx:971-988`), `WeekByDayView` (`app/page.tsx:990-1014`), `MonthPlanView` (`app/page.tsx:1016-1046`), `UnscheduledCard` (`app/page.tsx:967-969`) into the new file, with two changes:

In `WeekByDayView`, the `week-day-item` buttons currently only call `onOpen` — add a companion checkbox so items can be marked done straight from the week grid, without leaving `.week-day-item` as a plain button (which stays as the "open to edit" affordance):

```tsx
{dayItems.length ? dayItems.map((item) => <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
  <input type="checkbox" className="item-checkbox" checked={!!item.done} onChange={() => onDone(item)} aria-label={item.done ? "Mark not done" : "Mark done"} />
  <button type="button" className="week-day-item" style={item.done ? { textDecoration: "line-through", opacity: 0.6 } : undefined} onClick={() => onOpen(item)}>{item.text}</button>
</div>) : <div className="week-day-empty">—</div>}
```

`MonthPlanView`'s grid cells intentionally stay count-only (clicking a day drills into `DayPlanView`, which now has checkboxes via `ItemRow` already) — a month cell showing 5 items' worth of individual checkboxes wouldn't fit and isn't what "at a glance" means for a month. Add the stale-Later nudge here instead, right after the `<div className="month-grid">` closing tag, inside the same `<section className="card">`:

```tsx
{staleLater.length > 0 && <div className="notice" style={{ marginTop: 14 }}>{staleLater.length} "Later" item{staleLater.length === 1 ? " has" : "s have"} no date yet. Check Saved for Later to give them one, or leave them parked.</div>}
```

`MonthPlanView`'s props gain `staleLater: Item[]` (passed down from `OverviewPage`, computed once — see Step 4).

- [ ] **Step 3: Add the "Saved for Later" section**

New function in the same file:

```tsx
function SavedForLater({ items, projects, onOpen, onDone }: { items: Item[]; projects: Project[]; onOpen: (item: Item) => void; onDone: (item: Item) => void }) {
  const [open, setOpen] = useState(false);
  return <section className="card">
    <div className="card-header"><div><div className="section-label">Saved for later</div><h2>{items.length} parked</h2></div><button type="button" className="ghost small-button" onClick={() => setOpen((current) => !current)}>{open ? "Hide" : "Show"}</button></div>
    {open && (items.length ? <div className="item-list">{sortDoneLast(items).map((item) => <ItemRow key={item.id} item={item} projects={projects} onOpen={onOpen} action="Edit" onDone={onDone} />)}</div> : <p className="empty">Nothing parked right now.</p>)}
  </section>;
}
```

`items` here is whatever `Home()` passes as `laterItems` (already computed via `data.items.filter(isLater)` at `app/page.tsx:111` — unchanged, just consumed here).

- [ ] **Step 4: Assemble `OverviewPage`**

```tsx
const OVERVIEW_MODES = [["today", "Today"], ["week", "Week"], ["month", "Month"], ["projects", "Projects"], ["reflect", "Reflect"]] as const;
type OverviewMode = (typeof OVERVIEW_MODES)[number][0];

export function OverviewPage(props: OverviewPageProps) {
  const { layout } = props;
  const [mode, setMode] = useState<OverviewMode>("today");
  const [day, setDay] = useState(() => new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const unscheduled = unscheduledItems(props.committedItems);
  const staleLater = props.laterItems.filter((item) => !itemDateKey(item));

  const sections: Record<OverviewMode, React.ReactNode> = {
    today: <TodayView todayItems={props.todayItems} thisWeekItems={props.thisWeekItems} doneCount={props.doneCount} projects={props.projects} onOpen={props.onOpen} onDone={props.onDone} />,
    week: <WeekByDayView weekStart={weekStart} setWeekStart={setWeekStart} items={props.committedItems} unscheduled={unscheduled} projects={props.projects} onOpen={props.onOpen} onDone={props.onDone} />,
    month: <MonthPlanView month={month} setMonth={setMonth} items={props.committedItems} unscheduled={unscheduled} projects={props.projects} onOpen={props.onOpen} onDone={props.onDone} staleLater={staleLater} onPickDay={(picked) => setDay(picked)} />,
    projects: <ProjectsSection projects={props.projects} allItems={props.allItems} onOpen={props.onOpenProject} onCreateProject={props.onCreateProject} />,
    reflect: <ReflectionPanel doneToday={props.doneToday} doneThisWeek={props.doneThisWeek} unfinishedThisWeek={props.unfinishedThisWeek} openItems={props.openItems} allItems={props.allItems} projects={props.projects} reflections={props.reflections} onOpen={props.onOpen} onDrop={props.onDrop} onReplace={props.onReplace} onDone={props.onDone} onSave={props.onSaveReflection} />,
  };

  if (layout === "dashboard") {
    return <div className="stack">
      {(["today", "week", "month"] as OverviewMode[]).map((key) => <div key={key}>{sections[key]}</div>)}
      {(["projects", "reflect"] as OverviewMode[]).map((key) => <div key={key}>{sections[key]}</div>)}
      <SavedForLater items={props.laterItems} projects={props.projects} onOpen={props.onOpen} onDone={props.onDone} />
    </div>;
  }

  return <div className="stack">
    <div className="chips">{OVERVIEW_MODES.map(([key, label]) => <button type="button" key={key} className={`chip ${mode === key ? "selected" : ""}`} onClick={() => setMode(key)}>{label}</button>)}</div>
    {sections[mode]}
    <SavedForLater items={props.laterItems} projects={props.projects} onOpen={props.onOpen} onDone={props.onDone} />
  </div>;
}
```

`ProjectsSection` is the existing Projects card from `Inbox` (`app/page.tsx:591-601`) plus a "+ New project" input, extracted as its own function:

```tsx
function ProjectsSection({ projects, allItems, onOpen, onCreateProject }: { projects: Project[]; allItems: Item[]; onOpen: (project: Project) => void; onCreateProject: (project: Project) => void }) {
  const [newProjectName, setNewProjectName] = useState("");
  function create() {
    const name = newProjectName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    onCreateProject({ id: makeId(), name, done: false, createdAt: now, updatedAt: now });
    setNewProjectName("");
  }
  return <section className="card">
    <div className="card-header"><div><div className="section-label">Projects</div><h2>{projects.length} project{projects.length === 1 ? "" : "s"}</h2></div></div>
    {projects.length ? <div className="item-list">{sortProjectsDoneLast(projects).map((project) => {
      const subtaskCount = allItems.filter((item) => item.projectId === project.id).length;
      return <div className="item-row" key={project.id}><div className="item-main"><div className="item-text">{project.name}</div><div className="item-meta"><span className="tag">{subtaskCount} subtask{subtaskCount === 1 ? "" : "s"}</span>{project.done && <span className="tag accent">Done</span>}</div></div><button className="ghost small-button" onClick={() => onOpen(project)}>Open</button></div>;
    })}</div> : <p className="empty">No projects yet. Create one below, then attach tasks to it from Plan.</p>}
    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
      <input value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} placeholder="New project name…" style={{ flex: 1 }} onKeyDown={(event) => { if (event.key === "Enter") create(); }} />
      <button className="ghost small-button" onClick={create}>+ New project</button>
    </div>
  </section>;
}
```

Define `OverviewPageProps` at the top of the file as one named type gathering every prop referenced above (all of them already exist as values inside `Home()` today — this is a mechanical prop-threading step, not new state).

- [ ] **Step 5: Update `app/page.tsx`**

Remove `TodayView`, `BriefingCard`, `PlanTab`, `WeekView`, `DayPlanView`, `WeekByDayView`, `MonthPlanView`, `UnscheduledCard` from `app/page.tsx`. Import `OverviewPage` from `./components/OverviewPage`. This task's wiring into the actual nav/layout happens in Task 9 — for now, keep a temporary render call (`{tab === "overview" && <OverviewPage layout="tabs" ... />}`) with a `"overview"` entry added to the old nav array, just to keep the build green task-by-task.

- [ ] **Step 6: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS (with the same caveat as Task 7 Step 7 about the nav array being finished in Task 9).

- [ ] **Step 7: Manual check**

Run: `npm run dev`. Click through Today/Week/Month/Projects/Reflect via the toggle chips, confirm each renders and checkboxes work in Today and Week. Commit a Later item with no date and confirm it shows under Saved for Later.

- [ ] **Step 8: Commit**

```bash
git add app/components/OverviewPage.tsx app/page.tsx
git commit -m "Add OverviewPage: Today/Week/Month/Projects/Reflect toggle with checkboxes and Saved for Later"
```

---

### Task 9: Rewire `Home()` — two-tab mobile nav, desktop dashboard, static strap line

**Files:**
- Modify: `app/page.tsx`
- Create: `app/hooks/useIsDesktop.ts`

**Interfaces:**
- Produces: `useIsDesktop(breakpoint = 960): boolean` — mirrors the existing theme-init pattern (`app/page.tsx:91-94`): starts `false` (mobile) so server/client markup matches on first paint, then corrects itself in a `useEffect` via `window.matchMedia`, with a `change` listener so resizing the window live-updates it.
- Consumes: nothing external.

- [ ] **Step 1: Add the viewport hook**

Create `app/hooks/useIsDesktop.ts`:

```ts
"use client";

import { useEffect, useState } from "react";

// Starts false (mobile) so the very first client render matches whatever
// the server rendered - the real value is read right after mount, same
// "assume the safe default, correct it in an effect" shape the theme toggle
// already uses in app/page.tsx.
export function useIsDesktop(breakpoint = 960): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${breakpoint}px)`);
    setIsDesktop(query.matches);
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [breakpoint]);

  return isDesktop;
}
```

- [ ] **Step 2: Replace the nav array and tab type**

In `app/page.tsx`, change:

```ts
type Tab = "today" | "inbox" | "week" | "reflections";
```

to:

```ts
type Tab = "plan" | "overview";
```

Replace the `nav` array (`app/page.tsx:391-396`) with:

```ts
const nav = [
  ["plan", `Plan${unresolved.length ? ` · ${unresolved.length}` : ""}`],
  ["overview", "Overview"],
] as const;
```

Update the initial state: `const [tab, setTab] = useState<Tab>("plan");`.

- [ ] **Step 3: Add the strap line**

Right below the `<nav>` element in the JSX (after `app/page.tsx:420`), add:

```tsx
<p className="hint" style={{ marginBottom: 14 }}>Capture · Review · Commit · Reflect</p>
```

- [ ] **Step 4: Render mobile tabs vs. desktop dashboard**

Replace the whole capture-form-conditional block and the `tab === ...` render branches (`app/page.tsx:422-437`, after Tasks 7 and 8 already replaced the individual branches with `plan`/`overview` ones) with:

```tsx
{isDesktop ? (
  <div className="stack">
    <PlanPage items={unresolved} projects={data.projects} capture={capture} setCapture={setCapture} onAddThought={addThought} onSaveItem={updateItemSilently} onDeleteItem={deleteItem} onCreateProject={createProject} />
    <OverviewPage layout="dashboard" {...overviewProps} />
  </div>
) : (
  <>
    {tab === "plan" && <PlanPage items={unresolved} projects={data.projects} capture={capture} setCapture={setCapture} onAddThought={addThought} onSaveItem={updateItemSilently} onDeleteItem={deleteItem} onCreateProject={createProject} />}
    {tab === "overview" && <OverviewPage layout="tabs" {...overviewProps} />}
  </>
)}
```

Add `const isDesktop = useIsDesktop();` near the other hooks at the top of `Home()`, and build `overviewProps` once, right above the `return`, as a single object literal gathering every prop `OverviewPage` needs (`todayItems`, `thisWeekItems`, `doneCount: doneToday.length`, `projects: data.projects`, `onOpen: setSelected`, `onDone: toggleDone`, `committedItems`, `laterItems`, `allItems: data.items`, `onOpenProject: setProjectPanel`, `onCreateProject: createProject`, `doneToday`, `doneThisWeek`, `unfinishedThisWeek`, `openItems`, `reflections: data.reflections`, `onDrop: deleteItem`, `onReplace: replaceItem`, `onSaveReflection: saveReflection`) — this avoids typing the same 17-prop object out twice (mobile-tabs branch and desktop-dashboard branch above both spread it).

On desktop, hide the nav row entirely (it's meaningless once both pages render together) — wrap the existing `<nav className="nav">...</nav>` block in `{!isDesktop && (...)}`.

- [ ] **Step 5: Remove now-dead code**

Confirm nothing still references the old `unresolved`/`weekItems` split by tab-specific components that were deleted in Tasks 7-8 (`Inbox`, `PlanTab`, etc.) — `npx tsc --noEmit` will surface any leftover reference as an error.

- [ ] **Step 6: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS, no leftover references to the old 4-tab world.

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: PASS (this task touches no `lib/` files, so this is a regression check).

- [ ] **Step 8: Manual check — both breakpoints**

Run: `npm run dev`. In a normal-width browser window (or resize dev tools below 960px), confirm the Plan/Overview tab nav appears and switches correctly. Widen the window past 960px and confirm the nav disappears and Plan + all five Overview sections render stacked as one dashboard. Resize back and forth once to confirm the `change` listener in `useIsDesktop` actually re-renders live, not just on load.

- [ ] **Step 9: Commit**

```bash
git add app/page.tsx app/hooks/useIsDesktop.ts
git commit -m "Rewire Home to 2-tab Plan/Overview nav with a desktop all-in-one dashboard"
```

---

### Task 10: Style pass — chips, dashboard grid, checkboxes, saved-for-later, strap line

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: nothing (pure styling, classnames already used by Tasks 5-9's markup: `.item-checkbox` already added in Task 4; this task adds `.dashboard-columns` used nowhere yet in the JSX above — add it here and reference it from Task 9's Step 4 desktop branch, or fold that reference into this task if executed after Task 9).

- [ ] **Step 1: Add a two/three-column row helper for the desktop dashboard**

```css
.dashboard-columns { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; align-items: start; }
@media (max-width: 1180px) {
  .dashboard-columns { grid-template-columns: 1fr; }
}
```

Update Task 9 Step 4's desktop branch so the Today/Week/Month row and the Projects/Reflect row each wrap in `<div className="dashboard-columns">` instead of the flat `.map` list shown in that task (revise `OverviewPage`'s `layout === "dashboard"` return to group `["today","week","month"]` inside one `.dashboard-columns` div and `["projects","reflect"]` inside a second one, per the spec's Row 2 / Row 3 split).

- [ ] **Step 2: Confirm existing `.chips`, `.month-grid`, `.week-grid` styles already cover the new usages**

`BucketDateChips`, `PlanRow`, and `OverviewPage` all reuse the existing `.chip`, `.month-cell`, `.week-day-item` classes verbatim — no new selectors needed for those. Spot-check in the running dev server (Task 9 Step 8 already exercises every new surface) rather than adding speculative CSS.

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, confirm the desktop dashboard's three-column rows actually sit side by side above 1180px wide and stack to one column below it, both in light and dark theme (toggle via the existing theme button).

- [ ] **Step 5: Commit**

```bash
git add app/globals.css app/components/OverviewPage.tsx
git commit -m "Style the desktop dashboard's 3-column rows"
```

---

### Task 11: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: PASS, all `lib/*.test.ts` files including the new assertions from Tasks 1 and 3.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS, zero errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: PASS, all routes (including `/api/smart-split` and `/api/daily-briefing`, untouched by this plan) still register correctly.

- [ ] **Step 4: Manual end-to-end pass on mobile width**

Run: `npm run dev`. Capture a thought → organize it (type, category, bucket+date, estimate, project) → confirm it appears correctly in Overview's matching view (Today if bucket=Today, Week grid if This Week, Month grid + Saved for Later if This Month/Later) → check it off → confirm it strikes through. Try Later with no date picked and confirm it lands in Saved for Later, and that Month view's stale-Later notice mentions it.

- [ ] **Step 5: Manual end-to-end pass on desktop width**

Same flow as Step 4, but resized past 960px wide, confirming everything is reachable without switching tabs.

- [ ] **Step 6: Confirm nothing outside this plan's scope changed**

Run: `git status` and `git diff --stat main` (or the working branch's base) — confirm the AI-integration files from the earlier, still-paused session (`app/api/`, `lib/aiSuggestions.ts`, `.env.local`) are untouched by this plan's commits, since that work is separately on hold per the user's standing instruction.

- [ ] **Step 7: Report**

Summarize to the user: tests passing, build passing, both breakpoints manually verified, and remind them the AI-integration work is still paused and untouched, separate from this flow-redesign work — they can request that resumed independently whenever they're ready.

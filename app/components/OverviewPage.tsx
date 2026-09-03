"use client";

import { useState } from "react";
import type { Category, Item, Project, Reflection, Targets } from "../../lib/storage";
import { makeId } from "../../lib/storage";
import { addDays, itemDateKey, itemsOnDate, monthGridCells, startOfMonth, startOfWeek, toDateKey, unscheduledItems, weekDays } from "../../lib/schedule";
import { effectiveCategory, sortProjectsDoneLast } from "../../lib/projects";
import { rankReplacementCandidates } from "../../lib/reflect";
import { formatMinutes, estimateTag, ItemRow } from "./shared";

const OVERVIEW_CATEGORIES: Category[] = ["Work", "Social", "Personal"];

// One card, segmented, same shape as Week's Feed card - Today and "still
// open for the week" used to be two separate cards for no real reason,
// both are just "what's on deck," not different kinds of thing.
function TodayView({ todayItems, thisWeekItems, projects, onOpen, onDone }: { todayItems: Item[]; thisWeekItems: Item[]; projects: Project[]; onOpen: (item: Item) => void; onDone: (item: Item) => void }) {
  const todayOpen = todayItems.filter((item) => !item.done);
  const thisWeekOpen = thisWeekItems.filter((item) => !item.done);
  const done = [...todayItems, ...thisWeekItems].filter((item) => item.done);

  return <section className="card">
    <div className="card-header"><div><div className="section-label">Today</div><h2>{todayOpen.length ? `${todayOpen.length} thing${todayOpen.length === 1 ? "" : "s"} today` : "Nothing committed to today yet"}</h2></div></div>
    <div className="field full">
      <label>Today ({todayOpen.length})</label>
      <div style={{ marginTop: 8 }}><OpenItemsList items={todayOpen} projects={projects} onOpen={onOpen} onDone={onDone} empty="Organize a note from Plan and choose Today to see it here." /></div>
    </div>
    <div className="field full" style={{ marginTop: 18 }}>
      <label>This week, not on a specific day ({thisWeekOpen.length})</label>
      <div style={{ marginTop: 8 }}><OpenItemsList items={thisWeekOpen} projects={projects} onOpen={onOpen} onDone={onDone} empty="Nothing else queued for this week." /></div>
    </div>
    <details style={{ marginTop: 18 }}>
      <summary className="section-label">Completed · {done.length}</summary>
      {done.length > 0 && <div className="item-list" style={{ marginTop: 10 }}>{done.map((item) => <ItemRow key={item.id} item={item} projects={projects} onOpen={onOpen} action="Edit" onDone={onDone} />)}</div>}
    </details>
  </section>;
}

// Plain open-items list, no per-list "Completed" dropdown of its own -
// FeedCard below rolls every segment's done items into one combined
// dropdown at the bottom instead.
function OpenItemsList({ items, projects, onOpen, onDone, empty }: { items: Item[]; projects: Project[]; onOpen: (item: Item) => void; onDone: (item: Item) => void; empty: string }) {
  if (!items.length) return <p className="empty">{empty}</p>;
  return <div className="item-list">{items.map((item) => <ItemRow key={item.id} item={item} projects={projects} onOpen={onOpen} action="Edit" onDone={onDone} />)}</div>;
}

// This week's committed items, whatever's committed but not pinned to a
// day, and Later's parked items - all in one place. Items here are always
// already organised (they have a bucket); "unscheduled" just means no
// exact date yet, which is a normal, fine state, not a problem to fix.
// Truly un-organised items (still sitting in Inbox) never show up here at
// all - that's Plan's job, not Overview's.
function FeedCard({ weekItems, unscheduled, laterItems, projects, onOpen, onDone }: { weekItems: Item[]; unscheduled: Item[]; laterItems: Item[]; projects: Project[]; onOpen: (item: Item) => void; onDone: (item: Item) => void }) {
  const weekOpen = weekItems.filter((item) => !item.done);
  const unscheduledOpen = unscheduled.filter((item) => !item.done);
  const laterOpen = laterItems.filter((item) => !item.done);
  const done = [...weekItems, ...unscheduled, ...laterItems].filter((item) => item.done);

  return <section className="card">
    <div className="card-header"><div className="section-label">Feed</div></div>
    <div className="field full">
      <label>This week ({weekOpen.length})</label>
      <div style={{ marginTop: 8 }}><OpenItemsList items={weekOpen} projects={projects} onOpen={onOpen} onDone={onDone} empty="Organize an item and choose Today or This Week to see it here." /></div>
    </div>
    <div className="field full" style={{ marginTop: 18 }}>
      <label>Unscheduled ({unscheduledOpen.length})</label>
      <div style={{ marginTop: 8 }}><OpenItemsList items={unscheduledOpen} projects={projects} onOpen={onOpen} onDone={onDone} empty="Everything committed has a day, or nothing is committed yet." /></div>
    </div>
    <details style={{ marginTop: 18 }}>
      <summary className="section-label">Saved for later · {laterOpen.length}</summary>
      <div style={{ marginTop: 10 }}><OpenItemsList items={laterOpen} projects={projects} onOpen={onOpen} onDone={onDone} empty="Nothing parked right now." /></div>
    </details>
    <details style={{ marginTop: 18 }}>
      <summary className="section-label">Completed · {done.length}</summary>
      {done.length > 0 && <div className="item-list" style={{ marginTop: 10 }}>{done.map((item) => <ItemRow key={item.id} item={item} projects={projects} onOpen={onOpen} action="Edit" onDone={onDone} />)}</div>}
    </details>
  </section>;
}

// Combines the old category/targets breakdown with the day-by-day grid -
// two lenses on the same week, stacked instead of behind their own toggle,
// since Overview's only toggle now is the five Today/Week/Month/Projects/
// Reflect stops, not a second layer underneath Week.
function WeekSection({ weekItems, weekMinutes, categoryTotals, largestCategory, conflicts, targets, projects, onSaveTargets, committedItems, unscheduled, laterItems, onOpen, onDone }: { weekItems: Item[]; weekMinutes: number; categoryTotals: { category: Category; minutes: number }[]; largestCategory: number; conflicts: { category: Category; minutes: number }[]; targets: Targets; projects: Project[]; onSaveTargets: (targets: Targets) => void; committedItems: Item[]; unscheduled: Item[]; laterItems: Item[]; onOpen: (item: Item) => void; onDone: (item: Item) => void }) {
  const [draftTargets, setDraftTargets] = useState<Targets>(targets);
  const targetsAlreadySet = Object.values(targets).some((value) => value !== undefined);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const weekStartDisplay = startOfWeek(new Date());
  const weekEnd = addDays(weekStartDisplay, 6);
  const weekRange = `${weekStartDisplay.toLocaleDateString(undefined, { month: "long", day: "numeric" })} – ${weekEnd.toLocaleDateString(undefined, { month: "long", day: "numeric" })}`;
  const days = weekDays(weekStart);
  const rangeLabel = `${weekStart.toLocaleDateString(undefined, { month: "long", day: "numeric" })} – ${addDays(weekStart, 6).toLocaleDateString(undefined, { month: "long", day: "numeric" })}`;

  return <div className="stack">
    <section className="card">
      <div className="card-header"><div><div className="section-label">Draft week</div><h2>Your week, at a glance.</h2><p className="hint" style={{ marginTop: 4 }}>{weekRange}</p></div><span className="tag accent">{estimateTag(weekMinutes)}</span></div>
      {conflicts.length > 0 && <div className="notice">This draft is above the target for {conflicts.map((item) => item.category).join(", ")}. Choose the trade-off yourself; nothing moved automatically.</div>}
      <div className="split-list">{categoryTotals.map(({ category, minutes }) => <div className="split-row" key={category}><span>{category}</span><div className="split-bar" style={{ background: "var(--paper-deep)" }}><div className="split-fill" style={{ width: `${Math.min(100, (minutes / largestCategory) * 100)}%` }} /></div><strong>{formatMinutes(minutes)}</strong></div>)}</div>
    </section>

    <section className="card">
      <div className="card-header">
        <div><div className="section-label">Week by day</div><h2>{rangeLabel}</h2></div>
        <div className="row-footer" style={{ margin: 0 }}>
          <button className="ghost small-button" onClick={() => setWeekStart(addDays(weekStart, -7))}>← Prev</button>
          <button className="ghost small-button" onClick={() => setWeekStart(startOfWeek(new Date()))}>This week</button>
          <button className="ghost small-button" onClick={() => setWeekStart(addDays(weekStart, 7))}>Next →</button>
        </div>
      </div>
      <div className="week-grid">{days.map((day) => {
        const key = toDateKey(day);
        const dayItems = itemsOnDate(committedItems, key);
        return <div className="week-day" key={key}>
          <div className="week-day-label">{day.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</div>
          {dayItems.length ? dayItems.map((item) => <button type="button" className="week-day-item" key={item.id} onClick={() => onOpen(item)}>{item.text}</button>) : <div className="week-day-empty">—</div>}
        </div>;
      })}</div>
    </section>

    <FeedCard weekItems={weekItems} unscheduled={unscheduled} laterItems={laterItems} projects={projects} onOpen={onOpen} onDone={onDone} />

    <details className="card" style={{ padding: "12px 17px" }} open={targetsAlreadySet}>
      <summary className="section-label">Weekly targets (optional)</summary>
      <div style={{ marginTop: 12 }}>
        <p className="hint">Targets help the draft show where your time is going. You can skip this and return here later.</p>
        <div className="form-grid" style={{ marginTop: 14 }}>{OVERVIEW_CATEGORIES.map((category) => <div className="field" key={category}><label htmlFor={`target-${category}`}>{category} hours</label><input id={`target-${category}`} type="number" min="0" step="0.5" value={draftTargets[category] ?? ""} onChange={(event) => setDraftTargets({ ...draftTargets, [category]: event.target.value ? Number(event.target.value) : undefined })} placeholder="Not set" /></div>)}</div>
        <div className="actions"><button className="primary" onClick={() => onSaveTargets(draftTargets)}>Save targets</button></div>
      </div>
    </details>
  </div>;
}

// Month has no separate "Day" stop in Overview's toggle - tapping a day
// shows that day's items right here, appended below the grid, instead of
// switching the whole page to a different view.
function MonthSection({ month, setMonth, items, unscheduled, projects, staleLater, onOpen, onDone }: { month: Date; setMonth: (date: Date) => void; items: Item[]; unscheduled: Item[]; projects: Project[]; staleLater: Item[]; onOpen: (item: Item) => void; onDone: (item: Item) => void }) {
  const [pickedDay, setPickedDay] = useState<Date | null>(null);
  const cells = monthGridCells(month);
  const pickedDayItems = pickedDay ? itemsOnDate(items, toDateKey(pickedDay)) : [];
  const pickedDayOpen = pickedDayItems.filter((item) => !item.done);
  const unscheduledOpen = unscheduled.filter((item) => !item.done);
  const done = [...pickedDayItems, ...unscheduled].filter((item) => item.done);

  return <section className="card">
    <div className="card-header">
      <div><div className="section-label">Month</div><h2>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2></div>
      <div className="row-footer" style={{ margin: 0 }}>
        <button className="ghost small-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</button>
        <button className="ghost small-button" onClick={() => setMonth(startOfMonth(new Date()))}>This month</button>
        <button className="ghost small-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</button>
      </div>
    </div>
    <div className="month-grid">
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => <div className="month-heading" key={label}>{label}</div>)}
      {cells.map((cellDate, index) => {
        if (!cellDate) return <div className="month-cell month-cell-blank" key={`blank-${index}`} />;
        const key = toDateKey(cellDate);
        const count = itemsOnDate(items, key).length;
        return <button type="button" className="month-cell" key={key} onClick={() => setPickedDay(cellDate)}>
          <span className="month-cell-num">{cellDate.getDate()}</span>
          {count > 0 && <span className="month-cell-count">{count}</span>}
        </button>;
      })}
    </div>
    {staleLater.length > 0 && <div className="notice" style={{ marginTop: 14 }}>{staleLater.length} "Later" item{staleLater.length === 1 ? " has" : "s have"} no date yet. Check Week's Saved for later to give them one, or leave them parked.</div>}
    {pickedDay && <div className="field full" style={{ marginTop: 18 }}>
      <label>{pickedDay.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</label>
      <div style={{ marginTop: 8 }}><OpenItemsList items={pickedDayOpen} projects={projects} onOpen={onOpen} onDone={onDone} empty="Nothing scheduled for this day." /></div>
    </div>}
    <div className="field full" style={{ marginTop: 18 }}>
      <label>Unscheduled ({unscheduledOpen.length})</label>
      <div style={{ marginTop: 8 }}><OpenItemsList items={unscheduledOpen} projects={projects} onOpen={onOpen} onDone={onDone} empty="Everything committed has a day, or nothing is committed yet. Add a due date in Plan to put an item on the calendar." /></div>
    </div>
    <details style={{ marginTop: 18 }}>
      <summary className="section-label">Completed · {done.length}</summary>
      {done.length > 0 && <div className="item-list" style={{ marginTop: 10 }}>{done.map((item) => <ItemRow key={item.id} item={item} projects={projects} onOpen={onOpen} action="Edit" onDone={onDone} />)}</div>}
    </details>
  </section>;
}

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

function ReplacePanel({ original, allItems, onChoose, onJustDrop, onClose }: { original: Item; allItems: Item[]; onChoose: (chosenId: string) => void; onJustDrop: () => void; onClose: () => void }) {
  const [choosing, setChoosing] = useState(false);

  if (!choosing) {
    return <div className="modal-backdrop"><div className="modal card" role="dialog" aria-modal="true" aria-labelledby="replace-title">
      <div className="card-header"><div><div className="section-label">Replace</div><h2 id="replace-title">Pick something now, or later?</h2></div><button className="ghost small-button" onClick={onClose}>Close</button></div>
      <p className="empty">"{original.text}" will be dropped either way. Fill its spot with something else now, or leave it empty for now.</p>
      <div className="actions"><button className="ghost" onClick={onJustDrop}>Just drop it</button><button className="primary" onClick={() => setChoosing(true)}>Pick a replacement</button></div>
    </div></div>;
  }

  const ranked = rankReplacementCandidates(original, allItems);
  return <div className="modal-backdrop"><div className="modal card" role="dialog" aria-modal="true" aria-labelledby="replace-pick-title">
    <div className="card-header"><div><div className="section-label">Replace</div><h2 id="replace-pick-title">Choose what fills this spot.</h2></div><button className="ghost small-button" onClick={onClose}>Close</button></div>
    <p className="empty">Dropping "{original.text}" ({formatMinutes(original.estimateMinutes)}). Items that fit the same time or less are listed first.</p>
    {ranked.length ? <div className="item-list" style={{ marginTop: 12 }}>{ranked.map(({ item, longer }) => <div className="item-row" key={item.id}><div className="item-main"><div className="item-text">{item.text}</div><div className="item-meta"><span className="tag accent">{formatMinutes(item.estimateMinutes)}</span>{longer && <span className="tag">Takes longer</span>}</div></div><button className="ghost small-button" onClick={() => onChoose(item.id)}>Choose</button></div>)}</div> : <p className="empty">Nothing else has a time estimate yet to swap in. Add an estimate to another item first.</p>}
  </div></div>;
}

function ReflectionPanel({ doneToday, doneThisWeek, unfinishedThisWeek, openItems, allItems, projects, reflections, onOpen, onDrop, onReplace, onDone, onSave }: { doneToday: Item[]; doneThisWeek: Item[]; unfinishedThisWeek: Item[]; openItems: Item[]; allItems: Item[]; projects: Project[]; reflections: Reflection[]; onOpen: (item: Item) => void; onDrop: (id: string) => void; onReplace: (originalId: string, chosenId: string) => void; onDone: (item: Item) => void; onSave: (type: "daily" | "weekly", text: string) => void }) {
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [weeklyAcknowledged, setWeeklyAcknowledged] = useState<Set<string>>(new Set());
  const [replacing, setReplacing] = useState<{ item: Item; scope: "daily" | "weekly" } | null>(null);
  const [freeText, setFreeText] = useState("");
  const [wellText, setWellText] = useState("");
  const [changeText, setChangeText] = useState("");
  const [prioritiesText, setPrioritiesText] = useState("");
  const [selectedPriorities, setSelectedPriorities] = useState<Set<string>>(new Set());

  const visibleOpen = openItems.filter((item) => !acknowledged.has(item.id));
  const visibleUnfinished = unfinishedThisWeek.filter((item) => !weeklyAcknowledged.has(item.id));

  const weekStart = startOfWeek(new Date());
  const weekRange = `${weekStart.toLocaleDateString(undefined, { month: "long", day: "numeric" })} – ${addDays(weekStart, 6).toLocaleDateString(undefined, { month: "long", day: "numeric" })}`;

  function acknowledge(id: string) {
    setAcknowledged((current) => new Set(current).add(id));
  }

  function weeklyAcknowledge(id: string) {
    setWeeklyAcknowledged((current) => new Set(current).add(id));
  }

  function togglePriority(id: string) {
    setSelectedPriorities((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function saveDaily() {
    const summary = [doneToday.length ? `Done: ${doneToday.map((item) => item.text).join("; ")}.` : "", freeText.trim()].filter(Boolean).join("\n");
    if (!summary.trim()) return;
    onSave("daily", summary);
    setFreeText("");
  }

  function saveWeekly() {
    const priorityItems = openItems.filter((item) => selectedPriorities.has(item.id));
    const lines = [
      doneThisWeek.length ? `Went well: ${doneThisWeek.map((item) => item.text).join("; ")}.` : "",
      wellText.trim(),
      visibleUnfinished.length ? `Stayed unfinished: ${visibleUnfinished.map((item) => item.text).join("; ")}.` : "",
      priorityItems.length ? `Priorities: ${priorityItems.map((item) => item.text).join("; ")}.` : "",
      prioritiesText.trim(),
      changeText.trim() ? `Change next week: ${changeText.trim()}` : "",
    ];
    const summary = lines.filter(Boolean).join("\n");
    if (!summary.trim()) return;
    onSave("weekly", summary);
    setWellText("");
    setChangeText("");
    setPrioritiesText("");
    setSelectedPriorities(new Set());
  }

  return <div className="stack">
    <section className="card">
      <div className="card-header"><div><div className="section-label">End of day</div><h2>Close the loops gently.</h2></div></div>

      <div className="field full">
        <label>Done today ({doneToday.length})</label>
        {doneToday.length ? <div className="item-list" style={{ marginTop: 8 }}>{doneToday.map((item) => <div className="item-row" key={item.id}><div className="item-main"><div className="item-text">{item.text}</div><div className="item-meta"><span className="tag accent">Done</span>{item.actualMinutes ? <span className="tag">{formatMinutes(item.actualMinutes)} actual</span> : null}</div></div></div>)}</div> : <p className="empty">Nothing marked done yet today. Mark items done from Plan or Today as you finish them.</p>}
      </div>

      <div className="field full" style={{ marginTop: 18 }}>
        <label>Open items ({visibleOpen.length})</label>
        {visibleOpen.length ? <div className="item-list" style={{ marginTop: 8 }}>{visibleOpen.map((item) => <div className="item-row-wrap" key={item.id}>
          <div className="item-row"><div className="item-main"><div className="item-text">{item.text}</div><div className="item-meta">{effectiveCategory(item, projects) && <span className="tag">{effectiveCategory(item, projects)}</span>}{item.bucket && <span className="tag">{item.bucket}</span>}{item.estimateMinutes ? <span className="tag accent">{formatMinutes(item.estimateMinutes)}</span> : <span className="tag">Estimate needed</span>}</div></div><button className="ghost small-button" onClick={() => onOpen(item)}>Edit</button></div>
          <div className="row-footer">
            <button className="ghost small-button" onClick={() => onDone(item)}>Done</button>
            <button className="ghost small-button" onClick={() => acknowledge(item.id)}>Carry forward</button>
            <button className="ghost small-button" onClick={() => { onDrop(item.id); acknowledge(item.id); }}>Drop</button>
            <button className="ghost small-button" onClick={() => setReplacing({ item, scope: "daily" })}>Replace</button>
          </div>
        </div>)}</div> : <p className="empty">Nothing open right now.</p>}
      </div>

      <div className="field" style={{ marginTop: 18 }}>
        <label htmlFor="daily-reflection">Free reflection</label>
        <textarea id="daily-reflection" value={freeText} onChange={(event) => setFreeText(event.target.value)} placeholder="What did today teach you?" />
      </div>
      <div className="actions"><button className="primary" onClick={saveDaily}>Save daily reflection</button></div>
    </section>

    <section className="card">
      <div className="card-header"><div><div className="section-label">End of week</div><h2>Make the next week lighter.</h2><p className="hint" style={{ marginTop: 4 }}>{weekRange}</p></div></div>

      <div className="field full">
        <label>What went well ({doneThisWeek.length})</label>
        {doneThisWeek.length ? <div className="item-list" style={{ marginTop: 8 }}>{doneThisWeek.map((item) => <div className="item-row" key={item.id}><div className="item-main"><div className="item-text">{item.text}</div><div className="item-meta"><span className="tag accent">Done</span></div></div></div>)}</div> : <p className="empty">Nothing marked done yet this week.</p>}
        <textarea style={{ marginTop: 10 }} value={wellText} onChange={(event) => setWellText(event.target.value)} placeholder="Anything else that went well?" />
      </div>

      <div className="field full" style={{ marginTop: 18 }}>
        <label>What stayed unfinished ({visibleUnfinished.length})</label>
        {visibleUnfinished.length ? <div className="item-list" style={{ marginTop: 8 }}>{visibleUnfinished.map((item) => <div className="item-row-wrap" key={item.id}>
          <div className="item-row"><div className="item-main"><div className="item-text">{item.text}</div><div className="item-meta">{effectiveCategory(item, projects) && <span className="tag">{effectiveCategory(item, projects)}</span>}{item.bucket && <span className="tag">{item.bucket}</span>}{item.estimateMinutes ? <span className="tag accent">{formatMinutes(item.estimateMinutes)}</span> : <span className="tag">Estimate needed</span>}</div></div><button className="ghost small-button" onClick={() => onOpen(item)}>Edit</button></div>
          <div className="row-footer">
            <button className="ghost small-button" onClick={() => onDone(item)}>Done</button>
            <button className="ghost small-button" onClick={() => weeklyAcknowledge(item.id)}>Carry forward</button>
            <button className="ghost small-button" onClick={() => { onDrop(item.id); weeklyAcknowledge(item.id); }}>Drop</button>
            <button className="ghost small-button" onClick={() => setReplacing({ item, scope: "weekly" })}>Replace</button>
          </div>
        </div>)}</div> : <p className="empty">Nothing stayed unfinished this week.</p>}
      </div>

      <div className="field full" style={{ marginTop: 18 }}>
        <label>Next week's priorities</label>
        {openItems.length > 0 && <div className="chips" style={{ marginTop: 8 }}>{openItems.map((item) => <button type="button" key={item.id} className={`chip ${selectedPriorities.has(item.id) ? "selected" : ""}`} onClick={() => togglePriority(item.id)}>{item.text}</button>)}</div>}
        <textarea style={{ marginTop: 10 }} value={prioritiesText} onChange={(event) => setPrioritiesText(event.target.value)} placeholder="Anything else, or not yet captured?" />
      </div>

      <div className="field" style={{ marginTop: 18 }}>
        <label htmlFor="weekly-change">What should change next week?</label>
        <textarea id="weekly-change" value={changeText} onChange={(event) => setChangeText(event.target.value)} placeholder="What would make next week lighter?" />
      </div>

      <div className="actions"><button className="primary" onClick={saveWeekly}>Save weekly review</button></div>
    </section>

    {reflections.length > 0 && <section className="card"><div className="section-label">Recent reflections</div><div className="item-list" style={{ marginTop: 14 }}>{reflections.slice(0, 5).map((item) => <div className="item-row" key={item.id}><div className="item-main"><div className="item-text" style={{ whiteSpace: "pre-line" }}>{item.text}</div><div className="item-meta"><span className="tag">{item.type}</span><span className="tag">{new Date(item.createdAt).toLocaleDateString()}</span></div></div></div>)}</div></section>}
    {replacing && <ReplacePanel original={replacing.item} allItems={allItems} onChoose={(chosenId) => { onReplace(replacing.item.id, chosenId); (replacing.scope === "daily" ? acknowledge : weeklyAcknowledge)(replacing.item.id); setReplacing(null); }} onJustDrop={() => { onDrop(replacing.item.id); (replacing.scope === "daily" ? acknowledge : weeklyAcknowledge)(replacing.item.id); setReplacing(null); }} onClose={() => setReplacing(null)} />}
  </div>;
}

const OVERVIEW_MODES = [["today", "Today"], ["week", "Week"], ["month", "Month"], ["projects", "Projects"], ["reflect", "Reflect"]] as const;
type OverviewMode = (typeof OVERVIEW_MODES)[number][0];

export function OverviewPage({ todayItems, thisWeekItems, weekItems, weekMinutes, categoryTotals, largestCategory, categoryConflicts, targets, onSaveTargets, committedItems, laterItems, projects, allItems, onOpen, onOpenProject, onDone, onCreateProject, doneToday, doneThisWeek, unfinishedThisWeek, openItems, reflections, onDrop, onReplace, onSaveReflection }: {
  todayItems: Item[];
  thisWeekItems: Item[];
  weekItems: Item[];
  weekMinutes: number;
  categoryTotals: { category: Category; minutes: number }[];
  largestCategory: number;
  categoryConflicts: { category: Category; minutes: number }[];
  targets: Targets;
  onSaveTargets: (targets: Targets) => void;
  committedItems: Item[];
  laterItems: Item[];
  projects: Project[];
  allItems: Item[];
  onOpen: (item: Item) => void;
  onOpenProject: (project: Project) => void;
  onDone: (item: Item) => void;
  onCreateProject: (project: Project) => void;
  doneToday: Item[];
  doneThisWeek: Item[];
  unfinishedThisWeek: Item[];
  openItems: Item[];
  reflections: Reflection[];
  onDrop: (id: string) => void;
  onReplace: (originalId: string, chosenId: string) => void;
  onSaveReflection: (type: "daily" | "weekly", text: string) => void;
}) {
  const [mode, setMode] = useState<OverviewMode>("today");
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const unscheduled = unscheduledItems(committedItems);
  const staleLater = laterItems.filter((item) => !itemDateKey(item));

  const sections: Record<OverviewMode, React.ReactNode> = {
    today: <TodayView todayItems={todayItems} thisWeekItems={thisWeekItems} projects={projects} onOpen={onOpen} onDone={onDone} />,
    week: <WeekSection weekItems={weekItems} weekMinutes={weekMinutes} categoryTotals={categoryTotals} largestCategory={largestCategory} conflicts={categoryConflicts} targets={targets} projects={projects} onSaveTargets={onSaveTargets} committedItems={committedItems} unscheduled={unscheduled} laterItems={laterItems} onOpen={onOpen} onDone={onDone} />,
    month: <MonthSection month={month} setMonth={setMonth} items={committedItems} unscheduled={unscheduled} projects={projects} staleLater={staleLater} onOpen={onOpen} onDone={onDone} />,
    projects: <ProjectsSection projects={projects} allItems={allItems} onOpen={onOpenProject} onCreateProject={onCreateProject} />,
    reflect: <ReflectionPanel doneToday={doneToday} doneThisWeek={doneThisWeek} unfinishedThisWeek={unfinishedThisWeek} openItems={openItems} allItems={allItems} projects={projects} reflections={reflections} onOpen={onOpen} onDrop={onDrop} onReplace={onReplace} onDone={onDone} onSave={onSaveReflection} />,
  };

  return <div className="stack">
    <div className="chips">{OVERVIEW_MODES.map(([key, label]) => <button type="button" key={key} className={`chip ${mode === key ? "selected" : ""}`} onClick={() => setMode(key)}>{label}</button>)}</div>
    {sections[mode]}
  </div>;
}

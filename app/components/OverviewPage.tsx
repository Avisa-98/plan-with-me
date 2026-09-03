"use client";

import { useState } from "react";
import type { Category, Item, Targets } from "../../lib/storage";
import { addDays, itemDateKey, itemsOnDate, monthGridCells, startOfMonth, startOfWeek, toDateKey, unscheduledItems, weekDays } from "../../lib/schedule";
import { formatMinutes, estimateTag, ItemRow } from "./shared";

const OVERVIEW_CATEGORIES: Category[] = ["Work", "Social", "Personal"];

// Plain open-items list, no per-list "Completed" dropdown of its own -
// each view rolls its own done items into one combined dropdown at the
// very bottom instead.
function OpenItemsList({ items, onOpen, onDone, empty }: { items: Item[]; onOpen: (item: Item) => void; onDone: (item: Item) => void; empty: string }) {
  if (!items.length) return <p className="empty">{empty}</p>;
  return <div className="item-list">{items.map((item) => <ItemRow key={item.id} item={item} onOpen={onOpen} action="Edit" onDone={onDone} />)}</div>;
}

// Same idea as OpenItemsList, but items with no exact date get a small
// plain-text "Unscheduled" divider inline rather than being split into
// their own separate boxed section - one list, not two.
function ScheduleList({ items, onOpen, onDone, empty }: { items: Item[]; onOpen: (item: Item) => void; onDone: (item: Item) => void; empty: string }) {
  if (!items.length) return <p className="empty">{empty}</p>;
  const dated = items.filter((item) => itemDateKey(item));
  const undated = items.filter((item) => !itemDateKey(item));
  return <div className="item-list">
    {dated.map((item) => <ItemRow key={item.id} item={item} onOpen={onOpen} action="Edit" onDone={onDone} />)}
    {undated.length > 0 && <div className="hint" style={{ marginTop: dated.length ? 4 : 0 }}>Unscheduled</div>}
    {undated.map((item) => <ItemRow key={item.id} item={item} onOpen={onOpen} action="Edit" onDone={onDone} />)}
  </div>;
}

// One card, segmented, same shape as Week's Feed card - Today and "still
// open for the week" used to be two separate cards for no real reason,
// both are just "what's on deck," not different kinds of thing.
function TodayView({ todayItems, thisWeekItems, onOpen, onDone }: { todayItems: Item[]; thisWeekItems: Item[]; onOpen: (item: Item) => void; onDone: (item: Item) => void }) {
  const todayOpen = todayItems.filter((item) => !item.done);
  const thisWeekOpen = thisWeekItems.filter((item) => !item.done);
  const done = [...todayItems, ...thisWeekItems].filter((item) => item.done);

  return <section className="card">
    <div className="card-header"><div><div className="section-label">Today</div><h2>{todayOpen.length ? `${todayOpen.length} thing${todayOpen.length === 1 ? "" : "s"} today` : "Nothing committed to today yet"}</h2></div></div>
    <div className="field full">
      <label>Today ({todayOpen.length})</label>
      <div style={{ marginTop: 8 }}><OpenItemsList items={todayOpen} onOpen={onOpen} onDone={onDone} empty="Organize a note from Plan and choose Today to see it here." /></div>
    </div>
    <div className="field full" style={{ marginTop: 18 }}>
      <label>This week, not on a specific day ({thisWeekOpen.length})</label>
      <div style={{ marginTop: 8 }}><OpenItemsList items={thisWeekOpen} onOpen={onOpen} onDone={onDone} empty="Nothing else queued for this week." /></div>
    </div>
    <details className="completed-details" style={{ marginTop: 18 }}>
      <summary className="section-label tiny">Completed · {done.length}</summary>
      {done.length > 0 && <div className="item-list" style={{ marginTop: 10 }}>{done.map((item) => <ItemRow key={item.id} item={item} onOpen={onOpen} action="Edit" onDone={onDone} />)}</div>}
    </details>
  </section>;
}

// This week's committed items (dated and undated together, in one list)
// plus Later's parked items. Items here are always already organised -
// they have a bucket; "unscheduled" just means no exact date yet, which
// is a normal, fine state, not a problem to fix. Truly un-organised items
// (still sitting in Inbox) never show up here at all - that's Plan's job.
function FeedCard({ weekItems, laterItems, onOpen, onDone }: { weekItems: Item[]; laterItems: Item[]; onOpen: (item: Item) => void; onDone: (item: Item) => void }) {
  const weekOpen = weekItems.filter((item) => !item.done);
  const laterOpen = laterItems.filter((item) => !item.done);
  const done = [...weekItems, ...laterItems].filter((item) => item.done);

  return <section className="card">
    <div className="card-header"><div className="section-label">Feed</div></div>
    <div className="field full">
      <label>This week ({weekOpen.length})</label>
      <div style={{ marginTop: 8 }}><ScheduleList items={weekOpen} onOpen={onOpen} onDone={onDone} empty="Organize an item and choose Today or This Week to see it here." /></div>
    </div>
    <details style={{ marginTop: 18 }}>
      <summary className="section-label">Saved for later · {laterOpen.length}</summary>
      <div style={{ marginTop: 10 }}><OpenItemsList items={laterOpen} onOpen={onOpen} onDone={onDone} empty="Nothing parked right now." /></div>
    </details>
    <details className="completed-details" style={{ marginTop: 18 }}>
      <summary className="section-label tiny">Completed · {done.length}</summary>
      {done.length > 0 && <div className="item-list" style={{ marginTop: 10 }}>{done.map((item) => <ItemRow key={item.id} item={item} onOpen={onOpen} action="Edit" onDone={onDone} />)}</div>}
    </details>
  </section>;
}

// Combines the old category/targets breakdown with the day-by-day grid -
// two lenses on the same week, stacked instead of behind their own toggle,
// since Overview's only toggle now is Today/Week/Month.
function WeekSection({ weekItems, weekMinutes, categoryTotals, largestCategory, conflicts, targets, onSaveTargets, committedItems, laterItems, onOpen, onDone }: { weekItems: Item[]; weekMinutes: number; categoryTotals: { category: Category; minutes: number }[]; largestCategory: number; conflicts: { category: Category; minutes: number }[]; targets: Targets; onSaveTargets: (targets: Targets) => void; committedItems: Item[]; laterItems: Item[]; onOpen: (item: Item) => void; onDone: (item: Item) => void }) {
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

    <FeedCard weekItems={weekItems} laterItems={laterItems} onOpen={onOpen} onDone={onDone} />

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
function MonthSection({ month, setMonth, items, unscheduled, staleLater, onOpen, onDone }: { month: Date; setMonth: (date: Date) => void; items: Item[]; unscheduled: Item[]; staleLater: Item[]; onOpen: (item: Item) => void; onDone: (item: Item) => void }) {
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
      <div style={{ marginTop: 8 }}><OpenItemsList items={pickedDayOpen} onOpen={onOpen} onDone={onDone} empty="Nothing scheduled for this day." /></div>
    </div>}
    <div style={{ marginTop: 18 }}>
      <div className="hint" style={{ marginBottom: 8 }}>Unscheduled</div>
      <OpenItemsList items={unscheduledOpen} onOpen={onOpen} onDone={onDone} empty="Everything committed has a day, or nothing is committed yet. Add a due date in Plan to put an item on the calendar." />
    </div>
    <details className="completed-details" style={{ marginTop: 18 }}>
      <summary className="section-label tiny">Completed · {done.length}</summary>
      {done.length > 0 && <div className="item-list" style={{ marginTop: 10 }}>{done.map((item) => <ItemRow key={item.id} item={item} onOpen={onOpen} action="Edit" onDone={onDone} />)}</div>}
    </details>
  </section>;
}

const OVERVIEW_MODES = [["today", "Today"], ["week", "Week"], ["month", "Month"]] as const;
type OverviewMode = (typeof OVERVIEW_MODES)[number][0];

export function OverviewPage({ todayItems, thisWeekItems, weekItems, weekMinutes, categoryTotals, largestCategory, categoryConflicts, targets, onSaveTargets, committedItems, laterItems, onOpen, onDone }: {
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
  onOpen: (item: Item) => void;
  onDone: (item: Item) => void;
}) {
  const [mode, setMode] = useState<OverviewMode>("today");
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const unscheduled = unscheduledItems(committedItems);
  const staleLater = laterItems.filter((item) => !itemDateKey(item));

  const sections: Record<OverviewMode, React.ReactNode> = {
    today: <TodayView todayItems={todayItems} thisWeekItems={thisWeekItems} onOpen={onOpen} onDone={onDone} />,
    week: <WeekSection weekItems={weekItems} weekMinutes={weekMinutes} categoryTotals={categoryTotals} largestCategory={largestCategory} conflicts={categoryConflicts} targets={targets} onSaveTargets={onSaveTargets} committedItems={committedItems} laterItems={laterItems} onOpen={onOpen} onDone={onDone} />,
    month: <MonthSection month={month} setMonth={setMonth} items={committedItems} unscheduled={unscheduled} staleLater={staleLater} onOpen={onOpen} onDone={onDone} />,
  };

  return <div className="stack">
    <div className="chips">{OVERVIEW_MODES.map(([key, label]) => <button type="button" key={key} className={`chip ${mode === key ? "selected" : ""}`} onClick={() => setMode(key)}>{label}</button>)}</div>
    {sections[mode]}
  </div>;
}

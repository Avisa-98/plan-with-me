"use client";

import { useEffect, useMemo, useState } from "react";
import { Bucket, Category, Item, Reflection, StoredData, Targets, emptyData, loadData, makeId, saveData } from "../lib/storage";
import { isArchived, isLater, isUnresolved, isWeekItem } from "../lib/views";
import { joinSelected, segmentText } from "../lib/split";
import { isDoneToday, rankReplacementCandidates } from "../lib/reflect";
import { addDays, itemsOnDate, startOfMonth, startOfWeek, toDateKey, unscheduledItems } from "../lib/schedule";

const categories: Category[] = ["Work", "Family", "Friends", "Health", "Entertainment"];
const buckets: Bucket[] = ["Today", "This Week", "Later"];
type Tab = "home" | "inbox" | "week" | "reflections";

function formatMinutes(minutes?: number) {
  if (!minutes) return "Estimate needed";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h${rest ? ` ${rest}m` : ""}` : `${rest}m`;
}

export default function Home() {
  const [data, setData] = useState<StoredData>(() => emptyData());
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [capture, setCapture] = useState("");
  const [selected, setSelected] = useState<Item | null>(null);
  const [splitting, setSplitting] = useState<Item | null>(null);
  // What's waiting on the duplicate-warning popup: the text someone tried to
  // save, the existing item it matches, and (for a split item only) which
  // note it should stay linked back to if they choose to keep it anyway.
  const [duplicate, setDuplicate] = useState<{ text: string; match: Item; splitFrom?: string } | null>(null);
  // The item waiting on the "how long did it actually take?" prompt - only
  // set when turning Done ON, since turning it off needs no such prompt.
  const [markingDone, setMarkingDone] = useState<Item | null>(null);
  const [toast, setToast] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summary, setSummary] = useState<Reflection | null>(null);

  useEffect(() => {
    setData(loadData());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) saveData(data);
  }, [data, ready]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const targets = data.targets;
  const unresolved = data.items.filter(isUnresolved);
  const weekItems = data.items.filter(isWeekItem);
  const laterItems = data.items.filter(isLater);
  const archivedItems = data.items.filter(isArchived);
  const doneToday = data.items.filter((item) => isDoneToday(item, new Date()));
  const openItems = data.items.filter((item) => !isArchived(item) && !item.done);
  // Everything actually committed to a plan - the pool the Day/Week-by-day/
  // Month views draw from, since raw Unprocessed notes have nothing to put
  // on a calendar yet.
  const committedItems = data.items.filter((item) => !isArchived(item) && item.status === "Planned");
  const weekMinutes = weekItems.reduce((sum, item) => sum + (item.estimateMinutes ?? 0), 0);
  const categoryTotals = categories.map((category) => ({
    category,
    minutes: weekItems.filter((item) => item.category === category).reduce((sum, item) => sum + (item.estimateMinutes ?? 0), 0),
  }));
  const largestCategory = Math.max(...categoryTotals.map((item) => item.minutes), 60);
  const categoryConflicts = categoryTotals.filter(({ category, minutes }) => targets[category] && minutes > (targets[category] ?? 0));

  const updateData = (updater: (current: StoredData) => StoredData) => setData((current) => updater(current));

  function showToast(message: string) {
    setToast(message);
  }

  // The one place that actually writes a new item to storage. Both Quick
  // capture and Split call this - so there is exactly one rule for what a
  // saved item looks like, instead of two copies that could drift apart.
  function commitNewItem(text: string, splitFrom: string | undefined, message: string) {
    const now = new Date().toISOString();
    const item: Item = { id: makeId(), text, status: "Unprocessed", splitFrom, createdAt: now, updatedAt: now };
    updateData((current) => ({ ...current, items: [item, ...current.items] }));
    showToast(message);
  }

  // Same duplicate check for both entry points: is there already an item
  // with this exact wording? If so, stop and ask before saving a second
  // copy, instead of silently letting the same thought pile up twice.
  function findDuplicate(text: string) {
    return data.items.find((item) => item.text.trim().toLowerCase() === text.toLowerCase());
  }

  function addThought() {
    const text = capture.trim();
    if (!text) {
      showToast("Write the thought first. Nothing was saved.");
      return;
    }
    const matching = findDuplicate(text);
    if (matching) {
      setDuplicate({ text, match: matching });
      return;
    }
    commitNewItem(text, undefined, "Saved to Unprocessed.");
    setCapture("");
  }

  function keepDuplicate() {
    if (!duplicate) return;
    const fromCapture = !duplicate.splitFrom;
    commitNewItem(duplicate.text, duplicate.splitFrom, fromCapture ? "Saved as a second note." : "Added as a second item from this note.");
    setDuplicate(null);
    if (fromCapture) setCapture("");
  }

  function saveItem(updated: Item) {
    updateData((current) => ({ ...current, items: current.items.map((item) => item.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : item) }));
    setSelected(null);
    showToast(updated.status === "Planned" ? "Added to your draft week." : "Saved in Unprocessed.");
  }

  function deleteItem(id: string) {
    updateData((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
    setSelected(null);
    showToast("Item deleted.");
  }

  // Pulls one phrase out of a braindump as its own Unprocessed item. The
  // parent note is never edited - splitFrom just points a new item back at
  // it, so the original wording is always still there to check against.
  function addSplitItem(parentId: string, text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const matching = findDuplicate(trimmed);
    if (matching) {
      setDuplicate({ text: trimmed, match: matching, splitFrom: parentId });
      return;
    }
    commitNewItem(trimmed, parentId, "Added as a separate item.");
  }

  function archiveItem(id: string) {
    updateData((current) => ({ ...current, items: current.items.map((item) => item.id === id ? { ...item, archived: true, updatedAt: new Date().toISOString() } : item) }));
    showToast("Archived. It is out of your way, not deleted.");
  }

  // Tapping Done on an already-done item un-marks it right away - no prompt
  // needed to take something back. Marking it done for the first time opens
  // the actual-time prompt instead of writing straight to storage.
  function toggleDone(item: Item) {
    if (item.done) {
      updateData((current) => ({ ...current, items: current.items.map((i) => i.id === item.id ? { ...i, done: false, actualMinutes: undefined, updatedAt: new Date().toISOString() } : i) }));
      showToast("Marked not done.");
      return;
    }
    setMarkingDone(item);
  }

  function confirmDone(id: string, actualMinutes: number | undefined) {
    updateData((current) => ({ ...current, items: current.items.map((item) => item.id === id ? { ...item, done: true, actualMinutes, updatedAt: new Date().toISOString() } : item) }));
    setMarkingDone(null);
    showToast("Marked done. Nice work.");
  }

  // Replace: the original item is dropped, and the chosen item is scheduled
  // into the slot it leaves behind - the chosen item keeps its own category
  // and estimate, it just takes over the original's bucket.
  function replaceItem(originalId: string, chosenId: string) {
    updateData((current) => {
      const original = current.items.find((item) => item.id === originalId);
      const bucket = original?.bucket ?? "Today";
      return {
        ...current,
        items: current.items
          .filter((item) => item.id !== originalId)
          .map((item) => item.id === chosenId ? { ...item, status: "Planned", bucket, updatedAt: new Date().toISOString() } : item),
      };
    });
    showToast("Replaced. The new item is scheduled in its place.");
  }

  function saveReflection(type: "daily" | "weekly", text: string) {
    if (!text.trim()) return;
    const reflection: Reflection = { id: makeId(), type, text: text.trim(), createdAt: new Date().toISOString() };
    updateData((current) => ({ ...current, reflections: [reflection, ...current.reflections] }));
    showToast(`${type === "daily" ? "Daily" : "Weekly"} reflection saved.`);
  }

  function saveTargets(next: Targets) {
    updateData((current) => ({ ...current, targets: next }));
    showToast("Weekly targets saved.");
  }

  const nav = [
    ["home", "Overview"],
    ["inbox", `Unprocessed${unresolved.length ? ` · ${unresolved.length}` : ""}`],
    ["week", "This week"],
    ["reflections", "Reflections"],
  ] as const;

  if (!ready) return <main className="app-shell"><div className="app-frame"><div className="card">Opening your planner…</div></div></main>;

  return (
    <main className="app-shell">
      <div className="app-frame">
        <header className="topbar">
          <div><div className="eyebrow">Plan With Me · v1</div><h1>Make room for what matters.</h1></div>
          <p className="top-note">Catch the thought. Keep your focus. Decide what fits when you are ready.</p>
        </header>
        <nav className="nav" aria-label="Primary navigation">
          {nav.map(([key, label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}
        </nav>

        {/* Capture comes first on every tab - the point of this app is that a
            thought never has to wait for the right screen before it's saved. */}
        <section className="card capture-card" style={{ marginBottom: 18 }}>
          <div className="card-header"><div><div className="section-label">Quick capture</div><h2>Get it out of your head.</h2></div><span className="tag">No decision needed</span></div>
          <textarea id="capture" value={capture} onChange={(event) => setCapture(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) addThought(); }} placeholder="Write a concise thought, task, event, or idea…" aria-label="New thought" />
          <div className="capture-footer"><p className="hint">Save it now. Organize it from Unprocessed whenever you have the space.</p><button className="primary" onClick={addThought}>Add to Unprocessed</button></div>
        </section>

        {tab === "home" && <Overview unresolved={unresolved} weekItems={weekItems} weekMinutes={weekMinutes} categoryTotals={categoryTotals} largestCategory={largestCategory} onCapture={() => document.getElementById("capture")?.focus()} onOpen={(item) => setSelected(item)} onTab={setTab} />}
        {tab === "inbox" && <Inbox items={unresolved} allItems={data.items} archivedItems={archivedItems} onOpen={(item) => setSelected(item)} onSplit={(item) => setSplitting(item)} onArchive={archiveItem} onSummary={() => { setSummaryOpen(true); setSummary(null); }} />}
        {tab === "week" && <PlanTab weekItems={weekItems} laterItems={laterItems} weekMinutes={weekMinutes} categoryTotals={categoryTotals} largestCategory={largestCategory} conflicts={categoryConflicts} targets={targets} onSaveTargets={saveTargets} onOpen={(item) => setSelected(item)} onDone={toggleDone} committedItems={committedItems} />}
        {tab === "reflections" && <ReflectionPanel doneToday={doneToday} openItems={openItems} allItems={data.items} reflections={data.reflections} onOpen={(item) => setSelected(item)} onDrop={deleteItem} onReplace={replaceItem} onSave={saveReflection} />}

        {selected && <OrganizePanel item={selected} onSave={saveItem} onDelete={() => deleteItem(selected.id)} onClose={() => setSelected(null)} />}
        {markingDone && <DoneModal item={markingDone} onConfirm={(minutes) => confirmDone(markingDone.id, minutes)} onSkip={() => confirmDone(markingDone.id, undefined)} />}
        {splitting && <SplitPanel item={splitting} children={data.items.filter((item) => item.splitFrom === splitting.id)} onAddChild={(text) => addSplitItem(splitting.id, text)} onClose={() => setSplitting(null)} />}
        {duplicate && <div className="modal-backdrop"><div className="modal card" role="dialog" aria-modal="true" aria-labelledby="duplicate-title"><div className="section-label">Possible duplicate</div><h2 id="duplicate-title">You already have a note like this.</h2><p className="empty">Keep it anyway, or cancel and continue with the existing note.</p><div className="actions"><button className="ghost" onClick={() => setDuplicate(null)}>Cancel</button><button className="primary" onClick={keepDuplicate}>Keep both</button></div></div></div>}
        {summaryOpen && <SummaryModal items={unresolved} onClose={() => setSummaryOpen(false)} />}
        {toast && <div className="toast" role="status">{toast}</div>}
      </div>
    </main>
  );
}

function Overview({ unresolved, weekItems, weekMinutes, categoryTotals, largestCategory, onCapture, onOpen, onTab }: { unresolved: Item[]; weekItems: Item[]; weekMinutes: number; categoryTotals: { category: Category; minutes: number }[]; largestCategory: number; onCapture: () => void; onOpen: (item: Item) => void; onTab: (tab: Tab) => void }) {
  return <div className="layout"><div className="stack"><section className="card stat-card"><div className="section-label">This week in view</div><div className="big-number">{formatMinutes(weekMinutes)}</div><p className="stat-sub">estimated across {weekItems.length} planned {weekItems.length === 1 ? "item" : "items"}. Add estimates during review to make this useful.</p><div className="split-list">{categoryTotals.map(({ category, minutes }) => <div className="split-row" key={category}><span>{category}</span><div className="split-bar"><div className="split-fill" style={{ width: `${Math.min(100, (minutes / largestCategory) * 100)}%` }} /></div><strong>{formatMinutes(minutes)}</strong></div>)}</div></section><section className="card"><div className="card-header"><div><div className="section-label">Unprocessed</div><h2>{unresolved.length ? `${unresolved.length} thought${unresolved.length === 1 ? "" : "s"} waiting` : "Your inbox is clear"}</h2></div><button className="ghost small-button" onClick={() => onTab("inbox")}>Open inbox</button></div>{unresolved.length ? <div className="item-list">{unresolved.slice(0, 4).map((item) => <ItemRow key={item.id} item={item} onOpen={onOpen} action="Organize" />)}</div> : <p className="empty">Capture the next thing before it pulls you away.</p>}</section></div><div className="stack"><section className="card"><div className="section-label">The one move</div><h2 style={{ marginTop: 8 }}>Park the thought. Keep going.</h2><p className="empty">Your notes stay unresolved until you choose to organize them. Nothing gets scheduled without your approval.</p><button className="primary" style={{ marginTop: 16, width: "100%" }} onClick={onCapture}>Add a thought</button></section><section className="card"><div className="card-header"><div><div className="section-label">Draft week</div><h2>What is taking space?</h2></div></div><p className="empty">{weekItems.length ? "Review the draft to spot conflicts and make the trade-off yourself." : "Organized items will appear here as a draft week."}</p><button className="ghost" style={{ marginTop: 15, width: "100%" }} onClick={() => onTab("week")}>Open This week</button></section></div></div>;
}

function ItemRow({ item, onOpen, action, footer, onDone }: { item: Item; onOpen: (item: Item) => void; action: string; footer?: React.ReactNode; onDone?: (item: Item) => void }) {
  return <div className="item-row-wrap"><div className="item-row"><div className="item-main"><div className="item-text">{item.text}</div><div className="item-meta">{item.splitFrom && <span className="tag subtle">↗ from a braindump</span>}{item.category && <span className="tag">{item.category}</span>}{item.bucket && <span className="tag">{item.bucket}</span>}{item.estimateMinutes ? <span className="tag accent">{formatMinutes(item.estimateMinutes)}</span> : <span className="tag">Estimate needed</span>}{item.done && <span className="tag accent">Done</span>}</div></div><div style={{ display: "flex", gap: 6 }}>{onDone && <button className={`ghost small-button${item.done ? " done" : ""}`} onClick={() => onDone(item)}>{item.done ? "Undo" : "Mark done"}</button>}<button className="ghost small-button" onClick={() => onOpen(item)}>{action}</button></div></div>{footer}</div>;
}

function DoneModal({ item, onConfirm, onSkip }: { item: Item; onConfirm: (minutes: number | undefined) => void; onSkip: () => void }) {
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  function submit() {
    const total = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
    onConfirm(total || undefined);
  }
  return <div className="modal-backdrop"><div className="modal card" role="dialog" aria-modal="true" aria-labelledby="done-title">
    <div className="card-header"><div><div className="section-label">Marked done</div><h2 id="done-title">How long did it actually take?</h2></div></div>
    <p className="empty">{item.text}</p>
    <div className="form-grid" style={{ marginTop: 14 }}>
      <div className="field"><label htmlFor="actual-hours">Hours</label><input id="actual-hours" inputMode="numeric" value={hours} onChange={(event) => setHours(event.target.value)} placeholder="0" /></div>
      <div className="field"><label htmlFor="actual-minutes">Minutes</label><input id="actual-minutes" inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value)} placeholder="0" /></div>
    </div>
    <div className="actions"><button className="ghost" onClick={onSkip}>Skip</button><button className="primary" onClick={submit}>Save time</button></div>
  </div></div>;
}

function Inbox({ items, allItems, archivedItems, onOpen, onSplit, onArchive, onSummary }: { items: Item[]; allItems: Item[]; archivedItems: Item[]; onOpen: (item: Item) => void; onSplit: (item: Item) => void; onArchive: (id: string) => void; onSummary: () => void }) {
  return <div className="stack"><section className="card"><div className="card-header"><div><div className="section-label">Unprocessed inbox</div><h2>Decide when you have space.</h2></div><button className="ghost small-button" onClick={onSummary} disabled={!items.length}>Summarize unresolved</button></div>{items.length ? <div className="item-list">{items.map((item) => {
    const childCount = allItems.filter((candidate) => candidate.splitFrom === item.id).length;
    return <ItemRow key={item.id} item={item} onOpen={onOpen} action="Organize" footer={
      <div className="row-footer">
        {childCount > 0 && <span className="hint">⤷ {childCount} item{childCount === 1 ? "" : "s"} split out</span>}
        <button className="ghost small-button" onClick={() => onSplit(item)}>Split</button>
        {childCount > 0 && <button className="ghost small-button" onClick={() => onArchive(item.id)}>Nothing left in this note</button>}
      </div>
    } />;
  })}</div> : <p className="empty">Nothing waiting here. Use Quick capture whenever a thought arrives.</p>}</section>{archivedItems.length > 0 && <section className="card"><details><summary className="section-label">Archive · {archivedItems.length}</summary><p className="hint" style={{ marginTop: 10 }}>Original braindumps you have fully split into separate items. Kept out of the way, not deleted.</p><div className="item-list" style={{ marginTop: 12 }}>{archivedItems.map((item) => <ItemRow key={item.id} item={item} onOpen={onOpen} action="View" />)}</div></details></section>}</div>;
}

function SplitPanel({ item, children, onAddChild, onClose }: { item: Item; children: Item[]; onAddChild: (text: string) => void; onClose: () => void }) {
  // Recomputed only when the note's text changes - segmentText is a pure
  // function, so re-running it on every keystroke elsewhere would be wasted
  // work. It never changes here since the original note is read-only in
  // this panel, but useMemo keeps that assumption cheap either way.
  const segments = useMemo(() => segmentText(item.text), [item.text]);
  const [pending, setPending] = useState<Set<number>>(new Set());
  // Segments made into an item this session. A segment whose exact text
  // already matches an existing child (from a previous visit to this panel)
  // is treated as consumed too, so re-opening the panel does not invite you
  // to split the same phrase out twice.
  const [consumedThisSession, setConsumedThisSession] = useState<Set<number>>(new Set());
  const usedTexts = new Set(children.map((child) => child.text.trim().toLowerCase()));

  function isConsumed(id: number, text: string) {
    return consumedThisSession.has(id) || usedTexts.has(text.trim().toLowerCase());
  }

  function toggle(segment: { id: number; text: string }) {
    if (isConsumed(segment.id, segment.text)) return;
    setPending((current) => {
      const next = new Set(current);
      if (next.has(segment.id)) next.delete(segment.id); else next.add(segment.id);
      return next;
    });
  }

  function createFromPending() {
    if (pending.size === 0) return;
    onAddChild(joinSelected(segments, pending));
    setConsumedThisSession((current) => {
      const next = new Set(current);
      pending.forEach((id) => next.add(id));
      return next;
    });
    setPending(new Set());
  }

  function createFromHighlight() {
    const text = window.getSelection()?.toString().trim() ?? "";
    if (!text) return;
    onAddChild(text);
    window.getSelection()?.removeAllRanges();
  }

  // Rebuild the note as alternating plain text (the original punctuation
  // and spacing between chunks) and clickable spans (the chunks themselves),
  // using each segment's real offsets so the note still reads naturally.
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  segments.forEach((segment) => {
    if (segment.start > cursor) nodes.push(item.text.slice(cursor, segment.start));
    const consumed = isConsumed(segment.id, segment.text);
    const state = consumed ? "chunk-consumed" : pending.has(segment.id) ? "chunk-pending" : "";
    nodes.push(<span key={segment.id} className={`chunk chunk-c${segment.id % 6} ${state}`} onClick={() => toggle(segment)}>{segment.text}</span>);
    cursor = segment.end;
  });
  if (cursor < item.text.length) nodes.push(item.text.slice(cursor));

  return <div className="modal-backdrop"><div className="modal card" role="dialog" aria-modal="true" aria-labelledby="split-title">
    <div className="card-header"><div><div className="section-label">Split this note</div><h2 id="split-title">Pull out separate items.</h2></div><button className="ghost small-button" onClick={onClose}>Close</button></div>
    <p className="empty">Tap a highlighted phrase to turn it into its own item. Tap more than one if they are part of the same thought.</p>
    <p className="split-source">{nodes}</p>
    <div className="actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
      <button className="primary" onClick={createFromPending} disabled={pending.size === 0}>{pending.size > 1 ? `Create item from ${pending.size} chunks` : "Create item"}</button>
      <button className="ghost" onClick={createFromHighlight}>Make item from highlighted text</button>
    </div>
    {children.length > 0 && <div className="field full" style={{ marginTop: 18 }}>
      <label>Split out so far ({children.length})</label>
      <div className="item-list" style={{ marginTop: 8 }}>{children.map((child) => <div className="item-row" key={child.id}><div className="item-main"><div className="item-text">{child.text}</div></div></div>)}</div>
    </div>}
    <div className="actions"><button className="ghost" onClick={onClose}>Done</button></div>
  </div></div>;
}

function OrganizePanel({ item, onSave, onDelete, onClose }: { item: Item; onSave: (item: Item) => void; onDelete: () => void; onClose: () => void }) {
  const [draft, setDraft] = useState<Item>(item);
  const [hours, setHours] = useState(item.estimateMinutes ? String(Math.floor(item.estimateMinutes / 60)) : "");
  const [minutes, setMinutes] = useState(item.estimateMinutes ? String(item.estimateMinutes % 60) : "");
  const set = (changes: Partial<Item>) => setDraft((current) => ({ ...current, ...changes }));
  function save() {
    const estimate = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
    onSave({ ...draft, status: draft.bucket ? "Planned" : "Unprocessed", estimateMinutes: estimate || undefined });
  }
  return <div className="modal-backdrop"><div className="modal card" role="dialog" aria-modal="true" aria-labelledby="organize-title"><div className="card-header"><div><div className="section-label">Unprocessed note</div><h2 id="organize-title">Give it a place.</h2></div><button className="ghost small-button" onClick={onClose}>Close</button></div><div className="field full"><label htmlFor="item-text">Note</label><textarea id="item-text" value={draft.text} onChange={(event) => set({ text: event.target.value })} /></div><div className="field" style={{ marginTop: 14 }}><label>Category</label><div className="chips">{categories.map((category) => <button type="button" className={`chip ${draft.category === category ? "selected" : ""}`} key={category} onClick={() => set({ category })}>{category}</button>)}</div></div><div className="field" style={{ marginTop: 14 }}><label>When</label><div className="chips">{buckets.map((bucket) => <button type="button" className={`chip ${draft.bucket === bucket ? "selected" : ""}`} key={bucket} onClick={() => set({ bucket })}>{bucket}</button>)}</div></div><div className="form-grid" style={{ marginTop: 14 }}><div className="field"><label htmlFor="hours">Estimated hours</label><input id="hours" inputMode="numeric" value={hours} onChange={(event) => setHours(event.target.value)} placeholder="0" /></div><div className="field"><label htmlFor="minutes">Estimated minutes</label><input id="minutes" inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value)} placeholder="0" /></div><div className="field"><label htmlFor="effort">Effort</label><select id="effort" value={draft.effort ?? ""} onChange={(event) => set({ effort: (event.target.value || undefined) as Item["effort"] })}><option value="">Not set</option><option>Low</option><option>Medium</option><option>High</option></select></div><div className="field"><label htmlFor="due">Due date</label><input id="due" type="date" value={draft.dueDate ?? ""} onChange={(event) => set({ dueDate: event.target.value || undefined })} /></div><div className="field full"><label htmlFor="project">Project name (optional)</label><input id="project" value={draft.project ?? ""} onChange={(event) => set({ project: event.target.value || undefined })} placeholder="e.g. MIS rollout" /></div></div>{!draft.bucket && <div className="notice">Leave it here if you are not ready to commit it. Blank fields are allowed.</div>}<div className="actions"><button className="danger" onClick={onDelete}>Delete</button><button className="ghost" onClick={onClose}>Cancel</button><button className="primary" onClick={save}>{draft.bucket ? "Commit to plan" : "Save in Unprocessed"}</button></div></div></div>;
}

function WeekView({ items, laterItems, weekMinutes, categoryTotals, largestCategory, conflicts, targets, onSaveTargets, onOpen, onDone }: { items: Item[]; laterItems: Item[]; weekMinutes: number; categoryTotals: { category: Category; minutes: number }[]; largestCategory: number; conflicts: { category: Category; minutes: number }[]; targets: Targets; onSaveTargets: (targets: Targets) => void; onOpen: (item: Item) => void; onDone: (item: Item) => void }) {
  // Local editing draft, seeded from the saved targets. WeekView only mounts
  // after storage has loaded, so this always starts from real saved values.
  const [draftTargets, setDraftTargets] = useState<Targets>(targets);
  return <div className="stack"><section className="card"><div className="card-header"><div><div className="section-label">Draft week</div><h2>Your week, at a glance.</h2></div><span className="tag accent">{formatMinutes(weekMinutes)} estimated</span></div>{conflicts.length > 0 && <div className="notice">This draft is above the target for {conflicts.map((item) => item.category).join(", ")}. Choose the trade-off yourself; nothing moved automatically.</div>}<div className="split-list">{categoryTotals.map(({ category, minutes }) => <div className="split-row" key={category}><span>{category}</span><div className="split-bar" style={{ background: "var(--paper-deep)" }}><div className="split-fill" style={{ width: `${Math.min(100, (minutes / largestCategory) * 100)}%` }} /></div><strong>{formatMinutes(minutes)}</strong></div>)}</div></section><section className="card"><div className="card-header"><div><div className="section-label">Items in the draft</div><h2>What is taking space?</h2></div></div>{items.length ? <div className="item-list">{items.map((item) => <ItemRow key={item.id} item={item} onOpen={onOpen} action="Edit" onDone={onDone} />)}</div> : <p className="empty">Organize an item and choose Today or This Week to see it here.</p>}</section><section className="card"><div className="card-header"><div><div className="section-label">Later</div><h2>Parked, not forgotten.</h2></div><span className="tag">{laterItems.length}</span></div>{laterItems.length ? <div className="item-list">{laterItems.map((item) => <ItemRow key={item.id} item={item} onOpen={onOpen} action="Edit" onDone={onDone} />)}</div> : <p className="empty">Items you commit to Later wait here until you pull them into a week.</p>}</section><section className="card"><div className="card-header"><div><div className="section-label">Optional setup</div><h2>Set weekly targets.</h2></div></div><p className="empty">Targets help the draft show where your time is going. You can skip this and return here later.</p><div className="form-grid" style={{ marginTop: 14 }}>{categories.map((category) => <div className="field" key={category}><label htmlFor={`target-${category}`}>{category} hours</label><input id={`target-${category}`} type="number" min="0" step="0.5" value={draftTargets[category] ?? ""} onChange={(event) => setDraftTargets({ ...draftTargets, [category]: event.target.value ? Number(event.target.value) : undefined })} placeholder="Not set" /></div>)}</div><div className="actions"><button className="primary" onClick={() => onSaveTargets(draftTargets)}>Save targets</button></div></section></div>;
}

// The "This week" tab: one set of data, four lenses on it. Category is the
// original draft-week view; Day/Week-by-day/Month all read from the same
// committed items and the same "no date yet" pile, just laid out differently.
function PlanTab({ weekItems, laterItems, weekMinutes, categoryTotals, largestCategory, conflicts, targets, onSaveTargets, onOpen, onDone, committedItems }: { weekItems: Item[]; laterItems: Item[]; weekMinutes: number; categoryTotals: { category: Category; minutes: number }[]; largestCategory: number; conflicts: { category: Category; minutes: number }[]; targets: Targets; onSaveTargets: (targets: Targets) => void; onOpen: (item: Item) => void; onDone: (item: Item) => void; committedItems: Item[] }) {
  const [mode, setMode] = useState<"category" | "day" | "week" | "month">("category");
  const [day, setDay] = useState(() => new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const unscheduled = unscheduledItems(committedItems);

  const modes = [
    ["category", "By category"],
    ["day", "Day"],
    ["week", "Week by day"],
    ["month", "Month"],
  ] as const;

  return <div className="stack">
    <div className="chips">{modes.map(([key, label]) => <button type="button" key={key} className={`chip ${mode === key ? "selected" : ""}`} onClick={() => setMode(key)}>{label}</button>)}</div>
    {mode === "category" && <WeekView items={weekItems} laterItems={laterItems} weekMinutes={weekMinutes} categoryTotals={categoryTotals} largestCategory={largestCategory} conflicts={conflicts} targets={targets} onSaveTargets={onSaveTargets} onOpen={onOpen} onDone={onDone} />}
    {mode === "day" && <DayPlanView date={day} setDate={setDay} items={committedItems} unscheduled={unscheduled} onOpen={onOpen} onDone={onDone} />}
    {mode === "week" && <WeekByDayView weekStart={weekStart} setWeekStart={setWeekStart} items={committedItems} unscheduled={unscheduled} onOpen={onOpen} onDone={onDone} />}
    {mode === "month" && <MonthPlanView month={month} setMonth={setMonth} items={committedItems} unscheduled={unscheduled} onOpen={onOpen} onDone={onDone} onPickDay={(picked) => { setDay(picked); setMode("day"); }} />}
  </div>;
}

function UnscheduledCard({ items, onOpen, onDone }: { items: Item[]; onOpen: (item: Item) => void; onDone: (item: Item) => void }) {
  return <section className="card"><div className="card-header"><div><div className="section-label">Unscheduled</div><h2>No specific day yet.</h2></div><span className="tag">{items.length}</span></div>{items.length ? <div className="item-list">{items.map((item) => <ItemRow key={item.id} item={item} onOpen={onOpen} action="Edit" onDone={onDone} />)}</div> : <p className="empty">Everything committed has a day, or nothing is committed yet. Add a due date in Organize to put an item on the calendar.</p>}</section>;
}

function DayPlanView({ date, setDate, items, unscheduled, onOpen, onDone }: { date: Date; setDate: (date: Date) => void; items: Item[]; unscheduled: Item[]; onOpen: (item: Item) => void; onDone: (item: Item) => void }) {
  const dayItems = itemsOnDate(items, toDateKey(date));
  const label = date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  return <div className="stack">
    <section className="card">
      <div className="card-header">
        <div><div className="section-label">Day</div><h2>{label}</h2></div>
        <div className="row-footer" style={{ margin: 0 }}>
          <button className="ghost small-button" onClick={() => setDate(addDays(date, -1))}>← Prev</button>
          <button className="ghost small-button" onClick={() => setDate(new Date())}>Today</button>
          <button className="ghost small-button" onClick={() => setDate(addDays(date, 1))}>Next →</button>
        </div>
      </div>
      {dayItems.length ? <div className="item-list">{dayItems.map((item) => <ItemRow key={item.id} item={item} onOpen={onOpen} action="Edit" onDone={onDone} />)}</div> : <p className="empty">Nothing scheduled for this day. Add a due date to an item in Organize to see it here.</p>}
    </section>
    <UnscheduledCard items={unscheduled} onOpen={onOpen} onDone={onDone} />
  </div>;
}

function WeekByDayView({ weekStart, setWeekStart, items, unscheduled, onOpen, onDone }: { weekStart: Date; setWeekStart: (date: Date) => void; items: Item[]; unscheduled: Item[]; onOpen: (item: Item) => void; onDone: (item: Item) => void }) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const rangeLabel = `${weekStart.toLocaleDateString(undefined, { month: "long", day: "numeric" })} – ${addDays(weekStart, 6).toLocaleDateString(undefined, { month: "long", day: "numeric" })}`;
  return <div className="stack">
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
        const dayItems = itemsOnDate(items, key);
        return <div className="week-day" key={key}>
          <div className="week-day-label">{day.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</div>
          {dayItems.length ? dayItems.map((item) => <button type="button" className="week-day-item" key={item.id} onClick={() => onOpen(item)}>{item.text}</button>) : <div className="week-day-empty">—</div>}
        </div>;
      })}</div>
    </section>
    <UnscheduledCard items={unscheduled} onOpen={onOpen} onDone={onDone} />
  </div>;
}

function MonthPlanView({ month, setMonth, items, unscheduled, onOpen, onDone, onPickDay }: { month: Date; setMonth: (date: Date) => void; items: Item[]; unscheduled: Item[]; onOpen: (item: Item) => void; onDone: (item: Item) => void; onPickDay: (date: Date) => void }) {
  const first = startOfMonth(month);
  const totalDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leadingBlanks = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const cells: (Date | null)[] = [...Array(leadingBlanks).fill(null), ...Array.from({ length: totalDays }, (_, index) => addDays(first, index))];
  return <div className="stack">
    <section className="card">
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
          return <button type="button" className="month-cell" key={key} onClick={() => onPickDay(cellDate)}>
            <span className="month-cell-num">{cellDate.getDate()}</span>
            {count > 0 && <span className="month-cell-count">{count}</span>}
          </button>;
        })}
      </div>
    </section>
    <UnscheduledCard items={unscheduled} onOpen={onOpen} onDone={onDone} />
  </div>;
}

function ReflectionPanel({ doneToday, openItems, allItems, reflections, onOpen, onDrop, onReplace, onSave }: { doneToday: Item[]; openItems: Item[]; allItems: Item[]; reflections: Reflection[]; onOpen: (item: Item) => void; onDrop: (id: string) => void; onReplace: (originalId: string, chosenId: string) => void; onSave: (type: "daily" | "weekly", text: string) => void }) {
  // Items you've already decided on this sitting - Carry forward makes no
  // storage change (there is nothing to "carry," the item just stays where
  // it is), so this local set is the only record that you've dealt with it,
  // purely so you are not asked about the same item twice in one visit.
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [replacing, setReplacing] = useState<Item | null>(null);
  const [freeText, setFreeText] = useState("");
  const [weeklyFields, setWeeklyFields] = useState({ well: "", unfinished: "", change: "", priorities: "" });
  const setWeekly = (key: keyof typeof weeklyFields, value: string) => setWeeklyFields((current) => ({ ...current, [key]: value }));
  const weeklyText = Object.entries(weeklyFields).filter(([, value]) => value.trim()).map(([key, value]) => `${key}: ${value}`).join("\n");

  const visibleOpen = openItems.filter((item) => !acknowledged.has(item.id));

  function acknowledge(id: string) {
    setAcknowledged((current) => new Set(current).add(id));
  }

  function saveDaily() {
    const summary = [doneToday.length ? `Done: ${doneToday.map((item) => item.text).join("; ")}.` : "", freeText.trim()].filter(Boolean).join("\n");
    if (!summary.trim()) return;
    onSave("daily", summary);
    setFreeText("");
  }

  return <div className="stack">
    <section className="card">
      <div className="card-header"><div><div className="section-label">End of day</div><h2>Close the loops gently.</h2></div></div>

      <div className="field full">
        <label>Done today ({doneToday.length})</label>
        {doneToday.length ? <div className="item-list" style={{ marginTop: 8 }}>{doneToday.map((item) => <div className="item-row" key={item.id}><div className="item-main"><div className="item-text">{item.text}</div><div className="item-meta"><span className="tag accent">Done</span>{item.actualMinutes ? <span className="tag">{formatMinutes(item.actualMinutes)} actual</span> : null}</div></div></div>)}</div> : <p className="empty">Nothing marked done yet today. Mark items done from Unprocessed or This week as you finish them.</p>}
      </div>

      <div className="field full" style={{ marginTop: 18 }}>
        <label>Open items ({visibleOpen.length})</label>
        {visibleOpen.length ? <div className="item-list" style={{ marginTop: 8 }}>{visibleOpen.map((item) => <div className="item-row-wrap" key={item.id}>
          <div className="item-row"><div className="item-main"><div className="item-text">{item.text}</div><div className="item-meta">{item.category && <span className="tag">{item.category}</span>}{item.bucket && <span className="tag">{item.bucket}</span>}{item.estimateMinutes ? <span className="tag accent">{formatMinutes(item.estimateMinutes)}</span> : <span className="tag">Estimate needed</span>}</div></div><button className="ghost small-button" onClick={() => onOpen(item)}>Edit</button></div>
          <div className="row-footer">
            <button className="ghost small-button" onClick={() => acknowledge(item.id)}>Carry forward</button>
            <button className="ghost small-button" onClick={() => { onDrop(item.id); acknowledge(item.id); }}>Drop</button>
            <button className="ghost small-button" onClick={() => setReplacing(item)}>Replace</button>
          </div>
        </div>)}</div> : <p className="empty">Nothing open right now.</p>}
      </div>

      <div className="field" style={{ marginTop: 18 }}>
        <label htmlFor="daily-reflection">Free reflection</label>
        <textarea id="daily-reflection" value={freeText} onChange={(event) => setFreeText(event.target.value)} placeholder="What did today teach you?" />
      </div>
      <div className="actions"><button className="primary" onClick={saveDaily}>Save daily reflection</button></div>
    </section>
    <section className="card"><div className="section-label">End of week</div><h2 style={{ marginTop: 8 }}>Make the next week lighter.</h2><div className="review-grid" style={{ marginTop: 18 }}><ReviewCard title="What went well?" value={weeklyFields.well} setValue={(value) => setWeekly("well", value)} /><ReviewCard title="What stayed unfinished?" value={weeklyFields.unfinished} setValue={(value) => setWeekly("unfinished", value)} /><ReviewCard title="What should change next week?" value={weeklyFields.change} setValue={(value) => setWeekly("change", value)} /><ReviewCard title="Next week’s priorities" value={weeklyFields.priorities} setValue={(value) => setWeekly("priorities", value)} /></div><div className="actions"><button className="primary" onClick={() => { onSave("weekly", weeklyText); setWeeklyFields({ well: "", unfinished: "", change: "", priorities: "" }); }}>Save weekly review</button></div></section>
    {reflections.length > 0 && <section className="card"><div className="section-label">Recent reflections</div><div className="item-list" style={{ marginTop: 14 }}>{reflections.slice(0, 5).map((item) => <div className="item-row" key={item.id}><div className="item-main"><div className="item-text" style={{ whiteSpace: "pre-line" }}>{item.text}</div><div className="item-meta"><span className="tag">{item.type}</span><span className="tag">{new Date(item.createdAt).toLocaleDateString()}</span></div></div></div>)}</div></section>}
    {replacing && <ReplacePanel original={replacing} allItems={allItems} onChoose={(chosenId) => { onReplace(replacing.id, chosenId); acknowledge(replacing.id); setReplacing(null); }} onJustDrop={() => { onDrop(replacing.id); acknowledge(replacing.id); setReplacing(null); }} onClose={() => setReplacing(null)} />}
  </div>;
}

function ReplacePanel({ original, allItems, onChoose, onJustDrop, onClose }: { original: Item; allItems: Item[]; onChoose: (chosenId: string) => void; onJustDrop: () => void; onClose: () => void }) {
  const [choosing, setChoosing] = useState(false);

  if (!choosing) {
    return <div className="modal-backdrop"><div className="modal card" role="dialog" aria-modal="true" aria-labelledby="replace-title">
      <div className="card-header"><div><div className="section-label">Replace</div><h2 id="replace-title">Pick something now, or later?</h2></div><button className="ghost small-button" onClick={onClose}>Close</button></div>
      <p className="empty">“{original.text}” will be dropped either way. Fill its spot with something else now, or leave it empty for now.</p>
      <div className="actions"><button className="ghost" onClick={onJustDrop}>Just drop it</button><button className="primary" onClick={() => setChoosing(true)}>Pick a replacement</button></div>
    </div></div>;
  }

  const ranked = rankReplacementCandidates(original, allItems);
  return <div className="modal-backdrop"><div className="modal card" role="dialog" aria-modal="true" aria-labelledby="replace-pick-title">
    <div className="card-header"><div><div className="section-label">Replace</div><h2 id="replace-pick-title">Choose what fills this spot.</h2></div><button className="ghost small-button" onClick={onClose}>Close</button></div>
    <p className="empty">Dropping “{original.text}” ({formatMinutes(original.estimateMinutes)}). Items that fit the same time or less are listed first.</p>
    {ranked.length ? <div className="item-list" style={{ marginTop: 12 }}>{ranked.map(({ item, longer }) => <div className="item-row" key={item.id}><div className="item-main"><div className="item-text">{item.text}</div><div className="item-meta"><span className="tag accent">{formatMinutes(item.estimateMinutes)}</span>{longer && <span className="tag">Takes longer</span>}</div></div><button className="ghost small-button" onClick={() => onChoose(item.id)}>Choose</button></div>)}</div> : <p className="empty">Nothing else has a time estimate yet to swap in. Add an estimate to another item first.</p>}
  </div></div>;
}

function ReviewCard({ title, value, setValue }: { title: string; value: string; setValue: (value: string) => void }) { return <div className="review-card"><h3>{title}</h3><textarea value={value} onChange={(event) => setValue(event.target.value)} placeholder="Add a note…" /></div>; }

function SummaryModal({ items, onClose }: { items: Item[]; onClose: () => void }) { return <div className="modal-backdrop"><div className="modal card" role="dialog" aria-modal="true" aria-labelledby="summary-title"><div className="card-header"><div><div className="section-label">Manual summary</div><h2 id="summary-title">What is still asking for attention?</h2></div><button className="ghost small-button" onClick={onClose}>Close</button></div><p className="empty">This is only a quick scan. Nothing is categorized or scheduled by this summary.</p><div className="item-list" style={{ marginTop: 14 }}>{items.map((item) => <div className="item-row" key={item.id}><div className="item-main"><div className="item-text">{item.text}</div><div className="item-meta"><span className="tag">Unprocessed</span></div></div></div>)}</div></div></div>; }

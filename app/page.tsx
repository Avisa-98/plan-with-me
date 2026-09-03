"use client";

import { useEffect, useMemo, useState } from "react";
import { Bucket, Category, Item, ItemType, StoredData, Targets, emptyData, exportData, loadData, makeId, parseImport, saveData } from "../lib/storage";
import { exportMarkdown } from "../lib/exportMarkdown";
import { isIdea, isLater, isUnresolved, isWeekItem } from "../lib/views";
import { joinSelected, segmentText } from "../lib/split";
import { formatMinutes, ItemRow, DoneModal } from "./components/shared";
import { PlanPage } from "./components/PlanPage";
import { OverviewPage } from "./components/OverviewPage";

const categories: Category[] = ["Work", "Social", "Personal"];
const buckets: Bucket[] = ["Today", "This Week", "This Month", "Later"];
type Tab = "plan" | "overview";

export default function Home() {
  const [data, setData] = useState<StoredData>(() => emptyData());
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("plan");
  const [capture, setCapture] = useState("");
  const [selected, setSelected] = useState<Item | null>(null);
  const [splitting, setSplitting] = useState<Item | null>(null);
  // What's waiting on the duplicate-warning popup: the text someone tried to
  // save, the existing item it matches, and (for a split item only) which
  // note it should stay linked back to if they choose to keep it anyway.
  const [duplicate, setDuplicate] = useState<{ text: string; match: Item; splitFrom?: string; type?: ItemType } | null>(null);
  // The item waiting on the "how long did it actually take?" prompt - only
  // set when turning Done ON, since turning it off needs no such prompt.
  const [markingDone, setMarkingDone] = useState<Item | null>(null);
  const [toast, setToast] = useState("");
  // Starts "light" only as a placeholder - the blocking script in
  // layout.tsx already set the real theme on the page before React ever
  // ran, so the effect below just reads that back rather than guessing.
  const [theme, setTheme] = useState<"light" | "dark">("light");

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

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "dark" || current === "light") setTheme(current);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("plan-with-me:theme", next);
  }

  const targets = data.targets;
  const unresolved = data.items.filter(isUnresolved);
  const weekItems = data.items.filter(isWeekItem);
  // What Today actually shows: items you committed straight to Today, plus
  // (separately) items you put in This Week but never pinned to Today - so
  // that second group doesn't require a trip to the This Week tab to see.
  const todayItems = weekItems.filter((item) => item.bucket === "Today");
  const thisWeekItems = weekItems.filter((item) => item.bucket === "This Week");
  const laterItems = data.items.filter(isLater);
  const ideaItems = data.items.filter(isIdea);
  // Everything actually committed to a plan - the pool the Week/Month views
  // draw from, since raw Inbox notes have nothing to put on a calendar yet.
  const committedItems = data.items.filter((item) => item.status === "Planned");
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

  // Everything lives only in this browser's storage - Export writes the
  // exact same shape Import reads back, using the same functions, so a
  // round trip can't silently drop or reshape anything in between.
  function exportBackup() {
    const blob = new Blob([exportData(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `plan-with-me-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Backup downloaded.");
  }

  // A separate, read-only copy for humans - not the backup/restore format
  // above, and never read back in by Import. Real markdown checklists, so
  // it opens cleanly in a plain-text notes app like Obsidian too.
  function exportMarkdownBackup() {
    const blob = new Blob([exportMarkdown(data)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `plan-with-me-backup-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Markdown copy downloaded.");
  }

  function importBackup(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseImport(String(reader.result ?? ""));
      if (!parsed) {
        showToast("That file doesn't look like a Plan With Me backup.");
        return;
      }
      setData(parsed);
      showToast(`Imported ${parsed.items.length} item${parsed.items.length === 1 ? "" : "s"}.`);
    };
    reader.readAsText(file);
  }

  // The one place that actually writes a new item to storage. Both Quick
  // capture and Split call this - so there is exactly one rule for what a
  // saved item looks like, instead of two copies that could drift apart.
  function commitNewItem(text: string, splitFrom: string | undefined, message: string, type?: ItemType) {
    const now = new Date().toISOString();
    const item: Item = { id: makeId(), text, status: "Inbox", type, splitFrom, createdAt: now, updatedAt: now };
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
    commitNewItem(text, undefined, "Saved to Inbox.");
    setCapture("");
  }

  function keepDuplicate() {
    if (!duplicate) return;
    const fromCapture = !duplicate.splitFrom;
    commitNewItem(duplicate.text, duplicate.splitFrom, fromCapture ? "Saved as a second note." : "Added as a second item from this note.", duplicate.type);
    setDuplicate(null);
    if (fromCapture) setCapture("");
  }

  function saveItem(updated: Item) {
    updateData((current) => ({ ...current, items: current.items.map((item) => item.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : item) }));
    setSelected(null);
    showToast(updated.type === "idea" ? "Added to your idea log." : updated.status === "Planned" ? "Added to your draft week." : "Saved in Inbox.");
  }

  // Same write as saveItem, minus the toast - PlanPage's organize rows call
  // this once per chip tap, and a toast per tap would be noise, not
  // feedback. Modal-based edit paths (OrganizePanel) keep using saveItem,
  // where one toast per explicit Save action is the right amount.
  function updateItemSilently(updated: Item) {
    updateData((current) => ({ ...current, items: current.items.map((item) => item.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : item) }));
  }

  function deleteItem(id: string) {
    updateData((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
    setSelected(null);
    showToast("Item deleted.");
  }

  // Pulls one phrase out of a braindump as its own Inbox item. The
  // parent note is never edited - splitFrom just points a new item back at
  // it, so the original wording is always still there to check against.
  function addSplitItem(parentId: string, text: string, type: ItemType) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const matching = findDuplicate(trimmed);
    if (matching) {
      setDuplicate({ text: trimmed, match: matching, splitFrom: parentId, type });
      return;
    }
    commitNewItem(trimmed, parentId, type === "idea" ? "Added as a separate idea." : "Added as a separate item.", type);
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

  function saveTargets(next: Targets) {
    updateData((current) => ({ ...current, targets: next }));
    showToast("Weekly targets saved.");
  }

  const nav = [
    ["plan", `Plan${unresolved.length ? ` · ${unresolved.length}` : ""}`],
    ["overview", "Overview"],
  ] as const;

  if (!ready) return <main className="app-shell"><div className="app-frame"><div className="card">Opening your planner…</div></div></main>;

  const planPageNode = <>
    <PlanPage items={unresolved} capture={capture} setCapture={setCapture} onAddThought={addThought} onSaveItem={updateItemSilently} onDeleteItem={deleteItem} onAddChild={addSplitItem} />
    {ideaItems.length > 0 && <section className="card" style={{ marginTop: 18 }}><details><summary className="section-label">Idea log · {ideaItems.length}</summary><p className="hint" style={{ marginTop: 10 }}>Fleeting ideas, not tasks - no schedule, no estimate. Tap Edit to change the wording or drop one back to a task.</p><div style={{ marginTop: 12 }}><OrganizableList items={ideaItems} action="Edit" onSaveItem={saveItem} onDeleteItem={deleteItem} onSplitItem={(item) => setSplitting(item)} /></div></details></section>}
  </>;

  const overviewProps = {
    todayItems, thisWeekItems, weekMinutes, categoryTotals, largestCategory,
    categoryConflicts, targets, onSaveTargets: saveTargets, committedItems, laterItems,
    onOpen: (item: Item) => setSelected(item), onDone: toggleDone,
  };

  return (
    <main className="app-shell">
      <div className="app-frame">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button className="theme-toggle" onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>{theme === "dark" ? "☀️" : "🌙"}</button>
        </div>
        {/* The full hero sells the product to someone with nothing saved yet.
            Once there's real content, it would just push that content down
            on every visit - so a returning user gets a compact title bar
            instead. */}
        {data.items.length === 0 ? (
          <header className="topbar">
            <div><div className="eyebrow">Plan With Me · v1</div><h1>Capture the thought. Plan the week. No login.</h1></div>
            <p className="top-note">For anyone whose day gets pulled in five directions. Jot down what's on your mind in seconds, then turn it into a real plan when you have a minute.</p>
          </header>
        ) : (
          <header className="topbar-compact"><span className="eyebrow">Plan With Me</span></header>
        )}
        <nav className="nav" aria-label="Primary navigation">
          {nav.map(([key, label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}
        </nav>

        {tab === "plan" && planPageNode}
        {tab === "overview" && <OverviewPage {...overviewProps} />}

        <div className="device-banner" style={{ marginTop: 18 }}>
          <p>Saved on this device only — no account, no cloud backup. Clearing your browser data clears your plan.</p>
          <div className="device-banner-actions">
            <button className="ghost small-button" onClick={exportBackup}>Export backup</button>
            <button className="ghost small-button" onClick={() => document.getElementById("import-file")?.click()}>Import backup</button>
            <button className="ghost small-button" onClick={exportMarkdownBackup}>Export as Markdown</button>
            <input id="import-file" type="file" accept="application/json" style={{ display: "none" }} onChange={(event) => { const file = event.target.files?.[0]; if (file) importBackup(file); event.target.value = ""; }} />
          </div>
        </div>

        {selected && <OrganizePanel item={selected} onSave={saveItem} onDelete={() => deleteItem(selected.id)} onClose={() => setSelected(null)} onSplit={() => { setSplitting(selected); setSelected(null); }} />}
        {markingDone && <DoneModal item={markingDone} onConfirm={(minutes) => confirmDone(markingDone.id, minutes)} onSkip={() => confirmDone(markingDone.id, undefined)} />}
        {splitting && <SplitPanel item={splitting} children={data.items.filter((item) => item.splitFrom === splitting.id)} onAddChild={(text, type) => addSplitItem(splitting.id, text, type)} onClose={() => setSplitting(null)} />}
        {duplicate && <div className="modal-backdrop"><div className="modal card" role="dialog" aria-modal="true" aria-labelledby="duplicate-title"><div className="section-label">Possible duplicate</div><h2 id="duplicate-title">You already have a note like this.</h2><p className="empty">Keep it anyway, or cancel and continue with the existing note.</p><div className="actions"><button className="ghost" onClick={() => setDuplicate(null)}>Cancel</button><button className="primary" onClick={keepDuplicate}>Keep both</button></div></div></div>}
        {toast && <div className="toast" role="status">{toast}</div>}
      </div>
    </main>
  );
}

// A list of items where "Organize"/"Edit"/whatever expands the same form
// used everywhere, right in place - instead of covering the list you were
// just looking at with a separate screen. Each row tracks its own expanded
// state, and only one row in a given list opens at a time.
function OrganizableList({ items, action, onDone, footer, onSaveItem, onDeleteItem, onSplitItem }: { items: Item[]; action: string; onDone?: (item: Item) => void; footer?: (item: Item) => React.ReactNode; onSaveItem: (item: Item) => void; onDeleteItem: (id: string) => void; onSplitItem: (item: Item) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // The row itself turns into the form when expanded - not a row that stays
  // put plus a second box underneath it.
  return <div className="item-list">{items.map((item) => {
    if (expandedId === item.id) {
      return <OrganizePanel key={item.id} item={item} inline onSave={(updated) => { onSaveItem(updated); setExpandedId(null); }} onDelete={() => { onDeleteItem(item.id); setExpandedId(null); }} onSplit={() => onSplitItem(item)} onClose={() => setExpandedId(null)} />;
    }
    return <ItemRow key={item.id} item={item} onOpen={() => setExpandedId(item.id)} action={action} onDone={onDone} footer={footer ? footer(item) : undefined} />;
  })}</div>;
}


function SplitPanel({ item, children, onAddChild, onClose }: { item: Item; children: Item[]; onAddChild: (text: string, type: ItemType) => void; onClose: () => void }) {
  // Recomputed only when the note's text changes - segmentText is a pure
  // function, so re-running it on every keystroke elsewhere would be wasted
  // work. It never changes here since the original note is read-only in
  // this panel, but useMemo keeps that assumption cheap either way.
  const segments = useMemo(() => segmentText(item.text), [item.text]);
  const [pending, setPending] = useState<Set<number>>(new Set());
  // What the next item you pull out becomes. A braindump can mix tasks and
  // ideas together, so this stays as you left it rather than resetting after
  // each one - pulling three ideas in a row shouldn't mean re-picking Idea
  // three times.
  const [splitType, setSplitType] = useState<ItemType>("task");
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
    onAddChild(joinSelected(segments, pending), splitType);
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
    onAddChild(text, splitType);
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
    <div className="field" style={{ marginTop: 14 }}>
      <label>Add as</label>
      <div className="chips">
        <button type="button" className={`chip ${splitType === "task" ? "selected" : ""}`} onClick={() => setSplitType("task")}>Task</button>
        <button type="button" className={`chip ${splitType === "idea" ? "selected" : ""}`} onClick={() => setSplitType("idea")}>Idea</button>
      </div>
    </div>
    <div className="actions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
      <button className="primary" onClick={createFromPending} disabled={pending.size === 0}>{pending.size > 1 ? `Create item from ${pending.size} chunks` : "Create item"}</button>
      <button className="ghost" onClick={createFromHighlight}>Make item from highlighted text</button>
    </div>
    {children.length > 0 && <div className="field full" style={{ marginTop: 18 }}>
      <label>Split out so far ({children.length})</label>
      <div className="item-list" style={{ marginTop: 8 }}>{children.map((child) => <div className="item-row" key={child.id}><div className="item-main"><div className="item-text">{child.text}</div>{child.type === "idea" && <div className="item-meta"><span className="tag">Idea</span></div>}</div></div>)}</div>
    </div>}
    <div className="actions"><button className="ghost" onClick={onClose}>Done</button></div>
  </div></div>;
}

function OrganizePanel({ item, onSave, onDelete, onClose, onSplit, inline }: { item: Item; onSave: (item: Item) => void; onDelete: () => void; onClose: () => void; onSplit: () => void; inline?: boolean }) {
  const [draft, setDraft] = useState<Item>(item);
  const [hours, setHours] = useState(item.estimateMinutes ? String(Math.floor(item.estimateMinutes / 60)) : "");
  const [minutes, setMinutes] = useState(item.estimateMinutes ? String(item.estimateMinutes % 60) : "");
  const set = (changes: Partial<Item>) => setDraft((current) => ({ ...current, ...changes }));
  const isIdea = (draft.type ?? "task") === "idea";
  // "Add to idea log" the first time something becomes an idea; "Save" when
  // re-editing something that was already logged as one - the original item
  // decides which, not whatever the Type toggle is set to right now.
  const alreadyLogged = item.type === "idea";

  function save() {
    if (isIdea) {
      onSave({ ...draft, type: "idea" });
      return;
    }
    const estimate = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
    onSave({ ...draft, type: "task", status: draft.bucket ? "Planned" : "Inbox", estimateMinutes: estimate || undefined });
  }

  const content = <>
    <div className="card-header"><div><div className="section-label">Inbox note</div><h2 id="organize-title">Give it a place.</h2></div><div style={{ display: "flex", gap: 6 }}><button className="ghost small-button" onClick={onSplit}>Split</button><button className="ghost small-button" onClick={onClose}>{inline ? "Collapse" : "Close"}</button></div></div>
    <div className="field full"><label htmlFor="item-text">Note</label><textarea id="item-text" value={draft.text} onChange={(event) => set({ text: event.target.value })} /></div>
    <div className="field" style={{ marginTop: 14 }}><label>Type</label><div className="chips">
      <button type="button" className={`chip ${!isIdea ? "selected" : ""}`} onClick={() => set({ type: "task" })}>Task</button>
      <button type="button" className={`chip ${isIdea ? "selected" : ""}`} onClick={() => set({ type: "idea" })}>Idea</button>
    </div></div>
    {isIdea ? (
      <p className="empty">Ideas skip the schedule entirely - no category, estimate, or bucket. Just the note, logged for later.</p>
    ) : (
      <>
        <div className="field" style={{ marginTop: 14 }}><label>Category</label><div className="chips">{categories.map((category) => <button type="button" className={`chip ${draft.category === category ? "selected" : ""}`} key={category} onClick={() => set({ category })}>{category}</button>)}</div></div>
        <div className="field" style={{ marginTop: 14 }}><label>When</label><div className="chips">{buckets.map((bucket) => <button type="button" className={`chip ${draft.bucket === bucket ? "selected" : ""}`} key={bucket} onClick={() => set({ bucket })}>{bucket}</button>)}</div></div>
        <div className="form-grid" style={{ marginTop: 14 }}>
          <div className="field"><label htmlFor="hours">Estimated hours</label><input id="hours" inputMode="numeric" value={hours} onChange={(event) => setHours(event.target.value)} placeholder="0" /></div>
          <div className="field"><label htmlFor="minutes">Estimated minutes</label><input id="minutes" inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value)} placeholder="0" /></div>
          <div className="field"><label htmlFor="effort">Effort</label><select id="effort" value={draft.effort ?? ""} onChange={(event) => set({ effort: (event.target.value || undefined) as Item["effort"] })}><option value="">Not set</option><option>Low</option><option>Medium</option><option>High</option></select></div>
          <div className="field"><label htmlFor="due">Due date</label><input id="due" type="date" value={draft.dueDate ?? ""} onChange={(event) => set({ dueDate: event.target.value || undefined })} /></div>
        </div>
        {!draft.bucket && <div className="notice">Leave it here if you are not ready to commit it. Blank fields are allowed.</div>}
      </>
    )}
    <div className="actions">
      <button className="danger" onClick={onDelete}>Delete</button>
      <button className="ghost" onClick={onClose}>Cancel</button>
      <button className="primary" onClick={save}>{isIdea ? (alreadyLogged ? "Save" : "Add to idea log") : (draft.bucket ? "Commit to plan" : "Save in Inbox")}</button>
    </div>
  </>;

  // Reused two ways: the normal full-screen modal everywhere else, or -
  // from inside the Idea Log - expanded right in place, so organizing an
  // idea doesn't cover the list you came from and force you to close it
  // just to see it again.
  if (inline) {
    return <div className="card" style={{ marginTop: 8, marginBottom: 8, boxShadow: "none", background: "rgba(244, 240, 232, .55)" }}>{content}</div>;
  }
  return <div className="modal-backdrop"><div className="modal card" role="dialog" aria-modal="true" aria-labelledby="organize-title">{content}</div></div>;
}

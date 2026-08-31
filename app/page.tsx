"use client";

import { useEffect, useMemo, useState } from "react";
import { Bucket, Category, Item, Reflection, StoredData, Targets, emptyData, loadData, makeId, saveData } from "../lib/storage";
import { isLater, isUnresolved, isWeekItem } from "../lib/views";

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
  const [duplicate, setDuplicate] = useState<Item | null>(null);
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

  function addThought() {
    const text = capture.trim();
    if (!text) {
      showToast("Write the thought first. Nothing was saved.");
      return;
    }
    const matching = data.items.find((item) => item.text.trim().toLowerCase() === text.toLowerCase());
    if (matching) {
      setDuplicate(matching);
      return;
    }
    const now = new Date().toISOString();
    const item: Item = { id: makeId(), text, status: "Unprocessed", createdAt: now, updatedAt: now };
    updateData((current) => ({ ...current, items: [item, ...current.items] }));
    setCapture("");
    showToast("Saved to Unprocessed.");
  }

  function keepDuplicate() {
    const text = capture.trim();
    const now = new Date().toISOString();
    const item: Item = { id: makeId(), text, status: "Unprocessed", createdAt: now, updatedAt: now };
    updateData((current) => ({ ...current, items: [item, ...current.items] }));
    setDuplicate(null);
    setCapture("");
    showToast("Saved as a second note.");
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

        {tab === "home" && <Overview unresolved={unresolved} weekItems={weekItems} weekMinutes={weekMinutes} categoryTotals={categoryTotals} largestCategory={largestCategory} onCapture={() => document.getElementById("capture")?.focus()} onOpen={(item) => setSelected(item)} onTab={setTab} />}
        {tab === "inbox" && <Inbox items={unresolved} onOpen={(item) => setSelected(item)} onSummary={() => { setSummaryOpen(true); setSummary(null); }} />}
        {tab === "week" && <WeekView items={weekItems} laterItems={laterItems} weekMinutes={weekMinutes} categoryTotals={categoryTotals} largestCategory={largestCategory} conflicts={categoryConflicts} targets={targets} onSaveTargets={saveTargets} onOpen={(item) => setSelected(item)} />}
        {tab === "reflections" && <ReflectionPanel unresolved={unresolved} reflections={data.reflections} onOpen={(item) => setSelected(item)} onSave={saveReflection} />}

        <section className="card capture-card" style={{ marginTop: 18 }}>
          <div className="card-header"><div><div className="section-label">Quick capture</div><h2>Get it out of your head.</h2></div><span className="tag">No decision needed</span></div>
          <textarea id="capture" value={capture} onChange={(event) => setCapture(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) addThought(); }} placeholder="Write a concise thought, task, event, or idea…" aria-label="New thought" />
          <div className="capture-footer"><p className="hint">Save it now. Organize it from Unprocessed whenever you have the space.</p><button className="primary" onClick={addThought}>Add to Unprocessed</button></div>
        </section>

        {selected && <OrganizePanel item={selected} onSave={saveItem} onDelete={() => deleteItem(selected.id)} onClose={() => setSelected(null)} />}
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

function ItemRow({ item, onOpen, action }: { item: Item; onOpen: (item: Item) => void; action: string }) {
  return <div className="item-row"><div className="item-main"><div className="item-text">{item.text}</div><div className="item-meta">{item.category && <span className="tag">{item.category}</span>}{item.bucket && <span className="tag">{item.bucket}</span>}{item.estimateMinutes ? <span className="tag accent">{formatMinutes(item.estimateMinutes)}</span> : <span className="tag">Estimate needed</span>}</div></div><button className="ghost small-button" onClick={() => onOpen(item)}>{action}</button></div>;
}

function Inbox({ items, onOpen, onSummary }: { items: Item[]; onOpen: (item: Item) => void; onSummary: () => void }) {
  return <section className="card"><div className="card-header"><div><div className="section-label">Unprocessed inbox</div><h2>Decide when you have space.</h2></div><button className="ghost small-button" onClick={onSummary} disabled={!items.length}>Summarize unresolved</button></div>{items.length ? <div className="item-list">{items.map((item) => <ItemRow key={item.id} item={item} onOpen={onOpen} action="Organize" />)}</div> : <p className="empty">Nothing waiting here. Use Quick capture whenever a thought arrives.</p>}</section>;
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

function WeekView({ items, laterItems, weekMinutes, categoryTotals, largestCategory, conflicts, targets, onSaveTargets, onOpen }: { items: Item[]; laterItems: Item[]; weekMinutes: number; categoryTotals: { category: Category; minutes: number }[]; largestCategory: number; conflicts: { category: Category; minutes: number }[]; targets: Targets; onSaveTargets: (targets: Targets) => void; onOpen: (item: Item) => void }) {
  // Local editing draft, seeded from the saved targets. WeekView only mounts
  // after storage has loaded, so this always starts from real saved values.
  const [draftTargets, setDraftTargets] = useState<Targets>(targets);
  return <div className="stack"><section className="card"><div className="card-header"><div><div className="section-label">Draft week</div><h2>Your week, at a glance.</h2></div><span className="tag accent">{formatMinutes(weekMinutes)} estimated</span></div>{conflicts.length > 0 && <div className="notice">This draft is above the target for {conflicts.map((item) => item.category).join(", ")}. Choose the trade-off yourself; nothing moved automatically.</div>}<div className="split-list">{categoryTotals.map(({ category, minutes }) => <div className="split-row" key={category}><span>{category}</span><div className="split-bar" style={{ background: "var(--paper-deep)" }}><div className="split-fill" style={{ width: `${Math.min(100, (minutes / largestCategory) * 100)}%` }} /></div><strong>{formatMinutes(minutes)}</strong></div>)}</div></section><section className="card"><div className="card-header"><div><div className="section-label">Items in the draft</div><h2>What is taking space?</h2></div></div>{items.length ? <div className="item-list">{items.map((item) => <ItemRow key={item.id} item={item} onOpen={onOpen} action="Edit" />)}</div> : <p className="empty">Organize an item and choose Today or This Week to see it here.</p>}</section><section className="card"><div className="card-header"><div><div className="section-label">Later</div><h2>Parked, not forgotten.</h2></div><span className="tag">{laterItems.length}</span></div>{laterItems.length ? <div className="item-list">{laterItems.map((item) => <ItemRow key={item.id} item={item} onOpen={onOpen} action="Edit" />)}</div> : <p className="empty">Items you commit to Later wait here until you pull them into a week.</p>}</section><section className="card"><div className="card-header"><div><div className="section-label">Optional setup</div><h2>Set weekly targets.</h2></div></div><p className="empty">Targets help the draft show where your time is going. You can skip this and return here later.</p><div className="form-grid" style={{ marginTop: 14 }}>{categories.map((category) => <div className="field" key={category}><label htmlFor={`target-${category}`}>{category} hours</label><input id={`target-${category}`} type="number" min="0" step="0.5" value={draftTargets[category] ?? ""} onChange={(event) => setDraftTargets({ ...draftTargets, [category]: event.target.value ? Number(event.target.value) : undefined })} placeholder="Not set" /></div>)}</div><div className="actions"><button className="primary" onClick={() => onSaveTargets(draftTargets)}>Save targets</button></div></section></div>;
}

function ReflectionPanel({ unresolved, reflections, onOpen, onSave }: { unresolved: Item[]; reflections: Reflection[]; onOpen: (item: Item) => void; onSave: (type: "daily" | "weekly", text: string) => void }) {
  const [dailyFields, setDailyFields] = useState({ done: "", carry: "", drop: "", reflection: "" });
  const [weeklyFields, setWeeklyFields] = useState({ well: "", unfinished: "", change: "", priorities: "" });
  const setDaily = (key: keyof typeof dailyFields, value: string) => setDailyFields((current) => ({ ...current, [key]: value }));
  const setWeekly = (key: keyof typeof weeklyFields, value: string) => setWeeklyFields((current) => ({ ...current, [key]: value }));
  const dailyText = Object.entries(dailyFields).filter(([, value]) => value.trim()).map(([key, value]) => `${key}: ${value}`).join("\n");
  const weeklyText = Object.entries(weeklyFields).filter(([, value]) => value.trim()).map(([key, value]) => `${key}: ${value}`).join("\n");
  return <div className="stack"><section className="card"><div className="card-header"><div><div className="section-label">End of day</div><h2>Close the loops gently.</h2></div></div>{unresolved.length > 0 && <><p className="empty">These unresolved items are waiting for a decision.</p><div className="item-list" style={{ marginTop: 12 }}>{unresolved.map((item) => <ItemRow key={item.id} item={item} onOpen={onOpen} action="Resolve" />)}</div></>}<div className="review-grid" style={{ marginTop: 18 }}><ReviewCard title="Done" value={dailyFields.done} setValue={(value) => setDaily("done", value)} /><ReviewCard title="Carry forward" value={dailyFields.carry} setValue={(value) => setDaily("carry", value)} /><ReviewCard title="Drop or replace" value={dailyFields.drop} setValue={(value) => setDaily("drop", value)} /></div><div className="field" style={{ marginTop: 14 }}><label htmlFor="daily-reflection">Free reflection</label><textarea id="daily-reflection" value={dailyFields.reflection} onChange={(event) => setDaily("reflection", event.target.value)} placeholder="What did today teach you?" /></div><div className="actions"><button className="primary" onClick={() => { onSave("daily", dailyText); setDailyFields({ done: "", carry: "", drop: "", reflection: "" }); }}>Save daily reflection</button></div></section><section className="card"><div className="section-label">End of week</div><h2 style={{ marginTop: 8 }}>Make the next week lighter.</h2><div className="review-grid" style={{ marginTop: 18 }}><ReviewCard title="What went well?" value={weeklyFields.well} setValue={(value) => setWeekly("well", value)} /><ReviewCard title="What stayed unfinished?" value={weeklyFields.unfinished} setValue={(value) => setWeekly("unfinished", value)} /><ReviewCard title="What should change next week?" value={weeklyFields.change} setValue={(value) => setWeekly("change", value)} /><ReviewCard title="Next week’s priorities" value={weeklyFields.priorities} setValue={(value) => setWeekly("priorities", value)} /></div><div className="actions"><button className="primary" onClick={() => { onSave("weekly", weeklyText); setWeeklyFields({ well: "", unfinished: "", change: "", priorities: "" }); }}>Save weekly review</button></div></section>{reflections.length > 0 && <section className="card"><div className="section-label">Recent reflections</div><div className="item-list" style={{ marginTop: 14 }}>{reflections.slice(0, 5).map((item) => <div className="item-row" key={item.id}><div className="item-main"><div className="item-text">{item.text}</div><div className="item-meta"><span className="tag">{item.type}</span><span className="tag">{new Date(item.createdAt).toLocaleDateString()}</span></div></div></div>)}</div></section>}</div>;
}

function ReviewCard({ title, value, setValue }: { title: string; value: string; setValue: (value: string) => void }) { return <div className="review-card"><h3>{title}</h3><textarea value={value} onChange={(event) => setValue(event.target.value)} placeholder="Add a note…" /></div>; }

function SummaryModal({ items, onClose }: { items: Item[]; onClose: () => void }) { return <div className="modal-backdrop"><div className="modal card" role="dialog" aria-modal="true" aria-labelledby="summary-title"><div className="card-header"><div><div className="section-label">Manual summary</div><h2 id="summary-title">What is still asking for attention?</h2></div><button className="ghost small-button" onClick={onClose}>Close</button></div><p className="empty">This is only a quick scan. Nothing is categorized or scheduled by this summary.</p><div className="item-list" style={{ marginTop: 14 }}>{items.map((item) => <div className="item-row" key={item.id}><div className="item-main"><div className="item-text">{item.text}</div><div className="item-meta"><span className="tag">Unprocessed</span></div></div></div>)}</div></div></div>; }

"use client";

import { useEffect, useMemo, useState } from "react";
import { Bucket, Category, Item, ItemType, Project, Reflection, StoredData, Targets, emptyData, exportData, loadData, makeId, parseImport, saveData } from "../lib/storage";
import { exportMarkdown } from "../lib/exportMarkdown";
import { isArchived, isIdea, isLater, isUnresolved, isWeekItem, sortDoneLast } from "../lib/views";
import { joinSelected, segmentText } from "../lib/split";
import { isDoneToday, isDoneThisWeek, rankReplacementCandidates } from "../lib/reflect";
import { addDays, itemsOnDate, startOfMonth, startOfWeek, toDateKey, unscheduledItems } from "../lib/schedule";
import { effectiveCategory, sortProjectsDoneLast, subtaskTotalMinutes, subtasksOf } from "../lib/projects";

const categories: Category[] = ["Work", "Family", "Friends", "Health", "Personal"];
const buckets: Bucket[] = ["Today", "This Week", "Later"];
type Tab = "home" | "inbox" | "week" | "reflections";

function formatMinutes(minutes?: number) {
  if (!minutes) return "Estimate needed";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h${rest ? ` ${rest}m` : ""}` : `${rest}m`;
}

// "Estimate needed" already reads as a full sentence on its own - appending
// "estimated" to it produced "Estimate needed estimated". Only a real
// number gets that suffix.
function estimateTag(minutes?: number) {
  return minutes ? `${formatMinutes(minutes)} estimated` : "Estimate needed";
}

function CaptureForm({ capture, setCapture, onSubmit, onCancel, autoFocus }: { capture: string; setCapture: (value: string) => void; onSubmit: () => void; onCancel?: () => void; autoFocus?: boolean }) {
  return <section className="card capture-card" style={{ marginBottom: 18 }}>
    <div className="card-header"><div><h2>Add a thought</h2></div><span className="tag">No decision needed</span></div>
    <textarea id="capture" value={capture} onChange={(event) => setCapture(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) onSubmit(); }} placeholder="Write a concise thought, task, event, or idea…" aria-label="Add a thought" autoFocus={autoFocus} />
    <div className="capture-footer">
      <p className="hint">Save it now. Organize it from Inbox whenever you have the space.</p>
      <div style={{ display: "flex", gap: 8 }}>
        {onCancel && <button className="ghost" onClick={onCancel}>Cancel</button>}
        <button className="primary" onClick={onSubmit}>Add a thought</button>
      </div>
    </div>
  </section>;
}

export default function Home() {
  const [data, setData] = useState<StoredData>(() => emptyData());
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [capture, setCapture] = useState("");
  // Whether the full capture form is expanded on a non-Overview tab - those
  // tabs show a compact button instead, so their own content isn't pushed
  // below the fold by a form most visits don't need.
  const [captureExpanded, setCaptureExpanded] = useState(false);
  const [selected, setSelected] = useState<Item | null>(null);
  const [splitting, setSplitting] = useState<Item | null>(null);
  const [projectPanel, setProjectPanel] = useState<Project | null>(null);
  // What's waiting on the duplicate-warning popup: the text someone tried to
  // save, the existing item it matches, and (for a split item only) which
  // note it should stay linked back to if they choose to keep it anyway.
  const [duplicate, setDuplicate] = useState<{ text: string; match: Item; splitFrom?: string; type?: ItemType } | null>(null);
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

  useEffect(() => {
    setCaptureExpanded(false);
  }, [tab]);

  const targets = data.targets;
  const unresolved = data.items.filter(isUnresolved);
  const weekItems = data.items.filter(isWeekItem);
  const laterItems = data.items.filter(isLater);
  const archivedItems = data.items.filter(isArchived);
  const ideaItems = data.items.filter(isIdea);
  const doneToday = data.items.filter((item) => isDoneToday(item, new Date()));
  const doneThisWeek = data.items.filter((item) => isDoneThisWeek(item, new Date()));
  const unfinishedThisWeek = weekItems.filter((item) => !item.done);
  const openItems = data.items.filter((item) => !isArchived(item) && !item.done);
  // Everything actually committed to a plan - the pool the Day/Week-by-day/
  // Month views draw from, since raw Inbox notes have nothing to put
  // on a calendar yet.
  const committedItems = data.items.filter((item) => !isArchived(item) && item.status === "Planned");
  const weekMinutes = weekItems.reduce((sum, item) => sum + (item.estimateMinutes ?? 0), 0);
  const categoryTotals = categories.map((category) => ({
    category,
    minutes: weekItems.filter((item) => effectiveCategory(item, data.projects) === category).reduce((sum, item) => sum + (item.estimateMinutes ?? 0), 0),
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
    setCaptureExpanded(false);
  }

  function keepDuplicate() {
    if (!duplicate) return;
    const fromCapture = !duplicate.splitFrom;
    commitNewItem(duplicate.text, duplicate.splitFrom, fromCapture ? "Saved as a second note." : "Added as a second item from this note.", duplicate.type);
    setDuplicate(null);
    if (fromCapture) { setCapture(""); setCaptureExpanded(false); }
  }

  function saveItem(updated: Item) {
    updateData((current) => ({ ...current, items: current.items.map((item) => item.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : item) }));
    setSelected(null);
    showToast(updated.type === "idea" ? "Added to your idea log." : updated.status === "Planned" ? "Added to your draft week." : "Saved in Inbox.");
  }

  function deleteItem(id: string) {
    updateData((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
    setSelected(null);
    showToast("Item deleted.");
  }

  function createProject(project: Project) {
    updateData((current) => ({ ...current, projects: [project, ...current.projects] }));
    showToast(`Project "${project.name}" created.`);
  }

  function saveProject(updated: Project) {
    updateData((current) => ({ ...current, projects: current.projects.map((project) => project.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : project) }));
    showToast("Project saved.");
  }

  function toggleProjectDone(id: string, done: boolean) {
    updateData((current) => ({ ...current, projects: current.projects.map((project) => project.id === id ? { ...project, done, updatedAt: new Date().toISOString() } : project) }));
    showToast(done ? "Project marked done." : "Project reopened.");
  }

  // Deleting a project never deletes its subtasks - they're kept, just
  // detached, so closing out or undoing a project by mistake never costs you
  // real task data.
  function deleteProject(id: string) {
    updateData((current) => ({
      ...current,
      projects: current.projects.filter((project) => project.id !== id),
      items: current.items.map((item) => item.projectId === id ? { ...item, projectId: undefined } : item),
    }));
    setProjectPanel(null);
    showToast("Project deleted. Its tasks were kept, just detached.");
  }

  function addSubtask(projectId: string, text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    const item: Item = { id: makeId(), text: trimmed, status: "Inbox", projectId, createdAt: now, updatedAt: now };
    updateData((current) => ({ ...current, items: [item, ...current.items] }));
    // Straight into Organize, so setting its category/estimate/bucket doesn't
    // require leaving the project, finding it in Inbox, and reopening it.
    // The Project panel stays open underneath - closing Organize returns to
    // the project with the subtask already updated.
    setSelected(item);
    showToast("Subtask added.");
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
    ["inbox", `Inbox${unresolved.length ? ` · ${unresolved.length}` : ""}`],
    ["week", "This week"],
    ["reflections", "Reflections"],
  ] as const;

  if (!ready) return <main className="app-shell"><div className="app-frame"><div className="card">Opening your planner…</div></div></main>;

  return (
    <main className="app-shell">
      <div className="app-frame">
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
        <div className="device-banner">
          <p>Saved on this device only — no account, no cloud backup. Clearing your browser data clears your plan.</p>
          <div className="device-banner-actions">
            <button className="ghost small-button" onClick={exportBackup}>Export backup</button>
            <button className="ghost small-button" onClick={() => document.getElementById("import-file")?.click()}>Import backup</button>
            <button className="ghost small-button" onClick={exportMarkdownBackup}>Export as Markdown</button>
            <input id="import-file" type="file" accept="application/json" style={{ display: "none" }} onChange={(event) => { const file = event.target.files?.[0]; if (file) importBackup(file); event.target.value = ""; }} />
          </div>
        </div>
        <nav className="nav" aria-label="Primary navigation">
          {nav.map(([key, label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}
        </nav>

        {/* The full form always leads on Overview - that's the one screen whose
            whole job is capture. Elsewhere it stays a compact button so a
            tab's own content isn't pushed below the fold by a form most
            visits to that tab don't need. */}
        {tab === "home" ? (
          <CaptureForm capture={capture} setCapture={setCapture} onSubmit={addThought} />
        ) : captureExpanded ? (
          <CaptureForm capture={capture} setCapture={setCapture} onSubmit={addThought} onCancel={() => setCaptureExpanded(false)} autoFocus />
        ) : (
          <button type="button" className="capture-compact" onClick={() => setCaptureExpanded(true)}>Add a thought</button>
        )}

        {tab === "home" && <Overview unresolved={unresolved} weekItems={weekItems} weekMinutes={weekMinutes} categoryTotals={categoryTotals} largestCategory={largestCategory} projects={data.projects} onOpen={(item) => setSelected(item)} onTab={setTab} />}
        {tab === "inbox" && <Inbox items={unresolved} allItems={data.items} ideaItems={ideaItems} archivedItems={archivedItems} projects={data.projects} onSaveItem={saveItem} onDeleteItem={deleteItem} onSplit={(item) => setSplitting(item)} onArchive={archiveItem} onOpenProject={(project) => setProjectPanel(project)} onCreateProject={createProject} onSummary={() => { setSummaryOpen(true); setSummary(null); }} />}
        {tab === "week" && <PlanTab weekItems={weekItems} laterItems={laterItems} weekMinutes={weekMinutes} categoryTotals={categoryTotals} largestCategory={largestCategory} conflicts={categoryConflicts} targets={targets} projects={data.projects} onSaveTargets={saveTargets} onOpen={(item) => setSelected(item)} onDone={toggleDone} committedItems={committedItems} />}
        {tab === "reflections" && <ReflectionPanel doneToday={doneToday} doneThisWeek={doneThisWeek} unfinishedThisWeek={unfinishedThisWeek} openItems={openItems} allItems={data.items} projects={data.projects} reflections={data.reflections} onOpen={(item) => setSelected(item)} onDrop={deleteItem} onReplace={replaceItem} onDone={toggleDone} onSave={saveReflection} />}

        {selected && <OrganizePanel item={selected} projects={data.projects} onSave={saveItem} onDelete={() => deleteItem(selected.id)} onClose={() => setSelected(null)} onSplit={() => { setSplitting(selected); setSelected(null); }} onCreateProject={createProject} />}
        {projectPanel && <ProjectPanel project={data.projects.find((project) => project.id === projectPanel.id) ?? projectPanel} allProjects={data.projects} subtasks={subtasksOf(projectPanel.id, data.items)} onAddSubtask={(text) => addSubtask(projectPanel.id, text)} onSaveSubtask={saveItem} onDeleteSubtask={deleteItem} onSplitSubtask={(item) => { setSplitting(item); setProjectPanel(null); }} onDoneSubtask={toggleDone} onCreateProject={createProject} onSave={saveProject} onToggleDone={(done) => toggleProjectDone(projectPanel.id, done)} onDelete={() => deleteProject(projectPanel.id)} onClose={() => setProjectPanel(null)} />}
        {markingDone && <DoneModal item={markingDone} onConfirm={(minutes) => confirmDone(markingDone.id, minutes)} onSkip={() => confirmDone(markingDone.id, undefined)} />}
        {splitting && <SplitPanel item={splitting} children={data.items.filter((item) => item.splitFrom === splitting.id)} onAddChild={(text, type) => addSplitItem(splitting.id, text, type)} onClose={() => setSplitting(null)} />}
        {duplicate && <div className="modal-backdrop"><div className="modal card" role="dialog" aria-modal="true" aria-labelledby="duplicate-title"><div className="section-label">Possible duplicate</div><h2 id="duplicate-title">You already have a note like this.</h2><p className="empty">Keep it anyway, or cancel and continue with the existing note.</p><div className="actions"><button className="ghost" onClick={() => setDuplicate(null)}>Cancel</button><button className="primary" onClick={keepDuplicate}>Keep both</button></div></div></div>}
        {summaryOpen && <SummaryModal items={unresolved} onClose={() => setSummaryOpen(false)} />}
        {toast && <div className="toast" role="status">{toast}</div>}
      </div>
    </main>
  );
}

function Overview({ unresolved, weekItems, weekMinutes, categoryTotals, largestCategory, projects, onOpen, onTab }: { unresolved: Item[]; weekItems: Item[]; weekMinutes: number; categoryTotals: { category: Category; minutes: number }[]; largestCategory: number; projects: Project[]; onOpen: (item: Item) => void; onTab: (tab: Tab) => void }) {
  return <div className="layout"><div className="stack"><section className="card stat-card"><div className="section-label">This week in view</div>{weekItems.length > 0 ? <><div className="big-number">{formatMinutes(weekMinutes)}</div><p className="stat-sub">estimated across {weekItems.length} planned {weekItems.length === 1 ? "item" : "items"}. Add estimates during review to make this useful.</p><div className="split-list">{categoryTotals.map(({ category, minutes }) => <div className="split-row" key={category}><span>{category}</span><div className="split-bar"><div className="split-fill" style={{ width: `${Math.min(100, (minutes / largestCategory) * 100)}%` }} /></div><strong>{formatMinutes(minutes)}</strong></div>)}</div></> : <p className="stat-sub" style={{ marginTop: 8 }}>Add a thought, then organize it into this week to see your time here.</p>}</section><section className="card"><div className="card-header"><div><div className="section-label">Inbox</div><h2>{unresolved.length ? `${unresolved.length} thought${unresolved.length === 1 ? "" : "s"} waiting` : "Your inbox is clear"}</h2></div><button className="ghost" onClick={() => onTab("inbox")}>Open inbox</button></div>{unresolved.length ? <div className="item-list">{unresolved.slice(0, 4).map((item) => <ItemRow key={item.id} item={item} projects={projects} onOpen={onOpen} action="Organize" />)}</div> : <p className="empty">Add the next thought before it pulls you away.</p>}</section></div><div className="stack"><section className="card"><div className="card-header"><div><div className="section-label">Draft week</div><h2>What is taking space?</h2></div></div><p className="empty">{weekItems.length ? "Review the draft to spot conflicts and make the trade-off yourself." : "Organized items will appear here as a draft week."}</p><button className="ghost" style={{ marginTop: 15, width: "100%" }} onClick={() => onTab("week")}>Open This week</button></section></div></div>;
}

function ItemRow({ item, projects, onOpen, action, footer, onDone }: { item: Item; projects: Project[]; onOpen: (item: Item) => void; action: string; footer?: React.ReactNode; onDone?: (item: Item) => void }) {
  const category = effectiveCategory(item, projects);
  return <div className="item-row-wrap"><div className={`item-row${item.done ? " item-row-done" : ""}`}><div className="item-main"><div className="item-text">{item.text}</div><div className="item-meta">{item.splitFrom && <span className="tag subtle">↗ from a braindump</span>}{category && <span className="tag">{category}</span>}{item.bucket && <span className="tag">{item.bucket}</span>}{item.estimateMinutes ? <span className="tag accent">{formatMinutes(item.estimateMinutes)}</span> : <span className="tag">Estimate needed</span>}{item.done && <span className="tag accent">Done</span>}</div></div><div style={{ display: "flex", gap: 6 }}>{onDone && <button className={`ghost small-button${item.done ? " done" : ""}`} onClick={() => onDone(item)}>{item.done ? "Undo" : "Mark done"}</button>}<button className="ghost small-button" onClick={() => onOpen(item)}>{action}</button></div></div>{footer}</div>;
}

// A list of items where "Organize"/"Edit"/whatever expands the same form
// used everywhere, right in place - instead of covering the list you were
// just looking at with a separate screen. Each row tracks its own expanded
// state, and only one row in a given list opens at a time.
function OrganizableList({ items, action, projects, onDone, footer, onSaveItem, onDeleteItem, onSplitItem, onCreateProject }: { items: Item[]; action: string; projects: Project[]; onDone?: (item: Item) => void; footer?: (item: Item) => React.ReactNode; onSaveItem: (item: Item) => void; onDeleteItem: (id: string) => void; onSplitItem: (item: Item) => void; onCreateProject: (project: Project) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // The row itself turns into the form when expanded - not a row that stays
  // put plus a second box underneath it.
  return <div className="item-list">{items.map((item) => {
    if (expandedId === item.id) {
      return <OrganizePanel key={item.id} item={item} projects={projects} inline onSave={(updated) => { onSaveItem(updated); setExpandedId(null); }} onDelete={() => { onDeleteItem(item.id); setExpandedId(null); }} onSplit={() => onSplitItem(item)} onClose={() => setExpandedId(null)} onCreateProject={onCreateProject} />;
    }
    return <ItemRow key={item.id} item={item} projects={projects} onOpen={() => setExpandedId(item.id)} action={action} onDone={onDone} footer={footer ? footer(item) : undefined} />;
  })}</div>;
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

function Inbox({ items, allItems, ideaItems, archivedItems, projects, onSaveItem, onDeleteItem, onSplit, onArchive, onOpenProject, onCreateProject, onSummary }: { items: Item[]; allItems: Item[]; ideaItems: Item[]; archivedItems: Item[]; projects: Project[]; onSaveItem: (item: Item) => void; onDeleteItem: (id: string) => void; onSplit: (item: Item) => void; onArchive: (id: string) => void; onOpenProject: (project: Project) => void; onCreateProject: (project: Project) => void; onSummary: () => void }) {
  const [newProjectName, setNewProjectName] = useState("");

  function createProject() {
    const name = newProjectName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    onCreateProject({ id: makeId(), name, done: false, createdAt: now, updatedAt: now });
    setNewProjectName("");
  }

  return <div className="stack"><section className="card"><div className="card-header"><div><div className="section-label">Inbox</div><h2>Decide when you have space.</h2></div><button className="ghost small-button" onClick={onSummary} disabled={!items.length}>Summarize unresolved</button></div>{items.length ? <OrganizableList items={items} action="Organize" projects={projects} onSaveItem={onSaveItem} onDeleteItem={onDeleteItem} onSplitItem={onSplit} onCreateProject={onCreateProject} footer={(item) => {
    const childCount = allItems.filter((candidate) => candidate.splitFrom === item.id).length;
    return childCount > 0 ? <div className="row-footer">
      <span className="hint">⤷ {childCount} item{childCount === 1 ? "" : "s"} split out</span>
      <button className="ghost small-button" onClick={() => onArchive(item.id)}>Nothing left in this note</button>
    </div> : undefined;
  }} /> : <p className="empty">Nothing waiting here. Add a thought whenever one arrives.</p>}</section>

    <section className="card">
      <div className="card-header"><div><div className="section-label">Projects</div><h2>{projects.length} project{projects.length === 1 ? "" : "s"}</h2></div></div>
      {projects.length ? <div className="item-list">{sortProjectsDoneLast(projects).map((project) => {
        const subtaskCount = allItems.filter((item) => item.projectId === project.id).length;
        return <div className="item-row" key={project.id}><div className="item-main"><div className="item-text">{project.name}</div><div className="item-meta"><span className="tag">{subtaskCount} subtask{subtaskCount === 1 ? "" : "s"}</span>{project.done && <span className="tag accent">Done</span>}</div></div><button className="ghost small-button" onClick={() => onOpenProject(project)}>Open</button></div>;
      })}</div> : <p className="empty">No projects yet. Create one below, then attach tasks to it from Organize.</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} placeholder="New project name…" style={{ flex: 1 }} onKeyDown={(event) => { if (event.key === "Enter") createProject(); }} />
        <button className="ghost small-button" onClick={createProject}>+ New project</button>
      </div>
    </section>

    {ideaItems.length > 0 && <section className="card"><details><summary className="section-label">Idea log · {ideaItems.length}</summary><p className="hint" style={{ marginTop: 10 }}>Fleeting ideas, not tasks - no schedule, no estimate. Tap Edit to change the wording or drop one back to a task.</p><div style={{ marginTop: 12 }}><OrganizableList items={ideaItems} action="Edit" projects={projects} onSaveItem={onSaveItem} onDeleteItem={onDeleteItem} onSplitItem={onSplit} onCreateProject={onCreateProject} /></div></details></section>}{archivedItems.length > 0 && <section className="card"><details><summary className="section-label">Archive · {archivedItems.length}</summary><p className="hint" style={{ marginTop: 10 }}>Original braindumps you have fully split into separate items. Kept out of the way, not deleted.</p><div style={{ marginTop: 12 }}><OrganizableList items={archivedItems} action="View" projects={projects} onSaveItem={onSaveItem} onDeleteItem={onDeleteItem} onSplitItem={onSplit} onCreateProject={onCreateProject} /></div></details></section>}</div>;
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

function OrganizePanel({ item, projects, onSave, onDelete, onClose, onSplit, onCreateProject, inline }: { item: Item; projects: Project[]; onSave: (item: Item) => void; onDelete: () => void; onClose: () => void; onSplit: () => void; onCreateProject: (project: Project) => void; inline?: boolean }) {
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [draft, setDraft] = useState<Item>(item);
  const [hours, setHours] = useState(item.estimateMinutes ? String(Math.floor(item.estimateMinutes / 60)) : "");
  const [minutes, setMinutes] = useState(item.estimateMinutes ? String(item.estimateMinutes % 60) : "");
  const set = (changes: Partial<Item>) => setDraft((current) => ({ ...current, ...changes }));
  const isIdea = (draft.type ?? "task") === "idea";
  // "Add to idea log" the first time something becomes an idea; "Save" when
  // re-editing something that was already logged as one - the original item
  // decides which, not whatever the Type toggle is set to right now.
  const alreadyLogged = item.type === "idea";
  const attachedProject = projects.find((project) => project.id === draft.projectId);

  function save() {
    if (isIdea) {
      onSave({ ...draft, type: "idea" });
      return;
    }
    const estimate = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
    // A subtask never carries its own category - clearing it here (rather
    // than just leaving it ignored) means detaching from the project later
    // starts from a clean slate instead of resurrecting a stale value.
    onSave({ ...draft, type: "task", status: draft.bucket ? "Planned" : "Inbox", estimateMinutes: estimate || undefined, category: draft.projectId ? undefined : draft.category });
  }

  function createProject() {
    const name = newProjectName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const project: Project = { id: makeId(), name, done: false, createdAt: now, updatedAt: now };
    onCreateProject(project);
    set({ projectId: project.id });
    setNewProjectName("");
    setCreatingProject(false);
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
        {attachedProject ? (
          <div className="field" style={{ marginTop: 14 }}><label>Category</label><p className="hint">{attachedProject.category ? `${attachedProject.category} - inherited from "${attachedProject.name}"` : `"${attachedProject.name}" has no category set yet - set one from the Projects section.`}</p></div>
        ) : (
          <div className="field" style={{ marginTop: 14 }}><label>Category</label><div className="chips">{categories.map((category) => <button type="button" className={`chip ${draft.category === category ? "selected" : ""}`} key={category} onClick={() => set({ category })}>{category}</button>)}</div></div>
        )}
        <div className="field" style={{ marginTop: 14 }}><label>When</label><div className="chips">{buckets.map((bucket) => <button type="button" className={`chip ${draft.bucket === bucket ? "selected" : ""}`} key={bucket} onClick={() => set({ bucket })}>{bucket}</button>)}</div></div>
        <div className="form-grid" style={{ marginTop: 14 }}>
          <div className="field"><label htmlFor="hours">Estimated hours</label><input id="hours" inputMode="numeric" value={hours} onChange={(event) => setHours(event.target.value)} placeholder="0" /></div>
          <div className="field"><label htmlFor="minutes">Estimated minutes</label><input id="minutes" inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value)} placeholder="0" /></div>
          <div className="field"><label htmlFor="effort">Effort</label><select id="effort" value={draft.effort ?? ""} onChange={(event) => set({ effort: (event.target.value || undefined) as Item["effort"] })}><option value="">Not set</option><option>Low</option><option>Medium</option><option>High</option></select></div>
          <div className="field"><label htmlFor="due">Due date</label><input id="due" type="date" value={draft.dueDate ?? ""} onChange={(event) => set({ dueDate: event.target.value || undefined })} /></div>
          <div className="field full">
            <label htmlFor="project-select">Project (optional)</label>
            <div style={{ display: "flex", gap: 8 }}>
              <select id="project-select" style={{ flex: 1 }} value={draft.projectId ?? ""} onChange={(event) => set({ projectId: event.target.value || undefined })}>
                <option value="">No project</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}{project.done ? " (done)" : ""}</option>)}
              </select>
              <button type="button" className="ghost small-button" onClick={() => setCreatingProject((current) => !current)}>+ New</button>
            </div>
            {creatingProject && <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} placeholder="Project name" style={{ flex: 1 }} onKeyDown={(event) => { if (event.key === "Enter") createProject(); }} />
              <button type="button" className="primary small-button" onClick={createProject}>Create</button>
            </div>}
          </div>
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

  // Reused two ways: the normal full-screen modal everywhere else, or - from
  // inside a project's subtask list - expanded right in place, so organizing
  // a subtask doesn't cover the project you came from and force you to close
  // it just to see it again.
  if (inline) {
    return <div className="card" style={{ marginTop: 8, marginBottom: 8, boxShadow: "none", background: "rgba(244, 240, 232, .55)" }}>{content}</div>;
  }
  return <div className="modal-backdrop"><div className="modal card" role="dialog" aria-modal="true" aria-labelledby="organize-title">{content}</div></div>;
}

function ProjectPanel({ project, allProjects, subtasks, onAddSubtask, onSaveSubtask, onDeleteSubtask, onSplitSubtask, onDoneSubtask, onCreateProject, onSave, onToggleDone, onDelete, onClose }: { project: Project; allProjects: Project[]; subtasks: Item[]; onAddSubtask: (text: string) => void; onSaveSubtask: (item: Item) => void; onDeleteSubtask: (id: string) => void; onSplitSubtask: (item: Item) => void; onDoneSubtask: (item: Item) => void; onCreateProject: (project: Project) => void; onSave: (project: Project) => void; onToggleDone: (done: boolean) => void; onDelete: () => void; onClose: () => void }) {
  const [name, setName] = useState(project.name);
  const [category, setCategory] = useState<Category | undefined>(project.category);
  const [startDate, setStartDate] = useState(project.startDate ?? "");
  const [endDate, setEndDate] = useState(project.endDate ?? "");
  const [subtaskText, setSubtaskText] = useState("");
  // Every subtask's category comes from this project, so the row's own tag
  // reads correctly here without threading anything extra through -
  // subtasksOf/ItemRow already resolve it the same way everywhere else.
  const sortedSubtasks = sortDoneLast(subtasks);
  const total = subtaskTotalMinutes(project.id, subtasks);

  function save() {
    onSave({ ...project, name: name.trim() || project.name, category, startDate: startDate || undefined, endDate: endDate || undefined });
  }

  function addSubtask() {
    if (!subtaskText.trim()) return;
    onAddSubtask(subtaskText);
    setSubtaskText("");
  }

  return <div className="modal-backdrop"><div className="modal card" role="dialog" aria-modal="true" aria-labelledby="project-title">
    <div className="card-header"><div><div className="section-label">Project{project.done ? " · done" : ""}</div><h2 id="project-title">{project.name}</h2></div><button className="ghost small-button" onClick={onClose}>Close</button></div>

    <div className="field full"><label htmlFor="project-name">Name</label><input id="project-name" value={name} onChange={(event) => setName(event.target.value)} /></div>

    <div className="field" style={{ marginTop: 14 }}>
      <label>Category</label>
      <div className="chips">{categories.map((option) => <button type="button" key={option} className={`chip ${category === option ? "selected" : ""}`} onClick={() => setCategory(option)}>{option}</button>)}</div>
      <p className="hint" style={{ marginTop: 6 }}>Every subtask uses this category - they don't get their own.</p>
    </div>

    <div className="form-grid" style={{ marginTop: 14 }}>
      <div className="field"><label htmlFor="project-start">Start date</label><input id="project-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div>
      <div className="field"><label htmlFor="project-end">End date</label><input id="project-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></div>
    </div>
    <p className="hint" style={{ marginTop: 8 }}>Subtasks add up to {formatMinutes(total)}.</p>

    <div className="field full" style={{ marginTop: 18 }}>
      <label>Subtasks ({subtasks.length})</label>
      {sortedSubtasks.length ? <div style={{ marginTop: 8 }}><OrganizableList items={sortedSubtasks} action="Organize" projects={allProjects} onDone={onDoneSubtask} onSaveItem={onSaveSubtask} onDeleteItem={onDeleteSubtask} onSplitItem={onSplitSubtask} onCreateProject={onCreateProject} /></div> : <p className="empty">No subtasks yet.</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input value={subtaskText} onChange={(event) => setSubtaskText(event.target.value)} placeholder="Add a subtask…" style={{ flex: 1 }} onKeyDown={(event) => { if (event.key === "Enter") addSubtask(); }} />
        <button type="button" className="ghost small-button" onClick={addSubtask}>Add</button>
      </div>
    </div>

    <div className="actions">
      <button className="danger" onClick={onDelete}>Delete project</button>
      <button className="ghost" onClick={() => onToggleDone(!project.done)}>{project.done ? "Reopen project" : "Mark project done"}</button>
      <button className="primary" onClick={save}>Save</button>
    </div>
  </div></div>;
}

function WeekView({ items, laterItems, weekMinutes, categoryTotals, largestCategory, conflicts, targets, projects, onSaveTargets, onOpen, onDone }: { items: Item[]; laterItems: Item[]; weekMinutes: number; categoryTotals: { category: Category; minutes: number }[]; largestCategory: number; conflicts: { category: Category; minutes: number }[]; targets: Targets; projects: Project[]; onSaveTargets: (targets: Targets) => void; onOpen: (item: Item) => void; onDone: (item: Item) => void }) {
  // Local editing draft, seeded from the saved targets. WeekView only mounts
  // after storage has loaded, so this always starts from real saved values.
  const [draftTargets, setDraftTargets] = useState<Targets>(targets);
  const weekStart = startOfWeek(new Date());
  const weekEnd = addDays(weekStart, 6);
  const weekRange = `${weekStart.toLocaleDateString(undefined, { month: "long", day: "numeric" })} – ${weekEnd.toLocaleDateString(undefined, { month: "long", day: "numeric" })}`;
  return <div className="stack"><section className="card"><div className="card-header"><div><div className="section-label">Draft week</div><h2>Your week, at a glance.</h2><p className="hint" style={{ marginTop: 4 }}>{weekRange}</p></div><span className="tag accent">{estimateTag(weekMinutes)}</span></div>{conflicts.length > 0 && <div className="notice">This draft is above the target for {conflicts.map((item) => item.category).join(", ")}. Choose the trade-off yourself; nothing moved automatically.</div>}<div className="split-list">{categoryTotals.map(({ category, minutes }) => <div className="split-row" key={category}><span>{category}</span><div className="split-bar" style={{ background: "var(--paper-deep)" }}><div className="split-fill" style={{ width: `${Math.min(100, (minutes / largestCategory) * 100)}%` }} /></div><strong>{formatMinutes(minutes)}</strong></div>)}</div></section><section className="card"><div className="card-header"><div><div className="section-label">Items in the draft</div><h2>What is taking space?</h2></div></div>{items.length ? <div className="item-list">{sortDoneLast(items).map((item) => <ItemRow key={item.id} item={item} projects={projects} onOpen={onOpen} action="Edit" onDone={onDone} />)}</div> : <p className="empty">Organize an item and choose Today or This Week to see it here.</p>}</section><section className="card"><div className="card-header"><div><div className="section-label">Later</div><h2>Parked, not forgotten.</h2></div><span className="tag">{laterItems.length}</span></div>{laterItems.length ? <div className="item-list">{sortDoneLast(laterItems).map((item) => <ItemRow key={item.id} item={item} projects={projects} onOpen={onOpen} action="Edit" onDone={onDone} />)}</div> : <p className="empty">Items you commit to Later wait here until you pull them into a week.</p>}</section><section className="card"><div className="card-header"><div><div className="section-label">Optional setup</div><h2>Set weekly targets.</h2></div></div><p className="empty">Targets help the draft show where your time is going. You can skip this and return here later.</p><div className="form-grid" style={{ marginTop: 14 }}>{categories.map((category) => <div className="field" key={category}><label htmlFor={`target-${category}`}>{category} hours</label><input id={`target-${category}`} type="number" min="0" step="0.5" value={draftTargets[category] ?? ""} onChange={(event) => setDraftTargets({ ...draftTargets, [category]: event.target.value ? Number(event.target.value) : undefined })} placeholder="Not set" /></div>)}</div><div className="actions"><button className="primary" onClick={() => onSaveTargets(draftTargets)}>Save targets</button></div></section></div>;
}

// The "This week" tab: one set of data, four lenses on it. Category is the
// original draft-week view; Day/Week-by-day/Month all read from the same
// committed items and the same "no date yet" pile, just laid out differently.
function PlanTab({ weekItems, laterItems, weekMinutes, categoryTotals, largestCategory, conflicts, targets, projects, onSaveTargets, onOpen, onDone, committedItems }: { weekItems: Item[]; laterItems: Item[]; weekMinutes: number; categoryTotals: { category: Category; minutes: number }[]; largestCategory: number; conflicts: { category: Category; minutes: number }[]; targets: Targets; projects: Project[]; onSaveTargets: (targets: Targets) => void; onOpen: (item: Item) => void; onDone: (item: Item) => void; committedItems: Item[] }) {
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
    {mode === "category" && <WeekView items={weekItems} laterItems={laterItems} weekMinutes={weekMinutes} categoryTotals={categoryTotals} largestCategory={largestCategory} conflicts={conflicts} targets={targets} projects={projects} onSaveTargets={onSaveTargets} onOpen={onOpen} onDone={onDone} />}
    {mode === "day" && <DayPlanView date={day} setDate={setDay} items={committedItems} unscheduled={unscheduled} projects={projects} onOpen={onOpen} onDone={onDone} />}
    {mode === "week" && <WeekByDayView weekStart={weekStart} setWeekStart={setWeekStart} items={committedItems} unscheduled={unscheduled} projects={projects} onOpen={onOpen} onDone={onDone} />}
    {mode === "month" && <MonthPlanView month={month} setMonth={setMonth} items={committedItems} unscheduled={unscheduled} projects={projects} onOpen={onOpen} onDone={onDone} onPickDay={(picked) => { setDay(picked); setMode("day"); }} />}
  </div>;
}

function UnscheduledCard({ items, projects, onOpen, onDone }: { items: Item[]; projects: Project[]; onOpen: (item: Item) => void; onDone: (item: Item) => void }) {
  return <section className="card"><div className="card-header"><div><div className="section-label">Unscheduled</div><h2>No specific day yet.</h2></div><span className="tag">{items.length}</span></div>{items.length ? <div className="item-list">{sortDoneLast(items).map((item) => <ItemRow key={item.id} item={item} projects={projects} onOpen={onOpen} action="Edit" onDone={onDone} />)}</div> : <p className="empty">Everything committed has a day, or nothing is committed yet. Add a due date in Organize to put an item on the calendar.</p>}</section>;
}

function DayPlanView({ date, setDate, items, unscheduled, projects, onOpen, onDone }: { date: Date; setDate: (date: Date) => void; items: Item[]; unscheduled: Item[]; projects: Project[]; onOpen: (item: Item) => void; onDone: (item: Item) => void }) {
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
      {dayItems.length ? <div className="item-list">{sortDoneLast(dayItems).map((item) => <ItemRow key={item.id} item={item} projects={projects} onOpen={onOpen} action="Edit" onDone={onDone} />)}</div> : <p className="empty">Nothing scheduled for this day. Add a due date to an item in Organize to see it here.</p>}
    </section>
    <UnscheduledCard items={unscheduled} projects={projects} onOpen={onOpen} onDone={onDone} />
  </div>;
}

function WeekByDayView({ weekStart, setWeekStart, items, unscheduled, projects, onOpen, onDone }: { weekStart: Date; setWeekStart: (date: Date) => void; items: Item[]; unscheduled: Item[]; projects: Project[]; onOpen: (item: Item) => void; onDone: (item: Item) => void }) {
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
    <UnscheduledCard items={unscheduled} projects={projects} onOpen={onOpen} onDone={onDone} />
  </div>;
}

function MonthPlanView({ month, setMonth, items, unscheduled, projects, onOpen, onDone, onPickDay }: { month: Date; setMonth: (date: Date) => void; items: Item[]; unscheduled: Item[]; projects: Project[]; onOpen: (item: Item) => void; onDone: (item: Item) => void; onPickDay: (date: Date) => void }) {
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
    <UnscheduledCard items={unscheduled} projects={projects} onOpen={onOpen} onDone={onDone} />
  </div>;
}

function ReflectionPanel({ doneToday, doneThisWeek, unfinishedThisWeek, openItems, allItems, projects, reflections, onOpen, onDrop, onReplace, onDone, onSave }: { doneToday: Item[]; doneThisWeek: Item[]; unfinishedThisWeek: Item[]; openItems: Item[]; allItems: Item[]; projects: Project[]; reflections: Reflection[]; onOpen: (item: Item) => void; onDrop: (id: string) => void; onReplace: (originalId: string, chosenId: string) => void; onDone: (item: Item) => void; onSave: (type: "daily" | "weekly", text: string) => void }) {
  // Items you've already decided on this sitting - Carry forward makes no
  // storage change (there is nothing to "carry," the item just stays where
  // it is), so this local set is the only record that you've dealt with it,
  // purely so you are not asked about the same item twice in one visit.
  // Daily and weekly track this separately - carrying something forward in
  // one is not a decision about the other.
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
        {doneToday.length ? <div className="item-list" style={{ marginTop: 8 }}>{doneToday.map((item) => <div className="item-row" key={item.id}><div className="item-main"><div className="item-text">{item.text}</div><div className="item-meta"><span className="tag accent">Done</span>{item.actualMinutes ? <span className="tag">{formatMinutes(item.actualMinutes)} actual</span> : null}</div></div></div>)}</div> : <p className="empty">Nothing marked done yet today. Mark items done from Inbox or This week as you finish them.</p>}
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

function SummaryModal({ items, onClose }: { items: Item[]; onClose: () => void }) { return <div className="modal-backdrop"><div className="modal card" role="dialog" aria-modal="true" aria-labelledby="summary-title"><div className="card-header"><div><div className="section-label">Manual summary</div><h2 id="summary-title">What is still asking for attention?</h2></div><button className="ghost small-button" onClick={onClose}>Close</button></div><p className="empty">This is only a quick scan. Nothing is categorized or scheduled by this summary.</p><div className="item-list" style={{ marginTop: 14 }}>{items.map((item) => <div className="item-row" key={item.id}><div className="item-main"><div className="item-text">{item.text}</div><div className="item-meta"><span className="tag">Inbox</span></div></div></div>)}</div></div></div>; }

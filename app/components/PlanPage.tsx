"use client";

import { useMemo, useState } from "react";
import type { Category, Item, ItemType, Project } from "../../lib/storage";
import { joinSelected, segmentText } from "../../lib/split";
import { ItemRow } from "./shared";
import { BucketDateChips } from "./BucketDateChips";
import { ProjectQuickAssign } from "./ProjectQuickAssign";

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

const PLAN_CATEGORIES: Category[] = ["Work", "Social", "Personal"];

function PlanRow({ item, projects, onSave, onDelete, onCreateProject, onAddChild, expanded, onToggleExpand }: { item: Item; projects: Project[]; onSave: (item: Item) => void; onDelete: () => void; onCreateProject: (project: Project) => void; onAddChild: (text: string, type: ItemType) => void; expanded: boolean; onToggleExpand: () => void }) {
  const [draft, setDraft] = useState<Item>(item);
  const [showSplit, setShowSplit] = useState(false);
  const set = (changes: Partial<Item>) => setDraft((current) => { const next = { ...current, ...changes }; onSave(next); return next; });
  const isIdea = (draft.type ?? "task") === "idea";

  // Picking a bucket doesn't commit the item on its own - status only flips
  // to Planned once you collapse the row. Committing live, per chip tap,
  // would fail isUnresolved() (lib/views.ts) the instant a bucket was
  // picked and yank the row out of this very list mid-edit, before there
  // was a chance to also set category/estimate/project.
  function finishOrganizing() {
    if (!isIdea && draft.bucket && draft.status !== "Planned") set({ status: "Planned" });
    onToggleExpand();
  }

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
          {PLAN_CATEGORIES.map((category) => <button type="button" key={category} className={`chip ${draft.category === category ? "selected" : ""}`} onClick={() => set({ category })}>{category}</button>)}
        </div>
        <div style={{ marginTop: 8 }}><BucketDateChips bucket={draft.bucket} dueDate={draft.dueDate} onChange={({ bucket, dueDate }) => set({ bucket, dueDate })} /></div>
        <div className="row-footer" style={{ marginTop: 8 }}>
          <input inputMode="numeric" value={draft.estimateMinutes ?? ""} onChange={(event) => set({ estimateMinutes: event.target.value ? Number(event.target.value) : undefined })} placeholder="Estimate (min)" style={{ width: 140 }} />
          <ProjectQuickAssign projectId={draft.projectId} projects={projects} onChange={(projectId) => set({ projectId, category: projectId ? undefined : draft.category })} onCreate={onCreateProject} />
          <button type="button" className="ghost small-button" onClick={() => setShowSplit((current) => !current)}>Split</button>
        </div>
      </>}
      <div className="actions">
        <button className="danger" onClick={onDelete}>Delete</button>
        <button className="ghost" onClick={finishOrganizing}>Collapse</button>
      </div>
      {showSplit && <SplitInline item={item} onAddChild={onAddChild} />}
    </div>
  </div>;
}

export function PlanPage({ items, projects, capture, setCapture, onAddThought, onSaveItem, onDeleteItem, onCreateProject, onAddChild }: { items: Item[]; projects: Project[]; capture: string; setCapture: (value: string) => void; onAddThought: () => void; onSaveItem: (item: Item) => void; onDeleteItem: (id: string) => void; onCreateProject: (project: Project) => void; onAddChild: (parentId: string, text: string, type: ItemType) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  return <div className="stack">
    <CaptureBox capture={capture} setCapture={setCapture} onSubmit={onAddThought} />
    <section className="card">
      <div className="card-header"><div><div className="section-label">Organize</div><h2>{items.length ? `${items.length} to organize` : "Nothing waiting"}</h2></div></div>
      {items.length ? <div className="item-list">{items.map((item) => <PlanRow key={item.id} item={item} projects={projects} onSave={onSaveItem} onDelete={() => onDeleteItem(item.id)} onCreateProject={onCreateProject} onAddChild={(text, type) => onAddChild(item.id, text, type)} expanded={expandedId === item.id} onToggleExpand={() => setExpandedId((current) => current === item.id ? null : item.id)} />)}</div> : <p className="empty">Add a thought above — it'll show up here to organize.</p>}
    </section>
  </div>;
}

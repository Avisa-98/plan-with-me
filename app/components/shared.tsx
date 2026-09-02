"use client";

import { useState } from "react";
import type { Item, Project } from "../../lib/storage";
import { effectiveCategory } from "../../lib/projects";

export function formatMinutes(minutes?: number) {
  if (!minutes) return "Estimate needed";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h${rest ? ` ${rest}m` : ""}` : `${rest}m`;
}

// "Estimate needed" already reads as a full sentence on its own - appending
// "estimated" to it produced "Estimate needed estimated". Only a real
// number gets that suffix.
export function estimateTag(minutes?: number) {
  return minutes ? `${formatMinutes(minutes)} estimated` : "Estimate needed";
}

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

export function DoneModal({ item, onConfirm, onSkip }: { item: Item; onConfirm: (minutes: number | undefined) => void; onSkip: () => void }) {
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

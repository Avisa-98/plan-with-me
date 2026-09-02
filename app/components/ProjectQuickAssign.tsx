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

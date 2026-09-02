"use client";

import { useState } from "react";
import type { Bucket } from "../../lib/storage";
import { monthGridCells, startOfMonth, startOfWeek, toDateKey, weekDays } from "../../lib/schedule";

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

    {bucket === "This Week" && <div className="month-grid" style={{ marginTop: 8 }}>
      {weekDays(startOfWeek(new Date())).map((day) => {
        const key = toDateKey(day);
        return <button type="button" key={key} className={`month-cell ${dueDate === key ? "chunk-pending" : ""}`} onClick={() => pickDate(day)}>
          <span className="month-heading" style={{ padding: 0 }}>{day.toLocaleDateString(undefined, { weekday: "short" })}</span>
          <span className="month-cell-num">{day.getDate()}</span>
        </button>;
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

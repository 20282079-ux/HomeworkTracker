import React from "react";
import { getDaysLeft, formatDate } from "../tasks.js";

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function TaskCard({ task, index, compact, subject, onEdit, onDelete, onToggle, onPin }) {
  const today = new Date().toISOString().split("T")[0];
  const soonD = new Date();
  soonD.setDate(soonD.getDate() + 3);
  const soon = soonD.toISOString().split("T")[0];
  const isOverdue = task.status !== "done" && task.due && task.due < today;
  const isSoon = task.status !== "done" && task.due && task.due >= today && task.due <= soon;
  const isDone = task.status === "done";
  const subj = subject || { color: "#7c6af7" };

  let dueBadge = null;
  if (task.due) {
    const d = getDaysLeft(task.due);
    if (d < 0) dueBadge = <span className="badge badge-overdue">⚠ Overdue {Math.abs(d)}d</span>;
    else if (d === 0) dueBadge = <span className="badge badge-today">⏰ Due today</span>;
    else if (d <= 3) dueBadge = <span className="badge badge-soon">⚡ {d}d left</span>;
    else dueBadge = <span className="badge badge-due">📅 {formatDate(task.due)}</span>;
  }

  return (
    <div className={`task-card${isDone ? " done" : ""}${isOverdue ? " overdue" : ""}${isSoon && !isOverdue ? " due-soon" : ""}${compact ? " compact" : ""}${task.pinned ? " pinned" : ""}`} style={{ animationDelay: `${index * 0.04}s` }} role="listitem">
      <div className="task-strip" style={{ background: subj.color }} aria-hidden="true" />
      <button
        type="button"
        className={`star-btn${task.pinned ? " starred" : ""}`}
        onClick={() => onPin(task.id)}
        title={task.pinned ? "Unpin" : "Pin task"}
        aria-label={task.pinned ? `Unpin \"${task.title}\"` : `Pin \"${task.title}\"`}
        aria-pressed={!!task.pinned}
      >
        {task.pinned ? "⭐" : "☆"}
      </button>
      <button
        type="button"
        role="checkbox"
        aria-checked={isDone}
        className={`task-checkbox${isDone ? " checked" : ""}`}
        onClick={() => onToggle(task.id)}
        aria-label={`Mark \"${task.title}\" complete`}
      >
        <svg width="12" height="9" viewBox="0 0 12 9" fill="none" aria-hidden="true">
          <path d="M1 4L4.5 7.5L11 1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="task-body">
        <div className="task-title">{task.title}</div>
        {task.notes ? <div className="task-note">{task.notes}</div> : null}
        <div className="task-meta">
          <span className="badge" style={{ background: hexToRgba(subj.color, 0.15), color: subj.color, borderColor: hexToRgba(subj.color, 0.3) }}>
            {task.subject}
          </span>
          <span className={`badge badge-priority-${task.priority}`}>{task.priority}</span>
          {task.status === "in-progress" && (
            <span className="badge" style={{ background: "rgba(96,165,250,.15)", color: "#60a5fa", borderColor: "rgba(96,165,250,.3)" }}>
              In Progress
            </span>
          )}
          {dueBadge}
          {task.time ? <span className="badge badge-due">⏱ {task.time}m</span> : null}
        </div>
      </div>
      <div className="task-actions">
        <button type="button" className="task-act-btn edit" onClick={() => onEdit(task.id)} title="Edit" aria-label={`Edit \"${task.title}\"`}>
          ✎
        </button>
        <button type="button" className="task-act-btn del" onClick={() => onDelete(task.id)} title="Delete" aria-label={`Delete \"${task.title}\"`}>
          ✕
        </button>
      </div>
    </div>
  );
}

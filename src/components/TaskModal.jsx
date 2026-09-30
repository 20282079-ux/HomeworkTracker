import React, { useState } from "react";
import { PRIORITIES } from "../tasks.js";

export default function TaskModal({ editing, subjects, onSave, onClose, defaultSubject }) {
  const [title, setTitle] = useState(editing?.title || "");
  const [subject, setSubject] = useState(editing?.subject || defaultSubject);
  const [notes, setNotes] = useState(editing?.notes || "");
  const [due, setDue] = useState(editing?.due || "");
  const [priority, setPriority] = useState(editing?.priority || "Medium");
  const [time, setTime] = useState(editing?.time || "");
  const [status, setStatus] = useState(editing?.status || "pending");
  const [shake, setShake] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    onSave({
      title: title.trim(),
      subject,
      notes: notes.trim(),
      due,
      priority,
      time: parseInt(time) || 0,
      status,
    });
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal">
        <h2 className="modal-title" id="modal-title">{editing ? "✏️ Edit Assignment" : "📝 New Assignment"}</h2>
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="m-title">Assignment Title *</label>
              <input type="text" id="m-title" className={shake ? "shake" : ""} placeholder="e.g. Chapter 5 Problems" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
            </div>
            <div className="field">
              <label htmlFor="m-subject">Subject</label>
              <select id="m-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
                {subjects.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="m-notes">Notes / Description</label>
            <textarea id="m-notes" placeholder="Any extra details…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="form-grid-3">
            <div className="field">
              <label htmlFor="m-due">Due Date</label>
              <input type="date" id="m-due" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="m-priority">Priority</label>
              <select id="m-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="m-time">Est. Time (min)</label>
              <input type="number" id="m-time" placeholder="30" min="1" max="999" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="form-grid" style={{ marginBottom: 16 }}>
            <div className="field">
              <label htmlFor="m-status">Status</label>
              <select id="m-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

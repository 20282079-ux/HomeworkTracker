import React from "react";

export default function Toasts({ toasts }) {
  return (
    <>
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span>{t.type === "success" ? "✅" : t.type === "error" ? "❌" : "ℹ️"}</span> {t.msg}
        </div>
      ))}
      {toasts.some((t) => t.undoAction) && null}
    </>
  );
}

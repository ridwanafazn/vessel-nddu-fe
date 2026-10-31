import React from "react";
import "./EmptyState.css";

/**
 * Empty state untuk kondisi 404 (state belum dibuat di backend).
 */
const EmptyState = ({
  title = "Data belum dibuat",
  message = "Belum ada instance simulasi di server. Buat terlebih dahulu untuk mulai menampilkan data.",
  actionLabel = "Create",
  onAction,
  busy = false,
}) => {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 3v18M3 12h18" strokeLinecap="round" />
          <circle cx="12" cy="12" r="9" opacity="0.35" />
        </svg>
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
      {onAction && (
        <button type="button" className="empty-state-btn" onClick={onAction} disabled={busy}>
          {busy ? "Membuat…" : actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;

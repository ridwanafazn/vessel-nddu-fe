import React from "react";
import "./ConnectionBanner.css";

/**
 * Banner status koneksi backend.
 * - checking : menunggu / cold start Render (bisa ±60 detik)
 * - offline  : gagal konek, tampilkan tombol Retry
 * - online   : tidak dirender
 */
const ConnectionBanner = ({ status, error, onRetry, compact = false }) => {
  if (!status || status === "online") return null;

  const isChecking = status === "checking";

  return (
    <div className={`connection-banner ${status} ${compact ? "compact" : ""}`} role="status">
      <span className={`connection-dot ${isChecking ? "pulse" : ""}`} />
      <div className="connection-text">
        <strong>
          {isChecking ? "Menghubungkan ke server…" : "Server tidak dapat dihubungi"}
        </strong>
        <span>
          {isChecking
            ? "Render free bisa cold start ±60 detik. Mohon tunggu."
            : error || "Periksa koneksi internet lalu coba lagi."}
        </span>
      </div>
      {!isChecking && onRetry && (
        <button type="button" className="connection-retry" onClick={onRetry}>
          Coba lagi
        </button>
      )}
    </div>
  );
};

export default ConnectionBanner;

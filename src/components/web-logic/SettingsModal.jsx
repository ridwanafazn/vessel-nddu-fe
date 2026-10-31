import React, { useState, useEffect } from "react";
import { useSettings } from "../../api/SettingsContext";
import "./SettingsModal.css";

function SettingsModal({ isOpen, onClose }) {
  const { customApiUrl, customWsUrl, setApiUrl, setWsUrl, resetToDefaults, hasCustomConfig } = useSettings();
  const [apiUrl, setApiUrlState] = useState("");
  const [wsUrl, setWsUrlState] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setApiUrlState(customApiUrl);
      setWsUrlState(customWsUrl);
      setSaved(false);
      setError("");
    }
  }, [isOpen, customApiUrl, customWsUrl]);

  if (!isOpen) return null;

  const validateUrl = (url, label) => {
    if (!url) return null;
    try {
      new URL(url);
      if (label === "API" && !/^https?:\/\//.test(url)) return "API URL harus http:// atau https://";
      if (label === "WS" && !/^wss?:\/\//.test(url)) return "WS URL harus ws:// atau wss://";
      return null;
    } catch {
      return `${label} URL tidak valid`;
    }
  };

  const handleSave = () => {
    const apiErr = validateUrl(apiUrl, "API");
    const wsErr = validateUrl(wsUrl, "WS");
    if (apiErr || wsErr) {
      setError(apiErr || wsErr);
      return;
    }
    setError("");
    setApiUrl(apiUrl);
    setWsUrl(wsUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    resetToDefaults();
    setApiUrlState("");
    setWsUrlState("");
    setError("");
    setSaved(false);
  };

  const handleClose = () => {
    setApiUrlState(customApiUrl);
    setWsUrlState(customWsUrl);
    setError("");
    setSaved(false);
    onClose();
  };

  const getDefaultApiUrl = () => (
    import.meta.env.VITE_API_URL || "https://vessel-nddu.onrender.com"
  );
  const getDefaultWsUrl = () => (
    import.meta.env.VITE_WS_URL || "wss://vessel-nddu.onrender.com/ws"
  );

  return (
    <>
      <div className="settings-modal-overlay" onClick={handleClose}>
        <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
          <div className="settings-modal-header">
            <h2>Pengaturan Koneksi</h2>
            <button className="settings-modal-close" onClick={handleClose} aria-label="Tutup">&times;</button>
          </div>

          <div className="settings-modal-content">
            {error && <div className="settings-error">{error}</div>}
            {saved && <div className="settings-success">Tersimpan ✓</div>}

            <div className="settings-form-group">
              <label htmlFor="apiUrl">API Base URL</label>
              <input
                id="apiUrl"
                type="url"
                value={apiUrl}
                onChange={(e) => setApiUrlState(e.target.value)}
                placeholder={getDefaultApiUrl()}
                aria-describedby="apiUrlHint"
              />
              <small id="apiUrlHint" className="settings-hint">
                Default: <code>{getDefaultApiUrl()}</code>
                {" | Contoh: http://localhost:8080 atau https://xxx.trycloudflare.com"}
              </small>
            </div>

            <div className="settings-form-group">
              <label htmlFor="wsUrl">WebSocket URL</label>
              <input
                id="wsUrl"
                type="url"
                value={wsUrl}
                onChange={(e) => setWsUrlState(e.target.value)}
                placeholder={getDefaultWsUrl()}
                aria-describedby="wsUrlHint"
              />
              <small id="wsUrlHint" className="settings-hint">
                Default: <code>{getDefaultWsUrl()}</code>
                {" | Contoh: ws://localhost:8081/ws atau wss://xxx.trycloudflare.com/ws"}
              </small>
            </div>

            <div className="settings-warning">
              ⚠️ <strong>Penting untuk Cloudflare Pages:</strong> Frontend HTTPS tidak bisa request ke HTTP (localhost).
              Gunakan <strong>cloudflared tunnel --url http://localhost:8080</strong> untuk dapat URL HTTPS, lalu masukkan di sini.
            </div>

            <div className="settings-actions">
              <button className="settings-btn-secondary" onClick={handleReset} disabled={!hasCustomConfig}>
                Reset ke Default
              </button>
              <button className="settings-btn-primary" onClick={handleSave}>
                Simpan
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default SettingsModal;
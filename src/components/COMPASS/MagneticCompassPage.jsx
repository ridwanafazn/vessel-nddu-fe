import React, { useState, useEffect, useRef } from "react";
import "./MagneticCompassPage.css";
import { compassApi, fromConfig, toConfigPayload } from "../../api/endpoints";
import { usePolling } from "../../hooks/usePolling";
import { useRealtime } from "../../hooks/useRealtime";
import { useBackendHealth } from "../../hooks/useBackendHealth";
import EditActions from "../web-logic/Actions";
import ConfigPopup from "../web-logic/ConfigPopup";
import ConfirmationPopup from "../web-logic/ConfirmationPopUp";
import ToastNotification from "../web-logic/ToastNotification";
import SimulationControls from "../web-logic/SimulationControls";
import HeaderControl from "../web-logic/HeaderControl";
import ConnectionBanner from "../web-logic/ConnectionBanner";
import EmptyState from "../web-logic/EmptyState";
import { useConfig } from "../web-logic/ConfigContext";
import Active from '../../assets/status/Property 1=Active.png';
import Stop from '../../assets/status/Property 1=Stop.png';
import HeaderIcon from '../../assets/magnet/magnet_icon.png';
import StatusWaiting from "../../assets/status/Property 1=Waiting.png";

// ============================================================================
// DEFAULT CONFIGURATION (cloud-safe)
// ============================================================================
const defaultCompassConfig = {
  ip: "127.0.0.1",
  port: "1883",
  username: "vessel_user",
  password: "vessel_pass",
  topic: ["vessel/compass"],
  updateRate: "1000",
};

const MagneticCompassPage = ({ onStatusChange }) => {
  const { isSpeedDepthConfigOpen, closeSpeedDepthConfig } = useConfig();

  // ============================================================================
  // STATE DEFINITIONS
  // ============================================================================
  const [localConfig, setLocalConfig] = useState({
    ip: "",
    port: "",
    username: "",
    password: "",
    topic: [],
    updateRate: ""
  });
  
  const [backendHasDefaultConfig, setBackendHasDefaultConfig] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [isRecordCreated, setIsRecordCreated] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isConfigEditing, setIsConfigEditing] = useState(true);
  const [isEmpty, setIsEmpty] = useState(false);
  const backend = useBackendHealth();

  // ============================================================================
  // SIMULATION DATA
  // ============================================================================
  const [simData, setSimData] = useState({
    heading: 0.0,
    deviation: 0.0,
    variation: 0.0,
    last_update: new Date().toISOString(),
    is_running: false
  });

  const [needleRotation, setNeedleRotation] = useState(0);
  const [editData, setEditData] = useState({ heading: "" });

  // ============================================================================
  // POPUPS & NOTIFICATIONS
  // ============================================================================
  const [notification, setNotification] = useState({ message: "", type: "" });
  const [confirmPopup, setConfirmPopup] = useState({
    isOpen: false,
    title: "",
    message: "",
    variant: "danger",
    actionType: ""
  });

  // ============================================================================
  // REFS
  // ============================================================================
  const prevHeadingRef = useRef(0);
  const fetchIntervalRef = useRef(null);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================
  const showNotification = (msg, type = 'success') => {
    setNotification({ message: msg, type: type });
    setTimeout(() => setNotification({ message: "", type: "" }), 3000);
  };

  const formatDateTime = (iso) => {
    try {
      const d = new Date(iso);
      return isNaN(d.getTime()) ? "N/A" :
        `${String(d.getDate()).padStart(2, "0")} ${d.toLocaleString("en-GB", { month: "short" })} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
    } catch {
      return iso || "N/A";
    }
  };

  const getCardinalDirection = (angle) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.floor((((angle % 360) + 360) % 360) / 45) % 8];
  };

  const refreshData = async () => {
    try {
      const data = await compassApi.get();
      if (data) {
        setSimData({
          heading: data.heading ?? 0.0,
          deviation: data.deviation ?? 0.0,
          variation: data.variation ?? 0.0,
          last_update: data.last_update,
          is_running: data.is_running,
        });
        setEditData({ heading: String((data.heading ?? 0).toFixed(1)) });
        setIsRecordCreated(true);
        setIsEmpty(false);
      }
    } catch (error) {
      if (error.kind === "not_found") {
        setIsRecordCreated(false);
        setIsEmpty(true);
      }
    }
  };

  // ============================================================================
  // INITIAL LOAD (DATA + CONFIG)
  // ============================================================================
  useEffect(() => {
    let cancelled = false;

    const initData = async () => {
      // A. DATA
      try {
        const data = await compassApi.get();
        if (cancelled) return;
        if (data) {
          const fetchedHeading = data.heading ?? 0.0;
          setSimData({
            heading: fetchedHeading,
            deviation: data.deviation ?? 0.0,
            variation: data.variation ?? 0.0,
            last_update: data.last_update || new Date().toISOString(),
            is_running: data.is_running ?? false,
          });
          setEditData({ heading: String(fetchedHeading.toFixed(1)) });
          setNeedleRotation(fetchedHeading);
          prevHeadingRef.current = fetchedHeading;
          setIsRecordCreated(true);
          setIsEmpty(false);
        }
      } catch (error) {
        if (error.kind === "not_found") {
          setIsRecordCreated(false);
          setIsEmpty(true);
        } else if (error.kind === "offline" || error.kind === "timeout") {
          setIsBackendConnected(false);
        }
      }

      // B. CONFIG (data bisa null jika belum pernah dibuat)
      try {
        const cfg = await compassApi.getConfig();
        if (cancelled) return;
        setIsBackendConnected(true);
        const formatted = fromConfig(cfg);
        const valid = Boolean(formatted.ip && formatted.port && formatted.username);
        setLocalConfig(formatted);
        setBackendHasDefaultConfig(valid);
        setIsConfigEditing(!valid);
      } catch (error) {
        if (cancelled) return;
        setIsBackendConnected(error.kind !== "offline" && error.kind !== "timeout");
      }
    };

    initData();
    return () => {
      cancelled = true;
    };
  }, []);

  // ============================================================================
  // SINKRONISASI INPUT OTOMATIS
  // ============================================================================
  useEffect(() => {
    if (!isEditing) {
      setEditData({ heading: String(parseFloat(simData.heading).toFixed(1)) });
    }
  }, [simData.heading, isEditing]);

  // ============================================================================
  // ROTASI JARUM (SMOOTH)
  // ============================================================================
  useEffect(() => {
    const currentHeading = parseFloat(simData.heading);
    let diff = currentHeading - prevHeadingRef.current;
    if (diff > 180) diff -= 360;
    else if (diff < -180) diff += 360;

    setNeedleRotation(prev => prev + diff);
    prevHeadingRef.current = currentHeading;
  }, [simData.heading]);

  // ============================================================================
  // POLLING DATA (BERKALA)
  // ============================================================================
  const applyCompassData = (incoming) => {
    if (!incoming) return;
    setSimData((prev) => ({
      ...prev,
      heading: incoming.heading ?? prev.heading,
      deviation: incoming.deviation ?? prev.deviation,
      variation: incoming.variation ?? prev.variation,
      is_running: incoming.is_running ?? prev.is_running,
      last_update: incoming.last_update || prev.last_update,
    }));
    if (typeof incoming.is_running === "boolean" && onStatusChange) {
      onStatusChange(incoming.is_running);
    }
  };

  const pollRate = parseInt(localConfig.updateRate, 10) || 1000;

  usePolling(
    async () => {
      try {
        const data = await compassApi.get();
        if (data) {
          applyCompassData(data);
          setIsBackendConnected(true);
        }
      } catch (error) {
        if (error.kind === "not_found") {
          setIsRecordCreated(false);
          setIsEmpty(true);
        } else if (error.kind === "offline" || error.kind === "timeout") {
          setIsBackendConnected(false);
        }
      }
    },
    {
      enabled: backendHasDefaultConfig && simData.is_running,
      interval: pollRate,
      immediate: false,
    }
  );

  useRealtime(
    "compass_update",
    (message) => {
      if (!message?.data) return;
      applyCompassData(message.data);
      setIsBackendConnected(true);
    },
    backendHasDefaultConfig && simData.is_running
  );

  // ============================================================================
  // ACTION FUNCTIONS
  // ============================================================================
  const executeSaveBackend = async () => {
    const valHeading = editData.heading === "" ? 0 : parseFloat(editData.heading);
    try {
      if (!isRecordCreated) {
        await compassApi.create({ heading: valHeading });
        setIsRecordCreated(true);
      } else {
        await compassApi.update({ heading: valHeading, is_running: false });
      }
      await refreshData();
      setIsEmpty(false);
      showNotification("Data disimpan ke server!", "success");
    } catch (error) {
      showNotification(error.message || "Gagal menyimpan data", "error");
    }
    setConfirmPopup(prev => ({ ...prev, isOpen: false }));
  };

  const executeStart = async () => {
    const startHeading = editData.heading === "" ? 0 : parseFloat(editData.heading);
    try {
      if (!isRecordCreated) {
        await compassApi.create({ heading: startHeading });
        setIsRecordCreated(true);
      }
      await compassApi.update({ heading: startHeading, is_running: true });

      setSimData(prev => ({ ...prev, is_running: true, heading: startHeading }));
      setIsEditing(false);
      setIsEmpty(false);
      showNotification("Simulasi dijalankan", "success");
    } catch (error) {
      showNotification(
        error.kind === "bad_request"
          ? "Config kompas belum lengkap (IP, Port, Username, Password, Update Rate). Buka Config."
          : error.message || "Gagal start simulasi",
        "error"
      );
    }
    setConfirmPopup(prev => ({ ...prev, isOpen: false }));
  };

  const executeStop = async () => {
    try {
      await compassApi.update({ is_running: false });
      setSimData(prev => ({ ...prev, is_running: false }));
      showNotification("Simulasi dihentikan", "info");
    } catch (error) {
      setSimData(prev => ({ ...prev, is_running: false }));
      showNotification(error.message || "Gagal menghentikan simulasi", "error");
    }
    setConfirmPopup(prev => ({ ...prev, isOpen: false }));
  };

  const executeDelete = async () => {
    try {
      await compassApi.remove();
      setSimData(prev => ({
        ...prev,
        heading: 0.0,
        last_update: new Date().toISOString(),
        is_running: false
      }));
      setNeedleRotation(0);
      prevHeadingRef.current = 0;
      setEditData({ heading: "" });
      setIsRecordCreated(false);
      setIsEmpty(true);
      showNotification("Heading di-reset ke 0!", "success");
    } catch (error) {
      showNotification(error.message || "Gagal reset data", "error");
    }
    setConfirmPopup(prev => ({ ...prev, isOpen: false }));
  };

  const executeClearInput = () => {
    setEditData({ heading: "" });
    showNotification("Input form telah dikosongkan!", "info");
    setConfirmPopup(prev => ({ ...prev, isOpen: false }));
  };

  // ============================================================================
  // CONFIG HANDLERS
  // ============================================================================
  const handleConfigSaveAndClose = async (newConfig, shouldClose) => {
    if (!newConfig.ip || !newConfig.port || !newConfig.username || !newConfig.password || !newConfig.updateRate) {
      showNotification("IP, Port, Username, Password, dan Update Rate wajib diisi untuk Compass", "error");
      return;
    }

    try {
      const saved = await compassApi.updateConfig(toConfigPayload(newConfig));
      setLocalConfig(fromConfig(saved));
      setBackendHasDefaultConfig(true);
      setIsConfigEditing(false);
      await refreshData();
    } catch (error) {
      showNotification(error.message || "Gagal menyimpan konfigurasi", "error");
    }
    if (shouldClose) closeSpeedDepthConfig();
  };

  const handleConfigDefault = async () => {
    const defaultConfigForPopup = {
      ip: defaultCompassConfig.ip,
      port: String(defaultCompassConfig.port),
      username: defaultCompassConfig.username,
      password: defaultCompassConfig.password,
      topic: defaultCompassConfig.topic,
      updateRate: String(defaultCompassConfig.updateRate)
    };
    setLocalConfig(defaultConfigForPopup);
    setIsConfigEditing(true);
    showNotification("Form diisi dengan konfigurasi default", "info");
    await handleConfigSaveAndClose(defaultConfigForPopup, false);
  };

  const handleConfigClear = async () => {
    try {
      await compassApi.removeConfig();
      const emptyConfig = { ip: "", port: "", topic: [], username: "", password: "", updateRate: "" };
      setLocalConfig(emptyConfig);
      setBackendHasDefaultConfig(false);
      setIsConfigEditing(true);
      showNotification("Konfigurasi berhasil dihapus dari server.", "success");
    } catch (error) {
      const emptyConfig = { ip: "", port: "", topic: [], username: "", password: "", updateRate: "" };
      setLocalConfig(emptyConfig);
      setBackendHasDefaultConfig(false);
      setIsConfigEditing(true);
      showNotification(error.message || "Konfigurasi dikosongkan.", "info");
    }
  };

  const handleConfigChange = (isEditing) => setIsConfigEditing(isEditing);

  // ============================================================================
  // UI HANDLERS
  // ============================================================================
  const handleEditToggle = () => {
    if (simData.is_running) {
      showNotification("Matikan simulasi dulu untuk edit", "error");
      return;
    }
    
    if (isEditing) {
      if (!backendHasDefaultConfig) {
        showNotification("Silakan konfigurasi koneksi MQTT terlebih dahulu untuk menyimpan perubahan", "error");
        return;
      }
      openConfirmPopup("saveEdit");
    } else {
      if (!editData.heading) {
        setEditData({ heading: String(parseFloat(simData.heading).toFixed(1)) });
      }
      setIsEditing(true);
    }
  };

  const handleInputChange = (e) => {
    const { value } = e.target;
    if (value === '' || /^-?[0-9]*\.?[0-9]*$/.test(value)) {
      setEditData({ heading: value });
    }
  };

  const getInputValue = () => {
    if (isEditing) {
      return editData.heading || "";
    }
    return simData.heading !== 0 ? String(parseFloat(simData.heading).toFixed(1)) : "";
  };

  const executeCreateEmpty = async () => {
    try {
      await compassApi.create({ heading: 0 });
      setIsRecordCreated(true);
      setIsEmpty(false);
      setIsBackendConnected(true);
      await refreshData();
      showNotification("State Compass berhasil dibuat", "success");
    } catch (error) {
      showNotification(
        error.kind === "conflict"
          ? "State compass sudah ada. Gunakan tombol Edit/Save."
          : error.message || "Gagal membuat state Compass",
        "error"
      );
    }
  };

  const openConfirmPopup = (type) => {
    let config = { isOpen: true, actionType: type };
    if (type === "startSim") {
      config.title = "Mulai Simulasi";
      config.message = "Apakah Anda yakin ingin menjalankan simulasi?";
      config.variant = "primary";
    } else if (type === "stopSim") {
      config.title = "Hentikan Simulasi";
      config.message = "Apakah Anda yakin ingin menghentikan simulasi?";
      config.variant = "danger";
    } else if (type === "clearData") {
      config.title = "Reset Heading";
      config.message = "Apakah Anda yakin ingin me-reset heading menjadi 0?";
      config.variant = "danger";
    } else if (type === "clearInput") {
      config.title = "Hapus Input";
      config.message = "Apakah Anda yakin ingin mengosongkan form input?";
      config.variant = "danger";
    } else if (type === "saveEdit") {
      config.title = "Simpan Perubahan";
      config.message = "Apakah Anda yakin ingin menyimpan perubahan pada input?";
      config.variant = "primary";
    } else if (type === "saveBackend") {
      config.title = "Simpan Data";
      config.message = "Apakah Anda yakin ingin mengirim data ini ke server?";
      config.variant = "primary";
    }
    setConfirmPopup(config);
  };

  const handleConfirmAction = () => {
    const { actionType } = confirmPopup;
    if (actionType === "startSim") executeStart();
    else if (actionType === "stopSim") executeStop();
    else if (actionType === "clearData") executeDelete();
    else if (actionType === "clearInput") executeClearInput();
    else if (actionType === "saveEdit" || actionType === "saveBackend") executeSaveBackend();
    setConfirmPopup({ isOpen: false, title: "", message: "", variant: "danger", actionType: "" });
  };

  // ============================================================================
  // COMPASS VISUALIZATION
  // ============================================================================
  const renderCompassMarksInside = () => {
    const marks = [];
    for (let i = 0; i < 360; i += 22.5) {
      const isCardinal = i % 90 === 0;
      const isMajor = i % 45 === 0;
      marks.push(
        <div key={i} className="compass-mark-container" style={{ transform: `rotate(${i}deg)` }}>
          <div className={`compass-tick ${isCardinal ? 'tick-long' : (isMajor ? 'tick-medium' : 'tick-short')}`}></div>
          {isMajor && i !== 0 && (
            <div className="compass-labels-wrapper-inside" style={{ transform: `rotate(-${i}deg)` }}>
              <span className={`degree-text-inside ${isCardinal ? 'degree-cardinal' : ''}`}>{i}°</span>
            </div>
          )}
        </div>
      );
    }
    return marks;
  };

  // ============================================================================
  // COMPONENT RENDER
  // ============================================================================
  const isPanelDisabled = !isBackendConnected;

  return (
    <>
      <ToastNotification
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification({ message: "", type: "" })}
      />

      <ConfigPopup
        isOpen={isSpeedDepthConfigOpen}
        onClose={closeSpeedDepthConfig}
        config={localConfig}
        onSave={handleConfigSaveAndClose}
        onDefault={handleConfigDefault}
        onClear={handleConfigClear}
        isEditingExternal={isConfigEditing}
        onEditingChange={handleConfigChange}
      />

      <ConfirmationPopup
        isOpen={confirmPopup.isOpen}
        title={confirmPopup.title}
        message={confirmPopup.message}
        onConfirm={handleConfirmAction}
        onClose={() => setConfirmPopup(prev => ({ ...prev, isOpen: false }))}
        variant={confirmPopup.variant}
      />

      {/* DATA DISPLAY PANEL */}
      <div className={`data-display-panel magnet-panel ${isPanelDisabled ? "disabled" : ""}`}>
        <div className="panel-header">
          <h2>Simulasi Data</h2>
        </div>

        <ConnectionBanner
          status={backend.status}
          error={backend.error}
          onRetry={backend.retry}
          compact
        />

        <div className="info-group-panel">
          <div className="last-update-box">
            <span className="last-update-value">
              Last update time: {formatDateTime(simData.last_update)}
            </span>
          </div>
          <div className="status-container">
            <div className="status-item">
              <span className="status-label">STATUS</span>
              {!isBackendConnected ? (
                <img src={StatusWaiting} className="status-image" alt="Waiting" />
              ) : simData.is_running ? (
                <img src={Active} className="status-image" alt="Running" />
              ) : (
                <img src={Stop} className="status-image" alt="Stopped" />
              )}
            </div>
            <div className="status-item">
              <span className="status-label">UPDATE RATE</span>
              <div className="update-rate-value">{localConfig.updateRate || "1000"} ms</div>
            </div>
          </div>
        </div>

        {isEmpty && !simData.is_running ? (
          <EmptyState
            title="Compass belum dibuat di server"
            message="State compass belum ada (HTTP 404). Buat state awal, lalu atur heading lewat panel Edit Data."
            actionLabel="Create Compass State"
            onAction={executeCreateEmpty}
          />
        ) : (
        <div className="magnet-unified-container">
          <div className="magnet-header-row">
            <img src={HeaderIcon} className="magnet-title-icon-img" alt="Compass Icon" />
            <span className="magnet-title-text">Magnetic Heading</span>
          </div>

          <div className="magnet-content-row">
            <div className="compass-visual-side">
              <div className="compass-visual-wrapper">
                <div className="compass-circle-line-layer"></div>
                <div className="outside-cardinals-layer">
                  <span className="outside-label label-n">N</span>
                  <span className="outside-label label-e">E</span>
                  <span className="outside-label label-s">S</span>
                  <span className="outside-label label-w">W</span>
                </div>
                <div className="manual-compass-dial">
                  {renderCompassMarksInside()}
                  <div
                    className="manual-compass-needle"
                    style={{ transform: `translate(-50%, -50%) rotate(${needleRotation}deg)` }}
                  >
                    <div className="needle-part needle-north">
                      <div className="needle-half left-red"></div>
                      <div className="needle-half right-red"></div>
                    </div>
                    <div className="needle-part needle-south">
                      <div className="needle-half left-blue"></div>
                      <div className="needle-half right-blue"></div>
                    </div>
                    <div className="needle-center-cap"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="data-right-panel">
              <div className="heading-section">
                <span className="heading-label-top">HEADING</span>
                <div className="heading-value-wrapper">
                  <span className="heading-number-big">{parseFloat(simData.heading).toFixed(1)}</span>
                  <span className="heading-unit-big">°{getCardinalDirection(simData.heading)}</span>
                </div>
              </div>
              <div className="data-horizontal-divider"></div>
              <div className="secondary-data-row">
                <div className="secondary-item">
                  <span className="secondary-label">DEVIATION</span>
                  <span className="secondary-value-box">
                    {simData.deviation > 0 ? `+ ${parseFloat(simData.deviation).toFixed(1)}` : parseFloat(simData.deviation).toFixed(1)}
                    <span className="unit-small">°</span>
                  </span>
                </div>
                <div className="secondary-item">
                  <span className="secondary-label">VARIATION</span>
                  <span className="secondary-value-box">
                    {simData.variation > 0 ? `${parseFloat(simData.variation).toFixed(1)}` : parseFloat(simData.variation).toFixed(1)}
                    <span className="unit-small">°E</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        <SimulationControls
          onStart={() => openConfirmPopup("startSim")}
          onStop={() => openConfirmPopup("stopSim")}
          onDelete={() => openConfirmPopup("clearData")}
          isRunning={simData.is_running}
          isDisabled={!backendHasDefaultConfig || !isBackendConnected}
        />
      </div>

      {/* EDIT DATA PANEL */}
      <div className={`edit-data-panel ${isPanelDisabled ? "disabled" : ""}`}>
        <div className="panel-header">
          <h2>Edit Data</h2>
          <HeaderControl
            onEdit={handleEditToggle}
            onDelete={() => openConfirmPopup("clearInput")}
            isDisabled={isPanelDisabled}
            isRunning={simData.is_running}
            isEditing={isEditing}
          />
        </div>
        <div className="edit-form-container">
          <div className="input-group">
            <label>Set Heading</label>
            <input
              type="text"
              value={getInputValue()}
              onChange={handleInputChange}
              disabled={!isEditing || simData.is_running}
              placeholder="0.0"
            />
          </div>
        </div>
        <EditActions
          onSave={() => openConfirmPopup("saveBackend")}
          onDefault={() => setEditData({ heading: "45.0" })}
          isDisabled={!backendHasDefaultConfig || !isBackendConnected}
          isRunning={simData.is_running}
        />
      </div>
    </>
  );
};

export default MagneticCompassPage;
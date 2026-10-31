import React, { useState, useEffect, useRef } from "react";
import "./GyroPage.css";
import { gyroApi, fromConfig, toConfigPayload } from "../../api/endpoints";
import { usePolling } from "../../hooks/usePolling";
import { useRealtime } from "../../hooks/useRealtime";
import { useBackendHealth } from "../../hooks/useBackendHealth";
import ConfigPopup from "../web-logic/ConfigPopup";
import ConfirmationPopup from "../web-logic/ConfirmationPopUp";
import ToastNotification from "../web-logic/ToastNotification";
import SimulationControls from "../web-logic/SimulationControls";
import HeaderControl from "../web-logic/HeaderControl";
import EditActions from "../web-logic/Actions";
import ConnectionBanner from "../web-logic/ConnectionBanner";
import EmptyState from "../web-logic/EmptyState";
import { useConfig } from "../web-logic/ConfigContext";
import Frame1 from '../../assets/gyro/Frame.png';
import Frame2 from '../../assets/gyro/Frame1.png';
import Frame3 from '../../assets/gyro/Frame2.png';
import shipTopView from '../../assets/gyro/ShipTop.png';
import shipSideView from '../../assets/gyro/ShipSide.png';
import shipFrontView from '../../assets/gyro/ShipFront.png';
import Waiting from '../../assets/status/Property 1=Waiting.png';
import Active from '../../assets/status/Property 1=Active.png';
import Stop from '../../assets/status/Property 1=Stop.png';

// ============================================================================
// GAUGE COMPONENTS
// ============================================================================
const HeadingGauge = ({ heading }) => {
  const size = 240, center = 120, radius = 105, ticks = [];
  const labels = ["N", "E", "S", "W"];
  
  for(let i = 0; i < 360; i += 10) {
    const rad = (i - 90) * Math.PI / 180;
    const x1 = center + radius * Math.cos(rad);
    const y1 = center + radius * Math.sin(rad);
    const x2 = center + (radius - (i % 30 === 0 ? 10 : 5)) * Math.cos(rad);
    const y2 = center + (radius - (i % 30 === 0 ? 10 : 5)) * Math.sin(rad);
    
    ticks.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="gauge-tick"/>);
    
    if(i % 90 === 0) {
      ticks.push(
        <text 
          key={`l${i}`} 
          x={center + (radius - 30) * Math.cos(rad)} 
          y={center + (radius - 30) * Math.sin(rad)} 
          className="gauge-label-cardinal"
        >
          {labels[i/90]}
        </text>
      ); 
    }
  } 
  
  return (
    <div className="gauge-container">
      <svg viewBox="0 0 240 240" className="gauge-svg">
        <circle cx={120} cy={120} r={105} fill="var(--accent-sea)" stroke="#c9d8df" strokeWidth="2"/>
        <g>{ticks}</g>
      </svg>
      <img 
        src={shipTopView} 
        className="ship-indicator stationary-ship" 
        style={{transform:`translate(-50%,-50%) rotate(${heading - 90}deg)`}}
        alt="Ship Top View"
      />
    </div>
  ); 
};

const PitchGauge = ({ pitch }) => {
  const size = 240, center = 120, radius = 105, ticks = [];
  
  for(let i = 0; i < 360; i += 5) {
    if(i <= 90 || i >= 270) {
      const rad = i * Math.PI / 180;
      const x1 = center + radius * Math.cos(rad);
      const y1 = center + radius * Math.sin(rad);
      const x2 = center + (radius - (i % 15 === 0 ? 10 : 5)) * Math.cos(rad);
      const y2 = center + (radius - (i % 15 === 0 ? 10 : 5)) * Math.sin(rad);
      
      ticks.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="gauge-tick"/>);
    } 
  } 
  
  return (
    <div className="gauge-container">
      <svg viewBox="0 0 240 240" className="gauge-svg">
        <defs>
          <clipPath id="pitchClip">
            <rect x="0" y="120" width="240" height="120"/>
          </clipPath>
        </defs>
        <circle cx={120} cy={120} r={105} className="gauge-dial-sky"/>
        <circle cx={120} cy={120} r={105} className="gauge-dial-sea" clipPath="url(#pitchClip)"/>
        {ticks}
      </svg>
      <img 
        src={shipSideView} 
        className="ship-indicator" 
        style={{transform:`rotate(${-pitch}deg)`}}
        alt="Ship Side View"
      />
    </div>
  ); 
};

const RollGauge = ({ roll }) => {
  const size = 240, center = 120, radius = 110, ticks = [];
  
  for(let angle = -90; angle <= 90; angle += 10) {
    if(angle !== 0) {
      const rad = (angle - 90) * Math.PI / 180;
      const x1 = center + radius * Math.cos(rad);
      const y1 = center + radius * Math.sin(rad);
      const x2 = center + (radius - (angle % 30 === 0 ? 10 : 5)) * Math.cos(rad);
      const y2 = center + (radius - (angle % 30 === 0 ? 10 : 5)) * Math.sin(rad);
      
      ticks.push(<line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} className="gauge-tick"/>);
    } 
  } 
  
  return (
    <div className="gauge-container">
      <svg viewBox="0 0 240 240" className="gauge-svg">
        <path d="M 10 120 A 110 110 0 0 1 230 120" className="roll-arc"/>
        <rect x="10" y="102" width="220" height="36" className="roll-sea"/>
        <g transform={`rotate(${roll},120,120)`}>
          <image href={shipFrontView} x="48" y="48" height="144" width="144" className="ship-indicator-svg"/>
        </g>
        {ticks}
        <path d="M 112 10 L 120 22 L 128 10 Z" className="roll-pointer"/>
        <text x="35" y="125" className="roll-labels-svg">PORT</text>
        <text x="205" y="125" className="roll-labels-svg" textAnchor="end">STBD</text>
      </svg>
    </div>
  ); 
};

// ============================================================================
// DEFAULT CONFIGURATION (cloud-safe: TCP dimatikan)
// ============================================================================
const defaultGyroConfig = {
  ip: "127.0.0.1",
  port: "1883",
  username: "gyro_user",
  password: "secure_pass",
  topic: ["vessel/gyro"],
  updateRate: "1000",
  tcp_enabled: false,
};

function GyroPage({ onStatusChange }) {
  const { isGyroConfigOpen, closeGyroConfig } = useConfig();
  
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  const [localConfig, setLocalConfig] = useState(() => {
    return { ip: "", port: "", username: "", password: "", topic: [], updateRate: "" };
  });
  
  const [backendHasDefaultConfig, setBackendHasDefaultConfig] = useState(false);
  const [simulationDataExists, setSimulationDataExists] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);
  const backend = useBackendHealth();
  
  const [isRecordCreated, setIsRecordCreated] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isInputCleared, setIsInputCleared] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  
  // ============================================================================
  // NOTIFICATION & POPUP STATE
  // ============================================================================
  const [notification, setNotification] = useState({ message: "", type: "" });
  const [confirmPopup, setConfirmPopup] = useState({ isOpen: false, title: "", message: "", variant: "danger", actionType: "" });

  // ============================================================================
  // SIMULATION DATA STATE
  // ============================================================================
  const [simData, setSimData] = useState({
    yaw: 0.0,
    pitch: 0.0,
    roll: 0.0,
    yaw_rate: 2.5,
    last_update: new Date().toISOString(),
    is_running: false
  });

  const [editData, setEditData] = useState({
    yaw: "0.0",
    pitch: "0.0",
    roll: "0.0"
  });

  const [inputSnapshot, setInputSnapshot] = useState(null);
  const hasStartedRunningRef = useRef(false);
  const [isConfigEditing, setIsConfigEditing] = useState(false);

  // ============================================================================
  // NOTIFICATION FUNCTION
  // ============================================================================
  const showNotification = (msg, type = 'success') => {
    setNotification({ message: msg, type: type });
    setTimeout(() => setNotification({ message: "", type: "" }), 3000);
  };
  
  // ============================================================================
  // FORMATTING FUNCTIONS
  // ============================================================================
  const formatDateTime = (iso) => {
    try {
      const d = new Date(iso);
      return isNaN(d.getTime()) ? "N/A" : `${String(d.getDate()).padStart(2,"0")} ${d.toLocaleString("en-GB",{month:"short"})} ${d.getFullYear()}, ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
    } catch {
      return iso||"N/A";
    }
  };

  const formatToOneDecimal = (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? "0.0" : num.toFixed(1);
  };

  const formatHeading = (degrees) => {
    const deg = Math.round(degrees % 360);
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index = Math.floor(((deg + 22.5) % 360) / 45);
    return `${dirs[index]} ${String(deg).padStart(3, "0")}°`;
  };

  const formatWithSign = (value) => {
    const num = parseFloat(value);
    return num >= 0 ? `+${num.toFixed(1)}` : `${num.toFixed(1)}`;
  };

  const applyGyroData = (incoming) => {
    if (!incoming) return;
    setSimData((prev) => ({
      ...prev,
      yaw: incoming.yaw ?? prev.yaw,
      pitch: incoming.pitch ?? prev.pitch,
      roll: incoming.roll ?? prev.roll,
      yaw_rate: incoming.yaw_rate ?? prev.yaw_rate,
      is_running: incoming.is_running ?? prev.is_running,
      last_update: incoming.last_update || new Date().toISOString(),
    }));
    if (typeof incoming.is_running === "boolean" && onStatusChange) {
      onStatusChange(incoming.is_running);
    }
  };

  // ============================================================================
  // CHECK BACKEND CONFIG (PERBAIKAN UTAMA DI SINI)
  // ============================================================================
  useEffect(() => {
    let cancelled = false;

    const checkBackendConfig = async () => {
      try {
        const data = await gyroApi.getConfig();
        if (cancelled) return;
        const formatted = fromConfig(data);
        const valid = Boolean(formatted.ip && formatted.port && formatted.username);
        setLocalConfig(formatted);
        setBackendHasDefaultConfig(valid);
        setIsBackendConnected(true);
      } catch (error) {
        if (cancelled) return;
        setBackendHasDefaultConfig(false);
        if (error.kind === "offline" || error.kind === "timeout") {
          setIsBackendConnected(false);
        } else {
          setIsBackendConnected(true);
        }
      }
    };

    checkBackendConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  // ============================================================================
  // CONFIG FUNCTIONS
  // ============================================================================
  const fetchBackendConfig = async () => {
    try {
      const data = await gyroApi.getConfig();
      const formatted = fromConfig(data);
      const valid = Boolean(formatted.ip && formatted.port && formatted.username);
      setLocalConfig(formatted);
      setBackendHasDefaultConfig(valid);
      setIsConfigEditing(!valid);
      setIsBackendConnected(true);
      return valid ? formatted : null;
    } catch (error) {
      if (error.kind === "offline" || error.kind === "timeout") {
        setIsBackendConnected(false);
      }
      return null;
    }
  };

  const saveConfigToBackend = async (configData) => {
    if (!configData.ip || !configData.port || !configData.username) {
      showNotification("IP Address, Port, dan Username harus diisi", "error");
      return false;
    }

    try {
      const saved = await gyroApi.updateConfig(
        toConfigPayload(configData, { includeTcp: true })
      );
      setLocalConfig(fromConfig(saved));
      setBackendHasDefaultConfig(true);
      setIsConfigEditing(false);
      showNotification("Konfigurasi berhasil disimpan ke server", "success");
      return true;
    } catch (error) {
      showNotification(error.message || "Gagal menyimpan konfigurasi", "error");
      return false;
    }
  };

  // ============================================================================
  // CONFIG HANDLERS
  // ============================================================================
  const handleConfigSaveAndClose = async (newConfig, shouldClose) => {
    const processedConfig = {
      ...newConfig,
      topic: Array.isArray(newConfig.topic) ? newConfig.topic : (newConfig.topic ? [newConfig.topic] : [])
    };
    const backendSaved = await saveConfigToBackend(processedConfig);
    if (backendSaved) setIsConfigEditing(false);
    if (shouldClose) closeGyroConfig();
  };

  const handleConfigDefault = async () => {
    setLocalConfig(defaultGyroConfig);
    setIsConfigEditing(true);
    showNotification("Form diisi dengan konfigurasi default", "info");
    await saveConfigToBackend(defaultGyroConfig);
  };

  const handleConfigClear = async () => {
    try {
      await gyroApi.removeConfig();
      setLocalConfig({ ip: "", port: "", topic: [], username: "", password: "", updateRate: "" });
      setBackendHasDefaultConfig(false);
      setIsConfigEditing(true);
      showNotification("Konfigurasi MQTT berhasil dihapus dari server.", "success");
    } catch (error) {
      setLocalConfig({ ip: "", port: "", topic: [], username: "", password: "", updateRate: "" });
      setBackendHasDefaultConfig(false);
      setIsConfigEditing(true);
      showNotification(error.message || "Konfigurasi MQTT dikosongkan.", "info");
    }
  };

  const handleConfigChange = (isEditing) => setIsConfigEditing(isEditing);

  useEffect(() => {
    if (isGyroConfigOpen) fetchBackendConfig();
  }, [isGyroConfigOpen]);

  // ============================================================================
  // DATA FETCHING (initial) + POLLING fallback + WebSocket realtime
  // ============================================================================
  useEffect(() => {
    if (!backendHasDefaultConfig) return undefined;
    let cancelled = false;

    const fetchInitialData = async () => {
      try {
        const gyroData = (await gyroApi.get()) || {};
        if (cancelled) return;

        setIsBackendConnected(true);
        const mergedData = {
          yaw: gyroData.yaw ?? 0.0,
          pitch: gyroData.pitch ?? 0.0,
          roll: gyroData.roll ?? 0.0,
          yaw_rate: gyroData.yaw_rate ?? 2.5,
          is_running: Boolean(gyroData.is_running),
          last_update: gyroData.last_update || new Date().toISOString(),
        };

        setSimulationDataExists(
          mergedData.yaw !== 0.0 || mergedData.pitch !== 0.0 || mergedData.roll !== 0.0
        );
        setSimData(mergedData);
        setIsRecordCreated(true);
        setIsEmpty(false);

        if (!mergedData.is_running && !inputSnapshot) {
          setEditData({
            yaw: formatToOneDecimal(mergedData.yaw),
            pitch: formatToOneDecimal(mergedData.pitch),
            roll: formatToOneDecimal(mergedData.roll),
          });
        }
      } catch (error) {
        if (cancelled) return;
        if (error.kind === "not_found") {
          setIsBackendConnected(true);
          setIsRecordCreated(false);
          setIsEmpty(true);
          setSimulationDataExists(false);
          if (onStatusChange) onStatusChange(false);
        } else if (error.kind === "offline" || error.kind === "timeout") {
          setIsBackendConnected(false);
        }
      }
    };

    fetchInitialData();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendHasDefaultConfig]);

  const pollRate = parseInt(localConfig.updateRate, 10) || 1000;

  usePolling(
    async () => {
      try {
        const gyroData = await gyroApi.get();
        if (gyroData) {
          applyGyroData(gyroData);
          setSimulationDataExists(true);
          setIsRecordCreated(true);
          setIsEmpty(false);
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
    "gyro_update",
    (message) => {
      if (message?.data) {
        applyGyroData(message.data);
        setIsBackendConnected(true);
        setSimulationDataExists(true);
      }
    },
    backendHasDefaultConfig && simData.is_running
  );

  // ============================================================================
  // HANDLE SNAPSHOT
  // ============================================================================
  useEffect(() => {
    if (simData.is_running && !hasStartedRunningRef.current) {
      setInputSnapshot({...editData});
      hasStartedRunningRef.current = true;
    } else if (!simData.is_running && hasStartedRunningRef.current) {
      setInputSnapshot(null);
      hasStartedRunningRef.current = false;
      setEditData({
        yaw: formatToOneDecimal(simData.yaw),
        pitch: formatToOneDecimal(simData.pitch),
        roll: formatToOneDecimal(simData.roll)
      });
    }
  }, [simData.is_running, editData]);

  useEffect(() => {
    if (onStatusChange) onStatusChange(simData.is_running);
  }, [simData.is_running, onStatusChange]);

  // ============================================================================
  // ACTION FUNCTIONS
  // ============================================================================
  const handleSuccessfulUpdate = (newData) => {
    setSimData(prev => ({ ...prev, ...newData, last_update: new Date().toISOString() }));
    if (!isRecordCreated) setIsRecordCreated(true);
  };

  const executeSaveBackend = async () => {
    if (!backendHasDefaultConfig) {
      showNotification("Silakan konfigurasi koneksi MQTT terlebih dahulu", "error");
      return;
    }
    const payload = {
      yaw: parseFloat(editData.yaw) || 0,
      pitch: parseFloat(editData.pitch) || 0,
      roll: parseFloat(editData.roll) || 0,
      yaw_rate: parseFloat(simData.yaw_rate) || 2.5,
      is_running: simData.is_running
    };

    try {
      const saved = isRecordCreated
        ? await gyroApi.update(payload)
        : await gyroApi.create(payload);

      handleSuccessfulUpdate({
        yaw: saved.yaw,
        pitch: saved.pitch,
        roll: saved.roll,
        yaw_rate: saved.yaw_rate,
        is_running: saved.is_running
      });
      showNotification("Data berhasil dikirim ke Server!", "success");
    } catch (error) {
       showNotification(error.message || "Gagal menyimpan data.", "error");
    }
    setConfirmPopup(prev => ({ ...prev, isOpen: false }));
  };

  const executeApplyEdit = async () => {
    if (!backendHasDefaultConfig) {
      showNotification("Silakan konfigurasi koneksi MQTT terlebih dahulu", "error");
      return;
    }
    await executeSaveBackend();
    setIsEditing(false);
    setIsInputCleared(false);
    showNotification("Perubahan input berhasil disimpan!", "success");
  };

  const executeStart = async () => {
    if (!backendHasDefaultConfig) {
      showNotification("Silakan konfigurasi koneksi MQTT terlebih dahulu", "error");
      return;
    }
    const payload = {
      yaw: parseFloat(editData.yaw) || parseFloat(simData.yaw) || 0,
      pitch: parseFloat(editData.pitch) || parseFloat(simData.pitch) || 0,
      roll: parseFloat(editData.roll) || parseFloat(simData.roll) || 0,
      yaw_rate: parseFloat(simData.yaw_rate) || 2.5,
      is_running: true
    };

    try {
      const saved = isRecordCreated
        ? await gyroApi.update(payload)
        : await gyroApi.create(payload);

      handleSuccessfulUpdate({
        is_running: true,
        yaw: saved.yaw,
        pitch: saved.pitch,
        roll: saved.roll,
        yaw_rate: saved.yaw_rate
      });
      setIsEditing(false);
      setIsEmpty(false);
      showNotification("Simulasi dijalankan", "success");
    } catch (error) {
      showNotification(error.message || "Gagal menjalankan simulasi", "error");
    }
    setConfirmPopup(prev => ({ ...prev, isOpen: false }));
  };

  const executeStop = async () => {
    if (!isRecordCreated || !backendHasDefaultConfig) return;
    try {
      await gyroApi.update({ is_running: false });
      setSimData(prev => ({ ...prev, is_running: false }));
      showNotification("Simulasi dihentikan", "info");
    } catch (error) {
       showNotification(error.message || "Gagal menghentikan simulasi", "error");
    }
    setConfirmPopup(prev => ({ ...prev, isOpen: false }));
  };

  const executeDelete = async () => {
    if (!backendHasDefaultConfig) {
      showNotification("Silakan konfigurasi koneksi MQTT terlebih dahulu", "error");
      return;
    }
    setEditData({
      yaw: formatToOneDecimal(simData.yaw),
      pitch: formatToOneDecimal(simData.pitch),
      roll: formatToOneDecimal(simData.roll)
    });
    setIsInputCleared(true);

    try {
      await gyroApi.remove();
      setSimData({
        yaw: 0.0, pitch: 0.0, roll: 0.0, yaw_rate: 2.5,
        is_running: false, last_update: new Date().toISOString()
      });
      setSimulationDataExists(false);
      setIsRecordCreated(false);
      setIsEmpty(true);
      showNotification("Semua data berhasil dihapus!", "success");
    } catch (error) {
       showNotification(error.message || "Gagal menghapus data", "error");
    }
    setConfirmPopup(prev => ({ ...prev, isOpen: false }));
  };

  const executeClearInput = () => {
    setEditData({ yaw: "0.0", pitch: "0.0", roll: "0.0" });
    setIsInputCleared(true);
    showNotification("Input form telah dikosongkan!", "info");
    setConfirmPopup(prev => ({ ...prev, isOpen: false }));
  };

  const handleDefaultData = async () => {
    setIsInputCleared(false);
    const defData = { yaw: 0.0, pitch: 0.0, roll: 0.0, yaw_rate: 2.5 };
    const defString = { yaw: "0.0", pitch: "0.0", roll: "0.0" };

    if (!isRecordCreated) {
      setSimData(prev => ({ ...prev, ...defData, last_update: new Date().toISOString() }));
      setEditData(defString);
      showNotification("Data default diterapkan", "success");
      return;
    }
    try {
      const saved = await gyroApi.update(defData);
      handleSuccessfulUpdate({ ...saved });
      setEditData(defString);
      showNotification("Data default diterapkan", "success");
    } catch (error) {
      showNotification(error.message || "Gagal menerapkan data default", "error");
    }
  };

  const updateYawRate = async (newRate) => {
    if (!backendHasDefaultConfig) {
      showNotification("Silakan konfigurasi koneksi MQTT terlebih dahulu", "error");
      return;
    }
    if (!isRecordCreated) {
      setSimData(prev => ({...prev, yaw_rate: newRate}));
      return;
    }
    try {
      const saved = await gyroApi.update({ yaw_rate: newRate });
      if (saved) handleSuccessfulUpdate({ yaw_rate: saved.yaw_rate });
    } catch (error) {
      console.error("Error updating yaw rate:", error);
    }
  };

  const executeCreateEmpty = async () => {
    if (!backendHasDefaultConfig) {
      showNotification("Silakan konfigurasi koneksi MQTT terlebih dahulu", "error");
      return;
    }
    try {
      const saved = await gyroApi.create({ yaw: 0, pitch: 0, roll: 0, yaw_rate: 2.5, is_running: false });
      handleSuccessfulUpdate({ ...saved });
      setIsRecordCreated(true);
      setIsEmpty(false);
      setIsBackendConnected(true);
      showNotification("State Gyro berhasil dibuat", "success");
    } catch (error) {
      showNotification(
        error.kind === "conflict"
          ? "Config belum lengkap atau state sudah ada. Buka Config lalu isi IP/Port/Update Rate."
          : error.message || "Gagal membuat state Gyro",
        "error"
      );
    }
  };

  // ============================================================================
  // POPUP LOGIC
  // ============================================================================
  const openConfirmPopup = (type) => {
    const requiresConfig = ["startSim", "stopSim", "clearData", "saveEdit", "saveBackend"].includes(type);
    if (requiresConfig && !backendHasDefaultConfig) {
      showNotification("Silakan konfigurasi koneksi MQTT terlebih dahulu", "error");
      return;
    }
    let config = { isOpen: true, actionType: type };
    if (type === "startSim") { config.title = "Mulai Simulasi"; config.message = "Apakah Anda yakin ingin menjalankan simulasi?"; config.variant = "primary"; }
    else if (type === "stopSim") { config.title = "Hentikan Simulasi"; config.message = "Apakah Anda yakin ingin menghentikan simulasi?"; config.variant = "danger"; }
    else if (type === "clearData") { config.title = "Hapus Data"; config.message = "Apakah Anda yakin ingin me-reset visualisasi data?"; config.variant = "danger"; }
    else if (type === "clearInput") { config.title = "Hapus Input"; config.message = "Apakah Anda yakin ingin mengosongkan form input?"; config.variant = "danger"; }
    else if (type === "saveEdit") { config.title = "Simpan Perubahan"; config.message = "Apakah Anda yakin ingin menyimpan perubahan pada input?"; config.variant = "primary"; }
    else if (type === "saveBackend") { config.title = "Kirim Data"; config.message = "Apakah Anda yakin ingin mengirim data ini ke server?"; config.variant = "primary"; }
    setConfirmPopup(config);
  };

  const handleConfirmAction = () => {
    const { actionType } = confirmPopup;
    if (actionType === "startSim") executeStart();
    else if (actionType === "stopSim") executeStop();
    else if (actionType === "clearData") executeDelete();
    else if (actionType === "clearInput") executeClearInput();
    else if (actionType === "saveEdit") executeApplyEdit();
    else if (actionType === "saveBackend") executeSaveBackend();
    setConfirmPopup({ isOpen: false, title: "", message: "", variant: "danger", actionType: "" });
  };

  // ============================================================================
  // UI HANDLERS
  // ============================================================================
  const handleEditToggle = () => {
    if (simData.is_running) {
       showNotification("Tidak dapat mengedit saat simulasi berjalan", "error");
       return;
    }
    if (isEditing) {
      if (!backendHasDefaultConfig) {
        showNotification("Silakan konfigurasi koneksi MQTT terlebih dahulu untuk menyimpan perubahan", "error");
        return;
      }
      openConfirmPopup("saveEdit");
    } else {
      if (!isInputCleared) {
        setEditData({
          yaw: formatToOneDecimal(simData.yaw),
          pitch: formatToOneDecimal(simData.pitch),
          roll: formatToOneDecimal(simData.roll)
        });
      }
      setIsEditing(true);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (value === "" || value === "-") {
      setEditData((prev) => ({ ...prev, [name]: value }));
      return;
    }
    if (/^-?\d*\.?\d{0,1}$/.test(value)) {
      setEditData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const getInputValue = (key) => {
    if (simData.is_running && inputSnapshot) return inputSnapshot[key] || "0.0";
    if (isEditing || isInputCleared) return editData[key];
    return formatToOneDecimal(simData[key]);
  };

  const handleSaveButton = () => openConfirmPopup("saveBackend");

  const renderGyroStatusImage = () => {
    if (!isBackendConnected) return <img src={Waiting} alt="Waiting" className="status-image" />;
    if (simData.is_running) return <img src={Active} alt="Active" className="status-image" />;
    return <img src={Stop} alt="Stop" className="status-image" />;
  };

  const isPanelDisabled = !isBackendConnected;

  // ============================================================================
  // COMPONENT RENDER
  // ============================================================================
  return (
    <>
      <ToastNotification 
        message={notification.message} 
        type={notification.type} 
        onClose={() => setNotification({ message: "", type: "" })} 
      />
      
      <ConfigPopup 
        isOpen={isGyroConfigOpen} 
        onClose={closeGyroConfig} 
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
        onClose={() => setConfirmPopup(prev => ({...prev, isOpen: false}))} 
        variant={confirmPopup.variant}
      />

      <div className={`data-display-panel ${isPanelDisabled ? "disabled" : ""}`}>
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
              <div className="status-value-container">
                {renderGyroStatusImage()}
              </div>
            </div>
            <div className="status-item">
              <span className="status-label">UPDATE RATE</span>
              <div className="update-rate-value">
                {backendHasDefaultConfig ? (localConfig.updateRate || "1500") : "N/A"} ms
              </div>
            </div>
          </div>
        </div>

        {isEmpty && !simData.is_running ? (
          <EmptyState
            title="Gyro belum dibuat di server"
            message="State Gyro belum ada (HTTP 404). Buat state awal, lalu atur Yaw/Pitch/Roll lewat panel Edit Data."
            actionLabel="Create Gyro State"
            onAction={executeCreateEmpty}
          />
        ) : (
        <div className="gyro-visuals-container">
          <div className="gyro-card">
            <div className="card-header">
              <div className="card-title">
                <img src={Frame2} alt="Pitch" />
                <span>Pitch</span>
              </div>
              <h3>{formatWithSign(simData.pitch)}°</h3>
            </div>
            <PitchGauge pitch={simData.pitch} />
          </div>
          
          <div className="gyro-card">
            <div className="card-header">
              <div className="card-title">
                <img src={Frame1} alt="Yaw" />
                <span>Yaw</span>
              </div>
              <h3>{formatHeading(simData.yaw)}</h3>
            </div>
            <HeadingGauge heading={simData.yaw} />
            <div className="card-footer heading-rate-control">
              <span>Yaw Rate</span>
              <div className="rate-control-group">
                <button 
                  className="rate-btn btn-decrease" 
                  onClick={() => updateYawRate(Math.max(0, simData.yaw_rate - 0.5))}
                  disabled={!backendHasDefaultConfig || !isBackendConnected || simData.is_running}
                >
                  ◀
                </button>
                <span className="rate-value">{simData.yaw_rate.toFixed(1)}°/s</span>
                <button 
                  className="rate-btn btn-increase" 
                  onClick={() => updateYawRate(simData.yaw_rate + 0.5)}
                  disabled={!backendHasDefaultConfig || !isBackendConnected || simData.is_running}
                >
                  ▶
                </button>
              </div>
            </div>
          </div>
          
          <div className="gyro-card">
            <div className="card-header">
              <div className="card-title">
                <img src={Frame3} alt="Roll" />
                <span>Roll</span>
              </div>
              <h3>{simData.roll.toFixed(1)}°</h3>
            </div>
            <RollGauge roll={simData.roll} />
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

      <div className={`edit-data-panel ${isPanelDisabled ? "disabled" : ""}`}>
        <div className="panel-header">
          <h2>Edit Data</h2>
          <HeaderControl 
            onEdit={handleEditToggle} 
            onDelete={() => openConfirmPopup("clearInput")} 
            isDisabled={!isBackendConnected}
            isRunning={simData.is_running} 
            isEditing={isEditing} 
          />
        </div>
        
        <div className="form-container">
          <div className="input-group">
            <label>Set Yaw</label>
            <input 
              type="text" 
              name="yaw" 
              value={getInputValue('yaw')}
              onChange={handleInputChange}
              disabled={!isEditing || !isBackendConnected || simData.is_running}
              placeholder="0.0"
            />
          </div>
          
          <div className="input-group">
            <label>Set Pitch</label>
            <input 
              type="text" 
              name="pitch" 
              value={getInputValue('pitch')}
              onChange={handleInputChange}
              disabled={!isEditing || !isBackendConnected || simData.is_running}
              placeholder="0.0"
            />
          </div>
          
          <div className="input-group">
            <label>Set Roll</label>
            <input 
              type="text" 
              name="roll" 
              value={getInputValue('roll')}
              onChange={handleInputChange}
              disabled={!isEditing || !isBackendConnected || simData.is_running}
              placeholder="0.0"
            />
          </div>
        </div>
        
        <EditActions 
          onDefault={handleDefaultData} 
          onSave={handleSaveButton} 
          isDisabled={!backendHasDefaultConfig || !isBackendConnected}
          isRunning={simData.is_running} 
        />
      </div>
    </>
  );
}

export default GyroPage;
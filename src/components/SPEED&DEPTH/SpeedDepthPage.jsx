import React, { useState, useEffect, useRef } from "react";
import "./SpeedDepthPage.css"; 
import { speedApi, depthApi, navigationApi, fromConfig, toConfigPayload } from "../../api/endpoints";
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
import arrowSpeed from "../../assets/speed&depth/ArrowSpeed.png"; 
import iconArrowUpBlue from '../../assets/speed&depth/ArrowUpBlue.png'; 
import iconArrowUpGrey from '../../assets/speed&depth/ArrowUpGrey.png';
import iconArrowDownBlue from '../../assets/speed&depth/ArrowDownBlue.png';
import iconArrowDownGrey from '../../assets/speed&depth/ArrowDownGrey.png';
import Waiting from '../../assets/status/Property 1=Waiting.png';
import Active from '../../assets/status/Property 1=Active.png';
import Stop from '../../assets/status/Property 1=Stop.png';

// ============================================================================
// DEFAULT CONFIGURATION (cloud-safe)
// ============================================================================
const defaultNavigationConfig = { 
  ip: "127.0.0.1", 
  port: "1883", 
  username: "vessel_user", 
  password: "vessel_pass", 
  topic: ["vessel/navigation"], 
  updateRate: "1000" 
};

const SpeedDepthPage = ({ onStatusChange }) => {
  const { isSpeedDepthConfigOpen, closeSpeedDepthConfig } = useConfig();
  
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
    speed_through_water: 0.0,
    ocean_water_depth: 0.0,
    constant_clearance: 0.0,
    under_keel_clearance: 0.0,
    last_update: new Date().toISOString(),
    is_running: false
  });

  const [editData, setEditData] = useState({
    speed_through_water: "0.0",
    ocean_water_depth: "0.0",
    constant_clearance: "0.0", 
  });

  const [inputSnapshot, setInputSnapshot] = useState(null);

  // ============================================================================
  // DELTA STATE
  // ============================================================================
  const [previousSpeed, setPreviousSpeed] = useState(0.0);
  const [previousDepth, setPreviousDepth] = useState(0.0);
  const [speedDelta, setSpeedDelta] = useState(0.0); 
  const [depthDelta, setDepthDelta] = useState(0.0);
  const [speedTrend, setSpeedTrend] = useState('stable'); // 'up', 'down', 'stable'

  // ============================================================================
  // CONSTANTS & REFS
  // ============================================================================
  const MAX_SPEED = 60;
  const hasStartedRunningRef = useRef(false);
  const prevMetricsRef = useRef({ speed: 0, depth: 0 });

  // ============================================================================
  // CONFIG EDITING STATE
  // ============================================================================
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
  
  // ============================================================================
  // DELTA FORMATTING FUNCTION
  // ============================================================================
  const formatDelta = (val, unit) => {
    const absVal = Math.abs(val);
    
    if (absVal < 0.005) { // Kalau sangat kecil (0.005), anggap 0
      return `( 0.00 ${unit} )`;
    }
    
    const sign = val > 0 ? '+' : '-';
    return `( ${sign}${absVal.toFixed(2)} ${unit} )`;
  };

  // ============================================================================
  // CHECK BACKEND CONFIG
  // ============================================================================
  useEffect(() => {
    let cancelled = false;

    const checkBackendConfig = async () => {
      try {
        const data = await navigationApi.getConfig();
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
      const data = await navigationApi.getConfig();
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
    if (!configData.ip || !configData.port || !configData.username || !configData.password) {
      showNotification("IP, Port, Username, dan Password wajib diisi untuk Speed & Depth", "error");
      return false;
    }

    try {
      const saved = await navigationApi.updateConfig(toConfigPayload(configData));
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
    
    if (backendSaved) {
      setIsConfigEditing(false); 
    }
    
    if (shouldClose) closeSpeedDepthConfig();
  };

  const handleConfigDefault = async () => {
    setLocalConfig(defaultNavigationConfig);
    setIsConfigEditing(true); 
    showNotification("Form diisi dengan konfigurasi default", "info");
    await saveConfigToBackend(defaultNavigationConfig);
  };

  const handleConfigClear = async () => {
    try {
      await navigationApi.removeConfig();
      const emptyConfig = { ip: "", port: "", topic: [], username: "", password: "", updateRate: "" };
      setLocalConfig(emptyConfig);
      setBackendHasDefaultConfig(false);
      setIsConfigEditing(true); 
      showNotification("Konfigurasi MQTT berhasil dihapus dari server.", "success");
    } catch (error) {
      console.error("Failed to delete config:", error);
      const emptyConfig = { ip: "", port: "", topic: [], username: "", password: "", updateRate: "" };
      setLocalConfig(emptyConfig);
      setBackendHasDefaultConfig(false);
      setIsConfigEditing(true); 
      showNotification(error.message || "Konfigurasi MQTT dikosongkan.", "info");
    }
  };

  const handleConfigChange = (isEditing) => {
    setIsConfigEditing(isEditing);
  };

  useEffect(() => {
    if (isSpeedDepthConfigOpen) {
      fetchBackendConfig();
    }
  }, [isSpeedDepthConfigOpen]);

  // ============================================================================
  // DATA FETCHING (initial) + POLLING fallback + WebSocket realtime
  // ============================================================================
  const isPanelDisabled = !isBackendConnected;

  const applySpeedDepthData = (speedData, depthData) => {
    const previous = prevMetricsRef.current;
    const newSpeed = speedData?.speed_through_water ?? previous.speed;
    const newDepth = depthData?.ocean_water_depth ?? previous.depth;

    const speedDiff = newSpeed - previous.speed;
    const depthDiff = newDepth - previous.depth;

    setSpeedDelta(speedDiff);
    setDepthDelta(depthDiff);
    setSpeedTrend(speedDiff > 0.01 ? "up" : speedDiff < -0.01 ? "down" : "stable");

    prevMetricsRef.current = { speed: newSpeed, depth: newDepth };
    setPreviousSpeed(newSpeed);
    setPreviousDepth(newDepth);

    setSimData((prevData) => ({
      ...prevData,
      speed_through_water: newSpeed,
      ocean_water_depth: newDepth,
      constant_clearance: depthData?.constant_clearance ?? prevData.constant_clearance,
      under_keel_clearance: depthData?.under_keel_clearance ?? prevData.under_keel_clearance,
      is_running: speedData?.is_running ?? prevData.is_running,
      last_update: speedData?.last_update || new Date().toISOString(),
    }));

    if (typeof speedData?.is_running === "boolean" && onStatusChange) {
      onStatusChange(speedData.is_running);
    }
  };

  useEffect(() => {
    if (!backendHasDefaultConfig) return undefined;
    let cancelled = false;

    const fetchInitialData = async () => {
      try {
        const [speedD, depthD] = await Promise.all([speedApi.get(), depthApi.get()]);
        if (cancelled) return;

        setIsBackendConnected(true);
        const speedValue = speedD?.speed_through_water ?? 0.0;
        const depthValue = depthD?.ocean_water_depth ?? 0.0;

        const mergedData = {
          speed_through_water: speedValue,
          ocean_water_depth: depthValue,
          constant_clearance: depthD?.constant_clearance ?? 0.0,
          under_keel_clearance: depthD?.under_keel_clearance ?? 0.0,
          last_update: speedD?.last_update || new Date().toISOString(),
          is_running: Boolean(speedD?.is_running),
        };

        const hasData =
          (speedValue > 0 || depthValue > 0 || (depthD?.constant_clearance ?? 0) > 0) &&
          (speedValue !== 0.0 || depthValue !== 0.0 || (depthD?.constant_clearance ?? 0) !== 0.0);

        setSimulationDataExists(hasData);
        prevMetricsRef.current = { speed: speedValue, depth: depthValue };
        setPreviousSpeed(speedValue);
        setPreviousDepth(depthValue);
        setSimData(mergedData);
        setIsRecordCreated(true);
        setIsEmpty(false);

        if (!mergedData.is_running && !inputSnapshot) {
          setEditData({
            speed_through_water: String(speedValue),
            ocean_water_depth: String(depthValue),
            constant_clearance: String(depthD?.constant_clearance ?? 0.0),
          });
        }
      } catch (error) {
        if (cancelled) return;
        setIsBackendConnected(error.kind !== "offline" && error.kind !== "timeout");

        if (error.kind === "not_found") {
          setIsRecordCreated(false);
          setIsEmpty(true);
          setSimulationDataExists(false);
          if (onStatusChange) onStatusChange(false);
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
        const [speedD, depthD] = await Promise.all([speedApi.get(), depthApi.get()]);
        applySpeedDepthData(speedD, depthD);
        setSimulationDataExists(true);
        setIsRecordCreated(true);
        setIsEmpty(false);
        setIsBackendConnected(true);
      } catch (error) {
        if (error.kind === "offline" || error.kind === "timeout") {
          setIsBackendConnected(false);
        }
        if (error.kind === "not_found") {
          setIsRecordCreated(false);
          setIsEmpty(true);
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
    "speed_update",
    (message) => {
      if (!message?.data) return;
      applySpeedDepthData(message.data, null);
      setIsBackendConnected(true);
    },
    backendHasDefaultConfig && simData.is_running
  );

  useRealtime(
    "depth_update",
    (message) => {
      if (!message?.data) return;
      applySpeedDepthData(null, message.data);
      setIsBackendConnected(true);
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
        speed_through_water: String(simData.speed_through_water),
        ocean_water_depth: String(simData.ocean_water_depth),
        constant_clearance: String(simData.constant_clearance)
      });
    }
  }, [simData.is_running, editData]);

  // ============================================================================
  // RESET DELTA KETIKA STOP RUNNING
  // ============================================================================
  useEffect(() => {
    if (!simData.is_running) {
      setSpeedDelta(0.0);
      setDepthDelta(0.0);
      setSpeedTrend('stable');
    }
  }, [simData.is_running]);

  useEffect(() => {
    if (onStatusChange) onStatusChange(simData.is_running);
  }, [simData.is_running, onStatusChange]);

  // ============================================================================
  // ACTIONS
  // ============================================================================
  const handleSuccessfulUpdate = (newData) => {
    setSimData(prev => ({ ...prev, ...newData, last_update: new Date().toISOString() }));
    if (!isRecordCreated) setIsRecordCreated(true);
  };

  const upsertSpeed = async (payload) => {
    if (isRecordCreated) {
      try {
        return await speedApi.update(payload);
      } catch (error) {
        if (error.kind !== "not_found") throw error;
      }
    }
    return speedApi.create(payload);
  };

  const upsertDepth = async (payload) => {
    if (isRecordCreated) {
      try {
        return await depthApi.update(payload);
      } catch (error) {
        if (error.kind !== "not_found") throw error;
      }
    }
    return depthApi.create(payload);
  };

  const executeSaveBackend = async () => {
    if (!backendHasDefaultConfig) {
      showNotification("Silakan konfigurasi koneksi MQTT terlebih dahulu", "error");
      return;
    }

    const valSpeed = parseFloat(editData.speed_through_water) || 0;
    const valDepth = parseFloat(editData.ocean_water_depth) || 0;
    const valClearance = parseFloat(editData.constant_clearance) || 0;

    try {
      const speedPayload = { speed_through_water: valSpeed, is_running: simData.is_running };
      const depthPayload = {
        ocean_water_depth: valDepth,
        constant_clearance: valClearance,
        is_running: simData.is_running,
      };

      const [speedSaved, depthSaved] = await Promise.all([
        upsertSpeed(speedPayload),
        upsertDepth(depthPayload),
      ]);

      handleSuccessfulUpdate({
        speed_through_water: speedSaved.speed_through_water,
        ocean_water_depth: depthSaved.ocean_water_depth,
        constant_clearance: depthSaved.constant_clearance,
        under_keel_clearance: depthSaved.under_keel_clearance,
        is_running: simData.is_running,
      });
      setIsRecordCreated(true);
      setIsEmpty(false);
      showNotification("Data berhasil dikirim ke Server!", "success");
    } catch (error) {
      console.error("Error saving data:", error);
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
    
    try {
        const speedVal = parseFloat(editData.speed_through_water) || parseFloat(simData.speed_through_water) || 0;
        const depthVal = parseFloat(editData.ocean_water_depth) || parseFloat(simData.ocean_water_depth) || 0;
        const clearanceVal = parseFloat(editData.constant_clearance) || parseFloat(simData.constant_clearance) || 0;

        const [speedSaved, depthSaved] = await Promise.all([
            upsertSpeed({ speed_through_water: speedVal, is_running: true }),
            upsertDepth({ ocean_water_depth: depthVal, constant_clearance: clearanceVal, is_running: true })
        ]);

        handleSuccessfulUpdate({
            is_running: true,
            speed_through_water: speedSaved.speed_through_water,
            ocean_water_depth: depthSaved.ocean_water_depth,
            constant_clearance: depthSaved.constant_clearance,
            under_keel_clearance: depthSaved.under_keel_clearance
        });
        setIsEditing(false);
        setIsEmpty(false);
        showNotification("Simulasi dijalankan", "success");
    } catch (error) {
        console.error("Error start:", error);
        showNotification(
          error.kind === "conflict"
            ? "Config Navigation belum lengkap (IP, Port, Username, Password, Update Rate). Buka Config."
            : error.message || "Gagal menjalankan simulasi",
          "error"
        );
    }
    setConfirmPopup(prev => ({ ...prev, isOpen: false }));
  };

  const executeStop = async () => {
    if (!isRecordCreated || !backendHasDefaultConfig) return;
    try {
        await Promise.all([
            speedApi.update({ is_running: false }),
            depthApi.update({ is_running: false })
        ]);
        setSimData(prev => ({ ...prev, is_running: false }));
        showNotification("Simulasi dihentikan", "info");
    } catch (error) {
        console.error("Error stop:", error);
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
        speed_through_water: String(parseFloat(simData.speed_through_water).toFixed(1)).replace(/\.0$/, ''),
        ocean_water_depth: String(parseFloat(simData.ocean_water_depth).toFixed(1)).replace(/\.0$/, ''),
        constant_clearance: String(parseFloat(simData.constant_clearance).toFixed(1)).replace(/\.0$/, ''),
    });
    setIsInputCleared(true);

    try {
        await Promise.all([ speedApi.remove(), depthApi.remove() ]);
        setSimData({
            speed_through_water: 0.0,
            ocean_water_depth: 0.0,
            constant_clearance: 0.0,
            under_keel_clearance: 0.0,
            last_update: new Date().toISOString(),
            is_running: false
        });
        
        setSpeedDelta(0.0);
        setDepthDelta(0.0);
        setPreviousSpeed(0.0);
        setPreviousDepth(0.0);
        prevMetricsRef.current = { speed: 0, depth: 0 };
        setSimulationDataExists(false);
        
        setIsRecordCreated(false);
        setIsEmpty(true);
        showNotification("Semua data berhasil dihapus!", "success");
    } catch (error) {
        console.error("Error delete:", error);
        setSimData(prev => ({ ...prev, speed_through_water: 0, ocean_water_depth: 0, is_running: false }));
        setIsRecordCreated(false);
        setIsEmpty(true);
        showNotification(error.message || "Gagal menghapus data", "error");
    }
    setConfirmPopup(prev => ({ ...prev, isOpen: false }));
  };

  const executeClearInput = () => {
    setEditData({ speed_through_water: "0", ocean_water_depth: "0", constant_clearance: "0" });
    setIsInputCleared(true);
    showNotification("Input form telah dikosongkan!", "info");
    setConfirmPopup(prev => ({ ...prev, isOpen: false }));
  };

  const handleDefaultData = async () => {
    setIsInputCleared(false);
    const defData = { speed: 10.8, depth: 400.0, clearance: 20.0 };
    const defString = { speed_through_water: "10.8", ocean_water_depth: "400.0", constant_clearance: "20.0" };

    try {
        const [speedSaved, depthSaved] = await Promise.all([
            upsertSpeed({ speed_through_water: defData.speed }),
            upsertDepth({ ocean_water_depth: defData.depth, constant_clearance: defData.clearance })
        ]);

        handleSuccessfulUpdate({
            speed_through_water: speedSaved.speed_through_water,
            ocean_water_depth: depthSaved.ocean_water_depth,
            constant_clearance: depthSaved.constant_clearance,
            under_keel_clearance: depthSaved.under_keel_clearance
        });
        setEditData(defString);
        setIsRecordCreated(true);
        setIsEmpty(false);
        showNotification("Data default diterapkan", "success");
    } catch (error) {
        console.error("Error default data:", error);
        showNotification(error.message || "Gagal menerapkan data default", "error");
    }
  };

  const executeCreateEmpty = async () => {
    if (!backendHasDefaultConfig) {
      showNotification("Silakan konfigurasi koneksi MQTT terlebih dahulu", "error");
      return;
    }
    try {
      const [speedSaved, depthSaved] = await Promise.all([
        speedApi.create({ speed_through_water: 0, is_running: false }),
        depthApi.create({ ocean_water_depth: 0, constant_clearance: 0, is_running: false }),
      ]);
      handleSuccessfulUpdate({
        speed_through_water: speedSaved.speed_through_water,
        ocean_water_depth: depthSaved.ocean_water_depth,
        constant_clearance: depthSaved.constant_clearance,
        under_keel_clearance: depthSaved.under_keel_clearance,
        is_running: false,
      });
      setIsRecordCreated(true);
      setIsEmpty(false);
      setIsBackendConnected(true);
      showNotification("State Speed & Depth berhasil dibuat", "success");
    } catch (error) {
      showNotification(
        error.kind === "conflict"
          ? "Config Navigation belum lengkap atau state sudah ada. Buka Config lalu isi IP/Port/Username/Password/Update Rate."
          : error.message || "Gagal membuat state Speed & Depth",
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
    if (type === "startSim") { 
      config.title = "Mulai Simulasi"; 
      config.message = "Apakah Anda yakin ingin menjalankan simulasi?"; 
      config.variant = "primary"; 
    }
    else if (type === "stopSim") { 
      config.title = "Hentikan Simulasi"; 
      config.message = "Apakah Anda yakin ingin menghentikan simulasi?"; 
      config.variant = "danger"; 
    }
    else if (type === "clearData") { 
      config.title = "Hapus Data"; 
      config.message = "Apakah Anda yakin ingin me-reset visualisasi data?"; 
      config.variant = "danger"; 
    }
    else if (type === "clearInput") { 
      config.title = "Hapus Input"; 
      config.message = "Apakah Anda yakin ingin mengosongkan form input?"; 
      config.variant = "danger"; 
    }
    else if (type === "saveEdit") { 
      config.title = "Simpan Perubahan"; 
      config.message = "Apakah Anda yakin ingin menyimpan perubahan pada input?"; 
      config.variant = "primary"; 
    }
    else if (type === "saveBackend") { 
      config.title = "Kirim Data"; 
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
    else if (actionType === "saveEdit") executeApplyEdit();
    else if (actionType === "saveBackend") executeSaveBackend();
    setConfirmPopup({ isOpen: false, title: "", message: "", variant: "danger", actionType: "" });
  };

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
                speed_through_water: String(parseFloat(simData.speed_through_water).toFixed(1)).replace(/\.0$/, ''),
                ocean_water_depth: String(parseFloat(simData.ocean_water_depth).toFixed(1)).replace(/\.0$/, ''),
                constant_clearance: String(parseFloat(simData.constant_clearance).toFixed(1)).replace(/\.0$/, ''),
            });
        }
        setIsEditing(true);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
        setEditData(prev => ({ ...prev, [name]: value }));
    }
  };

  const getInputValue = (key) => {
    if (simData.is_running && inputSnapshot) {
      return inputSnapshot[key] || "0.0";
    }
    
    if (isEditing || isInputCleared) {
      return editData[key];
    }
    
    const value = simData[key];
    return typeof value === 'number' ? value.toFixed(1).replace(/\.0$/, '') : "0.0";
  };

  // ============================================================================
  // UI RENDER FUNCTIONS
  // ============================================================================
  const renderStatusImage = () => {
    if (!isBackendConnected) return <img src={Waiting} alt="Waiting" className="status-image" />;
    if (simData.is_running) return <img src={Active} alt="Active" className="status-image" />;
    return <img src={Stop} alt="Stop" className="status-image" />;
  };

  const handleSaveButton = () => openConfirmPopup("saveBackend");

  // ============================================================================
  // SPEED ARROW CONFIGURATION
  // ============================================================================
  const arrowUpImage = speedTrend === 'up' ? iconArrowUpBlue : iconArrowUpGrey;
  const arrowDownImage = speedTrend === 'down' ? iconArrowDownBlue : iconArrowDownGrey;
  
  const speedPercentage = Math.min((simData.speed_through_water / MAX_SPEED) * 100, 100);

  const formatDisplayValue = (value) => {
    return parseFloat(value).toFixed(1);
  };

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
        onClose={() => setConfirmPopup(prev => ({...prev, isOpen: false}))} 
        variant={confirmPopup.variant}
      />

      <div className={`data-display-panel speed-depth-panel ${isPanelDisabled ? "disabled" : ""}`}>
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
                {renderStatusImage()}
              </div>
            </div>
            <div className="status-item">
              <span className="status-label">UPDATE RATE</span>
              <div className="update-rate-value">
                {backendHasDefaultConfig ? (localConfig.updateRate || "1000") : "N/A"} ms
              </div>
            </div>
          </div>
        </div>

        {isEmpty && !simData.is_running ? (
          <EmptyState
            title="Speed & Depth belum dibuat di server"
            message="State speed/depth belum ada (HTTP 404). Buat state awal, lalu isi nilai lewat panel Edit Data."
            actionLabel="Create Speed & Depth"
            onAction={executeCreateEmpty}
          />
        ) : (
        <div className="visualization-cards-wrapper">
          <div className="vis-card">
            <div className="vis-header">
              <span className="vis-icon">≋</span> Speed Through Water
            </div>
            <div className="vis-content">
              <div className="speed-inner-box">
                <div className="speed-gauge-wrapper">
                  <div className="speed-ruler">
                    <span>0</span><span>10</span><span>20</span><span>30</span><span>40</span><span>50</span><span>60</span>
                  </div>
                  <div className="speed-track">
                    <div className="speed-segment green"></div>
                    <div className="speed-segment blue"></div>
                    <div className="speed-segment yellow"></div>
                    <div className="speed-segment red"></div>
                  </div>
                  <div className="speed-needle" style={{ left: `${speedPercentage}%` }}>
                    <img src={arrowSpeed} alt="Needle" />
                  </div>
                </div>
                <div className="digital-value-box">
                  <span className="label">Current Speed</span>
                  <div className="speed-display-group">
                    <div className="trend-arrows-container">
                      <img src={arrowUpImage} alt="Up" className="trend-arrow arrow-up" />
                      <img src={arrowDownImage} alt="Down" className="trend-arrow arrow-down" />
                    </div>
                    <div className="speed-text-column">
                      <div className="value-row">
                        <span className="value-large">
                          {formatDisplayValue(simData.speed_through_water)}
                        </span>
                        <span className="unit">kn</span>
                      </div>
                      <div className="speed-delta-text">
                        {formatDelta(speedDelta, 'kn')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="vis-card">
            <div className="vis-header">
              <span className="vis-icon">⬇</span> Ocean Water Depth
            </div>
            <div className="vis-content depth-content">
              <div className="depth-inner-box">
                <div className="depth-info-side">
                  <div className="info-block">
                    <span className="label">Current Depth</span>
                    <div className="value-row">
                      <span className="value-large">
                        {formatDisplayValue(simData.ocean_water_depth)}
                      </span>
                      <span className="unit" style={{ position: 'relative' }}>
                        m
                        <span className="depth-delta-absolute">
                          {formatDelta(depthDelta, 'm')}
                        </span>
                      </span>
                    </div>
                    <small>From Surface</small>
                  </div>
                  <div className="divider-vertical"></div>
                  <div className="info-block">
                    <span className="label">UKC (Under Keel)</span>
                    <div className="value-row">
                      <span className="value-large">
                        {formatDisplayValue(simData.under_keel_clearance)}
                      </span>
                      <span className="unit">m</span>
                    </div>
                    <small>Clearance</small>
                  </div>
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

        <div className="edit-form-container">
          <div className="input-group">
            <label>Set Speed</label>
            <input 
              type="text" 
              name="speed_through_water"
              value={getInputValue('speed_through_water')}
              onChange={handleInputChange}
              disabled={!isEditing || !isBackendConnected || simData.is_running} 
              placeholder="0.0"
            />
          </div>
          <div className="input-group">
            <label>Set Depth</label>
            <input 
              type="text" 
              name="ocean_water_depth"
              value={getInputValue('ocean_water_depth')}
              onChange={handleInputChange}
              disabled={!isEditing || !isBackendConnected || simData.is_running}
              placeholder="0.0"
            />
          </div>
          <div className="input-group">
            <label>Set Constant Clearance</label>
            <input 
              type="text" 
              name="constant_clearance"
              value={getInputValue('constant_clearance')}
              onChange={handleInputChange}
              disabled={!isEditing || !isBackendConnected || simData.is_running}
              placeholder="0.0"
            />
          </div>
        </div>

        <EditActions 
          onSave={handleSaveButton} 
          onDefault={handleDefaultData} 
          isDisabled={!backendHasDefaultConfig || !isBackendConnected} 
          isRunning={simData.is_running} 
        />
      </div>
    </>
  );
};

export default SpeedDepthPage;
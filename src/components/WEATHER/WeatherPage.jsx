import React, { useState, useEffect, useRef } from "react";
import "./WeatherPage.css";
import { weatherApi, fromConfig, toConfigPayload } from "../../api/endpoints";
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
import ship from '../../assets/weather/ship.png';
import wind_icon from '../../assets/weather/wind_icon.png'; 
import wind from '../../assets/weather/wind.png'; 
import IconWind from '../../assets/weather/IconWind.png';
import StatusWaiting from "../../assets/status/Property 1=Waiting.png"; 
import StatusActive from "../../assets/status/Property 1=Active.png";
import StatusStopImg from "../../assets/status/Property 1=Stop.png";

// Default config untuk weather (cloud-safe)
const defaultWeatherConfig = { 
  ip: "127.0.0.1", 
  port: "1883", 
  username: "vessel-user", 
  password: "secret123", 
  topic: ["weather/sensor"], 
  updateRate: "1000" 
};

const WeatherPage = ({ onStatusChange }) => {
  const { isWeatherConfigOpen, closeWeatherConfig } = useConfig();
  
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
  
  const [notification, setNotification] = useState({ message: "", type: "" });
  const [confirmPopup, setConfirmPopup] = useState({ isOpen: false, title: "", message: "", variant: "danger", actionType: "" });

  const [simData, setSimData] = useState({
    air_temperature: 0.0,
    air_humidity: 0.0,
    air_pressure: 0.0,
    wind_direction_relative: 0.0,
    wind_velocity: 0.0,
    is_running: false,
    last_update: new Date().toISOString()
  });

  const [editData, setEditData] = useState({
    air_temperature: "0.00",
    air_humidity: "0.00", 
    air_pressure: "0.00",
    wind_direction_relative: "0.00",
    wind_velocity: "0.00"
  });

  const [inputSnapshot, setInputSnapshot] = useState(null);

  // State untuk delta values
  const [previousTemperature, setPreviousTemperature] = useState(0.0);
  const [previousHumidity, setPreviousHumidity] = useState(0.0);
  const [previousPressure, setPreviousPressure] = useState(0.0);
  const [previousWindDirection, setPreviousWindDirection] = useState(0.0);
  const [previousWindVelocity, setPreviousWindVelocity] = useState(0.0);

  // REFS
  const hasStartedRunningRef = useRef(false);
  const fetchIntervalRef = useRef(null);
  const isMountedRef = useRef(true);
  const initialLoadRef = useRef(false);
  const isEditingRef = useRef(false);

  // State untuk config editing
  const [isConfigEditing, setIsConfigEditing] = useState(false);

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (fetchIntervalRef.current) clearInterval(fetchIntervalRef.current);
    };
  }, []);

  // ============ NOTIFICATION FUNCTION ============
  const showNotification = (msg, type = 'success') => { 
    setNotification({ message: msg, type: type }); 
    setTimeout(() => setNotification({ message: "", type: "" }), 3000);
  };
  
  const formatDateTime = (iso) => { 
    try { 
      const d = new Date(iso); 
      return isNaN(d.getTime()) ? "N/A" : `${String(d.getDate()).padStart(2,"0")} ${d.toLocaleString("en-GB",{month:"short"})} ${d.getFullYear()}, ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`; 
    } catch { 
      return iso||"N/A"; 
    } 
  };

  const formatToTwoDecimals = (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? "0.00" : num.toFixed(2);
  };

  // ============ INITIALIZATION (Config) ============
  useEffect(() => {
    let cancelled = false;

    const initializePage = async () => {
      try {
        const data = await weatherApi.getConfig();
        if (cancelled) return;

        setIsBackendConnected(true);
        const formatted = fromConfig(data);
        const valid = Boolean(formatted.ip && formatted.port && formatted.username);
        setLocalConfig(formatted);
        setBackendHasDefaultConfig(valid);
        setIsConfigEditing(!valid);
      } catch (error) {
        if (cancelled) return;
        setBackendHasDefaultConfig(false);
        setIsConfigEditing(true);
        setIsBackendConnected(error.kind !== "offline" && error.kind !== "timeout");
      }
    };

    initializePage();
    return () => {
      cancelled = true;
    };
  }, []);

  // ============ DATA HELPERS ============
  const applyWeatherData = (incoming) => {
    if (!incoming) return;

    const next = {
      air_temperature: incoming.air_temperature,
      air_humidity: incoming.air_humidity,
      air_pressure: incoming.air_pressure,
      wind_direction_relative: incoming.wind_direction_relative,
      wind_velocity: incoming.wind_velocity,
    };

    setPreviousTemperature(next.air_temperature ?? 0);
    setPreviousHumidity(next.air_humidity ?? 0);
    setPreviousPressure(next.air_pressure ?? 0);
    setPreviousWindDirection(next.wind_direction_relative ?? 0);
    setPreviousWindVelocity(next.wind_velocity ?? 0);

    setSimData((prev) => ({
      ...prev,
      ...next,
      is_running: incoming.is_running ?? prev.is_running,
      last_update: incoming.last_update || new Date().toISOString(),
    }));

    if (typeof incoming.is_running === "boolean" && onStatusChange) {
      onStatusChange(incoming.is_running);
    }
  };

  // ============ INITIAL DATA (HTTP) ============
  useEffect(() => {
    if (!backendHasDefaultConfig) return undefined;
    let cancelled = false;

    const loadInitialData = async () => {
      try {
        const weatherData = (await weatherApi.get()) || {};
        if (cancelled) return;

        setIsBackendConnected(true);
        const mergedData = {
          air_temperature: weatherData.air_temperature ?? 0.0,
          air_humidity: weatherData.air_humidity ?? 0.0,
          air_pressure: weatherData.air_pressure ?? 0.0,
          wind_direction_relative: weatherData.wind_direction_relative ?? 0.0,
          wind_velocity: weatherData.wind_velocity ?? 0.0,
          is_running: Boolean(weatherData.is_running),
          last_update: weatherData.last_update || new Date().toISOString(),
        };

        setSimData(mergedData);
        setIsRecordCreated(true);
        setIsEmpty(false);
        setSimulationDataExists(true);

        if (!isEditingRef.current) {
          setEditData({
            air_temperature: formatToTwoDecimals(mergedData.air_temperature),
            air_humidity: formatToTwoDecimals(mergedData.air_humidity),
            air_pressure: formatToTwoDecimals(mergedData.air_pressure),
            wind_direction_relative: formatToTwoDecimals(mergedData.wind_direction_relative),
            wind_velocity: formatToTwoDecimals(mergedData.wind_velocity),
          });
        }

        if (!initialLoadRef.current) initialLoadRef.current = true;
      } catch (error) {
        if (cancelled) return;
        setIsBackendConnected(error.kind !== "offline" && error.kind !== "timeout");

        if (error.kind === "not_found") {
          setIsRecordCreated(false);
          setIsEmpty(true);
          setSimulationDataExists(false);
          if (onStatusChange) onStatusChange(false);
          if (!initialLoadRef.current) initialLoadRef.current = true;
        }
      }
    };

    loadInitialData();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendHasDefaultConfig]);

  const stopPolling = () => {
    /* polling dikelola oleh usePolling, tidak ada interval manual */
  };

  const pollRate = parseInt(localConfig.updateRate, 10) || 1000;

  // ============ POLLING FALLBACK (recursive setTimeout) ============
  usePolling(
    async () => {
      try {
        const weatherData = await weatherApi.get();
        if (!weatherData) return;
        applyWeatherData(weatherData);
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

  // ============ WEBSOCKET REALTIME ============
  useRealtime(
    "weather_update",
    (message) => {
      if (!message?.data) return;
      applyWeatherData(message.data);
      setIsBackendConnected(true);
    },
    backendHasDefaultConfig && simData.is_running
  );

  useEffect(() => {
    if (onStatusChange) onStatusChange(simData.is_running);
  }, [simData.is_running, onStatusChange]);

  // ============ CONFIG FUNCTIONS (POPUP) ============
  const fetchBackendConfig = async () => {
    try {
      const data = await weatherApi.getConfig();
      setIsBackendConnected(true);
      const formatted = fromConfig(data);
      const valid = Boolean(formatted.ip && formatted.port && formatted.username);
      setLocalConfig(formatted);
      setBackendHasDefaultConfig(valid);
      setIsConfigEditing(!valid);
      return valid ? formatted : null;
    } catch (error) {
      setBackendHasDefaultConfig(false);
      setIsConfigEditing(true);
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
      const saved = await weatherApi.updateConfig(toConfigPayload(configData));
      setLocalConfig(fromConfig(saved));
      setBackendHasDefaultConfig(true);
      setIsConfigEditing(false);
      showNotification("Konfigurasi Weather berhasil disimpan ke server", "success");
      return true;
    } catch (error) {
      showNotification(error.message || "Gagal menyimpan konfigurasi Weather", "error");
      return false;
    }
  };

  const handleConfigSaveAndClose = async (newConfig, shouldClose) => {
    const processedConfig = {
      ...newConfig,
      topic: Array.isArray(newConfig.topic) ? newConfig.topic : (newConfig.topic ? [newConfig.topic] : [])
    };
    const backendSaved = await saveConfigToBackend(processedConfig);
    if (backendSaved) setIsConfigEditing(false);
    if (shouldClose) closeWeatherConfig();
  };

  const handleConfigDefault = async () => {
    setLocalConfig(defaultWeatherConfig);
    setIsConfigEditing(true);
    showNotification("Form diisi dengan konfigurasi default", "info");
  };

  const handleConfigClear = async () => {
    try {
      await weatherApi.removeConfig();
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
    if (isWeatherConfigOpen) fetchBackendConfig();
  }, [isWeatherConfigOpen]);

  // HANDLE SNAPSHOT
  useEffect(() => {
    if (simData.is_running && !hasStartedRunningRef.current) {
      setInputSnapshot({...editData});
      hasStartedRunningRef.current = true;
    } else if (!simData.is_running && hasStartedRunningRef.current) {
      setInputSnapshot(null);
      hasStartedRunningRef.current = false;
      setEditData({
        air_temperature: formatToTwoDecimals(simData.air_temperature),
        air_humidity: formatToTwoDecimals(simData.air_humidity),
        air_pressure: formatToTwoDecimals(simData.air_pressure),
        wind_direction_relative: formatToTwoDecimals(simData.wind_direction_relative),
        wind_velocity: formatToTwoDecimals(simData.wind_velocity)
      });
    }
  }, [simData.is_running, editData]);

  // ============ ACTIONS ============
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
      air_temperature: parseFloat(editData.air_temperature) || 0,
      air_humidity: parseFloat(editData.air_humidity) || 0,
      air_pressure: parseFloat(editData.air_pressure) || 0,
      wind_direction_relative: parseFloat(editData.wind_direction_relative) || 0,
      wind_velocity: parseFloat(editData.wind_velocity) || 0,
      is_running: simData.is_running
    };
    try {
      let saved;
      try {
        saved = isRecordCreated
          ? await weatherApi.update(payload)
          : await weatherApi.create(payload);
      } catch (error) {
        if (error.kind !== "not_found") throw error;
        saved = await weatherApi.create(payload);
        setIsRecordCreated(true);
      }

      handleSuccessfulUpdate({
        air_temperature: saved.air_temperature,
        air_humidity: saved.air_humidity,
        air_pressure: saved.air_pressure,
        wind_direction_relative: saved.wind_direction_relative,
        wind_velocity: saved.wind_velocity,
        is_running: saved.is_running
      });
      setIsEmpty(false);
      showNotification("Data Weather berhasil dikirim ke Server!", "success");
    } catch (error) {
      showNotification(error.message || "Gagal menyimpan data Weather", "error");
    }
    setConfirmPopup(prev => ({ ...prev, isOpen: false }));
  };

  const executeStart = async () => {
    if (!backendHasDefaultConfig) {
      showNotification("Silakan konfigurasi koneksi MQTT terlebih dahulu", "error");
      return;
    }
    const startTemp = parseFloat(editData.air_temperature) || parseFloat(simData.air_temperature) || 0;
    const startHumidity = parseFloat(editData.air_humidity) || parseFloat(simData.air_humidity) || 0;
    const startPressure = parseFloat(editData.air_pressure) || parseFloat(simData.air_pressure) || 0;
    const startWindDir = parseFloat(editData.wind_direction_relative) || parseFloat(simData.wind_direction_relative) || 0;
    const startWindVel = parseFloat(editData.wind_velocity) || parseFloat(simData.wind_velocity) || 0;

    const payload = {
      air_temperature: startTemp,
      air_humidity: startHumidity,
      air_pressure: startPressure,
      wind_direction_relative: startWindDir,
      wind_velocity: startWindVel,
      is_running: true
    };

    try {
      let saved;
      try {
        saved = isRecordCreated
          ? await weatherApi.update(payload)
          : await weatherApi.create(payload);
      } catch (error) {
        if (error.kind !== "not_found") throw error;
        saved = await weatherApi.create(payload);
        setIsRecordCreated(true);
      }

      handleSuccessfulUpdate({ is_running: true, ...saved });
      setIsRecordCreated(true);
      setIsEditing(false);
      setIsEmpty(false);
      showNotification("Simulasi Weather dimulai!", "success");
    } catch (error) {
      showNotification(error.message || "Gagal memulai simulasi Weather", "error");
    }
    setConfirmPopup(prev => ({ ...prev, isOpen: false }));
  };

  const executeStop = async () => {
    if (!isRecordCreated || !backendHasDefaultConfig) return;
    stopPolling();
    try {
      await weatherApi.update({ is_running: false });
      setSimData(prev => ({ ...prev, is_running: false }));
      showNotification("Simulasi Weather dihentikan", "success");
    } catch (error) {
      setSimData(prev => ({ ...prev, is_running: false }));
      showNotification(error.message || "Gagal menghentikan simulasi", "error");
    }
    setConfirmPopup(prev => ({ ...prev, isOpen: false }));
  };

  const executeDelete = async () => {
    if (!backendHasDefaultConfig) {
      showNotification("Silakan konfigurasi koneksi MQTT terlebih dahulu", "error");
      return;
    }
    stopPolling();
    setEditData({
      air_temperature: formatToTwoDecimals(simData.air_temperature),
      air_humidity: formatToTwoDecimals(simData.air_humidity),
      air_pressure: formatToTwoDecimals(simData.air_pressure),
      wind_direction_relative: formatToTwoDecimals(simData.wind_direction_relative),
      wind_velocity: formatToTwoDecimals(simData.wind_velocity)
    });
    setIsInputCleared(true);

    try {
      await weatherApi.remove();
      setSimData({
        air_temperature: 0.0, air_humidity: 0.0, air_pressure: 0.0,
        wind_direction_relative: 0.0, wind_velocity: 0.0,
        is_running: false, last_update: new Date().toISOString()
      });
      setSimulationDataExists(false);
      setIsRecordCreated(false);
      setIsEmpty(true);
      showNotification("Semua data Weather berhasil dihapus!", "success");
    } catch (error) {
      setSimData(prev => ({ ...prev, is_running: false }));
      setIsRecordCreated(false);
      setIsEmpty(true);
      showNotification(error.message || "Gagal menghapus data Weather", "error");
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
    showNotification("Perubahan input Weather berhasil disimpan!", "success");
  };

  const executeClearInput = () => {
    setEditData({ 
      air_temperature: "0.00", air_humidity: "0.00", air_pressure: "0.00", 
      wind_direction_relative: "0.00", wind_velocity: "0.00" 
    });
    setIsInputCleared(true);
    showNotification("Input form Weather telah dikosongkan!", "info");
    setConfirmPopup(prev => ({ ...prev, isOpen: false }));
  };

  const handleDefaultData = async () => {
    setIsInputCleared(false);
    const defData = { temperature: 25.00, humidity: 60.00, pressure: 1013.25, windDir: 0.00, windVel: 10.00 };
    const defString = { 
      air_temperature: "25.00", air_humidity: "60.00", air_pressure: "1013.25", 
      wind_direction_relative: "0.00", wind_velocity: "10.00" 
    };
    stopPolling();

    try {
      const payload = {
        air_temperature: defData.temperature,
        air_humidity: defData.humidity,
        air_pressure: defData.pressure,
        wind_direction_relative: defData.windDir,
        wind_velocity: defData.windVel,
      };

      let saved;
      try {
        saved = isRecordCreated
          ? await weatherApi.update(payload)
          : await weatherApi.create(payload);
      } catch (error) {
        if (error.kind !== "not_found") throw error;
        saved = await weatherApi.create(payload);
      }

      setIsRecordCreated(true);
      setIsEmpty(false);
      handleSuccessfulUpdate({ ...payload, ...saved });
      setEditData(defString);
      showNotification("Data default berhasil diterapkan", "success");
    } catch (error) {
      showNotification(error.message || "Gagal menerapkan data default", "error");
    }
  };

  const executeCreateEmpty = async () => {
    if (!backendHasDefaultConfig) {
      showNotification("Silakan konfigurasi koneksi MQTT terlebih dahulu", "error");
      return;
    }
    try {
      const saved = await weatherApi.create({
        air_temperature: 0,
        air_humidity: 0,
        air_pressure: 0,
        wind_direction_relative: 0,
        wind_velocity: 0,
        is_running: false,
      });
      handleSuccessfulUpdate({ ...saved });
      setIsRecordCreated(true);
      setIsEmpty(false);
      setIsBackendConnected(true);
      showNotification("State Weather berhasil dibuat", "success");
    } catch (error) {
      showNotification(
        error.kind === "conflict"
          ? "Config belum lengkap atau state sudah ada. Buka Config lalu isi IP/Port/Update Rate."
          : error.message || "Gagal membuat state Weather",
        "error"
      );
    }
  };

  const openConfirmPopup = (type) => {
    const requiresConfig = ["startSim", "stopSim", "clearData", "saveEdit", "saveBackend"].includes(type);
    if (requiresConfig && !backendHasDefaultConfig) {
      showNotification("Silakan konfigurasi koneksi MQTT terlebih dahulu", "error");
      return;
    }
    let config = { isOpen: true, actionType: type };
    if (type === "startSim") { config.title = "Mulai Simulasi Weather"; config.message = "Apakah Anda yakin ingin menjalankan simulasi Weather?"; config.variant = "primary"; }
    else if (type === "stopSim") { config.title = "Hentikan Simulasi Weather"; config.message = "Apakah Anda yakin ingin menghentikan simulasi Weather?"; config.variant = "danger"; }
    else if (type === "clearData") { config.title = "Hapus Data Weather"; config.message = "Apakah Anda yakin ingin me-reset visualisasi data Weather?"; config.variant = "danger"; }
    else if (type === "clearInput") { config.title = "Hapus Input Weather"; config.message = "Apakah Anda yakin ingin mengosongkan form input Weather?"; config.variant = "danger"; }
    else if (type === "saveEdit") { config.title = "Simpan Perubahan Weather"; config.message = "Apakah Anda yakin ingin menyimpan perubahan pada input Weather?"; config.variant = "primary"; }
    else if (type === "saveBackend") { config.title = "Kirim Data Weather"; config.message = "Apakah Anda yakin ingin mengirim data Weather ini ke server?"; config.variant = "primary"; }
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
          air_temperature: formatToTwoDecimals(simData.air_temperature),
          air_humidity: formatToTwoDecimals(simData.air_humidity),
          air_pressure: formatToTwoDecimals(simData.air_pressure),
          wind_direction_relative: formatToTwoDecimals(simData.wind_direction_relative),
          wind_velocity: formatToTwoDecimals(simData.wind_velocity)
        });
      }
      setIsEditing(true);
    }
  };

  const handleInputChange = (field, value) => {
    const cleanValue = value.replace(/[^-0-9.]/g, '');
    const parts = cleanValue.split('.');
    if (parts.length > 2 || (parts[1] && parts[1].length > 2)) return;
    setEditData(prev => ({ ...prev, [field]: cleanValue }));
  };

  const getInputValue = (field) => {
    if (simData.is_running && inputSnapshot) return inputSnapshot[field] || "0.00";
    if (isEditing || isInputCleared) return editData[field];
    return formatToTwoDecimals(simData[field]);
  };

  const renderStatusImage = () => {
    if (!isBackendConnected) return <img src={StatusWaiting} alt="Waiting" className="status-image" />;
    if (simData.is_running) return <img src={StatusActive} alt="Active" className="status-image" />;
    return <img src={StatusStopImg} alt="Stop" className="status-image" />;
  };

  const handleSaveButton = () => openConfirmPopup("saveBackend");

  const renderCompassMarkers = () => { 
    const markers = []; 
    const thickAngles = [0,30,60,90,120,150,180,210,240,270,300,330]; 
    for(let i=0; i<360; i+=10){ 
      const isThick = thickAngles.includes(i);
      const height = isThick ? 10 : (i % 10 === 0 ? 8 : 0); 
      if(height > 0) {
        markers.push(
          <div key={i} style={{
              transform: `rotate(${i}deg) translateY(-${(isThick?107:102)-height}px)`,
              height: `${height}px`, width: isThick ? '2px' : '1.5px',
              backgroundColor: isThick ? 'black' : 'rgba(0,0,0,0.5)',
              position: 'absolute', left: '50%', top: '46%',
              marginLeft: isThick ? '-1.5px' : '-0.9px', marginTop: isThick ? '-2px' : '0.4px',
              transformOrigin: 'center bottom', zIndex: 5
            }}
          />
        ); 
      }
    } 
    return markers; 
  };

  const renderDegreeLabels = () => { 
    const labels = []; 
    const radius = 115; 
    [0,30,60,90,120,150,180,210,240,270,300,330].forEach(angle => { 
      const rad = (angle - 90) * Math.PI / 180; 
      labels.push(
        <div key={angle} className="compass-degree-label" style={{
            position: 'absolute', left: `calc(50% + ${radius * Math.cos(rad)}px)`,
            top: `calc(50% + ${radius * Math.sin(rad)}px)`, transform: 'translate(-50%,-50%)'
          }}
        >
          {angle}
        </div>
      ); 
    }); 
    return labels; 
  };

  const windAngle = Number(simData.wind_direction_relative) || 0; 
  const windRadius = 70; 
  const windX = Math.round(windRadius * Math.cos((windAngle - 90) * Math.PI / 180));
  const windY = Math.round(windRadius * Math.sin((windAngle - 90) * Math.PI / 180));

  const isPanelDisabled = !isBackendConnected;

  return (
    <>
      <ToastNotification message={notification.message} type={notification.type} onClose={() => setNotification({ message: "", type: "" })} />
      <ConfigPopup 
        isOpen={isWeatherConfigOpen} onClose={closeWeatherConfig} config={localConfig} 
        onSave={handleConfigSaveAndClose} onDefault={handleConfigDefault} onClear={handleConfigClear} 
        isEditingExternal={isConfigEditing} onEditingChange={handleConfigChange} 
      />
      <ConfirmationPopup 
        isOpen={confirmPopup.isOpen} title={confirmPopup.title} message={confirmPopup.message} 
        onConfirm={handleConfirmAction} onClose={() => setConfirmPopup(prev => ({...prev, isOpen: false}))} 
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
            <span className="last-update-value">Last update time: {formatDateTime(simData.last_update)}</span>
          </div>
          <div className="status-container">
            <div className="status-item">
              <span className="status-label">STATUS</span>
              <div className="status-value-container">{renderStatusImage()}</div>
            </div>
            <div className="status-item">
              <span className="status-label">UPDATE RATE</span>
              <div className="update-rate-value">{backendHasDefaultConfig ? (localConfig.updateRate || "1000") : "N/A"} ms</div>
            </div>
          </div>
        </div>

        {isEmpty && !simData.is_running ? (
          <EmptyState
            title="Weather belum dibuat di server"
            message="State Weather belum ada (HTTP 404). Buat state awal, lalu isi nilai lewat panel Edit Data."
            actionLabel="Create Weather State"
            onAction={executeCreateEmpty}
          />
        ) : (
        <div className="weather-wind-container">
          <div className="weather-display-section">
            <div className="weather-section-header">
              <img src={IconWind} className="weather-header-icon" alt="Weather Icon" />
              <h3>Weather</h3>
            </div>
            <div className="weather-data-simple">
              <div className="weather-data-item">
                <span className="weather-data-label-simple">Temperature</span>
                <span className="weather-data-value-simple">{formatToTwoDecimals(simData.air_temperature)}°C</span>
              </div>
              <div className="weather-data-item">
                <span className="weather-data-label-simple">Air Humidity</span>
                <span className="weather-data-value-simple">{formatToTwoDecimals(simData.air_humidity)}%</span>
              </div>
              <div className="weather-data-item">
                <span className="weather-data-label-simple">Air Pressure</span>
                <span className="weather-data-value-simple">{formatToTwoDecimals(simData.air_pressure)} hPa</span>
              </div>
            </div>
          </div>
          
          <div className="wind-indicator-section">
            <div className="weather-section-header">
              <img src={wind_icon} className="weather-header-icon" alt="Wind Icon" />
              <h3>Relative Wind Indicator</h3>
            </div>
            <div className="wind-display-container">
              <div className="wind-visual">
                <div className="compass-dial-container">
                  {renderCompassMarkers()}
                  {renderDegreeLabels()}
                  <div className="ship-container"><img src={ship} className="ship" alt="Ship" /></div>
                  <div className="wind-arrow-container" style={{
                      left: `calc(50% + ${windX}px)`, top: `calc(50% + ${windY}px)`,
                      transform: `translate(-50%,-50%) rotate(${windAngle - 120}deg)`
                    }}
                  >
                    <img src={wind} className="wind-arrow-image" alt="Wind Arrow" />
                  </div>
                </div>
              </div>
              <div className="wind-data-simple">
                <div className="weather-data-item">
                  <span className="weather-data-label-simple">Wind Direction</span>
                  <span className="weather-data-value-simple">{formatToTwoDecimals(simData.wind_direction_relative)}°</span>
                </div>
                <div className="weather-data-item">
                  <span className="weather-data-label-simple">Wind Velocity</span>
                  <span className="weather-data-value-simple">{formatToTwoDecimals(simData.wind_velocity)} km</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        <SimulationControls 
          onStart={() => openConfirmPopup("startSim")} onStop={() => openConfirmPopup("stopSim")} 
          onDelete={() => openConfirmPopup("clearData")} isRunning={simData.is_running} 
          isDisabled={!backendHasDefaultConfig || !isBackendConnected} 
        />
      </div>

      <div className={`edit-data-panel ${isPanelDisabled ? "disabled" : ""}`}>
        <div className="panel-header">
          <h2>Edit Data</h2>
          <HeaderControl 
            onEdit={handleEditToggle} onDelete={() => openConfirmPopup("clearInput")} 
            isDisabled={!isBackendConnected} isRunning={simData.is_running} isEditing={isEditing} 
          />
        </div>

        <div className="weather-input-group">
          <label>Set Air Temperature</label>
          <div className="input-with-unit">
            <input type="text" value={getInputValue('air_temperature')} onChange={(e) => handleInputChange('air_temperature', e.target.value)} disabled={!isEditing || !isBackendConnected || simData.is_running} placeholder="0.00" />
          </div>
        </div>
        <div className="weather-input-group">
          <label>Set Air Humidity</label>
          <div className="input-with-unit">
            <input type="text" value={getInputValue('air_humidity')} onChange={(e) => handleInputChange('air_humidity', e.target.value)} disabled={!isEditing || !isBackendConnected || simData.is_running} placeholder="0.00" />
          </div>
        </div>
        <div className="weather-input-group">
          <label>Set Air Pressure</label>
          <div className="input-with-unit">
            <input type="text" value={getInputValue('air_pressure')} onChange={(e) => handleInputChange('air_pressure', e.target.value)} disabled={!isEditing || !isBackendConnected || simData.is_running} placeholder="0.00" />
          </div>
        </div>
        <div className="weather-input-group">
          <label>Set Wind Direction Relative</label>
          <div className="input-with-unit">
            <input type="text" value={getInputValue('wind_direction_relative')} onChange={(e) => handleInputChange('wind_direction_relative', e.target.value)} disabled={!isEditing || !isBackendConnected || simData.is_running} placeholder="0.00" />
          </div>
        </div>
        <div className="weather-input-group">
          <label>Set Wind Velocity</label>
          <div className="input-with-unit">
            <input type="text" value={getInputValue('wind_velocity')} onChange={(e) => handleInputChange('wind_velocity', e.target.value)} disabled={!isEditing || !isBackendConnected || simData.is_running} placeholder="0.00" />
          </div>
        </div>

        <EditActions 
          onSave={handleSaveButton} onDefault={handleDefaultData} 
          isDisabled={!backendHasDefaultConfig || !isBackendConnected} isRunning={simData.is_running} 
        />
      </div>
    </>
  );
};

export default WeatherPage;
import React, { useState, useEffect, useRef } from "react";
import "./GPSPage.css";
import { useConfig } from "../web-logic/ConfigContext";
import { gpsApi, fromConfig, toConfigPayload } from "../../api/endpoints";
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
import statusWaiting from "../../assets/status/Property 1=Waiting.png";
import statusActive from "../../assets/status/Property 1=Active.png";
import statusStopImg from "../../assets/status/Property 1=Stop.png";

// ============================================================================
// DEFAULT CONFIGURATION (cloud-safe: TCP dimatikan)
// ============================================================================
const defaultGPSConfig = {
  ip: "127.0.0.1",
  port: "1883",
  username: "gps_user",
  password: "secure_pass",
  topic: ["vessel/gps"],
  updateRate: "1000",
  tcp_enabled: false,
};

const GPSPage = ({ onStatusChange }) => {
  const { isGpsConfigOpen, closeGpsConfig } = useConfig();

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

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  const [isRecordCreated, setIsRecordCreated] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isInputCleared, setIsInputCleared] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  const [notification, setNotification] = useState({ message: "", type: "" });
  const [confirmPopup, setConfirmPopup] = useState({
    isOpen: false, title: "", message: "", variant: "danger", actionType: ""
  });

  // ============================================================================
  // INITIAL DATA
  // ============================================================================
  const [simData, setSimData] = useState({
    latitude: 0.0,
    longitude: 0.0,
    sog: 0.0,
    cog: 0.0,
    variation: 0.0,
    last_update: new Date().toISOString(),
    is_running: false
  });

  const [editData, setEditData] = useState({
    latitude: "",
    longitude: "",
    sog: "",
    cog: "",
    variation: ""
  });

  const [inputSnapshot, setInputSnapshot] = useState(null);

  // ============================================================================
  // DELTA STATE
  // ============================================================================
  const [previousLatitude, setPreviousLatitude] = useState(0.0);
  const [previousLongitude, setPreviousLongitude] = useState(0.0);
  const [previousSog, setPreviousSog] = useState(0.0);
  const [previousCog, setPreviousCog] = useState(0.0);

  const [latitudeDelta, setLatitudeDelta] = useState(0.0);
  const [longitudeDelta, setLongitudeDelta] = useState(0.0);
  const [sogDelta, setSogDelta] = useState(0.0);
  const [cogDelta, setCogDelta] = useState(0.0);

  const hasStartedRunningRef = useRef(false);
  const prevRef = useRef({ latitude: 0, longitude: 0, sog: 0, cog: 0 });
  const [isConfigEditing, setIsConfigEditing] = useState(false);

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

  const toDMS = (coord, isLatitude) => {
    if (coord == null || isNaN(coord)) return "--° --' --\" --";
    const absolute = Math.abs(coord);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = Math.floor((minutesNotTruncated - minutes) * 60);
    const direction = isLatitude ? (coord >= 0 ? "N" : "S") : (coord >= 0 ? "E" : "W");
    return `${Math.abs(degrees)}° ${minutes}' ${seconds}" ${direction}`;
  };

  const formatDelta = (val, unit) => {
    const absVal = Math.abs(val);
    if (absVal < 0.0005) return `( 0.00 ${unit} )`;
    const sign = val > 0 ? '+' : '-';
    return `( ${sign}${absVal.toFixed(4)} ${unit} )`;
  };

  // Terapkan data sensor (dari HTTP polling maupun WebSocket) + hitung delta.
  const applySensorData = (incoming) => {
    if (!incoming) return;
    const previous = prevRef.current;
    const next = {
      latitude: incoming.latitude ?? previous.latitude,
      longitude: incoming.longitude ?? previous.longitude,
      sog: incoming.sog ?? previous.sog,
      cog: incoming.cog ?? previous.cog,
    };

    setLatitudeDelta(next.latitude - previous.latitude);
    setLongitudeDelta(next.longitude - previous.longitude);
    setSogDelta(next.sog - previous.sog);
    setCogDelta(next.cog - previous.cog);
    prevRef.current = next;

    setPreviousLatitude(next.latitude);
    setPreviousLongitude(next.longitude);
    setPreviousSog(next.sog);
    setPreviousCog(next.cog);

    setSimData((prevData) => ({
      ...prevData,
      ...next,
      variation: incoming.variation ?? prevData.variation,
      is_running: incoming.is_running ?? prevData.is_running,
      last_update: incoming.last_update || new Date().toISOString(),
    }));

    if (typeof incoming.is_running === "boolean" && onStatusChange) {
      onStatusChange(incoming.is_running);
    }
  };

  // ============================================================================
  // CONFIGURATION MANAGEMENT
  // ============================================================================
  useEffect(() => {
    let cancelled = false;

    const checkBackendConfig = async () => {
      try {
        const data = await gpsApi.getConfig();
        if (cancelled) return;
        const formatted = fromConfig(data);
        const valid = Boolean(formatted.ip && formatted.port && formatted.username);
        setLocalConfig(formatted);
        setBackendHasDefaultConfig(valid);
      } catch (error) {
        if (cancelled) return;
        setBackendHasDefaultConfig(false);
      }
    };

    checkBackendConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchBackendConfig = async () => {
    try {
      const data = await gpsApi.getConfig();
      const formatted = fromConfig(data);
      const valid = Boolean(formatted.ip && formatted.port && formatted.username);
      setLocalConfig(formatted);
      setBackendHasDefaultConfig(valid);
      setIsConfigEditing(!valid);
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
      const saved = await gpsApi.updateConfig(
        toConfigPayload(configData, { includeTcp: true })
      );
      const formatted = fromConfig(saved);
      setLocalConfig(formatted);
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
    if (shouldClose) closeGpsConfig();
  };

  const handleConfigDefault = async () => {
    const defaultConfigForPopup = {
      ip: defaultGPSConfig.ip,
      port: String(defaultGPSConfig.port),
      username: defaultGPSConfig.username,
      password: defaultGPSConfig.password,
      topic: defaultGPSConfig.topic,
      updateRate: String(defaultGPSConfig.updateRate)
    };
    setLocalConfig(defaultConfigForPopup);
    setIsConfigEditing(true);
    showNotification("Form diisi dengan konfigurasi default", "info");
    await saveConfigToBackend(defaultGPSConfig);
  };

  const handleConfigClear = async () => {
    try {
      await gpsApi.removeConfig();
      const emptyConfig = { ip: "", port: "", topic: [], username: "", password: "", updateRate: "" };
      setLocalConfig(emptyConfig);
      setBackendHasDefaultConfig(false);
      setIsConfigEditing(true);
      showNotification("Konfigurasi MQTT berhasil dihapus dari server.", "success");
    } catch (error) {
      const emptyConfig = { ip: "", port: "", topic: [], username: "", password: "", updateRate: "" };
      setLocalConfig(emptyConfig);
      setBackendHasDefaultConfig(false);
      setIsConfigEditing(true);
      showNotification(error.message || "Konfigurasi MQTT dikosongkan.", "info");
    }
  };

  const handleConfigChange = (isEditing) => setIsConfigEditing(isEditing);

  useEffect(() => {
    if (isGpsConfigOpen) fetchBackendConfig();
  }, [isGpsConfigOpen]);

  // ============================================================================
  // DATA FETCHING (initial) + POLLING fallback + WebSocket realtime
  // ============================================================================
  useEffect(() => {
    if (!backendHasDefaultConfig) return undefined;
    let cancelled = false;

    const fetchInitialData = async () => {
      try {
        const gpsData = (await gpsApi.get()) || {};
        if (cancelled) return;

        setIsBackendConnected(true);
        const mergedData = {
          latitude: gpsData.latitude ?? 0.0,
          longitude: gpsData.longitude ?? 0.0,
          sog: gpsData.sog ?? 0.0,
          cog: gpsData.cog ?? 0.0,
          variation: gpsData.variation ?? 0.0,
          last_update: gpsData.last_update || new Date().toISOString(),
          is_running: Boolean(gpsData.is_running),
        };

        prevRef.current = {
          latitude: mergedData.latitude,
          longitude: mergedData.longitude,
          sog: mergedData.sog,
          cog: mergedData.cog,
        };
        setPreviousLatitude(mergedData.latitude);
        setPreviousLongitude(mergedData.longitude);
        setPreviousSog(mergedData.sog);
        setPreviousCog(mergedData.cog);
        setSimData(mergedData);
        setSimulationDataExists(
          mergedData.latitude !== 0.0 || mergedData.longitude !== 0.0
        );
        setIsRecordCreated(true);
        setIsEmpty(false);
        if (onStatusChange) onStatusChange(mergedData.is_running);

        if (!mergedData.is_running && !inputSnapshot && !isEditing) {
          setEditData({
            latitude: mergedData.latitude !== 0.0 ? String(mergedData.latitude) : "",
            longitude: mergedData.longitude !== 0.0 ? String(mergedData.longitude) : "",
            sog: mergedData.sog !== 0.0 ? String(mergedData.sog) : "",
            cog: mergedData.cog !== 0.0 ? String(mergedData.cog) : "",
            variation: mergedData.variation !== 0.0 ? String(mergedData.variation) : "",
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

  // Polling fallback (recursive setTimeout, tidak menumpuk request)
  usePolling(
    async () => {
      try {
        const gpsData = await gpsApi.get();
        if (gpsData) {
          applySensorData(gpsData);
          setIsBackendConnected(true);
          setSimulationDataExists(true);
          setIsRecordCreated(true);
          setIsEmpty(false);
        }
      } catch (error) {
        if (error.kind === "not_found") {
          setIsRecordCreated(false);
          setIsEmpty(true);
          if (onStatusChange) onStatusChange(false);
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

  // WebSocket realtime (GPS memakai key "json", bukan "data")
  useRealtime(
    "gps_update",
    (message) => {
      if (!message?.json) return;
      applySensorData(message.json);
      setIsBackendConnected(true);
      setSimulationDataExists(true);
    },
    backendHasDefaultConfig && simData.is_running
  );

  // ============================================================================
  // SNAPSHOT HANDLING - FIXED
  // ============================================================================
  useEffect(() => {
    if (simData.is_running && !hasStartedRunningRef.current) {
      setInputSnapshot({ ...editData });
      hasStartedRunningRef.current = true;
    } else if (!simData.is_running && hasStartedRunningRef.current) {
      setInputSnapshot(null);
      hasStartedRunningRef.current = false;

      // FIX: Jangan reset editData ke simData saat simulasi berhenti
      // Biarkan editData tetap dengan nilai terakhir yang diinput user
      // setEditData({
      //   latitude: String(simData.latitude),
      //   longitude: String(simData.longitude),
      //   sog: String(simData.sog),
      //   cog: String(simData.cog),
      //   variation: String(simData.variation)
      // });
    }
  }, [simData.is_running]);

  // ============================================================================
  // DELTA RESET
  // ============================================================================
  useEffect(() => {
    if (!simData.is_running) {
      setLatitudeDelta(0.0);
      setLongitudeDelta(0.0);
      setSogDelta(0.0);
      setCogDelta(0.0);
    }
  }, [simData.is_running]);

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
    const valLatitude = parseFloat(editData.latitude) || 0;
    const valLongitude = parseFloat(editData.longitude) || 0;
    const valSog = parseFloat(editData.sog) || 0;
    const valCog = parseFloat(editData.cog) || 0;
    const valVariation = parseFloat(editData.variation) || 0; // FIX: gunakan dari editData, bukan simData

    try {
      const payload = {
        latitude: valLatitude, longitude: valLongitude, sog: valSog,
        cog: valCog, variation: valVariation, is_running: simData.is_running
      };
      const saved = isRecordCreated
        ? await gpsApi.update(payload)
        : await gpsApi.create(payload);

      handleSuccessfulUpdate({
        latitude: saved.latitude,
        longitude: saved.longitude,
        sog: saved.sog,
        cog: saved.cog,
        variation: saved.variation,
        is_running: simData.is_running
      });
      
      // FIX: Update editData dengan nilai yang berhasil disimpan
      setEditData({
        latitude: String(saved.latitude),
        longitude: String(saved.longitude),
        sog: String(saved.sog),
        cog: String(saved.cog),
        variation: String(saved.variation)
      });
      
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
      // FIX: Gunakan nilai dari editData jika ada, jika tidak dari simData
      const valLatitude = editData.latitude ? parseFloat(editData.latitude) : (simData.latitude || 0);
      const valLongitude = editData.longitude ? parseFloat(editData.longitude) : (simData.longitude || 0);
      const valSog = editData.sog ? parseFloat(editData.sog) : (simData.sog || 0);
      const valCog = editData.cog ? parseFloat(editData.cog) : (simData.cog || 0);
      const valVariation = editData.variation ? parseFloat(editData.variation) : (simData.variation || 0);

      const payload = {
        latitude: valLatitude, longitude: valLongitude, sog: valSog,
        cog: valCog, variation: valVariation, is_running: true
      };

      const saved = isRecordCreated
        ? await gpsApi.update(payload)
        : await gpsApi.create(payload);

      handleSuccessfulUpdate({
        is_running: true,
        latitude: saved.latitude,
        longitude: saved.longitude,
        sog: saved.sog,
        cog: saved.cog,
        variation: saved.variation
      });
      
      // FIX: Update editData dengan nilai yang berhasil disimpan
      setEditData({
        latitude: String(saved.latitude),
        longitude: String(saved.longitude),
        sog: String(saved.sog),
        cog: String(saved.cog),
        variation: String(saved.variation)
      });
      
      if (onStatusChange) onStatusChange(true);
      setIsEditing(false);
      setIsEmpty(false);
      showNotification("Simulasi GPS dimulai!", "success");
    } catch (error) {
      console.error("Error start:", error);
      showNotification(error.message || "Gagal memulai simulasi", "error");
      if (onStatusChange) onStatusChange(false);
    }
    setConfirmPopup(prev => ({ ...prev, isOpen: false }));
  };

  const executeStop = async () => {
    if (!backendHasDefaultConfig || !isBackendConnected) return;

    const payload = {
      latitude: simData.latitude,
      longitude: simData.longitude,
      sog: simData.sog,
      cog: simData.cog,
      variation: simData.variation,
      is_running: false
    };

    try {
      await gpsApi.update(payload);
      setSimData(prev => ({ ...prev, is_running: false }));

      if (onStatusChange) onStatusChange(false);
      showNotification("Simulasi dihentikan", "info");
    } catch (error) {
      console.error("Error stop:", error);
      showNotification("Gagal menghentikan simulasi", "error");
    }
    setConfirmPopup(prev => ({ ...prev, isOpen: false }));
  };

  const executeDelete = async () => {
    if (!backendHasDefaultConfig) {
      showNotification("Silakan konfigurasi koneksi MQTT terlebih dahulu", "error");
      return;
    }
    
    // FIX: Reset editData ke string kosong, bukan ke nilai 0
    setEditData({
      latitude: "",
      longitude: "",
      sog: "",
      cog: "",
      variation: ""
    });
    setIsInputCleared(true);

    try {
      await gpsApi.remove();
      setSimData({
        latitude: 0.0, longitude: 0.0, sog: 0.0, cog: 0.0, variation: 0.0,
        last_update: new Date().toISOString(), is_running: false
      });
      if (onStatusChange) onStatusChange(false);
      setLatitudeDelta(0.0); setLongitudeDelta(0.0); setSogDelta(0.0); setCogDelta(0.0);
      setPreviousLatitude(0.0); setPreviousLongitude(0.0); setPreviousSog(0.0); setPreviousCog(0.0);
      prevRef.current = { latitude: 0, longitude: 0, sog: 0, cog: 0 };
      setSimulationDataExists(false);
      setIsRecordCreated(false);
      setIsEmpty(true);
      showNotification("Semua data berhasil dihapus!", "success");
    } catch (error) {
      console.error("Error delete:", error);
      setSimData(prev => ({ ...prev, latitude: 0, longitude: 0, sog: 0, cog: 0, is_running: false }));
      setIsRecordCreated(false);
      setIsEmpty(true);
      if (onStatusChange) onStatusChange(false);
      showNotification(error.message || "Gagal menghapus data", "error");
    }
    setConfirmPopup(prev => ({ ...prev, isOpen: false }));
  };

  const executeClearInput = () => {
    setEditData({ latitude: "", longitude: "", sog: "", cog: "", variation: "" });
    setIsInputCleared(true);
    showNotification("Input form telah dikosongkan!", "info");
    setConfirmPopup(prev => ({ ...prev, isOpen: false }));
  };

  const handleDefaultData = async () => {
    setIsInputCleared(false);
    const defData = { latitude: 58.430493, longitude: 15.732333, sog: 0.5, cog: 30.0, variation: 6.4 };
    const defString = {
      latitude: "58.430493", longitude: "15.732333",
      sog: "0.5", cog: "30.0", variation: "6.4"
    };

    // FIX: Update editData dengan data default
    setEditData(defString);

    if (!isRecordCreated) {
      setSimData(prev => ({
        ...prev,
        latitude: defData.latitude, longitude: defData.longitude,
        sog: defData.sog, cog: defData.cog, variation: defData.variation,
        last_update: new Date().toISOString()
      }));
      showNotification("Data default diterapkan", "success");
      return;
    }

    try {
      const saved = await gpsApi.update(defData);
      handleSuccessfulUpdate({
        latitude: saved.latitude,
        longitude: saved.longitude,
        sog: saved.sog,
        cog: saved.cog,
        variation: saved.variation
      });
      showNotification("Data default berhasil diterapkan", "success");
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
      const saved = await gpsApi.create({
        latitude: 0,
        longitude: 0,
        sog: 0,
        cog: 0,
        is_running: false,
      });
      handleSuccessfulUpdate({ ...saved });
      setIsRecordCreated(true);
      setIsEmpty(false);
      setIsBackendConnected(true);
      setEditData({
        latitude: String(saved.latitude),
        longitude: String(saved.longitude),
        sog: String(saved.sog),
        cog: String(saved.cog),
        variation: String(saved.variation),
      });
      showNotification("State GPS berhasil dibuat", "success");
    } catch (error) {
      const message =
        error.kind === "conflict"
          ? "Config belum lengkap atau state sudah ada. Buka Config lalu isi IP/Port/Update Rate."
          : error.message || "Gagal membuat state GPS";
      showNotification(message, "error");
    }
  };

  // ============================================================================
  // POPUP MANAGEMENT
  // ============================================================================
  const openConfirmPopup = (type) => {
    const requiresConfig = ["startSim", "stopSim", "clearData", "saveEdit", "saveBackend"].includes(type);
    if (requiresConfig && !backendHasDefaultConfig) {
      showNotification("Silakan konfigurasi koneksi MQTT terlebih dahulu", "error");
      return;
    }
    let config = { isOpen: true, actionType: type };
    if (type === "startSim") {
      config.title = "Mulai Simulasi"; config.message = "Apakah Anda yakin ingin menjalankan simulasi?"; config.variant = "primary";
    }
    else if (type === "stopSim") {
      config.title = "Hentikan Simulasi"; config.message = "Apakah Anda yakin ingin menghentikan simulasi?"; config.variant = "danger";
    }
    else if (type === "clearData") {
      config.title = "Hapus Data"; config.message = "Apakah Anda yakin ingin me-reset visualisasi data?"; config.variant = "danger";
    }
    else if (type === "clearInput") {
      config.title = "Hapus Input"; config.message = "Apakah Anda yakin ingin mengosongkan form input?"; config.variant = "danger";
    }
    else if (type === "saveEdit") {
      config.title = "Simpan Perubahan"; config.message = "Apakah Anda yakin ingin menyimpan perubahan pada input?"; config.variant = "primary";
    }
    else if (type === "saveBackend") {
      config.title = "Kirim Data"; config.message = "Apakah Anda yakin ingin mengirim data ini ke server?"; config.variant = "primary";
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
      // FIX: Hanya isi editData jika belum ada data di editData
      if (!isInputCleared && (!editData.latitude || !editData.longitude)) {
        setEditData({
          latitude: simData.latitude !== 0.0 ? String(simData.latitude) : "",
          longitude: simData.longitude !== 0.0 ? String(simData.longitude) : "",
          sog: simData.sog !== 0.0 ? String(simData.sog) : "",
          cog: simData.cog !== 0.0 ? String(simData.cog) : "",
          variation: simData.variation !== 0.0 ? String(simData.variation) : ""
        });
      }
      setIsEditing(true);
    }
  };

  // ============================================================================
  // INPUT HANDLING - FIXED
  // ============================================================================
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (value === '' || /^-?[0-9]*\.?[0-9]*$/.test(value)) {
      setEditData(prev => ({ ...prev, [name]: value }));
    }
  };

  // FIX: Fungsi getInputValue yang diperbaiki
  const getInputValue = (key) => {
    // Jika simulasi sedang berjalan, tampilkan snapshot atau nilai simData
    if (simData.is_running) {
      if (inputSnapshot && inputSnapshot[key]) {
        return inputSnapshot[key];
      }
      // Fallback ke nilai simData jika tidak ada snapshot
      const value = simData[key];
      if (value === 0 || value === 0.0) return "";
      if (key === 'latitude' || key === 'longitude') return typeof value === 'number' ? value.toFixed(6) : "";
      return typeof value === 'number' ? value.toFixed(1) : "";
    }
    
    // Jika sedang editing, tampilkan nilai dari editData
    if (isEditing || isInputCleared) {
      return editData[key] || "";
    }
    
    // Jika tidak sedang editing, tampilkan nilai dari simData
    const value = simData[key];
    if (value === 0 || value === 0.0) return "";
    if (key === 'latitude' || key === 'longitude') return typeof value === 'number' ? value.toFixed(6) : "";
    return typeof value === 'number' ? value.toFixed(1) : "";
  };

  // ============================================================================
  // UI RENDER FUNCTIONS
  // ============================================================================
  const renderStatusImage = () => {
    if (!isBackendConnected) return <img src={statusWaiting} alt="Waiting" className="status-image" />;
    if (simData.is_running) return <img src={statusActive} alt="Active" className="status-image" />;
    return <img src={statusStopImg} alt="Stop" className="status-image" />;
  };

  const handleSaveButton = () => openConfirmPopup("saveBackend");
  const formatDisplayValue = (value, decimals = 1) => parseFloat(value).toFixed(decimals);

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
        isOpen={isGpsConfigOpen}
        onClose={closeGpsConfig}
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

      <div className={`data-display-panel gps-panel ${isPanelDisabled ? "disabled" : ""}`}>
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
            title="GPS belum dibuat di server"
            message="State GPS belum ada (HTTP 404). Buat state awal, lalu isi nilai lewat panel Edit Data."
            actionLabel="Create GPS State"
            onAction={executeCreateEmpty}
          />
        ) : (
          <>
            <div className="position-section">
              <h3>Position</h3>
              <div className="coordinate-group">
                <div className="coordinate-box">
                  <div className="coordinate-value">
                    {toDMS(simData.latitude, true)}
                  </div>
                  <span className="coordinate-label">LATITUDE</span>
                </div>
                <div className="coordinate-box">
                  <div className="coordinate-value">
                    {toDMS(simData.longitude, false)}
                  </div>
                  <span className="coordinate-label">LONGITUDE</span>
                </div>
              </div>
            </div>

            <div className="other-data-section">
              <div className="data-box">
                <div className="data-value">
                  {formatDisplayValue(simData.sog, 1)}
                  <span className="unit">knot</span>
                </div>
                <span className="data-label">SPEED OVER GROUND</span>
              </div>
              <div className="data-box">
                <div className="data-value">
                  {formatDisplayValue(simData.cog, 1)}
                  <span className="unit">deg</span>
                </div>
                <span className="data-label">COURSE OVER GROUND</span>
              </div>
              <div className="data-box">
                <div className="data-value">
                  {formatDisplayValue(simData.variation, 3)}
                  <span className="unit">deg</span>
                </div>
                <span className="data-label">MAGNETIC VARIATION</span>
              </div>
            </div>
          </>
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
            isDisabled={isPanelDisabled}
            isRunning={simData.is_running}
            isEditing={isEditing}
          />
        </div>

        <div className="edit-form-container">
          <div className="input-group">
            <label>Set Latitude</label>
            <input
              type="text"
              name="latitude"
              value={getInputValue('latitude')}
              onChange={handleInputChange}
              disabled={!isEditing || isPanelDisabled || simData.is_running}
              placeholder="0.000000"
            />
          </div>
          <div className="input-group">
            <label>Set Longitude</label>
            <input
              type="text"
              name="longitude"
              value={getInputValue('longitude')}
              onChange={handleInputChange}
              disabled={!isEditing || isPanelDisabled || simData.is_running}
              placeholder="0.000000"
            />
          </div>
          <div className="input-group">
            <label>Set Speed Over Ground</label>
            <input
              type="text"
              name="sog"
              value={getInputValue('sog')}
              onChange={handleInputChange}
              disabled={!isEditing || isPanelDisabled || simData.is_running}
              placeholder="0.0"
            />
          </div>
          <div className="input-group">
            <label>Set Course Over Ground</label>
            <input
              type="text"
              name="cog"
              value={getInputValue('cog')}
              onChange={handleInputChange}
              disabled={!isEditing || isPanelDisabled || simData.is_running}
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

export default GPSPage;
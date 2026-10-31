import { createContext, useContext, useState, useEffect, useCallback } from "react";

const SettingsContext = createContext(null);

const STORAGE_KEY_API = "nddu_custom_api_url";
const STORAGE_KEY_WS = "nddu_custom_ws_url";

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return ctx;
}

export function SettingsProvider({ children }) {
  const [customApiUrl, setCustomApiUrl] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY_API) || "";
    }
    return "";
  });

  const [customWsUrl, setCustomWsUrl] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY_WS) || "";
    }
    return "";
  });

  // Sync ke localStorage
  useEffect(() => {
    if (customApiUrl) {
      localStorage.setItem(STORAGE_KEY_API, customApiUrl);
    } else {
      localStorage.removeItem(STORAGE_KEY_API);
    }
  }, [customApiUrl]);

  useEffect(() => {
    if (customWsUrl) {
      localStorage.setItem(STORAGE_KEY_WS, customWsUrl);
    } else {
      localStorage.removeItem(STORAGE_KEY_WS);
    }
  }, [customWsUrl]);

  // Fungsi untuk mendapatkan URL efektif (custom > env default)
  const getEffectiveApiUrl = useCallback(() => {
    if (customApiUrl) return customApiUrl.replace(/\/+$/, "");
    return (
      import.meta.env.VITE_API_URL || "https://vessel-nddu.onrender.com"
    ).replace(/\/+$/, "");
  }, [customApiUrl]);

  const getEffectiveWsUrl = useCallback(() => {
    if (customWsUrl) return customWsUrl;
    return import.meta.env.VITE_WS_URL || "wss://vessel-nddu.onrender.com/ws";
  }, [customWsUrl]);

  const setApiUrl = useCallback((url) => {
    setCustomApiUrl(url?.trim() || "");
  }, []);

  const setWsUrl = useCallback((url) => {
    setCustomWsUrl(url?.trim() || "");
  }, []);

  const resetToDefaults = useCallback(() => {
    setCustomApiUrl("");
    setCustomWsUrl("");
  }, []);

  const value = {
    customApiUrl,
    customWsUrl,
    getEffectiveApiUrl,
    getEffectiveWsUrl,
    setApiUrl,
    setWsUrl,
    resetToDefaults,
    hasCustomConfig: Boolean(customApiUrl || customWsUrl),
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export default SettingsContext;
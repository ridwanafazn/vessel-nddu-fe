import React, { createContext, useState, useContext } from 'react';

// 1. Membuat context
const ConfigContext = createContext();

// 2. Hook kustom
export function useConfig() {
  return useContext(ConfigContext);
}

// 3. Provider
export function ConfigProvider({ children } ) {
  const [isGpsConfigOpen, setIsGpsConfigOpen] = useState(false);
  const [isGyroConfigOpen, setIsGyroConfigOpen] = useState(false);
  const [isWeatherConfigOpen, setIsWeatherConfigOpen] = useState(false);
  const [isSpeedDepthConfigOpen, setIsSpeedDepthConfigOpen] = useState(false);

  const value = {
    isGpsConfigOpen,
    openGpsConfig: () => setIsGpsConfigOpen(true),
    closeGpsConfig: () => setIsGpsConfigOpen(false),

    isGyroConfigOpen,
    openGyroConfig: () => setIsGyroConfigOpen(true),
    closeGyroConfig: () => setIsGyroConfigOpen(false),

    isWeatherConfigOpen,
    openWeatherConfig: () => setIsWeatherConfigOpen(true),
    closeWeatherConfig: () => setIsWeatherConfigOpen(false),

    // Fungsi untuk Speed & Depth
    isSpeedDepthConfigOpen,
    openSpeedDepthConfig: () => setIsSpeedDepthConfigOpen(true),
    closeSpeedDepthConfig: () => setIsSpeedDepthConfigOpen(false),
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
}
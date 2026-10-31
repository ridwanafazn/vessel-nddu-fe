import React, { useState, useCallback, useEffect } from "react";
import "./App.css"; 
import DarkModeToggle from "./components/web-logic/DarkModeToggle";
import { ConfigProvider, useConfig } from "./components/web-logic/ConfigContext";
import { SettingsProvider } from "./api/SettingsContext";
import SettingsModal from "./components/web-logic/SettingsModal";

// --- Page Imports ---
import GyroPage from "./components/GYRO/GyroPage";
import WeatherPage from "./components/WEATHER/WeatherPage";
import GPSPage from "./components/GPS/GPSPage"; 
import SpeedDepthPage from "./components/SPEED&DEPTH/SpeedDepthPage"; 
import MagneticCompassPage from "./components/COMPASS/MagneticCompassPage";
import LoginPage from "./components/LOGIN/LoginPage";

// --- Asset Imports ---
import iconDashboard from "./assets/inactive/Property 1=Dashboard_icon-Default.png";
import iconGPSDefault from "./assets/inactive/ButtonID=GPS_icon-Default.png";
import iconGPSActive from "./assets/active/ButtonID=GPS_icon-Active.png";
import iconGyroDefault from "./assets/inactive/ButtonID=Gyro_icon-Default.png";
import iconGyroActive from "./assets/active/ButtonID=Gyro_icon-Active.png";
import iconWeatherDefault from "./assets/inactive/ButtonWeather.png";
import iconWeatherActive from "./assets/active/ButtonWeatherActive.png";
import iconPlaceHolder2 from "./assets/inactive/ButtonID=Placeholder2_icon-Default.png";
import iconPlaceHolder2Active from "./assets/active/ButtonID=Placeholder2_icon-Active.png";
import iconMagnetDefault from "./assets/inactive/ButtonID=ButtonID16.png"; 

const AppContent = () => {
  const [activeMenu, setActiveMenu] = useState("GPS");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Sync theme saat app load
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      document.body.setAttribute('data-theme', savedTheme);
    }
  }, []);
  
  // --- STATE STATUS RUNNING ---
  const [isGpsRunning, setIsGpsRunning] = useState(false); 
  const [isGyroRunning, setIsGyroRunning] = useState(false); 
  const [isWeatherRunning, setIsWeatherRunning] = useState(false); 
  const [isSensorRunning, setIsSensorRunning] = useState(false); 
  const [isMagnetRunning, setIsMagnetRunning] = useState(false); 

  const { 
    openGpsConfig, 
    openGyroConfig, 
    openWeatherConfig,
    openSpeedDepthConfig 
  } = useConfig();

  const pageTitles = {
    Dashboard: "Dashboard",
    GPS: "GPS Simulator",
    Gyro: "Gyroscope Simulator",
    Weather: "Weather Simulator",
    Sensor: "Speed & Depth Simulator",
    Magnet: "Magnetic Compass Simulator",
  };

  // --- CALLBACKS STATUS ---
  const handleGpsStatusChange = useCallback((runningStatus) => setIsGpsRunning(runningStatus), []);
  const handleGyroStatusChange = useCallback((runningStatus) => setIsGyroRunning(runningStatus), []);
  const handleWeatherStatusChange = useCallback((runningStatus) => setIsWeatherRunning(runningStatus), []);
  const handleSensorStatusChange = useCallback((runningStatus) => setIsSensorRunning(runningStatus), []);
  const handleMagnetStatusChange = useCallback((runningStatus) => {
    setIsMagnetRunning(runningStatus);
  }, []);

  const handleHeaderConfigClick = useCallback(() => {
    if (activeMenu === "GPS") openGpsConfig();
    else if (activeMenu === "Gyro") openGyroConfig();
    else if (activeMenu === "Weather") openWeatherConfig();
    else if (activeMenu === "Sensor") openSpeedDepthConfig(); 
    else if (activeMenu === "Magnet") openSpeedDepthConfig(); 
  }, [activeMenu, openGpsConfig, openGyroConfig, openWeatherConfig, openSpeedDepthConfig]);

  // Handler untuk klik menu (kecuali Dashboard)
  const handleMenuClick = useCallback((menu) => {
    if (menu !== "Dashboard") {
      setActiveMenu(menu);
    }
  }, []);

  if (!isLoggedIn) {
    return <LoginPage onLogin={setIsLoggedIn} />;
  }

  return (
    <div className="simulator-container">
      <div className="sidebar">
        {/* Dashboard - non-interaktif */}
        <div 
          className={`sidebar-icon${activeMenu === "Dashboard" ? " active" : ""}`} 
          style={{ cursor: 'not-allowed', opacity: 0.6 }}
        >
          <img src={iconDashboard} alt="Dashboard" /> 
          <span className="sidebar-label">Dashboard</span> 
        </div>
        
        {/* Menu GPS */}
        <div 
          className={`sidebar-icon${activeMenu === "GPS" ? " active" : ""}`} 
          onClick={() => handleMenuClick("GPS")}
        > 
          <img src={isGpsRunning ? iconGPSActive : iconGPSDefault} alt="GPS" /> 
          <span className="sidebar-label">GPS</span> 
        </div>
        
        {/* Menu Gyro */}
        <div 
          className={`sidebar-icon${activeMenu === "Gyro" ? " active" : ""}`} 
          onClick={() => handleMenuClick("Gyro")}
        > 
          <img src={isGyroRunning ? iconGyroActive : iconGyroDefault} alt="Gyro" /> 
          <span className="sidebar-label">Gyroscope</span> 
        </div>
        
        {/* Menu Weather */}
        <div 
          className={`sidebar-icon${activeMenu === "Weather" ? " active" : ""}`} 
          onClick={() => handleMenuClick("Weather")}
        > 
          <img src={isWeatherRunning ? iconWeatherActive : iconWeatherDefault} alt="Weather" /> 
          <span className="sidebar-label">Weather</span> 
        </div>

        {/* Menu Speed & Depth */}
        <div 
          className={`sidebar-icon${activeMenu === "Sensor" ? " active" : ""}`} 
          onClick={() => handleMenuClick("Sensor")}
        > 
          <img src={isSensorRunning ? iconPlaceHolder2Active : iconPlaceHolder2} alt="Sensor" /> 
          <span className="sidebar-label">Speed & Depth</span> 
        </div>

        {/* Menu Magnetic Compass */}
        <div 
          className={`sidebar-icon${activeMenu === "Magnet" ? " active" : ""}`} 
          onClick={() => handleMenuClick("Magnet")}
        > 
          <img 
            src={iconMagnetDefault} 
            alt="Magnet" 
            style={isMagnetRunning ? {filter: "brightness(1.2) sepia(1) hue-rotate(190deg) saturate(5)"} : {}} 
          /> 
          <span className="sidebar-label">Magnetic Compass</span> 
        </div>

        <DarkModeToggle />
      </div>
      
      <div className="main-content-wrapper">
        <header className="simulator-header">
          <h1>{pageTitles[activeMenu] || "Simulator"}</h1>
          <div className="header-actions">
            <button 
              className="header-icon-btn settings-btn" 
              onClick={() => setIsSettingsOpen(true)}
              title="Pengaturan Koneksi (API & WebSocket)"
              aria-label="Pengaturan Koneksi"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
            <button className="config-button" onClick={handleHeaderConfigClick}>Config</button>
          </div>
        </header>

        <div className="simulator-layout">
          {activeMenu === "GPS" && <GPSPage onStatusChange={handleGpsStatusChange} />}
          {activeMenu === "Dashboard" && (
            <div style={{ 
              width: "100%", 
              padding: "20px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
              color: "var(--text-secondary)",
              fontSize: "1.2rem"
            }}>
              Dashboard Page (Under Development)
            </div>
          )}
          {activeMenu === "Weather" && <WeatherPage onStatusChange={handleWeatherStatusChange} />}
          {activeMenu === "Gyro" && <GyroPage onStatusChange={handleGyroStatusChange} />}
          {activeMenu === "Sensor" && <SpeedDepthPage onStatusChange={handleSensorStatusChange} />}
          {activeMenu === "Magnet" && <MagneticCompassPage onStatusChange={handleMagnetStatusChange} />}
        </div>
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

function App() {
  return (
    <ConfigProvider>
      <SettingsProvider>
        <AppContent />
      </SettingsProvider>
    </ConfigProvider>
  );
}

export default App;
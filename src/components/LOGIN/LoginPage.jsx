import React from "react";
import "./LoginPage.css";
import loginLight from "../../assets/login/login_light.png";
import loginDark from "../../assets/login/login_dark.png";
import darkModeIcon from "../../assets/mode/DarkMode.png";
import lightModeIcon from "../../assets/mode/LightMode.png";
import { authApi } from "../../api/endpoints";
import { useBackendHealth } from "../../hooks/useBackendHealth";
import ConnectionBanner from "../web-logic/ConnectionBanner";

// ============================================================================
// LOGIN PAGE COMPONENT
// ============================================================================
const LoginPage = ({ onLogin }) => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  const [isDarkMode, setIsDarkMode] = React.useState(false);
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const backend = useBackendHealth();

  // ============================================================================
  // THEME INITIALIZATION
  // ============================================================================
  React.useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.body.setAttribute('data-theme', 'dark');
    } else {
      document.body.setAttribute('data-theme', 'light');
    }
  }, []);

  // ============================================================================
  // LOGIN HANDLER
  // ============================================================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const data = await authApi.login(username.trim(), password);

      if (data?.success) {
        try {
          sessionStorage.setItem("nddu_username", data.username || username);
        } catch {
          /* ignore */
        }
        onLogin(true);
      } else {
        setError(data?.message || "Login gagal");
      }
    } catch (err) {
      if (err?.status === 401) {
        setError(err.data?.message || "Username atau password salah");
      } else if (err?.kind === "timeout" || err?.kind === "offline") {
        setError(
          "Server belum siap (cold start Render bisa ±60 detik). Tunggu sebentar lalu coba lagi."
        );
      } else {
        setError(err?.message || "Gagal terhubung ke server.");
      }
      backend.retry();
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // DARK MODE TOGGLE HANDLER
  // ============================================================================
  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    
    if (newMode) {
      localStorage.setItem('theme', 'dark');
      document.body.setAttribute('data-theme', 'dark');
    } else {
      localStorage.setItem('theme', 'light');
      document.body.setAttribute('data-theme', 'light');
    }
  };

  // ============================================================================
  // COMPONENT RENDER
  // ============================================================================
  return (
    <div className="login-container">
      {/* STATUS KONEKSI BACKEND (cold start / offline) */}
      <div className="login-connection-banner">
        <ConnectionBanner
          status={backend.status}
          error={backend.error}
          onRetry={backend.retry}
          compact
        />
      </div>

      {/* BACKGROUND LAYERS */}
      <div className="login-background"></div>
      
      <div className="login-layer">
        <div className="login-layer-container">
          <img 
            src={isDarkMode ? loginDark : loginLight} 
            alt="Login Background" 
            className="login-layer-image" 
          />
        </div>
      </div>
      
      {/* DARK MODE TOGGLE */}
      <div className="dark-mode-toggle-absolute" onClick={toggleDarkMode}>
        <img 
          src={isDarkMode ? lightModeIcon : darkModeIcon} 
          alt={isDarkMode ? "Light Mode" : "Dark Mode"} 
          className="dark-mode-icon-absolute"
        />
        <span className="dark-mode-label-absolute">
          {isDarkMode ? "Light Mode" : "Dark Mode"}
        </span>
      </div>
      
      {/* TITLE SECTION */}
      <div className="login-title-container">
        <div className="login-title-wrapper">
          {/* Mark kapal/kompas orisinal (bukan logo institusi pihak lain) */}
          <svg
            className="login-mark"
            viewBox="0 0 64 64"
            role="img"
            aria-label="NDDU vessel mark"
          >
            <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.55" />
            <path
              d="M32 8 L37.5 26.5 L56 32 L37.5 37.5 L32 56 L26.5 37.5 L8 32 L26.5 26.5 Z"
              fill="currentColor"
            />
            <circle cx="32" cy="32" r="4.5" fill="var(--bg-primary)" />
          </svg>
          <h1 className="login-title">Navigation Data Distribution Unit</h1>
          <p className="login-subtitle">Vessel Sensor Simulator · NDDU</p>
        </div>
      </div>
      
      {/* LOGIN FORM SECTION */}
      <div className="login-content">
        <div className="login-card">
          <form className="login-form" onSubmit={handleSubmit}>
            {/* ERROR MESSAGE DISPLAY */}
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {/* USERNAME INPUT */}
            <div className="form-group">
              <label htmlFor="username" className="form-label">Username</label>
              <input
                type="text"
                id="username"
                className="form-input"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
              />
            </div>
            
            {/* PASSWORD INPUT */}
            <div className="form-group">
              <label htmlFor="password" className="form-label">Password</label>
              <input
                type="password"
                id="password"
                className="form-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            
            {/* LOGIN BUTTON */}
            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? "Menghubungkan…" : "Login"}
            </button>

            <p className="login-demo-hint"><strong>admin</strong> / <strong>admin</strong></p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
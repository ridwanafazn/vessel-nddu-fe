import React, { useState, useEffect } from "react";
import "./ConfigPopup.css";
import ConfirmationPopup from "./ConfirmationPopUp";

// Impor ikon
import iconEdit from "../../assets/icon/PropertyEdit.png";
import iconDelete from "../../assets/icon/PropertyDelete.png";

function ConfigPopup({ isOpen, onClose, config, onSave, onDefault, onClear }) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempConfig, setTempConfig] = useState(config);
  const [warning, setWarning] = useState("");
  const [topicInput, setTopicInput] = useState("");

  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: "",
    message: "",
    variant: "danger",
    actionType: ""
  });

  useEffect(() => {
    if (isOpen) {
      const initialConfig = {
        ...config,
        topic: Array.isArray(config.topic) ? config.topic : config.topic ? [config.topic] : [],
      };
      setTempConfig(initialConfig);
      setWarning("");
      setTopicInput("");
    }

  }, [isOpen, config]); 

  if (!isOpen) return null;

  // --- HANDLERS ---
  const handleLocalChange = (e) => {
    const { name, value } = e.target;
    setTempConfig((prev) => ({ ...prev, [name]: value }));
  };

  const handleTopicKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const newTopic = topicInput.trim();
      if (newTopic && !tempConfig.topic.includes(newTopic)) {
        setTempConfig((prev) => ({ ...prev, topic: [...prev.topic, newTopic] }));
      }
      setTopicInput("");
    }
  };

  const removeTopic = (indexToRemove) => {
    setTempConfig((prev) => ({
      ...prev,
      topic: prev.topic.filter((_, index) => index !== indexToRemove),
    }));
  };

  // --- VALIDATION ---
  const validateInputs = () => {
    if (!tempConfig.ip) return "IP Address harus diisi";
    
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(tempConfig.ip) && tempConfig.ip !== "localhost") {
      return "Format IP Address tidak valid";
    }
    
    if (!tempConfig.port) return "Port harus diisi";
    const portNum = parseInt(tempConfig.port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return "Port harus antara 1-65535";
    }
    
    if (!tempConfig.username) return "Username harus diisi";
    
    // PERUBAHAN: Hilangkan validasi batasan update rate
    if (!tempConfig.updateRate) return "Update Rate harus diisi";
    const rateNum = parseInt(tempConfig.updateRate, 10);
    if (isNaN(rateNum) || rateNum < 1) { // Hanya cek harus lebih dari 0
      return "Update Rate harus angka positif (minimal 1 ms)";
    }
    
    return null;
  };

  // --- LOGIKA TOMBOL HEADER (EDIT / APPLY) ---
  const handleEditToggle = () => {
    if (isEditing) {
      const error = validateInputs();
      if (error) {
        setWarning({ type: "error", message: error });
        return;
      }
      setIsEditing(false);
      setWarning("");
    } else {
      setIsEditing(true);
      setWarning("");
    }
  };

  const handleCancel = () => {
    const resetConfig = {
      ...config,
      topic: Array.isArray(config.topic) ? config.topic : config.topic ? [config.topic] : [],
    };
    setTempConfig(resetConfig);
    setIsEditing(false);
    setWarning("");
  };

  const handleDefaultClick = () => {
    onDefault();
  };

  // --- CONFIRMATION LOGIC (SAVE TO SERVER) ---
  const requestSaveConfig = () => {
    const error = validateInputs();
    if (error) {
      setWarning({ type: "error", message: error });
      return;
    }
    
    setConfirmState({
      isOpen: true,
      title: "Simpan Konfigurasi MQTT",
      message: "Apakah Anda yakin ingin menyimpan pengaturan MQTT ini ke sistem?",
      variant: "primary", 
      actionType: "saveConfig"
    });
  };

  const requestClearConfig = () => {
    setConfirmState({
      isOpen: true,
      title: "Hapus Konfigurasi MQTT",
      message: "Apakah Anda yakin akan menghapus konfigurasi MQTT?",
      variant: "danger", 
      actionType: "clearConfig"
    });
  };

  const executeAction = () => {
    if (confirmState.actionType === "saveConfig") {
      onSave(tempConfig); 
      setIsEditing(false);
      onClose(); 

    } else if (confirmState.actionType === "clearConfig") {
      onClear();
      setIsEditing(false);
      setWarning("");
      onClose(); 
    }
    closeConfirm();
  };

  const closeConfirm = () => {
    setConfirmState({ isOpen: false, title: "", message: "", variant: "danger", actionType: "" });
  };

  return (
    <>
      <ConfirmationPopup
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        variant={confirmState.variant}
        onConfirm={executeAction}
        onClose={closeConfirm}
      />

      <div className="popup-overlay config-overlay">
        <div className="popup-container config-popup">
          <div className="popup-header config-header">
            <div className="header-content-left">
              <span className="popup-title">CONFIGURATION</span>
            </div>
            <button className="popup-close" onClick={onClose}>&times;</button>
          </div>

          <div className="popup-content config-content">
            {warning && (
              <div className={`config-warning config-warning-${warning.type}`}>
                {warning.message}
              </div>
            )}

            {/* Input Rows */}
            <div className="config-row">
              <div className="config-label-col">
                <label>IP Address</label>
                <input 
                  name="ip" 
                  value={tempConfig.ip} 
                  onChange={handleLocalChange} 
                  placeholder="e.g., 127.0.0.1" 
                  readOnly={!isEditing} 
                  disabled={!isEditing} 
                  className={!isEditing ? "input-disabled" : ""} 
                />
              </div>
              <div className="config-label-col">
                <label>Username</label>
                <input 
                  name="username" 
                  value={tempConfig.username} 
                  onChange={handleLocalChange} 
                  placeholder="Username" 
                  readOnly={!isEditing} 
                  disabled={!isEditing} 
                  className={!isEditing ? "input-disabled" : ""} 
                />
              </div>
            </div>
            <div className="config-row">
              <div className="config-label-col">
                <label>Port</label>
                <input 
                  name="port" 
                  value={tempConfig.port} 
                  onChange={handleLocalChange} 
                  placeholder="e.g., 1883" 
                  readOnly={!isEditing} 
                  disabled={!isEditing} 
                  className={!isEditing ? "input-disabled" : ""} 
                />
              </div>
              <div className="config-label-col">
                <label>Password</label>
                <input 
                  name="password" 
                  type="password" 
                  value={tempConfig.password} 
                  onChange={handleLocalChange} 
                  placeholder="Password" 
                  readOnly={!isEditing} 
                  disabled={!isEditing} 
                  className={!isEditing ? "input-disabled" : ""} 
                />
              </div>
            </div>
            <div className="config-row">
              <div className="config-label-col">
                <label>Topic</label>
                {isEditing && (
                  <input 
                    className="topic-input-field" 
                    value={topicInput} 
                    onChange={(e) => setTopicInput(e.target.value)} 
                    onKeyDown={handleTopicKeyDown} 
                    placeholder="Add new topic (press Enter)" 
                  />
                )}
                <div className={`topic-tags-display ${!isEditing ? "topic-disabled" : ""}`}>
                  {tempConfig.topic.map((topic, index) => (
                    <div key={index} className="topic-tag">
                      {topic}
                      {isEditing && <button className="topic-tag-remove" onClick={() => removeTopic(index)}>&times;</button>}
                    </div>
                  ))}
                  {tempConfig.topic.length === 0 && !isEditing && (
                    <span className="no-topics-message">
                      {tempConfig.ip ? "No topics configured." : "Konfigurasi MQTT belum diisi."}
                    </span>
                  )}
                </div>
                {isEditing && (
                  <div className="topic-hint">
                    <small>Press Enter or comma (,) to add a topic</small>
                  </div>
                )}
              </div>
              <div className="config-label-col">
                <label>Update Rate</label>
                <input 
                  name="updateRate" 
                  value={tempConfig.updateRate} 
                  onChange={handleLocalChange} 
                  placeholder="Update Rate (ms)" 
                  readOnly={!isEditing} 
                  disabled={!isEditing} 
                  className={!isEditing ? "input-disabled" : ""} 
                />
                <div className="update-rate-hint">
                  {/* PERUBAHAN: Hapus batasan dari hint */}
                  <small>Masukkan angka positif (dalam milidetik)</small>
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="popup-actions config-actions">
              <div className="header-actions">
                <button 
                  className="header-btn edit-btn" 
                  onClick={handleEditToggle} 
                  type="button"
                  title={isEditing ? "Apply Changes (Lock)" : "Edit Configuration"}
                >
                  <img src={iconEdit} alt={isEditing ? "Apply" : "Edit"} />
                  <span>{isEditing ? "Apply" : "Edit"}</span> 
                </button>
                <button 
                  className="header-btn delete-btn" 
                  onClick={requestClearConfig} 
                  type="button"
                  title="Hapus Konfigurasi MQTT"
                >
                  <img src={iconDelete} alt="Delete" />
                </button>
              </div>

              <div className="bottom-actions">
                {isEditing ? (
                  /* MODE EDIT */
                  <>
                    <button 
                      className="popup-btn-default config-btn" 
                      onClick={handleCancel} 
                      type="button"
                    >
                      CANCEL
                    </button>
                    <button
                      className="popup-btn-save config-btn"
                      onClick={requestSaveConfig}
                      type="button"
                      disabled={true} 
                      title="Klik 'Apply' di atas kiri dulu untuk menyimpan edit"
                      style={{ opacity: 0.5, cursor: "not-allowed" }}
                    >
                      SAVE
                    </button>
                  </>
                ) : (
                  /* MODE LOCKED (APPLIED) */
                  <>
                    <button 
                      className="popup-btn-default config-btn" 
                      onClick={handleDefaultClick} 
                      type="button"
                    >
                      DEFAULT
                    </button>
                    <button
                      className="popup-btn-save config-btn"
                      onClick={requestSaveConfig}
                      type="button"
                    >
                      SAVE
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default ConfigPopup;
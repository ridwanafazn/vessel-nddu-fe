import React from 'react';
import './SimulationControls.css';
import iconSend from '../../assets/icon/PropertySend.png';
import iconStop from '../../assets/icon/PropertyStop.png';
import iconDelete from '../../assets/icon/PropertyDelete.png';

const SimulationControls = ({ 
  onStart, 
  onStop, 
  onDelete, 
  isRunning, 
  isDisabled 
}) => {
  return (
    <div className="action-buttons-container">
      <div className="action-buttons-group">
        <button 
          className="action-icon-btn" 
          onClick={onStart} 
          disabled={isRunning || isDisabled} 
          title={isRunning ? "Simulasi sedang berjalan" : (isDisabled ? "Silakan konfigurasi MQTT terlebih dahulu" : "Mulai simulasi")}
        >
          <img src={iconSend} alt="Start" />
        </button>
        <button 
          className="action-icon-btn" 
          onClick={onStop} 
          disabled={!isRunning || isDisabled}  
          title={!isRunning ? "Simulasi belum berjalan" : (isDisabled ? "Silakan konfigurasi MQTT terlebih dahulu" : "Hentikan simulasi")}
        >
          <img src={iconStop} alt="Stop" />
        </button>
      </div>
      <div className="action-divider"></div>
      <button 
        className="action-delete-btn" 
        onClick={onDelete} 
        disabled={isRunning || isDisabled}  
        title={isRunning ? "Hentikan simulasi terlebih dahulu" : (isDisabled ? "Silakan konfigurasi MQTT terlebih dahulu" : "Reset visualisasi data")}
      >
        <img src={iconDelete} alt="Delete" />
        <span>Delete</span>
      </button>
    </div>
  );
};

export default SimulationControls;
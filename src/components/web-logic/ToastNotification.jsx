import React, { useEffect, useState } from 'react';
import './ToastNotification.css';

const ToastNotification = ({ message, type = 'success', onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);

        setTimeout(onClose, 300); 
      }, 1000); 

      return () => clearTimeout(timer);
    }

  }, [message]); 

  if (!message && !isVisible) return null;

  return (
    <div className={`toast-notification ${type} ${isVisible ? 'show' : 'hide'}`}>
      <div className="toast-icon">
        {type === 'success' && '✓'}
        {type === 'error' && '✕'}
        {type === 'info' && 'ℹ'}
      </div>
      <span className="toast-message">{message}</span>
    </div>
  );
};

export default ToastNotification;
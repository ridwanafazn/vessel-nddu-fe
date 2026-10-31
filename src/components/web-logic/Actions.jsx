import React from 'react';
import './Actions.css';

const EditActions = ({ onDefault, onSave, isDisabled, isRunning }) => {
  return (
    <div className="edit-actions-container">
      {/* Tombol SAVE ditaruh di atas sesuai request gambar */}
      <button 
        className="btn-action btn-save" 
        onClick={onSave} 
        disabled={isDisabled || isRunning}
      >
        Save
      </button>

      {/* Tombol DEFAULT ditaruh di bawah */}
      <button 
        className="btn-action btn-default" 
        onClick={onDefault} 
        disabled={isDisabled || isRunning}
      >
        Default
      </button>
    </div>
  );
};

export default EditActions;
import React from 'react';
import './HeaderControl.css';
import iconEdit from '../../assets/icon/PropertyEdit.png';
import iconDelete from '../../assets/icon/PropertyDelete.png';

const HeaderControl = ({ 
  onEdit, 
  onDelete, 
  isDisabled, 
  isRunning,
  isEditing = false 
}) => {
  return (
    <div className="panel-header-actions">
      <button 
        className={`panel-icon-btn btn-edit-icon ${isEditing ? 'btn-save-mode' : ''}`} 
        onClick={onEdit} 
        disabled={isDisabled || isRunning}
      >
        {isEditing ? (
          <span className="save-text-header">Save</span>
        ) : (
          <img src={iconEdit} alt="Edit" />
        )}
      </button>
      
      <button 
        className="panel-icon-btn btn-delete-icon" 
        onClick={onDelete} 
        disabled={isDisabled || isRunning}
      >
        <img src={iconDelete} alt="Delete" />
      </button>
    </div>
  );
};

export default HeaderControl;
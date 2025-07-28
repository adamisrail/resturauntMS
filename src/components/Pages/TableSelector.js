import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Pages.css';
import './TableSelector.css';

const TableSelector = () => {
  const navigate = useNavigate();

  const handleTableSelect = (tableNumber) => {
    navigate(`/table${tableNumber}`);
  };

  return (
    <div className="table-selector">
      <div className="table-selector-header">
        <h1>Welcome to Our Restaurant</h1>
        <p>Please select your table to get started</p>
      </div>
      
      <div className="tables-grid">
        <div className="table-option" onClick={() => handleTableSelect(1)}>
          <div className="table-icon">🪑</div>
          <h3>Table 1</h3>
          <p>Join the conversation at Table 1</p>
          <div className="table-status available">Available</div>
        </div>
        
        <div className="table-option" onClick={() => handleTableSelect(2)}>
          <div className="table-icon">🪑</div>
          <h3>Table 2</h3>
          <p>Join the conversation at Table 2</p>
          <div className="table-status available">Available</div>
        </div>
      </div>
      
      <div className="table-selector-footer">
        <p>Scan the QR code on your table or select manually</p>
        <p className="table-note">Each table has its own chat and order session</p>
      </div>
    </div>
  );
};

export default TableSelector; 
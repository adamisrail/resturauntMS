import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../../contexts/StoreContext';
import './Pages.css';
import './TableSelector.css';

const TableSelector = () => {
  const navigate = useNavigate();
  const { storeSlug } = useParams();   // undefined when at "/"
  const { store, loading } = useStore();

  const handleTableSelect = (tableNumber) => {
    if (storeSlug) {
      navigate(`/${storeSlug}/table/${tableNumber}`);
    } else {
      navigate(`/table/${tableNumber}`);
    }
  };

  if (loading) {
    return (
      <div className="table-selector">
        <div className="table-selector-header">
          <div className="table-selector-loading">Loading restaurant...</div>
        </div>
      </div>
    );
  }

  const tableCount = store?.tableCount || 2;
  const tables = Array.from({ length: tableCount }, (_, i) => i + 1);

  return (
    <div className="table-selector">
      <div className="table-selector-header">
        {store?.logo && (
          <img
            src={store.logo}
            alt={store.name}
            className="table-selector-logo"
            onError={e => { e.target.style.display = 'none'; }}
          />
        )}
        <h1>{store?.name || 'Welcome to Our Restaurant'}</h1>
        <p>{store?.description || 'Please select your table to get started'}</p>
      </div>

      <div className="tables-grid">
        {tables.map(n => (
          <div key={n} className="table-option" onClick={() => handleTableSelect(n)}>
            <div className="table-icon">🪑</div>
            <h3>Table {n}</h3>
            <p>Join the conversation at Table {n}</p>
            <div className="table-status available">Available</div>
          </div>
        ))}
      </div>

      <div className="table-selector-footer">
        <p>Scan the QR code on your table or select manually</p>
        <p className="table-note">Each table has its own chat and order session</p>
      </div>
    </div>
  );
};

export default TableSelector;

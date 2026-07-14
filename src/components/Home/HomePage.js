import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllStores } from '../../utils/storeService';
import './HomePage.css';

const HomePage = () => {
  const navigate = useNavigate();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getAllStores()
      .then(setStores)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = stores.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="home-page">
      {/* Hero */}
      <div className="home-hero">
        <div className="home-hero-content">
          <h1 className="home-title">TableFlow</h1>
          <p className="home-subtitle">Order food from your favourite restaurant — at the table or from home.</p>
          <div className="home-search-wrap">
            <span className="home-search-icon">🔍</span>
            <input
              className="home-search"
              type="text"
              placeholder="Search restaurants..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Stores */}
      <div className="home-stores-section">
        <h2 className="home-section-title">
          {search ? `Results for "${search}"` : 'Restaurants'}
        </h2>

        {loading ? (
          <div className="home-loading">
            <div className="home-spinner" />
            <p>Finding restaurants...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="home-empty">
            <p>No restaurants found{search ? ` for "${search}"` : ''}.</p>
          </div>
        ) : (
          <div className="home-stores-grid">
            {filtered.map(store => (
              <div
                key={store.id}
                className="home-store-card"
                onClick={() => navigate(`/${store.slug}`)}
              >
                <div className="home-store-img-wrap">
                  {store.logo ? (
                    <img
                      src={store.logo}
                      alt={store.name}
                      className="home-store-img"
                      onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    />
                  ) : null}
                  <div
                    className="home-store-img-placeholder"
                    style={{ display: store.logo ? 'none' : 'flex' }}
                  >
                    {store.name.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="home-store-info">
                  <h3>{store.name}</h3>
                  {store.description && <p>{store.description}</p>}
                  <div className="home-store-meta">
                    <span className="home-order-badge">🛒 Order Online</span>
                    <span className="home-dine-badge">🪑 Dine In</span>
                  </div>
                </div>
                <div className="home-store-arrow">→</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="home-footer">
        <p>Are you a restaurant owner? <a href="/admin">Sign in to your dashboard →</a></p>
      </div>
    </div>
  );
};

export default HomePage;

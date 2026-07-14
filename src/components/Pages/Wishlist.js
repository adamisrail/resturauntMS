import React, { useState } from 'react';
import Profile from '../Navigation/Profile';
import './Pages.css';

const Wishlist = ({ user, onLogout, wishlist, removeFromWishlist, isInWishlist, tableWishlists = {} }) => {
  const [expandedUsers, setExpandedUsers] = useState({});

  const toggleUser = (key) => setExpandedUsers(prev => ({ ...prev, [key]: !prev[key] }));

  // Other table members' wishlists (exclude own)
  const othersWishlists = Object.entries(tableWishlists).filter(
    ([, data]) => data?.phoneNumber && data.phoneNumber !== user?.phoneNumber && (data.items || []).length > 0
  );

  return (
    <div className="page-container wishlist-page-container">
      <div className="page-header">
        <div className="logo-container">
          <img
            src="/58c33377dfcbb3022493dec49d098b02.jpg"
            alt="Restaurant Logo"
            className="restaurant-logo"
          />
        </div>
        <div className="page-title">
          <h1>Wishlist</h1>
          <p>Your saved items</p>
        </div>
        <Profile user={user} onLogout={onLogout} />
      </div>

      <div className="page-content">
        {/* ── My Wishlist ─────────────────────────────────── */}
        <div className="wishlist-section-label">My Wishlist</div>
        {wishlist.length === 0 ? (
          <div className="placeholder-content">
            <div className="placeholder-icon">❤️</div>
            <h2>Your Wishlist is Empty</h2>
            <p>Add items to your wishlist from the menu</p>
          </div>
        ) : (
          <div className="wishlist-items">
            {wishlist.map((item) => {
              const uniqueKey = item.id || `item-${item.name}-${item.price}`;
              return (
                <div key={uniqueKey} className="wishlist-item">
                  <div className="wishlist-item-image">
                    <img src={item.image} alt={item.name} className="wishlist-item-img" />
                  </div>
                  <div className="wishlist-item-details">
                    <h3 className="wishlist-item-name">{item.name}</h3>
                    <p className="wishlist-item-description">{item.description}</p>
                    <div className="wishlist-item-meta">
                      <div className="wishlist-item-rating">
                        <span className="stars">⭐ {item.rating}</span>
                        <span className="review-count">({item.reviewCount})</span>
                      </div>
                      <div className="wishlist-item-price">${item.price}</div>
                    </div>
                  </div>
                  <button
                    className="wishlist-remove-btn"
                    onClick={() => removeFromWishlist(uniqueKey)}
                    title="Remove from wishlist"
                  >
                    ❌
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Table Members' Wishlists ─────────────────────── */}
        {othersWishlists.length > 0 && (
          <div className="table-wishlists-section">
            <div className="wishlist-section-label" style={{ marginTop: 24 }}>At the Table</div>
            {othersWishlists.map(([key, data]) => (
              <div key={key} className="table-member-wishlist">
                <button
                  className="table-member-header"
                  onClick={() => toggleUser(key)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: '#182229', border: '1px solid #2a3942', borderRadius: 12,
                    padding: '12px 16px', cursor: 'pointer', color: '#e9edef', marginBottom: 8,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    ❤️ {data.name}'s Wishlist
                    <span style={{ color: '#8696a0', fontWeight: 400, marginLeft: 8, fontSize: 13 }}>
                      ({(data.items || []).length} item{data.items?.length !== 1 ? 's' : ''})
                    </span>
                  </span>
                  <span style={{ color: '#8696a0' }}>{expandedUsers[key] ? '▲' : '▼'}</span>
                </button>

                {expandedUsers[key] && (
                  <div className="wishlist-items">
                    {(data.items || []).map((item) => {
                      const uniqueKey = item.id || `item-${item.name}-${item.price}`;
                      return (
                        <div key={uniqueKey} className="wishlist-item" style={{ opacity: 0.85 }}>
                          <div className="wishlist-item-image">
                            <img src={item.image} alt={item.name} className="wishlist-item-img" />
                          </div>
                          <div className="wishlist-item-details">
                            <h3 className="wishlist-item-name">{item.name}</h3>
                            <p className="wishlist-item-description">{item.description}</p>
                            <div className="wishlist-item-meta">
                              <div className="wishlist-item-rating">
                                <span className="stars">⭐ {item.rating}</span>
                                <span className="review-count">({item.reviewCount})</span>
                              </div>
                              <div className="wishlist-item-price">${item.price}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Wishlist;

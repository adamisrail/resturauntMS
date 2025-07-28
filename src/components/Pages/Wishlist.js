import React, { useState, useEffect, useMemo } from 'react';
import Profile from '../Navigation/Profile';
import './Pages.css';

const Wishlist = ({ user, onLogout, wishlist, removeFromWishlist, isInWishlist }) => {
  // Current deployment timestamp - this will show when the app was deployed
  const deploymentTime = useMemo(() => new Date('2025-07-27T15:13:28.016Z'), []); // Current deployment time
  const [secondsSinceDeployment, setSecondsSinceDeployment] = useState(0);

  // Update seconds since deployment every second
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const diffInSeconds = Math.floor((now - deploymentTime) / 1000);
      setSecondsSinceDeployment(diffInSeconds);
    }, 1000);

    return () => clearInterval(timer);
  }, [deploymentTime]);

  const formatTime = (date) => {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="page-container wishlist-page-container">
      {/* Header with Logo and Profile */}
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
        <p>Your favorite items</p>
        </div>
        <Profile user={user} onLogout={onLogout} />
      </div>
      
      <div className="page-content">
        {wishlist.length === 0 ? (
        <div className="placeholder-content">
          <div className="placeholder-icon">❤️</div>
            <h2>Your Wishlist is Empty</h2>
            <p>Add items to your wishlist from the menu</p>
          </div>
        ) : (
          <div className="wishlist-items">
            {wishlist.map((item) => (
              <div key={item.id} className="wishlist-item">
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
                  onClick={() => removeFromWishlist(item.id)}
                  title="Remove from wishlist"
                >
                  ❌
                </button>
              </div>
            ))}
        </div>
        )}
      </div>

      {/* Deployment timestamp above bottom navigation */}
      <div className="timestamp-display">
        <span>Deployed: {formatTime(deploymentTime)} | {secondsSinceDeployment}s ago</span>
      </div>
    </div>
  );
};

export default Wishlist; 
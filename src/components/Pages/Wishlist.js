import React from 'react';
import Profile from '../Navigation/Profile';
import './Pages.css';

const Wishlist = ({ user, onLogout, wishlist, removeFromWishlist, isInWishlist }) => {
  return (
    <div className="page-container">
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
                  <span className="wishlist-item-emoji">{item.image}</span>
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
    </div>
  );
};

export default Wishlist; 
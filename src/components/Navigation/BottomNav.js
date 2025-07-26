import React from 'react';
import './BottomNav.css';

const BottomNav = ({ activeTab, onTabChange, typingUsers = [], wishlistCount = 0, unreadMessageCount = 0, cartCount = 0 }) => {
  const tabs = [
    {
      id: 'menu',
      label: 'Menu',
      icon: (
        <svg viewBox="0 0 24 24" className="nav-icon">
          <path fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
        </svg>
      )
    },
    {
      id: 'chat',
      label: 'Chat',
      icon: (
        <div className="chat-icon-container">
          <svg viewBox="0 0 24 24" className="nav-icon">
            <path fill="currentColor" d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
          </svg>
          {unreadMessageCount > 0 && (
            <div className="chat-badge">
              {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
            </div>
          )}
          {typingUsers.length > 0 && (
            <div className="typing-indicator-dot">
              <div className="typing-dot"></div>
            </div>
          )}
        </div>
      )
    },
    {
      id: 'wishlist',
      label: 'Wishlist',
      icon: (
        <div className="wishlist-icon-container">
        <svg viewBox="0 0 24 24" className="nav-icon">
          <path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
          {wishlistCount > 0 && (
            <div className="wishlist-badge">
              {wishlistCount > 99 ? '99+' : wishlistCount}
            </div>
          )}
        </div>
      )
    },
    {
      id: 'cart',
      label: 'Cart',
      icon: (
        <div className="cart-icon-container">
        <svg viewBox="0 0 24 24" className="nav-icon">
          <path fill="currentColor" d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12L8.1 13h7.45c.75 0 1.41-.41 1.75-1.03L21.7 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>
          {cartCount > 0 && (
            <div className="cart-badge">
              {cartCount > 99 ? '99+' : cartCount}
            </div>
          )}
        </div>
      )
    }
  ];

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
          data-has-wishlist={tab.id === 'wishlist' && wishlistCount > 0 ? 'true' : 'false'}
          data-has-messages={tab.id === 'chat' && unreadMessageCount > 0 ? 'true' : 'false'}
        >
          <div className="nav-icon-container">
            {tab.icon}
          </div>
          <span className="nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default BottomNav; 
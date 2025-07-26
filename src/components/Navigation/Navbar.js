import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import './Navbar.css';

const Navbar = ({ user, onLogout }) => {
  const [userProfile, setUserProfile] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.phoneNumber));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    };

    fetchUserProfile();
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const generateRainbowAvatar = (name) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    const index = name ? name.charCodeAt(0) % colors.length : 0;
    return colors[index];
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleProfileClick = () => {
    setShowDropdown(!showDropdown);
  };

  const handleLogout = () => {
    onLogout();
    setShowDropdown(false);
  };

  const handleUpdatePhoto = () => {
    // TODO: Implement photo upload functionality
    alert('Photo upload feature coming soon!');
    setShowDropdown(false);
  };

  const profileColor = generateRainbowAvatar(userProfile?.name || user?.displayName);
  const initials = getInitials(userProfile?.name || user?.displayName);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <h1>Restaurant MS</h1>
        </div>
        
        <div className="navbar-user" ref={dropdownRef}>
          <div className="profile-container">
            <div 
              className="profile-avatar"
              style={{ backgroundColor: profileColor }}
              onClick={handleProfileClick}
            >
              {user?.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt="Profile" 
                  className="profile-image"
                />
              ) : (
                <span className="profile-initials">{initials}</span>
              )}
            </div>
            
            {showDropdown && (
              <div className="profile-dropdown">
                <div className="dropdown-header">
                  <div 
                    className="dropdown-avatar"
                    style={{ backgroundColor: profileColor }}
                  >
                    {user?.photoURL ? (
                      <img 
                        src={user.photoURL} 
                        alt="Profile" 
                        className="dropdown-image"
                      />
                    ) : (
                      <span className="dropdown-initials">{initials}</span>
                    )}
                  </div>
                  <div className="dropdown-user-info">
                    <span className="dropdown-name">{userProfile?.name || user?.displayName || user?.phoneNumber}</span>
                    <span className="dropdown-phone">{user?.phoneNumber}</span>
                  </div>
                </div>
                
                <div className="dropdown-actions">
                  <button onClick={handleUpdatePhoto} className="dropdown-action">
                    <svg viewBox="0 0 24 24" className="action-icon">
                      <path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                    Update Photo
                  </button>
                  
                  <button onClick={handleLogout} className="dropdown-action">
                    <svg viewBox="0 0 24 24" className="action-icon">
                      <path fill="currentColor" d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
                    </svg>
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 
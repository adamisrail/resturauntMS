import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { fetchAllProducts, fetchProductsByCategory, PRODUCT_CATEGORIES } from '../../utils/productService';
import Profile from '../Navigation/Profile';
import './Pages.css';
import './Menu.css';

const Menu = ({ user, onLogout, wishlist, addToWishlist, removeFromWishlist, isInWishlist, addToCart, addGiftToCart, getChatParticipants, menuProducts, menuProductsLoaded, menuProductsLoading, loadMenuProducts }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('main-course');
  const [sortBy, setSortBy] = useState('relevancy');
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [layoutMode, setLayoutMode] = useState('grid'); // 'grid' for 2 per row, 'list' for 1 per row, 'compact' for compact list
  const [expandedDescriptions, setExpandedDescriptions] = useState({});
  const [notificationCount, setNotificationCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [showNotificationSummary, setShowNotificationSummary] = useState(false);
  const [clickedImages, setClickedImages] = useState({});
  const [sendDropdownOpen, setSendDropdownOpen] = useState({});
  const [giftDropdownOpen, setGiftDropdownOpen] = useState({});
  const [chatParticipants, setChatParticipants] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  // Use global state instead of local state
  const menuItems = menuProducts;
  const loading = menuProductsLoading;
  const productsLoaded = menuProductsLoaded;

  // Function to clear cache and reload products
  const clearProductCache = () => {
    sessionStorage.removeItem('cachedMenuProducts');
    sessionStorage.removeItem('cachedMenuProductsTimestamp');
    // Note: Global state will be reset when component remounts
  };

  const categories = React.useMemo(() => [
    { id: 'main-course', name: 'Main Course', icon: '🍽️' },
    { id: 'appetizers', name: 'Appetizers', icon: '🥗' },
    { id: 'drinks', name: 'Drinks', icon: '🥤' },
    { id: 'desserts', name: 'Desserts', icon: '🍰' }
  ], []);

  const sortOptions = [
    { value: 'relevancy', label: 'Relevancy' },
    { value: 'name', label: 'Name' },
    { value: 'price', label: 'Price' },
    { value: 'spice', label: 'Spice Level' },
    { value: 'chef-special', label: 'Chef Special' },
    { value: 'most-ordered', label: 'Most Ordered' },
    { value: 'reviews', label: 'Reviews' }
  ];

    // Load products when component mounts if not already loaded
  useEffect(() => {
    if (!productsLoaded && Object.keys(menuItems).length === 0) {
      loadMenuProducts();
    }
  }, [productsLoaded, menuItems, loadMenuProducts]);

  const scrollToCategory = (categoryId) => {
    setActiveCategory(categoryId);
    const element = document.getElementById(`category-${categoryId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Scroll synchronization logic
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -70% 0px', // Adjust these values to control when a section is considered "active"
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const categoryId = entry.target.id.replace('category-', '');
          setActiveCategory(categoryId);
        }
      });
    }, observerOptions);

    // Observe all category sections
    categories.forEach((category) => {
      const element = document.getElementById(`category-${category.id}`);
      if (element) {
        observer.observe(element);
      }
    });

    // Cleanup observer on unmount
    return () => {
      observer.disconnect();
    };
  }, [categories, searchQuery]); // Re-run when search query changes to handle filtered results

  const handleSort = (sortType) => {
    setSortBy(sortType);
    setShowFilterDropdown(false);
  };

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const toggleLayout = () => {
    if (layoutMode === 'grid') {
      setLayoutMode('list');
    } else if (layoutMode === 'list') {
      setLayoutMode('compact');
    } else {
      setLayoutMode('grid');
    }
  };

  const toggleDescription = (itemId) => {
    setExpandedDescriptions(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const filterItemsBySearch = (items) => {
    if (!items) return [];
    if (!searchQuery.trim()) return items;
    
    return items.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
    );
  };

  const getItemLabel = (item) => {
    // Priority: Chef Special > Popular
    if (item.chefSpecial) return { type: 'chef-special', text: 'Chef Special' };
    if (item.popular) return { type: 'popular', text: 'Popular' };
    return null;
  };

  const handleWishlistToggle = (item) => {
    if (isInWishlist(item.id)) {
      removeFromWishlist(item.id);
    } else {
      addToWishlist(item);
    }
  };

  const handleImageClick = (itemId) => {
    setClickedImages(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  // Get chat participants dynamically from messages
  useEffect(() => {
    const fetchParticipants = async () => {
      if (getChatParticipants) {
        try {
          const participants = await getChatParticipants();
          setChatParticipants(participants);
        } catch (error) {
          console.error("Error fetching chat participants:", error);
        }
      }
    };

    fetchParticipants();
  }, [getChatParticipants]);

  // Fetch user profile for message sender name
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.phoneNumber) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.phoneNumber));
        if (userDoc.exists()) {
          const profileData = userDoc.data();
          setUserProfile(profileData);
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    };

    fetchUserProfile();
  }, [user?.phoneNumber]);

  const handleImageAction = (action, item) => {
    // Get unique key for this item
    const uniqueKey = item.id || `item-${item.name}-${item.price}`;
    
    // Handle different actions
    switch (action) {
      case 'send':
        // Toggle send dropdown for this item
        setSendDropdownOpen(prev => ({
          ...prev,
          [uniqueKey]: !prev[uniqueKey]
        }));
        // Close gift dropdown if open
        setGiftDropdownOpen(prev => ({
          ...prev,
          [uniqueKey]: false
        }));
        break;
      case 'gift':
        // Toggle gift dropdown for this item
        setGiftDropdownOpen(prev => ({
          ...prev,
          [uniqueKey]: !prev[uniqueKey]
        }));
        // Close send dropdown if open
        setSendDropdownOpen(prev => ({
          ...prev,
          [uniqueKey]: false
        }));
        break;
      case 'cart':
        // Add item to cart and close the overlay
        addToCart(item, 1);
        setClickedImages(prev => ({
          ...prev,
          [uniqueKey]: false
        }));
        break;
      case 'wishlist':
        handleWishlistToggle(item);
        break;
      default:
        break;
    }
  };

  const handleSendToParticipant = async (participant, item) => {
    // Get unique key for this item
    const uniqueKey = item.id || `item-${item.name}-${item.price}`;
    
    // Close dropdown and overlay
    setSendDropdownOpen(prev => ({
      ...prev,
      [uniqueKey]: false
    }));
    setClickedImages(prev => ({
      ...prev,
      [uniqueKey]: false
    }));

    try {
      // Generate chat message
      const messageText = `💡 ${userProfile?.name || user.displayName || 'You'} recommended "${item.name}" ($${item.price}) to ${participant.name}`;
      
      // Add message to Firestore
      await addDoc(collection(db, "messages"), {
        text: messageText,
        phoneNumber: user.phoneNumber,
        name: userProfile?.name || user.displayName || 'You',
        timestamp: serverTimestamp(),
        type: 'recommendation',
        recommendedItem: item.name,
        recommendedItemPrice: item.price,
        recommendedTo: participant.name
      });

      // No notification for sender - they already know they sent the recommendation
    } catch (error) {
      console.error("Error sending recommendation message:", error);
      if (window.addNotification) {
        window.addNotification(`Failed to recommend ${item.name}`, 'error', 3000);
      }
    }
  };

  const handleGiftToParticipant = async (participant, item) => {
    // Get unique key for this item
    const uniqueKey = item.id || `item-${item.name}-${item.price}`;
    
    // Close dropdown and overlay
    setGiftDropdownOpen(prev => ({
      ...prev,
      [uniqueKey]: false
    }));
    setClickedImages(prev => ({
      ...prev,
      [uniqueKey]: false
    }));

    try {
      const senderName = userProfile?.name || user.displayName || 'You';
      
      // Add gift to Firestore and sender's cart
      const giftAdded = await addGiftToCart(item, participant.phoneNumber, senderName, participant.name);

      // Only proceed with chat message and success notification if gift was actually added
      if (giftAdded) {
        // Generate chat message with sender name
        const messageText = `🎁 ${senderName} gifted "${item.name}" ($${item.price}) to ${participant.name}`;
        
        // Add message to Firestore
        await addDoc(collection(db, "messages"), {
          text: messageText,
          phoneNumber: user.phoneNumber,
          name: userProfile?.name || user.displayName || 'You',
          timestamp: serverTimestamp(),
          type: 'gift',
          giftedItem: item.name,
          giftedItemPrice: item.price,
          giftedTo: participant.name,
          giftedToPhone: participant.phoneNumber
        });

        // Show success notification
        if (window.addNotification) {
          window.addNotification(`Gifted ${item.name} to ${participant.name}!`, 'success', 3000);
        }
      }
      // If giftAdded is false, the error notification is already shown by addGiftToCart
    } catch (error) {
      console.error("Error sending gift message:", error);
      if (window.addNotification) {
        window.addNotification(`Failed to gift ${item.name}`, 'error', 3000);
      }
    }
  };

  // Notification summary function with smooth scroll
  const toggleNotificationSummary = () => {
    const newState = !showNotificationSummary;
    setShowNotificationSummary(newState);
    
    if (newState) {
      // Reset notification count when summary is opened
      setNotificationCount(0);
      
      // Smooth scroll to notification summary when opening
      setTimeout(() => {
        const notificationDropdown = document.querySelector('.notification-summary-dropdown');
        if (notificationDropdown) {
          notificationDropdown.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest'
          });
        }
      }, 50); // Small delay to ensure the dropdown is rendered
    }
  };

  // Track notifications when they appear (excluding message notifications)
  useEffect(() => {
    const originalAddNotification = window.addNotification;
    
    window.addNotification = (message, type, duration, options) => {
      // Call the original function
      if (originalAddNotification) {
        originalAddNotification(message, type, duration, options);
      }
      
      // Only track non-message notifications for summary
      if (type !== 'message' && !options?.isMessage) {
        const newNotification = {
          id: Date.now(),
          message,
          type,
          timestamp: new Date(),
          duration,
          sender: options?.sender || null,
          messagePreview: options?.messagePreview || null,
          isMessage: options?.isMessage || false
        };
        
        setRecentNotifications(prev => [newNotification, ...prev.slice(0, 9)]); // Keep last 10
        setNotificationCount(prev => prev + 1);
      }
    };
    
    return () => {
      window.addNotification = originalAddNotification;
    };
  }, []);

  // Close notification summary when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showNotificationSummary && !event.target.closest('.notification-summary-button') && !event.target.closest('.notification-summary-dropdown')) {
        // Smooth scroll back to top when closing
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
        setShowNotificationSummary(false);
      }
    };

    if (showNotificationSummary) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotificationSummary]);

  const sortItems = (items) => {
    if (!items) return [];
    
    const sortedItems = [...items];
    
    switch (sortBy) {
      case 'name':
        sortedItems.sort((a, b) => {
          const comparison = a.name.localeCompare(b.name);
          return sortOrder === 'asc' ? comparison : -comparison;
        });
        break;
      case 'price':
        sortedItems.sort((a, b) => {
          return sortOrder === 'asc' ? a.price - b.price : b.price - a.price;
        });
        break;
      case 'spice':
        sortedItems.sort((a, b) => {
          return sortOrder === 'asc' ? a.spiceLevel - b.spiceLevel : b.spiceLevel - a.spiceLevel;
        });
        break;
      case 'chef-special':
        sortedItems.sort((a, b) => {
          if (a.chefSpecial === b.chefSpecial) return 0;
          return sortOrder === 'asc' ? (a.chefSpecial ? -1 : 1) : (a.chefSpecial ? 1 : -1);
        });
        break;
      case 'most-ordered':
        sortedItems.sort((a, b) => {
          return sortOrder === 'asc' ? a.orderCount - b.orderCount : b.orderCount - a.orderCount;
        });
        break;
      case 'reviews':
        sortedItems.sort((a, b) => {
          return sortOrder === 'asc' ? a.reviewCount - b.reviewCount : b.reviewCount - a.reviewCount;
        });
        break;
      case 'relevancy':
      default:
        // Keep original order for relevancy
        break;
    }
    
    return sortedItems;
  };


  return (
    <div className="menu-page">
      {/* Header with Logo, Search and Profile */}
      <div className="menu-header">
        <div className="logo-container">
          <img 
            src="/58c33377dfcbb3022493dec49d098b02.jpg" 
            alt="Restaurant Logo" 
            className="restaurant-logo"
          />
        </div>
        <div className="search-container">
          <div className="search-icon">🔍</div>
          <input
            type="text"
            placeholder="Search menu items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button
              className="clear-search-button"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        
        <button 
          className="notification-summary-button"
          onClick={toggleNotificationSummary}
          title="Notification Summary"
        >
          🔔
          {notificationCount > 0 && (
            <span className="notification-count-badge">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </button>
        
        {showNotificationSummary && (
          <div className="notification-summary-dropdown">
            <div className="notification-summary-header">
              <h3>Recent Notifications</h3>
                      <button 
          className="close-summary-button"
          onClick={() => {
            // Smooth scroll back to top when closing
            window.scrollTo({
              top: 0,
              behavior: 'smooth'
            });
            setShowNotificationSummary(false);
          }}
        >
          ✕
        </button>
            </div>
            <div className="notification-summary-content">
              {recentNotifications.length === 0 ? (
                <div className="no-notifications">
                  <p>No recent notifications</p>
                </div>
              ) : (
                recentNotifications.map((notification) => (
                  <div key={notification.id} className={`notification-summary-item ${notification.type}`}>
                    <div className="notification-summary-icon">
                      {notification.type === 'success' ? '✅' : 
                       notification.type === 'error' ? '❌' : 
                       notification.type === 'warning' ? '⚠️' : 
                       notification.type === 'message' ? '📱' : 'ℹ️'}
                    </div>
                    <div className="notification-summary-message">
                      {notification.isMessage && notification.sender ? (
                        <div className="message-notification">
                          <div className="message-sender">{notification.sender}</div>
                          <div className="message-preview">{notification.messagePreview || notification.message}</div>
                        </div>
                      ) : (
                        notification.message
                      )}
                    </div>
                    <div className="notification-summary-time">
                      {new Date(notification.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </div>
            {recentNotifications.length > 0 && (
              <div className="notification-summary-footer">
                <button 
                  className="clear-notifications-button"
                  onClick={() => {
                    setRecentNotifications([]);
                    setNotificationCount(0);
                    // Smooth scroll back to top after clearing
                    setTimeout(() => {
                      window.scrollTo({
                        top: 0,
                        behavior: 'smooth'
                      });
                      setShowNotificationSummary(false);
                    }, 300); // Small delay to show the clearing effect
                  }}
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        )}
        
        <div className="profile-button">
          <Profile user={user} onLogout={onLogout} />
        </div>
      </div>

      {/* Category Navigation */}
      <div className="category-nav">
        {categories.map((category) => (
          <button
            key={category.id}
            className={`category-tab ${activeCategory === category.id ? 'active' : ''}`}
            onClick={() => scrollToCategory(category.id)}
          >
            <span className="category-icon">{category.icon}</span>
            <span className="category-name">{category.name}</span>
          </button>
        ))}
      </div>

      {/* Filter and Sort Section */}
      <div className="filter-section">
        <div className="filter-container">
          <div className="filter-dropdown">
            <button 
              className="filter-button"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            >
              <span className="filter-icon">🔽</span>
              <span className="filter-text">
                Sort by: {sortOptions.find(option => option.value === sortBy)?.label}
              </span>
            </button>
            
            {showFilterDropdown && (
              <div className="filter-options">
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    className={`filter-option ${sortBy === option.value ? 'active' : ''}`}
                    onClick={() => handleSort(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <button 
            className="sort-order-button"
            onClick={toggleSortOrder}
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
          
          <button 
            className="layout-toggle-button"
            onClick={toggleLayout}
            title={layoutMode === 'grid' ? 'Switch to List View' : layoutMode === 'list' ? 'Switch to Compact View' : 'Switch to Grid View'}
          >
            {layoutMode === 'grid' ? '⊟' : layoutMode === 'list' ? '☰' : '⊞'}
          </button>
        </div>
      </div>

      {/* Menu Content */}
      <div className="menu-content">
        {categories.map((category) => {
          const filteredItems = filterItemsBySearch(menuItems[category.id]);
          const sortedItems = sortItems(filteredItems);
          
          // Hide category if no items match the search
          if (searchQuery.trim() && sortedItems.length === 0) {
            return null;
          }
          
          return (
          <div key={category.id} id={`category-${category.id}`} className="category-section">
            <h2 className="category-title">{category.name}</h2>
              <div className={`menu-items-grid ${layoutMode === 'list' ? 'list-layout' : layoutMode === 'compact' ? 'compact-layout' : 'grid-layout'}`}>
                {loading ? (
                  <div className="loading-message">Loading {category.name}...</div>
                ) : sortedItems?.map((item, index) => {
                  const itemLabel = getItemLabel(item);
                  // Ensure unique key - use item.id if available, otherwise use index
                  const uniqueKey = item.id || `item-${index}`;
                  return (
                <div key={uniqueKey} className="menu-item">
                      <div 
                        className={`item-image ${clickedImages[uniqueKey] ? 'clicked' : ''}`}
                        onClick={() => handleImageClick(uniqueKey)}
                      >
                    <img src={item.image} alt={item.name} className="item-image-tag" />
                        {layoutMode !== 'compact' && itemLabel && (
                          <div className={`${itemLabel.type}-badge`}>{itemLabel.text}</div>
                        )}
                        {layoutMode !== 'compact' && (
                          <button 
                            className={`favorite-btn ${isInWishlist(item.id) ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleWishlistToggle(item);
                            }}
                          >
                            {isInWishlist(item.id) ? '❤️' : '🤍'}
                          </button>
                        )}
                        
                        {/* Image Overlay with Action Icons */}
                        {clickedImages[uniqueKey] && (
                          <div className="image-overlay">
                            <div className="overlay-background"></div>
                            <div className="action-grid">
                              <div className="action-row">
                                <button 
                                  className="action-icon gift-icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleImageAction('gift', item);
                                  }}
                                  title="Gift"
                                >
                                  🎁
                                </button>
                                {giftDropdownOpen[uniqueKey] && (
                                  <div className="gift-dropdown">
                                    <div className="dropdown-header">
                                      <span>Gift to:</span>
                                    </div>
                                    <div className="participants-list">
                                      {chatParticipants.map((participant) => (
                                                                                 <button
                                           key={participant.id}
                                           className="participant-item"
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             handleGiftToParticipant(participant, item);
                                           }}
                                         >
                                           <div className="participant-avatar">
                                             {participant.photoURL ? (
                                               <img 
                                                 src={participant.photoURL} 
                                                 alt={participant.name}
                                                 className="participant-avatar-image"
                                               />
                                             ) : (
                                               <span className="participant-avatar-initials">
                                                 {participant.name.charAt(0).toUpperCase()}
                                               </span>
                                             )}
                                           </div>
                                           <span className="participant-name">{participant.name}</span>
                                         </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                <button 
                                  className="action-icon send-icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleImageAction('send', item);
                                  }}
                                                                     title="Recommend"
                                >
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                                  </svg>
                                </button>
                                {sendDropdownOpen[uniqueKey] && (
                                                                     <div className="send-dropdown">
                                     <div className="dropdown-header">
                                       <span>Recommend to:</span>
                                     </div>
                                    <div className="participants-list">
                                      {chatParticipants.map((participant) => (
                                                                                 <button
                                           key={participant.id}
                                           className="participant-item"
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             handleSendToParticipant(participant, item);
                                           }}
                                         >
                                           <div className="participant-avatar">
                                             {participant.photoURL ? (
                                               <img 
                                                 src={participant.photoURL} 
                                                 alt={participant.name}
                                                 className="participant-avatar-image"
                                               />
                                             ) : (
                                               <span className="participant-avatar-initials">
                                                 {participant.name.charAt(0).toUpperCase()}
                                               </span>
                                             )}
                                           </div>
                                           <span className="participant-name">{participant.name}</span>
                                         </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="action-row">
                                <button 
                                  className="action-icon cart-icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleImageAction('cart', item);
                                  }}
                                  title="Add to Cart"
                                >
                                  🛒
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                  </div>
                  <div className="item-details">
                        <div className="item-title-row">
                    <h3 className="item-name">{item.name}</h3>
                          {layoutMode === 'compact' && itemLabel && (
                            <div className={`compact-${itemLabel.type}-badge`}>{itemLabel.text}</div>
                          )}
                          {layoutMode === 'compact' && (
                            <button 
                              className={`compact-favorite-btn ${isInWishlist(item.id) ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleWishlistToggle(item);
                              }}
                            >
                              {isInWishlist(item.id) ? '❤️' : '🤍'}
                            </button>
                          )}
                        </div>
                      <div 
                        className="description-container"
                        onClick={() => toggleDescription(item.id)}
                      >
                    <p className="item-description">{item.description}</p>
                        <span className={`description-icon ${expandedDescriptions[item.id] ? 'expanded' : ''}`}>
                          ▼
                        </span>
                      </div>
                      {expandedDescriptions[item.id] && (
                        <div className="description-full">
                          {item.fullDescription}
                        </div>
                      )}
                      <div className="item-meta">
                        <div className="item-meta-row">
                    <div className="item-rating">
                      <span className="stars">⭐ {item.rating}</span>
                            <span className="review-count">({item.reviewCount})</span>
                          </div>
                          {item.spiceLevel > 0 && (
                            <div className="item-spice">
                              {[...Array(item.spiceLevel)].map((_, index) => (
                                <span key={index} className="spice-icon">🌶️</span>
                              ))}
                            </div>
                          )}
                    </div>
                    <div className="item-price">${item.price}</div>
                  </div>
                </div>
                  </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Menu; 
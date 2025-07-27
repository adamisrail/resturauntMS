import React, { useState, useEffect } from 'react';
import { collection, orderBy, query, onSnapshot, doc, getDoc, addDoc, deleteDoc, serverTimestamp, where, getDocs } from 'firebase/firestore';
import { db } from './firebase/config';
import Login from './components/Auth/Login';
// import Navbar from './components/Navigation/Navbar';
import BottomNav from './components/Navigation/BottomNav';
import ChatRoom from './components/Chat/ChatRoom';
import Menu from './components/Pages/Menu';
import Wishlist from './components/Pages/Wishlist';
import Cart from './components/Pages/Cart';
import NotificationSystem from './components/Notifications/NotificationSystem';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    // Get the last visited tab from localStorage, default to 'menu'
    const savedTab = localStorage.getItem('lastActiveTab');
    return savedTab || 'menu';
  });

  // Track current page for notification logic
  const [currentPage, setCurrentPage] = useState('menu');
  
  // Track unread message count
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);
  
  // Notification grouping system
  const [groupedNotifications, setGroupedNotifications] = useState({});
  const [notificationTimeouts, setNotificationTimeouts] = useState({});
  const [wishlist, setWishlist] = useState(() => {
    // Get wishlist from localStorage
    const savedWishlist = localStorage.getItem('wishlist');
    return savedWishlist ? JSON.parse(savedWishlist) : [];
  });

  // Deduplication function for cart items
  const deduplicateCart = (cartItems) => {
    const seen = new Set();
    return cartItems.filter(item => {
      // Create a unique key that includes both itemId and whether it's a gift
      const uniqueKey = `${item.id}-${item.isGift ? 'gift' : 'regular'}`;
      
      if (seen.has(uniqueKey)) {
        return false;
      }
      seen.add(uniqueKey);
      return true;
    });
  };

  const [cart, setCart] = useState(() => {
    // Get cart from localStorage and deduplicate
    const savedCart = localStorage.getItem('cart');
    const parsedCart = savedCart ? JSON.parse(savedCart) : [];
    const deduplicatedCart = deduplicateCart(parsedCart);
    
    return deduplicatedCart;
  });

  const [gifts, setGifts] = useState([]);
  // const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    // Check for existing user session in localStorage
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('lastActiveTab', activeTab);
  }, [activeTab]);

  // Save wishlist to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  // Add received and sent gifts to cart when gifts are fetched
  useEffect(() => {
    const normalizePhone = phone => phone?.replace(/[^0-9]/g, '');
    const normalizedUserPhone = normalizePhone(user?.phoneNumber);
    
    if (gifts.length > 0) {
      const newGiftsToAdd = [];
      
      gifts.forEach(gift => {
        // Skip test items to avoid duplicate key issues
        if (gift.itemId === 'test-item') {
          return;
        }
        
        const normalizedGiftRecipient = normalizePhone(gift.recipientPhoneNumber);
        const normalizedGiftSender = normalizePhone(gift.senderPhoneNumber);
        
        // Handle received gifts (current user is recipient)
        if (normalizedGiftRecipient === normalizedUserPhone) {
          const giftId = `received-${gift.itemId}-${gift.senderPhoneNumber}`;
          
          // Check if gift already exists in cart using current cart state
          const giftExists = cart.some(item => item.giftId === giftId);
          if (!giftExists) {
            // Add received gift to cart
            const receivedGiftItem = {
              id: gift.itemId,
              name: gift.itemName,
              price: 0, // Free for receiver
              image: gift.itemImage,
              description: gift.itemDescription,
              rating: gift.itemRating,
              reviewCount: gift.itemReviewCount,
              quantity: 1,
              isGift: true,
              giftedBy: gift.senderName,
              giftedTo: gift.recipientPhoneNumber,
              originalPrice: gift.itemPrice,
              isGiftSent: false,
              isGiftReceived: true,
              giftId: giftId,
              giftDocId: gift.id // Store the Firestore document ID
            };

            newGiftsToAdd.push(receivedGiftItem);
          }
        }
        
        // Handle sent gifts (current user is sender)
        if (normalizedGiftSender === normalizedUserPhone) {
          const giftId = `sent-${gift.itemId}-${gift.recipientPhoneNumber}`;
          
          // Check if gift already exists in cart using current cart state
          const giftExists = cart.some(item => item.giftId === giftId);
          if (!giftExists) {
            // Add sent gift to cart
            const sentGiftItem = {
              id: gift.itemId,
              name: gift.itemName,
              price: gift.itemPrice, // Sender pays
              image: gift.itemImage,
              description: gift.itemDescription,
              rating: gift.itemRating,
              reviewCount: gift.itemReviewCount,
              quantity: 1,
              isGift: true,
              giftedBy: gift.senderName,
              giftedTo: gift.recipientPhoneNumber,
              giftedToName: gift.recipientName || 'Unknown User',
              originalPrice: gift.itemPrice,
              isGiftSent: true,
              isGiftReceived: false,
              giftId: giftId,
              giftDocId: gift.id // Store the Firestore document ID
            };

            newGiftsToAdd.push(sentGiftItem);
          }
        }
      });
      
      // Add all new gifts at once to avoid multiple re-renders
      if (newGiftsToAdd.length > 0) {
        setCart(prev => {
          const updatedCart = [...prev, ...newGiftsToAdd];
          const deduplicatedCart = deduplicateCart(updatedCart);
          return deduplicatedCart;
        });
      }
    }
  }, [gifts, user?.phoneNumber, cart]); // Added cart dependency

  // Remove cart gifts that are no longer present in Firestore gifts
  useEffect(() => {
    // Get all giftIds from the current gifts state
    const validGiftIds = new Set();
    const normalizePhone = phone => phone?.replace(/[^0-9]/g, '');
    const normalizedUserPhone = normalizePhone(user?.phoneNumber);
    
    gifts.forEach(gift => {
      // Skip test items
      if (gift.itemId === 'test-item') {
        return;
      }
      
      // For received gifts (gift exists in Firestore and user is recipient)
      if (normalizePhone(gift.recipientPhoneNumber) === normalizedUserPhone) {
        const giftId = `received-${gift.itemId}-${gift.senderPhoneNumber}`;
        validGiftIds.add(giftId);
      }
      // For sent gifts (gift exists in Firestore and user is sender)
      if (normalizePhone(gift.senderPhoneNumber) === normalizedUserPhone) {
        const giftId = `sent-${gift.itemId}-${gift.recipientPhoneNumber}`;
        validGiftIds.add(giftId);
      }
    });
    
    // Remove any cart gift items not in validGiftIds, and also remove test items
    setCart(prev => {
      const filteredCart = prev.filter(item => {
        // Remove test items
        if (item.id === 'test-item') {
          return false;
        }
        
        if (!item.isGift) return true;
        const isValid = validGiftIds.has(item.giftId);
        return isValid;
      });
      
      // Apply deduplication to ensure no duplicates remain
      const deduplicatedCart = deduplicateCart(filteredCart);
      return deduplicatedCart;
    });
  }, [gifts, user?.phoneNumber]);

  // Fetch user profile for gift functionality
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.phoneNumber) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.phoneNumber));
        if (userDoc.exists()) {
                  // const profileData = userDoc.data();
        // setUserProfile(profileData);
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    };

    fetchUserProfile();
  }, [user?.phoneNumber]);

  // Fetch gifts for the current user
  useEffect(() => {
    if (!user?.phoneNumber) return;



    // Use the existing index with status and timestamp only
    const giftsQuery = query(
      collection(db, 'gifts'),
      where('status', '==', 'active'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(giftsQuery, (querySnapshot) => {
      const giftsData = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Include all gifts for the current user (both sent and received)
        // The filtering for removed items will be handled in the cart sync useEffect
        if (data.senderPhoneNumber === user.phoneNumber || 
            data.recipientPhoneNumber === user.phoneNumber) {
          giftsData.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      setGifts(giftsData);
    });

    return () => unsubscribe();
  }, [user?.phoneNumber]);

  // Function to handle grouped notifications
  const handleGroupedNotification = React.useCallback(async (newMessage) => {
    const senderPhoneNumber = newMessage.phoneNumber;
    
    // Handle recommendation messages separately - they get special notifications
    if (newMessage.type === 'recommendation') {
      // Only show notification if the current user is NOT the sender
      if (newMessage.phoneNumber !== user.phoneNumber) {
        try {
          const userDoc = await getDoc(doc(db, 'users', senderPhoneNumber));
          let senderName = senderPhoneNumber; // fallback to phone number
          
          if (userDoc.exists()) {
            const profileData = userDoc.data();
            senderName = profileData.name || profileData.displayName || senderPhoneNumber;
          }
          
          // Create recommendation notification
          if (window.addNotification) {
            const itemName = newMessage.recommendedItem;
            const itemPrice = newMessage.recommendedItemPrice;
            const recommendedTo = newMessage.recommendedTo;
            const priceText = itemPrice ? ` ($${itemPrice})` : '';
            
            window.addNotification(
              `${senderName} recommended "${itemName}"${priceText} to ${recommendedTo}`,
              'recommendation',
              6000,
              {
                sender: senderName,
                receiver: recommendedTo,
                itemName: itemName,
                itemPrice: itemPrice,
                isRecommendation: true
              }
            );
          }
        } catch (error) {
          console.error("Error handling recommendation notification:", error);
        }
      }
      
      return; // Don't process as regular chat message
    }
    
    // Handle gift messages separately - they get special notifications
    if (newMessage.type === 'gift') {
      // Only show notification if the current user is NOT the sender
      if (newMessage.phoneNumber !== user.phoneNumber) {
        try {
          const userDoc = await getDoc(doc(db, 'users', senderPhoneNumber));
          let senderName = senderPhoneNumber; // fallback to phone number
          
          if (userDoc.exists()) {
            const profileData = userDoc.data();
            senderName = profileData.name || profileData.displayName || senderPhoneNumber;
          }
          
          // Create gift notification
          if (window.addNotification) {
            const itemName = newMessage.giftedItem;
            const itemPrice = newMessage.giftedItemPrice;
            const giftedTo = newMessage.giftedTo;
            const priceText = itemPrice ? ` ($${itemPrice})` : '';
            
            window.addNotification(
              `${senderName} gifted "${itemName}"${priceText} to ${giftedTo}`,
              'gift',
              6000,
              {
                sender: senderName,
                receiver: giftedTo,
                itemName: itemName,
                itemPrice: itemPrice,
                isGift: true
              }
            );
          }
        } catch (error) {
          console.error("Error handling gift notification:", error);
        }
      }
      
      return; // Don't process as regular chat message
    }
    
    try {
      const userDoc = await getDoc(doc(db, 'users', senderPhoneNumber));
      let senderName = senderPhoneNumber; // fallback to phone number
      
      if (userDoc.exists()) {
        const profileData = userDoc.data();
        senderName = profileData.name || profileData.displayName || senderPhoneNumber;
      }
      
      // Increment unread message count
      setUnreadMessageCount(prev => prev + 1);
      
      // Create enhanced message preview for gift messages
      let messagePreview = newMessage.text;
      if (newMessage.type === 'gift' && newMessage.giftedItem && newMessage.giftedTo) {
        // Extract item name and price from the gift message
        const itemName = newMessage.giftedItem;
        const itemPrice = newMessage.giftedItemPrice;
        const giftedTo = newMessage.giftedTo;
        
        // Create a more informative preview with price
        const priceText = itemPrice ? ` ($${itemPrice})` : '';
        messagePreview = `${senderName} gifted "${itemName}"${priceText} to ${giftedTo}`;
      }
      
      // Check if we already have a grouped notification for this sender
      const existingGroup = groupedNotifications[senderPhoneNumber];
      
      if (existingGroup) {
        // Update existing grouped notification
        const updatedGroup = {
          ...existingGroup,
          messageCount: existingGroup.messageCount + 1,
          lastMessage: messagePreview,
          lastMessageTime: new Date()
        };
        
        setGroupedNotifications(prev => ({
          ...prev,
          [senderPhoneNumber]: updatedGroup
        }));
        
        // Clear existing timeout and set new one
        if (notificationTimeouts[senderPhoneNumber]) {
          clearTimeout(notificationTimeouts[senderPhoneNumber]);
        }
        
        const newTimeout = setTimeout(() => {
          // Show the grouped notification
          if (window.addNotification) {
            const messageText = updatedGroup.messageCount === 1 
              ? updatedGroup.lastMessage 
              : `${updatedGroup.messageCount} new messages`;
            
            window.addNotification(
              senderName,
              'message',
              5000,
              {
                sender: senderName,
                messagePreview: messageText,
                isMessage: true
              }
            );
          }
          
          // Clear the grouped notification
          setGroupedNotifications(prev => {
            const newState = { ...prev };
            delete newState[senderPhoneNumber];
            return newState;
          });
          
          setNotificationTimeouts(prev => {
            const newState = { ...prev };
            delete newState[senderPhoneNumber];
            return newState;
          });
        }, 1000); // Wait 1 second before showing notification
        
        setNotificationTimeouts(prev => ({
          ...prev,
          [senderPhoneNumber]: newTimeout
        }));
        
      } else {
        // Create new grouped notification
        const newGroup = {
          senderPhoneNumber,
          senderName,
          messageCount: 1,
          lastMessage: messagePreview,
          lastMessageTime: new Date()
        };
        
        setGroupedNotifications(prev => ({
          ...prev,
          [senderPhoneNumber]: newGroup
        }));
        
        const timeout = setTimeout(() => {
          // Show the grouped notification
          if (window.addNotification) {
            window.addNotification(
              senderName,
              'message',
              5000,
              {
                sender: senderName,
                messagePreview: messagePreview,
                isMessage: true
              }
            );
          }
          
          // Clear the grouped notification
          setGroupedNotifications(prev => {
            const newState = { ...prev };
            delete newState[senderPhoneNumber];
            return newState;
          });
          
          setNotificationTimeouts(prev => {
            const newState = { ...prev };
            delete newState[senderPhoneNumber];
            return newState;
          });
        }, 1000); // Wait 1 second before showing notification
        
        setNotificationTimeouts(prev => ({
          ...prev,
          [senderPhoneNumber]: timeout
        }));
      }
    } catch (error) {
      console.error("Error handling notification:", error);
    }
  }, [user?.phoneNumber, groupedNotifications, notificationTimeouts]);

  // Set up messages subscription once when user is available
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "messages"), orderBy("timestamp"));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const messageList = [];
      let newMessage = null;
      
      querySnapshot.forEach((doc) => {
        const messageData = { id: doc.id, ...doc.data() };
        messageList.push(messageData);
        
        // Check if this is a new message (within last 2 seconds)
        const messageTime = messageData.timestamp?.toDate?.() || new Date(messageData.timestamp);
        const now = new Date();
        const timeDiff = (now - messageTime) / 1000;
        
        if (timeDiff < 2 && messageData.phoneNumber !== user?.phoneNumber) {
          newMessage = messageData;
        }
      });
      
      setMessages(messageList);
      setMessagesLoading(false);
      
      // Show grouped notification for new message if user is not on chat page
      if (newMessage && currentPage !== 'chat') {
        handleGroupedNotification(newMessage);
      }
    });

    return () => unsubscribe();
  }, [user, currentPage, handleGroupedNotification]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      // Clear all notification timeouts
      Object.values(notificationTimeouts).forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
    };
  }, [notificationTimeouts]);

  // Listen for typing indicators
  useEffect(() => {
    if (!user?.phoneNumber) return;

    const typingRef = doc(db, 'typing', 'chat');
    const unsubscribe = onSnapshot(typingRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const typing = [];
        // let newTypingUser = null;
        
        Object.entries(data).forEach(([phoneNumber, userData]) => {
          if (phoneNumber !== user.phoneNumber && userData?.isTyping) {
            // Check if typing status is recent (within 5 seconds)
            const timestamp = userData.timestamp?.toDate?.();
            const now = new Date();
            const timeDiff = timestamp ? (now - timestamp) / 1000 : 0;
            
            if (timeDiff < 5) {
              typing.push({
                phoneNumber,
                name: userData.name
              });
              
              // Check if this is a new typing indicator (within last 1 second)
              if (timeDiff < 1) {
                // newTypingUser = userData.name || phoneNumber;
              }
            }
          }
        });
        
        setTypingUsers(typing);
        
        // Removed typing notifications - only show message notifications from other users
      } else {
        setTypingUsers([]);
      }
    });

    return () => unsubscribe();
  }, [user?.phoneNumber, currentPage]);

  const handleLoginSuccess = () => {
    // Get the user from localStorage and update state
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('lastActiveTab');
    localStorage.removeItem('wishlist');
    setUser(null);
    setWishlist([]);
  };

  const addToWishlist = (item) => {
    setWishlist(prev => {
      const exists = prev.find(wishlistItem => wishlistItem.id === item.id);
      if (!exists) {
        // Show success notification
        if (window.addNotification) {
          window.addNotification(`${item.name} added to wishlist!`, 'error', 3000);
        }
        return [...prev, item];
      }
      return prev;
    });
  };

  const removeFromWishlist = (itemId) => {
    setWishlist(prev => {
      const itemToRemove = prev.find(item => item.id === itemId);
      if (itemToRemove && window.addNotification) {
        window.addNotification(`${itemToRemove.name} removed from wishlist`, 'info', 3000);
      }
      return prev.filter(item => item.id !== itemId);
    });
  };

  const isInWishlist = (itemId) => {
    return wishlist.some(item => item.id === itemId);
  };

  // Cart management functions
  const addToCart = (item, quantity = 1) => {
    setCart(prev => {
      // Check for existing item with same id AND same type (gift vs regular)
      const existingItem = prev.find(cartItem => 
        cartItem.id === item.id && cartItem.isGift === item.isGift
      );
      
      if (existingItem) {
        // Update quantity if item already exists (same id AND same type)
        return prev.map(cartItem => 
          cartItem.id === item.id && cartItem.isGift === item.isGift
            ? { ...cartItem, quantity: cartItem.quantity + quantity }
            : cartItem
        );
      } else {
        // Add new item to cart
        return [...prev, { ...item, quantity }];
      }
    });
    
    if (window.addNotification) {
      window.addNotification(`${item.name} added to cart`, 'success', 3000);
    }
  };

  const removeFromCart = (itemId) => {
    setCart(prev => {
      const itemToRemove = prev.find(item => {
        const itemIdentifier = item.giftId || item.id;
        return itemIdentifier === itemId;
      });
      
      if (itemToRemove && window.addNotification) {
        window.addNotification(`${itemToRemove.name} removed from cart`, 'info', 3000);
      }
      
      // If it's a gift, delete it from Firestore completely
      if (itemToRemove?.giftDocId) {
        // Delete the gift document from Firestore
        deleteDoc(doc(db, 'gifts', itemToRemove.giftDocId)).catch(error => {
          console.error('Error deleting gift from Firestore:', error);
          if (window.addNotification) {
            window.addNotification('Failed to remove gift', 'error', 3000);
          }
        });
      }
      
      return prev.filter(item => {
        const itemIdentifier = item.giftId || item.id;
        return itemIdentifier !== itemId;
      });
    });
  };

  const updateCartQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    
    setCart(prev => 
      prev.map(item => {
        const itemIdentifier = item.giftId || item.id;
        if (itemIdentifier === itemId) {
          // For gift items, always keep quantity at 1
          if (item.isGift) {
            return { ...item, quantity: 1 };
          }
          // For regular items, allow quantity changes
          return { ...item, quantity: newQuantity };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setCart([]);
    if (window.addNotification) {
      window.addNotification('Cart cleared', 'info', 3000);
    }
  };

  const getCartItemCount = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };



  // Add gift to Firestore and handle cart updates
  const addGiftToCart = async (item, recipientPhoneNumber, senderName, recipientName) => {
    try {
      // Check if this gift already exists in Firestore
      const existingGiftQuery = query(
        collection(db, 'gifts'),
        where('itemId', '==', item.id),
        where('senderPhoneNumber', '==', user.phoneNumber),
        where('recipientPhoneNumber', '==', recipientPhoneNumber),
        where('status', '==', 'active')
      );
      
      const existingGiftSnapshot = await getDocs(existingGiftQuery);
      
      if (!existingGiftSnapshot.empty) {
        // Gift already exists, show error message
        if (window.addNotification) {
          window.addNotification('You cannot gift the same item twice to the same person', 'error', 3000);
        }
        return false; // Return false to indicate failure
      }

      // Store gift in Firestore
      const giftData = {
        itemId: item.id,
        itemName: item.name,
        itemPrice: item.price,
        itemImage: item.image,
        itemDescription: item.description,
        itemRating: item.rating,
        itemReviewCount: item.reviewCount,
        senderPhoneNumber: user.phoneNumber,
        senderName: senderName,
        recipientPhoneNumber: recipientPhoneNumber,
        recipientName: recipientName,
        timestamp: serverTimestamp(),
        status: 'active',
        removedBySender: false,
        removedByReceiver: false
      };

      const giftDocRef = await addDoc(collection(db, 'gifts'), giftData);

      // Add gift to sender's cart (they pay for it)
      const senderGiftItem = {
        ...item,
        quantity: 1,
        isGift: true,
        giftedBy: senderName,
        giftedTo: recipientPhoneNumber,
        giftedToName: recipientName,
        originalPrice: item.price,
        isGiftSent: true,
        isGiftReceived: false,
        price: item.price, // Sender pays
        giftId: `sent-${item.id}-${recipientPhoneNumber}`,
        giftDocId: giftDocRef.id // Store the Firestore document ID
      };

      setCart(prev => {
        const existingItem = prev.find(cartItem => 
          cartItem.giftId === senderGiftItem.giftId
        );
        
        if (existingItem) {
          // Gift already exists, keep quantity at 1 (don't increment)
          return prev;
        } else {
          // Add new gift with quantity 1
          return [...prev, senderGiftItem];
        }
      });

      // Show success message
      if (window.addNotification) {
        window.addNotification(`Gift sent to ${recipientName}!`, 'success', 3000);
      }

      return true; // Return true to indicate success

    } catch (error) {
      console.error("Error adding gift:", error);
      if (window.addNotification) {
        window.addNotification('Failed to send gift', 'error', 3000);
      }
      return false; // Return false to indicate failure
    }
  };

  // Get unique chat participants from messages with profile data
  const getChatParticipants = async () => {
    const uniqueParticipants = new Map();
    
    // First, collect unique phone numbers from messages
    messages.forEach(message => {
      if (message.phoneNumber && message.phoneNumber !== user?.phoneNumber) {
        if (!uniqueParticipants.has(message.phoneNumber)) {
          uniqueParticipants.set(message.phoneNumber, {
            id: message.phoneNumber,
            phoneNumber: message.phoneNumber,
            name: message.name || 'Unknown User'
          });
        }
      }
    });
    
    // Try to fetch actual profile data for each participant
    const participantsWithProfiles = [];
    for (const [phoneNumber, participant] of uniqueParticipants) {
      try {
        const userDoc = await getDoc(doc(db, 'users', phoneNumber));
        if (userDoc.exists()) {
          const profileData = userDoc.data();
          participantsWithProfiles.push({
            ...participant,
            name: profileData.name || participant.name,
            photoURL: profileData.photoURL
          });
        } else {
          participantsWithProfiles.push(participant);
        }
      } catch (error) {
        console.error("Error fetching profile for:", phoneNumber, error);
        participantsWithProfiles.push(participant);
      }
    }
    
    return participantsWithProfiles;
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(tab);
    
    // Reset unread count when switching to chat page
    if (tab === 'chat') {
      setUnreadMessageCount(0);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'menu':
        return <Menu 
          user={user} 
          onLogout={handleLogout} 
          wishlist={wishlist}
          addToWishlist={addToWishlist}
          removeFromWishlist={removeFromWishlist}
          isInWishlist={isInWishlist}
          addToCart={addToCart}
          addGiftToCart={addGiftToCart}
          getChatParticipants={getChatParticipants}
        />;
      case 'chat':
        return <ChatRoom user={user} messages={messages} loading={messagesLoading} typingUsers={typingUsers} onLogout={handleLogout} />;
      case 'wishlist':
        return <Wishlist 
          user={user} 
          onLogout={handleLogout} 
          wishlist={wishlist}
          removeFromWishlist={removeFromWishlist}
          isInWishlist={isInWishlist}
        />;
      case 'cart':
        return <Cart 
          user={user} 
          onLogout={handleLogout} 
          cart={cart}
          removeFromCart={removeFromCart}
          updateCartQuantity={updateCartQuantity}
          clearCart={clearCart}
        />;
      default:
        return <ChatRoom user={user} messages={messages} loading={messagesLoading} typingUsers={typingUsers} onLogout={handleLogout} />;
    }
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="App">
      <NotificationSystem />
      {user ? (
        <>
          {/* <Navbar user={user} onLogout={handleLogout} /> */}
          <main className="main-content">
            {renderContent()}
          </main>
          <BottomNav 
            activeTab={activeTab} 
            onTabChange={handleTabChange} 
            typingUsers={typingUsers}
            wishlistCount={wishlist.length}
            unreadMessageCount={unreadMessageCount}
            cartCount={getCartItemCount()}
          />
          

        </>
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}

export default App; 
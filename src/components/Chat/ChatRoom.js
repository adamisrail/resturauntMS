import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import Profile from '../Navigation/Profile';
import './ChatRoom.css';

const ChatRoom = ({ user, messages = [], loading = true, typingUsers = [], onLogout, tableNumber }) => {
  const [newMessage, setNewMessage] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [userProfiles, setUserProfiles] = useState({});
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch user profile from Firestore
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
  }, [user?.phoneNumber]); // Only re-run if phone number changes

  // Fetch profiles for all users in messages
  const fetchUserProfiles = useCallback(async () => {
      const uniquePhoneNumbers = [...new Set(messages.map(msg => msg.phoneNumber))];
      const profiles = {};
      
      for (const phoneNumber of uniquePhoneNumbers) {
        if (phoneNumber && !userProfiles[phoneNumber]) {
          try {
            const userDoc = await getDoc(doc(db, 'users', phoneNumber));
            if (userDoc.exists()) {
              profiles[phoneNumber] = userDoc.data();
            }
          } catch (error) {
            console.error("Error fetching profile for:", phoneNumber, error);
          }
        }
      }
      
      if (Object.keys(profiles).length > 0) {
        setUserProfiles(prev => ({ ...prev, ...profiles }));
      }
  }, [messages, userProfiles]);

  useEffect(() => {
    if (messages.length > 0) {
      fetchUserProfiles();
    }
  }, [fetchUserProfiles, messages.length]);

  // Removed welcome notification - only show notifications for messages from other users

  const generateRainbowAvatar = (name) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    const index = name ? name.charCodeAt(0) % colors.length : 0;
    return colors[index];
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    
    const messageDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInMs = now - messageDate;
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
    
    // Format time as HH:MM AM/PM
    const timeString = messageDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    // If message is from today, show only time
    if (messageDate.toDateString() === now.toDateString()) {
      return timeString;
    }
    
    // If message is from yesterday, show "Yesterday"
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    // If message is within last 7 days, show day name
    if (diffInDays < 7) {
      return messageDate.toLocaleDateString('en-US', { weekday: 'short' });
    }
    
    // If message is from this year, show date without year
    if (messageDate.getFullYear() === now.getFullYear()) {
      return messageDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
    
    // If message is from different year, show full date
    return messageDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderUserAvatar = (message) => {
    const profile = userProfiles[message.phoneNumber];
    const displayName = profile?.name || message.displayName || message.phoneNumber;
    const profileColor = generateRainbowAvatar(displayName);
    const initials = getInitials(displayName);

    return (
      <div 
        className="message-avatar"
        style={{ backgroundColor: profileColor }}
      >
        {message.photoURL ? (
          <img 
            src={message.photoURL} 
            alt="Profile" 
            className="avatar-image"
          />
        ) : (
          <span className="avatar-initials">{initials}</span>
        )}
      </div>
    );
  };





  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (newMessage.trim() === '') return;

    try {
      const messageData = {
        text: newMessage,
        timestamp: serverTimestamp(),
        uid: user.uid || user.phoneNumber,
        phoneNumber: user.phoneNumber,
        displayName: userProfile?.name || user.displayName || user.phoneNumber,
        photoURL: user.photoURL || null,
        tableNumber: tableNumber || 'Table 1',
        tableId: `table-${tableNumber || '1'}`
      };
      
      // Use table-specific collection for messages
      const collectionName = tableNumber ? `messages-table-${tableNumber}` : 'messages';
      await addDoc(collection(db, collectionName), messageData);
      
      setNewMessage('');
      setIsTyping(false);
      updateTypingStatus(false);
      
      // Removed success notification - only show notifications for messages from other users
    } catch (error) {
      console.error("Error sending message: ", error);
      
      // Removed error notification - only show notifications for messages from other users
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setNewMessage(value);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Update typing status with debouncing
    if (!isTyping && value.trim()) {
      setIsTyping(true);
      updateTypingStatus(true);
    } else if (isTyping && !value.trim()) {
      setIsTyping(false);
      updateTypingStatus(false);
    } else if (isTyping && value.trim()) {
      // Set timeout to stop typing indicator after 1.5 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        updateTypingStatus(false);
      }, 1500);
    }
  };

  // Add timeout when user stops typing but still has text
  const handleInputBlur = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isTyping) {
      // Set a shorter timeout when user leaves the input field
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        updateTypingStatus(false);
      }, 1000);
    }
  };

  // Clear typing status when user focuses back on input
  const handleInputFocus = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (newMessage.trim() && !isTyping) {
      setIsTyping(true);
      updateTypingStatus(true);
    }
  };

  const updateTypingStatus = useCallback(async (typing) => {
    if (!user?.phoneNumber) return;
    
    try {
      // Use table-specific typing status
      const typingRef = doc(db, 'typing', tableNumber ? `table-${tableNumber}` : 'chat');
      await setDoc(typingRef, {
        [user.phoneNumber]: typing ? {
          isTyping: true,
          timestamp: serverTimestamp(),
          name: userProfile?.name || user.displayName || user.phoneNumber,
          tableNumber: tableNumber || 'Table 1'
        } : null
      }, { merge: true });
    } catch (error) {
      console.error("Error updating typing status:", error);
    }
  }, [user?.phoneNumber, userProfile?.name, user?.displayName, tableNumber]);



  // Clear typing status when component unmounts or user changes
  useEffect(() => {
    return () => {
      if (isTyping) {
        updateTypingStatus(false);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [isTyping, user?.phoneNumber, updateTypingStatus]);

  // Force stop typing after 5 seconds of no activity
  useEffect(() => {
    if (isTyping) {
      const forceStopTimeout = setTimeout(() => {
        setIsTyping(false);
        updateTypingStatus(false);
      }, 5000);

      return () => clearTimeout(forceStopTimeout);
    }
  }, [isTyping, updateTypingStatus]);



  if (loading) {
    return <div className="chat-loading">Loading messages...</div>;
  }

  return (
    <div className="chat-room">
      {/* Header with Logo */}
      <div className="chat-header">
        <div className="logo-container">
          <img 
            src="/58c33377dfcbb3022493dec49d098b02.jpg" 
            alt="Restaurant Logo" 
            className="restaurant-logo"
          />
        </div>
        <div className="chat-title">
          <h2>Chat Room</h2>
          {/* Typing Indicator - Positioned in header below title */}
          {typingUsers.length > 0 && (
            <div className="typing-indicator">
              <div className="typing-content">
                <div className="typing-text">
                  {typingUsers.length === 1 
                    ? `${typingUsers[0].name} is typing`
                    : `${typingUsers.length} people are typing`
                  }
                </div>
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
        </div>
        <Profile user={user} onLogout={onLogout} />
      </div>

      <div className="messages-container">
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={`message ${message.uid === user?.uid ? 'sent' : 'received'}`}
          >
            {message.uid !== user?.uid && (
              <div className="message-avatar-container">
                {renderUserAvatar(message)}
              </div>
            )}
            <div className="message-content">
              <div className="message-header">
                <span className="message-author">{message.displayName}</span>
                <span className="message-time">
                  {formatMessageTime(message.timestamp)}
                </span>
              </div>
              <div className="message-text">{message.text}</div>
            </div>
          </div>
        ))}
        
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={sendMessage} className="message-form">
        <input
          type="text"
          value={newMessage}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          onBlur={handleInputBlur}
          onFocus={handleInputFocus}
          placeholder="Type a message"
          className="message-input"
        />
        <button type="submit" className="send-button">
          ➤
        </button>
      </form>
    </div>
  );
};

export default ChatRoom; 
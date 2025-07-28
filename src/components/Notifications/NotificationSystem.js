import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './NotificationSystem.css';

const NotificationSystem = () => {
  const [notifications, setNotifications] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  const timeoutsRef = useRef(new Map());
  const dragStateRef = useRef({ isDragging: false, currentId: null, startPos: null });
  const rafRef = useRef(null);

  // Limit notifications to prevent memory issues
  const MAX_NOTIFICATIONS = 5;
  const DRAG_THRESHOLD = 60;

  // Optimized add notification function
  const addNotification = useCallback((message, type = 'info', duration = 4000, options = {}) => {
    // Use setTimeout to ensure this runs after render
    setTimeout(() => {
      const id = Date.now() + Math.random();
      const newNotification = {
        id,
        message,
        type,
        duration,
        // Only include essential fields
        sender: options.sender || null,
        messagePreview: options.messagePreview || null,
        isMessage: type === 'message' || options.isMessage || false
      };

      setNotifications(prev => {
        let updated;
        
        if (type === 'message') {
          // Replace chat notifications
          const nonChat = prev.filter(n => n.type !== 'message');
          updated = [newNotification, ...nonChat];
        } else {
          // Add to beginning, limit total count
          updated = [newNotification, ...prev].slice(0, MAX_NOTIFICATIONS);
        }
        
        return updated;
      });
      
      setIsVisible(true);

      // Set timeout
      if (duration > 0) {
        const timeoutId = setTimeout(() => {
          const timeoutId = timeoutsRef.current.get(id);
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutsRef.current.delete(id);
          }

          setNotifications(prev => {
            const updated = prev.filter(n => n.id !== id);
            if (updated.length === 0) {
              setIsVisible(false);
            }
            return updated;
          });
        }, duration);
        timeoutsRef.current.set(id, timeoutId);
      }
    }, 0);
  }, []);

  const removeNotification = useCallback((id) => {
    const timeoutId = timeoutsRef.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutsRef.current.delete(id);
    }

    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id);
      if (updated.length === 0) {
        setIsVisible(false);
      }
      return updated;
    });
  }, []);

  // Optimized drag handlers with RAF for performance
  const handleMouseDown = useCallback((e, id) => {
    e.stopPropagation();
    dragStateRef.current = {
      isDragging: true,
      currentId: id,
      startPos: { x: e.clientX, y: e.clientY }
    };
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!dragStateRef.current.isDragging) return;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      const { startPos } = dragStateRef.current;
      const deltaX = e.clientX - startPos.x;
      const deltaY = e.clientY - startPos.y;
      
      if (Math.abs(deltaX) > DRAG_THRESHOLD || deltaY < -DRAG_THRESHOLD) {
        removeNotification(dragStateRef.current.currentId);
        dragStateRef.current = { isDragging: false, currentId: null, startPos: null };
      }
    });
  }, [removeNotification]);

  const handleMouseUp = useCallback(() => {
    dragStateRef.current = { isDragging: false, currentId: null, startPos: null };
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
  }, []);

  // Memoized icon and class functions
  const getNotificationIcon = useMemo(() => ({
    success: '✅',
    error: '❌',
    warning: '⚠️',
    message: '📱',
    info: 'ℹ️',
    recommendation: '💡',
    gift: '🎁'
  }), []);

  const getNotificationClass = useMemo(() => ({
    success: 'notification-success',
    error: 'notification-error',
    warning: 'notification-warning',
    message: 'notification-message',
    info: 'notification-info',
    recommendation: 'notification-recommendation',
    gift: 'notification-gift'
  }), []);

  // Global notification function
  useEffect(() => {
    window.addNotification = addNotification;
    return () => {
      delete window.addNotification;
    };
  }, []); // Remove addNotification dependency to prevent re-running

  // Cleanup on unmount
  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach(timeoutId => clearTimeout(timeoutId));
      timeouts.clear();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Global mouse event listeners for drag
  useEffect(() => {
    if (isVisible) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleMouseMove, { passive: false });
      document.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [isVisible, handleMouseMove, handleMouseUp]);

  if (!isVisible || notifications.length === 0) {
    return null;
  }

  return (
    <div className="notification-system">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification-item ${getNotificationClass[notification.type] || getNotificationClass.info}`}
          data-type={notification.type}
          onMouseDown={(e) => handleMouseDown(e, notification.id)}
          onTouchStart={(e) => handleMouseDown(e, notification.id)}
        >
          <div className="notification-content">
            <div className="notification-icon">
              {getNotificationIcon[notification.type] || getNotificationIcon.info}
            </div>
            <div className="notification-message">
              {notification.isRecommendation && notification.sender && notification.receiver ? (
                <div className="recommendation-notification">
                  <div className="recommendation-sender">{notification.sender}</div>
                  <div className="recommendation-preview">
                    recommended "{notification.itemName}" (${notification.itemPrice}) to {notification.receiver}
                  </div>
                </div>
              ) : notification.isGift && notification.sender && notification.receiver ? (
                <div className="gift-notification">
                  <div className="gift-sender">{notification.sender}</div>
                  <div className="gift-preview">
                    gifted "{notification.itemName}" (${notification.itemPrice}) to {notification.receiver}
                  </div>
                </div>
              ) : notification.isMessage && notification.sender ? (
                <div className="message-notification">
                  <div className="message-sender">{notification.sender}</div>
                  <div className="message-preview">{notification.messagePreview || notification.message}</div>
                </div>
              ) : (
                notification.message
              )}
            </div>
          </div>
          {notification.duration > 0 && (
            <div className="notification-progress">
              <div 
                className="notification-progress-bar"
                style={{ animationDuration: `${notification.duration}ms` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default NotificationSystem; 
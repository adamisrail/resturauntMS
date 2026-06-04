import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, Navigate } from 'react-router-dom';
import { collection, orderBy, query, onSnapshot, doc, getDoc, addDoc, deleteDoc, serverTimestamp, where, getDocs } from 'firebase/firestore';
import { db } from './firebase/config';
import { StoreProvider } from './contexts/StoreContext';
import Login from './components/Auth/Login';
import AdminPanel from './components/Admin/AdminPanel';
import JoinStore from './components/Store/JoinStore';
import Table from './components/Pages/Table';
import TableSelector from './components/Pages/TableSelector';
import SuperAdmin from './components/SuperAdmin/SuperAdmin';
import NotificationSystem from './components/Notifications/NotificationSystem';
import './App.css';

// ---------------------------------------------------------------------------
// StoreRoutes — nested under /:storeSlug
// Table + TableSelector are PUBLIC. Admin requires login.
// ---------------------------------------------------------------------------
function StoreRoutes(props) {
  const { storeSlug } = useParams();
  return (
    <StoreProvider storeSlug={storeSlug}>
      <Routes>
        {/* PUBLIC */}
        <Route path="/" element={<TableSelector />} />
        <Route path="/table/:tableNumber" element={<Table {...props} />} />
        <Route path="/join" element={<JoinStore user={props.user} />} />

        {/* PROTECTED — redirects to /login if not logged in */}
        <Route
          path="/admin"
          element={
            <RequireAuth user={props.user} redirectTo={`/${storeSlug}/admin`}>
              <AdminPanel user={props.user} onLogout={props.onLogout} />
            </RequireAuth>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </StoreProvider>
  );
}

// ---------------------------------------------------------------------------
// RequireAuth — redirects to /login if user is not logged in
// ---------------------------------------------------------------------------
function RequireAuth({ user, children, redirectTo }) {
  if (!user) {
    const dest = redirectTo || window.location.pathname;
    window.location.href = `/login?redirect=${encodeURIComponent(dest)}`;
    return null;
  }
  return children;
}

// ---------------------------------------------------------------------------
// AppRoutes — lives inside the Router
// ---------------------------------------------------------------------------
function AppRoutes({ user, handleLoginSuccess, handleLogout, ...rest }) {
  return (
    <>
      <NotificationSystem />
      <Routes>
        {/* "/" — requires login, redirects to /login if not authenticated */}
        <Route path="/" element={
          user
            ? <StoreProvider storeSlug={null}><TableSelector /></StoreProvider>
            : <Navigate to="/login" replace />
        } />

        <Route path="/table/:tableNumber" element={
          <StoreProvider storeSlug={null}>
            <Table user={user} onLogout={handleLogout} {...rest} />
          </StoreProvider>
        } />

        {/* Dedicated login page */}
        <Route path="/login" element={
          <Login onLoginSuccess={(slug) => {
            handleLoginSuccess(slug);
            const params = new URLSearchParams(window.location.search);
            const redirect = params.get('redirect');
            if (redirect) window.location.href = redirect;
          }} />
        } />

        {/* Legacy redirects */}
        <Route path="/table1" element={<Navigate to="/table/1" replace />} />
        <Route path="/table2" element={<Navigate to="/table/2" replace />} />

        {/* /admin — SuperAdmin has its own password gate, always render it */}
        <Route path="/admin" element={<SuperAdmin />} />

        {/* Store-scoped routes */}
        <Route
          path="/:storeSlug/*"
          element={
            <StoreRoutes
              user={user}
              onLogout={handleLogout}
              handleLoginSuccess={handleLoginSuccess}
              {...rest}
            />
          }
        />
      </Routes>
    </>
  );
}

// ---------------------------------------------------------------------------
// App — auth + global state, wraps the router
// ---------------------------------------------------------------------------
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('lastActiveTab') || 'menu');
  const [currentPage, setCurrentPage] = useState('menu');
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);
  const [groupedNotifications, setGroupedNotifications] = useState({});
  const [notificationTimeouts, setNotificationTimeouts] = useState({});

  const [wishlist, setWishlist] = useState(() => {
    const saved = localStorage.getItem('wishlist');
    return saved ? JSON.parse(saved) : [];
  });

  const deduplicateCart = (items) => {
    const seen = new Set();
    return items.filter(item => {
      const key = `${item.id}-${item.isGift ? 'gift' : 'regular'}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('cart');
    return saved ? deduplicateCart(JSON.parse(saved)) : [];
  });

  const [gifts, setGifts] = useState([]);
  const [menuProducts, setMenuProducts] = useState({});
  const [menuProductsLoaded, setMenuProductsLoaded] = useState(false);
  const [menuProductsLoading, setMenuProductsLoading] = useState(false);
  const [menuProductsStoreId, setMenuProductsStoreId] = useState(null);

  // Persist state
  useEffect(() => { localStorage.setItem('lastActiveTab', activeTab); }, [activeTab]);
  useEffect(() => { localStorage.setItem('wishlist', JSON.stringify(wishlist)); }, [wishlist]);
  useEffect(() => { localStorage.setItem('cart', JSON.stringify(cart)); }, [cart]);

  // Restore session
  useEffect(() => {
    const saved = localStorage.getItem('currentUser');
    if (saved) setUser(JSON.parse(saved));
    setLoading(false);
  }, []);

  // Gift → cart sync
  useEffect(() => {
    if (!user?.phoneNumber || gifts.length === 0) return;
    const norm = p => p?.replace(/[^0-9]/g, '');
    const me = norm(user.phoneNumber);

    setCart(prev => {
      const toAdd = [];
      gifts.forEach(gift => {
        if (gift.itemId === 'test-item') return;
        if (norm(gift.recipientPhoneNumber) === me) {
          const giftId = `received-${gift.itemId}-${gift.senderPhoneNumber}`;
          if (!prev.some(i => i.giftId === giftId)) {
            toAdd.push({ id: gift.itemId, name: gift.itemName, price: 0, image: gift.itemImage, description: gift.itemDescription, rating: gift.itemRating, reviewCount: gift.itemReviewCount, quantity: 1, isGift: true, giftedBy: gift.senderName, giftedTo: gift.recipientPhoneNumber, originalPrice: gift.itemPrice, isGiftSent: false, isGiftReceived: true, giftId, giftDocId: gift.id });
          }
        }
        if (norm(gift.senderPhoneNumber) === me) {
          const giftId = `sent-${gift.itemId}-${gift.recipientPhoneNumber}`;
          if (!prev.some(i => i.giftId === giftId)) {
            toAdd.push({ id: gift.itemId, name: gift.itemName, price: gift.itemPrice, image: gift.itemImage, description: gift.itemDescription, rating: gift.itemRating, reviewCount: gift.itemReviewCount, quantity: 1, isGift: true, giftedBy: gift.senderName, giftedTo: gift.recipientPhoneNumber, giftedToName: gift.recipientName || 'Unknown', originalPrice: gift.itemPrice, isGiftSent: true, isGiftReceived: false, giftId, giftDocId: gift.id });
          }
        }
      });
      if (toAdd.length === 0) return prev;
      return deduplicateCart([...prev, ...toAdd]);
    });
  }, [gifts, user?.phoneNumber]);

  // Remove stale gift cart items
  useEffect(() => {
    const norm = p => p?.replace(/[^0-9]/g, '');
    const me = norm(user?.phoneNumber);
    const valid = new Set();
    gifts.forEach(gift => {
      if (gift.itemId === 'test-item') return;
      if (norm(gift.recipientPhoneNumber) === me) valid.add(`received-${gift.itemId}-${gift.senderPhoneNumber}`);
      if (norm(gift.senderPhoneNumber) === me) valid.add(`sent-${gift.itemId}-${gift.recipientPhoneNumber}`);
    });
    setCart(prev => deduplicateCart(prev.filter(i => i.id !== 'test-item' && (!i.isGift || valid.has(i.giftId)))));
  }, [gifts, user?.phoneNumber]);

  // Gifts subscription
  useEffect(() => {
    if (!user?.phoneNumber) return;
    const q = query(collection(db, 'gifts'), where('status', '==', 'active'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, snapshot => {
      const data = [];
      snapshot.forEach(d => {
        const g = d.data();
        if (g.senderPhoneNumber === user.phoneNumber || g.recipientPhoneNumber === user.phoneNumber) {
          data.push({ id: d.id, ...g });
        }
      });
      setGifts(data);
    });
    return unsub;
  }, [user?.phoneNumber]);

  // Grouped notification helper
  const handleGroupedNotification = React.useCallback(async (newMessage) => {
    const sender = newMessage.phoneNumber;

    if (newMessage.type === 'recommendation' && sender !== user.phoneNumber) {
      const userDoc = await getDoc(doc(db, 'users', sender)).catch(() => null);
      const name = userDoc?.exists() ? (userDoc.data().name || sender) : sender;
      if (window.addNotification) {
        window.addNotification(`${name} recommended "${newMessage.recommendedItem}"`, 'recommendation', 6000, { sender: name, isRecommendation: true });
      }
      return;
    }

    if (newMessage.type === 'gift' && sender !== user.phoneNumber) {
      const userDoc = await getDoc(doc(db, 'users', sender)).catch(() => null);
      const name = userDoc?.exists() ? (userDoc.data().name || sender) : sender;
      if (window.addNotification) {
        window.addNotification(`${name} gifted "${newMessage.giftedItem}"`, 'gift', 6000, { sender: name, isGift: true });
      }
      return;
    }

    if (newMessage.type === 'recommendation' || newMessage.type === 'gift') return;

    try {
      const userDoc = await getDoc(doc(db, 'users', sender));
      const senderName = userDoc.exists() ? (userDoc.data().name || sender) : sender;
      setUnreadMessageCount(p => p + 1);

      const existing = groupedNotifications[sender];
      const count = existing ? existing.messageCount + 1 : 1;
      setGroupedNotifications(prev => ({ ...prev, [sender]: { senderPhoneNumber: sender, senderName, messageCount: count, lastMessage: newMessage.text, lastMessageTime: new Date() } }));

      if (notificationTimeouts[sender]) clearTimeout(notificationTimeouts[sender]);
      const t = setTimeout(() => {
        if (window.addNotification) {
          window.addNotification(senderName, 'message', 5000, { sender: senderName, messagePreview: count > 1 ? `${count} new messages` : newMessage.text, isMessage: true });
        }
        setGroupedNotifications(p => { const n = { ...p }; delete n[sender]; return n; });
        setNotificationTimeouts(p => { const n = { ...p }; delete n[sender]; return n; });
      }, 1000);
      setNotificationTimeouts(prev => ({ ...prev, [sender]: t }));
    } catch (e) { console.error(e); }
  }, [user?.phoneNumber, groupedNotifications, notificationTimeouts]);

  // Messages subscription
  useEffect(() => {
    if (!user) return;
    const tableNumber = user.tableNumber || user.tableId?.replace('table-', '') || null;
    const col = tableNumber ? `messages-table-${tableNumber}` : 'messages';
    const q = query(collection(db, col), orderBy('timestamp'));
    const unsub = onSnapshot(q, snapshot => {
      const list = [];
      let newMsg = null;
      snapshot.forEach(d => {
        const m = { id: d.id, ...d.data() };
        list.push(m);
        const t = m.timestamp?.toDate?.() || new Date(m.timestamp);
        if ((Date.now() - t) / 1000 < 2 && m.phoneNumber !== user.phoneNumber) newMsg = m;
      });
      setMessages(list);
      setMessagesLoading(false);
      if (newMsg && currentPage !== 'chat') handleGroupedNotification(newMsg);
    });
    return unsub;
  }, [user, currentPage, handleGroupedNotification]);

  // Typing subscription
  useEffect(() => {
    if (!user?.phoneNumber) return;
    const tableNumber = user.tableNumber || user.tableId?.replace('table-', '') || null;
    const docName = tableNumber ? `table-${tableNumber}` : 'chat';
    const unsub = onSnapshot(doc(db, 'typing', docName), d => {
      if (!d.exists()) { setTypingUsers([]); return; }
      const data = d.data();
      const typing = [];
      Object.entries(data).forEach(([phone, u]) => {
        if (phone !== user.phoneNumber && u?.isTyping) {
          const ts = u.timestamp?.toDate?.();
          if (!ts || (Date.now() - ts) / 1000 < 5) typing.push({ phoneNumber: phone, name: u.name });
        }
      });
      setTypingUsers(typing);
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.phoneNumber, user?.tableNumber, user?.tableId, currentPage]);

  useEffect(() => () => Object.values(notificationTimeouts).forEach(clearTimeout), [notificationTimeouts]);

  const handleLoginSuccess = (storeSlug) => {
    const saved = localStorage.getItem('currentUser');
    if (saved) {
      const u = JSON.parse(saved);
      setUser(u);
      // Staff login → redirect straight to their store admin
      if (storeSlug) {
        window.location.href = `/${storeSlug}/admin`;
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('lastActiveTab');
    localStorage.removeItem('wishlist');
    setUser(null);
    setWishlist([]);
  };

  // Wishlist helpers
  const addToWishlist = (item) => setWishlist(prev => {
    const id = item.id || `item-${item.name}-${item.price}`;
    if (prev.some(i => (i.id || `item-${i.name}-${i.price}`) === id)) return prev;
    if (window.addNotification) window.addNotification(`${item.name} added to wishlist!`, 'success', 3000);
    return [...prev, item];
  });

  const removeFromWishlist = (itemId) => setWishlist(prev => {
    const item = prev.find(i => (i.id || `item-${i.name}-${i.price}`) === itemId);
    if (item && window.addNotification) window.addNotification(`${item.name} removed from wishlist`, 'info', 3000);
    return prev.filter(i => (i.id || `item-${i.name}-${i.price}`) !== itemId);
  });

  const isInWishlist = (itemId) => wishlist.some(i => (i.id || `item-${i.name}-${i.price}`) === itemId);

  // Cart helpers
  const addToCart = (item, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id && c.isGift === item.isGift);
      if (existing) return prev.map(c => c.id === item.id && c.isGift === item.isGift ? { ...c, quantity: c.quantity + quantity } : c);
      return [...prev, { ...item, quantity }];
    });
    if (window.addNotification) window.addNotification(`${item.name} added to cart`, 'success', 3000);
  };

  const removeFromCart = (itemId) => setCart(prev => {
    const item = prev.find(i => (i.giftId || i.id) === itemId);
    if (item && window.addNotification) window.addNotification(`${item.name} removed from cart`, 'info', 3000);
    if (item?.giftDocId) deleteDoc(doc(db, 'gifts', item.giftDocId)).catch(console.error);
    return prev.filter(i => (i.giftId || i.id) !== itemId);
  });

  const updateCartQuantity = (itemId, qty) => {
    if (qty <= 0) { removeFromCart(itemId); return; }
    setCart(prev => prev.map(i => (i.giftId || i.id) === itemId ? { ...i, quantity: i.isGift ? 1 : qty } : i));
  };

  const clearCart = () => { setCart([]); if (window.addNotification) window.addNotification('Cart cleared', 'info', 3000); };
  const getCartItemCount = () => cart.reduce((s, i) => s + i.quantity, 0);

  const addGiftToCart = async (item, recipientPhoneNumber, senderName, recipientName) => {
    try {
      const existing = await getDocs(query(collection(db, 'gifts'), where('itemId', '==', item.id), where('senderPhoneNumber', '==', user.phoneNumber), where('recipientPhoneNumber', '==', recipientPhoneNumber), where('status', '==', 'active')));
      if (!existing.empty) {
        if (window.addNotification) window.addNotification('You already gifted this item to this person', 'error', 3000);
        return false;
      }
      const ref = await addDoc(collection(db, 'gifts'), { itemId: item.id, itemName: item.name, itemPrice: item.price, itemImage: item.image, itemDescription: item.description, itemRating: item.rating, itemReviewCount: item.reviewCount, senderPhoneNumber: user.phoneNumber, senderName, recipientPhoneNumber, recipientName, timestamp: serverTimestamp(), status: 'active', removedBySender: false, removedByReceiver: false });
      setCart(prev => {
        const giftId = `sent-${item.id}-${recipientPhoneNumber}`;
        if (prev.some(i => i.giftId === giftId)) return prev;
        return [...prev, { ...item, quantity: 1, isGift: true, giftedBy: senderName, giftedTo: recipientPhoneNumber, giftedToName: recipientName, originalPrice: item.price, isGiftSent: true, isGiftReceived: false, giftId, giftDocId: ref.id }];
      });
      if (window.addNotification) window.addNotification(`Gift sent to ${recipientName}!`, 'success', 3000);
      return true;
    } catch (e) {
      console.error(e);
      if (window.addNotification) window.addNotification('Failed to send gift', 'error', 3000);
      return false;
    }
  };

  const loadMenuProducts = async (storeId = null) => {
    // Return cached products only if they're for the same store
    if (menuProductsLoaded && menuProductsStoreId === storeId && Object.keys(menuProducts).length > 0) {
      return menuProducts;
    }

    const cacheKey = `cachedMenuProducts_${storeId || 'global'}`;
    const tsKey = `${cacheKey}_ts`;
    const cached = sessionStorage.getItem(cacheKey);
    const ts = sessionStorage.getItem(tsKey);
    if (cached && ts && Date.now() - parseInt(ts) < 5 * 60 * 1000) {
      try {
        const p = JSON.parse(cached);
        setMenuProducts(p);
        setMenuProductsLoaded(true);
        setMenuProductsStoreId(storeId);
        return p;
      } catch (_) {}
    }

    try {
      setMenuProductsLoading(true);
      const { fetchAllProducts } = await import('./utils/productService');
      const p = await fetchAllProducts(storeId);
      setMenuProducts(p);
      setMenuProductsLoaded(true);
      setMenuProductsStoreId(storeId);
      sessionStorage.setItem(cacheKey, JSON.stringify(p));
      sessionStorage.setItem(tsKey, Date.now().toString());
      return p;
    } catch (e) {
      console.error(e); return {};
    } finally {
      setMenuProductsLoading(false);
    }
  };

  const getChatParticipants = async () => {
    const map = new Map();
    messages.forEach(m => {
      if (m.phoneNumber && m.phoneNumber !== user?.phoneNumber && !map.has(m.phoneNumber)) {
        map.set(m.phoneNumber, { id: m.phoneNumber, phoneNumber: m.phoneNumber, name: m.name || 'Unknown' });
      }
    });
    const result = [];
    for (const [phone, p] of map) {
      try {
        const d = await getDoc(doc(db, 'users', phone));
        result.push(d.exists() ? { ...p, name: d.data().name || p.name, photoURL: d.data().photoURL } : p);
      } catch (_) { result.push(p); }
    }
    return result;
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(tab);
    if (tab === 'chat') setUnreadMessageCount(0);
  };

  if (loading) return (
    <div className="app-loading">
      <div className="loading-spinner" />
      <p>Loading...</p>
    </div>
  );

  const sharedProps = {
    user, onLogout: handleLogout,
    wishlist, addToWishlist, removeFromWishlist, isInWishlist,
    addToCart, addGiftToCart, getChatParticipants,
    menuProducts, menuProductsLoaded, menuProductsLoading, loadMenuProducts,
    cart, removeFromCart, updateCartQuantity, clearCart,
    messages, messagesLoading, typingUsers, unreadMessageCount,
    handleTabChange, activeTab, getCartItemCount
  };

  return (
    <Router>
      <div className="App">
        <AppRoutes
          handleLoginSuccess={handleLoginSuccess}
          handleLogout={handleLogout}
          user={user}
          {...sharedProps}
        />
      </div>
    </Router>
  );
}

export default App;

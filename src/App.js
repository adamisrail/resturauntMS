import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, Navigate, useNavigate } from 'react-router-dom';
import { collection, orderBy, query, onSnapshot, doc, getDoc, addDoc, deleteDoc, serverTimestamp, where, getDocs } from 'firebase/firestore';
import { db } from './firebase/config';
import { StoreProvider, useStore } from './contexts/StoreContext';
import AdminLogin from './components/Admin/AdminLogin';
import AdminPanel from './components/Admin/AdminPanel';
import JoinStore from './components/Store/JoinStore';
import OnlineOrderPage from './components/Store/OnlineOrderPage';
import Table from './components/Pages/Table';
import HomePage from './components/Home/HomePage';
import SuperAdmin from './components/SuperAdmin/SuperAdmin';
import NotificationSystem from './components/Notifications/NotificationSystem';
import './App.css';

// ---------------------------------------------------------------------------
// CustomerLoginGate — prompts phone login to access a table
// ---------------------------------------------------------------------------
function CustomerLoginGate({ children, tableNumber, parentOnLogout, onLogin }) {
  const [user, setUser] = React.useState(() => {
    const s = localStorage.getItem('currentUser');
    if (!s) return null;
    const u = JSON.parse(s);
    // If the stored user belongs to a different table, force re-login
    if (tableNumber && u.tableNumber !== tableNumber) return null;
    return u;
  });
  const [phone, setPhone] = React.useState('');
  const [name, setName] = React.useState('');
  const [step, setStep] = React.useState('phone'); // phone | name
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  if (user) {
    const handleLogout = () => {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('lastActiveTab');
      localStorage.removeItem('wishlist');
      localStorage.removeItem('cart');
      localStorage.removeItem('tableUser');
      setUser(null);
      parentOnLogout?.();
    };
    // Inject both the customer user and the scoped logout so children work correctly
    return React.cloneElement(React.Children.only(children), { user, onLogout: handleLogout });
  }

  const loginUser = (u) => {
    localStorage.setItem('currentUser', JSON.stringify(u));
    setUser(u);
    onLogin?.(u); // notify App.js so message subscriptions activate
  };

  const handlePhone = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const snap = await getDoc(doc(db, 'users', phone));
      if (snap.exists()) {
        const data = snap.data();
        loginUser({ uid: phone, phoneNumber: phone, name: data.name, displayName: data.name, tableNumber });
      } else {
        setStep('name');
      }
    } catch (err) { setError('Something went wrong. Try again.'); }
    finally { setLoading(false); }
  };

  const handleName = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await import('firebase/firestore').then(({ setDoc, doc: fDoc }) =>
        setDoc(fDoc(db, 'users', phone), { name, phoneNumber: phone, createdAt: new Date(), lastLogin: new Date() })
      );
      loginUser({ uid: phone, phoneNumber: phone, name, displayName: name, tableNumber });
    } catch (err) { setError('Could not create account.'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0b141a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'Poppins, sans-serif' }}>
      <div style={{ background: '#182229', border: '1px solid #2a3942', borderRadius: 20, padding: 40, width: '100%', maxWidth: 380, textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🍽️</div>
        <h2 style={{ color: '#e9edef', margin: '0 0 8px', fontFamily: 'Montserrat, sans-serif' }}>Welcome</h2>
        <p style={{ color: '#8696a0', margin: '0 0 24px', fontSize: 14 }}>
          {step === 'phone' ? 'Enter your phone number to join this table' : 'What should we call you?'}
        </p>
        <form onSubmit={step === 'phone' ? handlePhone : handleName}>
          {step === 'phone' ? (
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+1234567890"
              required
              autoFocus
              style={{ width: '100%', padding: '12px 14px', background: '#0b141a', border: '1px solid #2a3942', borderRadius: 10, color: '#e9edef', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 14, fontFamily: 'Poppins, sans-serif' }}
            />
          ) : (
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              required
              autoFocus
              style={{ width: '100%', padding: '12px 14px', background: '#0b141a', border: '1px solid #2a3942', borderRadius: 10, color: '#e9edef', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 14, fontFamily: 'Poppins, sans-serif' }}
            />
          )}
          {error && <p style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 10 }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ width: '100%', padding: 13, background: '#25D366', color: 'white', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'Poppins, sans-serif' }}>
            {loading ? 'Please wait...' : step === 'phone' ? 'Continue →' : 'Join Table →'}
          </button>
          {step === 'name' && (
            <button type="button" onClick={() => { setStep('phone'); setName(''); setError(''); }} style={{ background: 'none', border: 'none', color: '#8696a0', fontSize: 13, marginTop: 12, cursor: 'pointer' }}>
              ← Back
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TableRoute — validates tableNumber is within store's tableCount
// ---------------------------------------------------------------------------
function TableRoute(props) {
  const { tableNumber } = useParams();
  const { store, loading } = useStore();
  const navigate = useNavigate();

  const num = parseInt(tableNumber, 10);
  const tableCount = store?.tableCount || 10;

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0b141a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#8696a0', fontFamily: 'Poppins, sans-serif' }}>Loading...</div>
    </div>
  );

  if (!store || isNaN(num) || num < 1 || num > tableCount) {
    return (
      <div style={{ minHeight: '100vh', background: '#0b141a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'Poppins, sans-serif' }}>
        <div style={{ background: '#182229', border: '1px solid #2a3942', borderRadius: 20, padding: 40, maxWidth: 360, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🚫</div>
          <h2 style={{ color: '#e9edef', margin: '0 0 8px', fontFamily: 'Montserrat, sans-serif' }}>Table Not Found</h2>
          <p style={{ color: '#8696a0', fontSize: 14, margin: '0 0 24px' }}>
            Table {tableNumber} does not exist. This restaurant has {tableCount} table{tableCount !== 1 ? 's' : ''}.
          </p>
          <button onClick={() => navigate(-1)} style={{ padding: '12px 24px', background: '#25D366', color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <CustomerLoginGate tableNumber={tableNumber} parentOnLogout={props.onLogout} onLogin={props.onCustomerLogin}>
      <Table {...props} />
    </CustomerLoginGate>
  );
}

// ---------------------------------------------------------------------------
// StoreRoutes — nested under /:storeSlug
// ---------------------------------------------------------------------------
function StoreRoutes(props) {
  const { storeSlug } = useParams();
  return (
    <StoreProvider storeSlug={storeSlug}>
      <Routes>
        {/* Online order page — public */}
        <Route path="/" element={<OnlineOrderPage />} />

        {/* Table — validates table number then requires customer login */}
        <Route path="/table/:tableNumber" element={<TableRoute {...props} /> } />

        {/* Invite acceptance */}
        <Route path="/join" element={<JoinStore user={props.user} />} />

        {/* Store admin — requires staff login */}
        <Route
          path="/admin"
          element={
            props.user
              ? <AdminPanel user={props.user} onLogout={props.onLogout} />
              : <Navigate to={`/admin?redirect=/${storeSlug}/admin`} replace />
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </StoreProvider>
  );
}

// ---------------------------------------------------------------------------
// AppRoutes — lives inside the Router
// ---------------------------------------------------------------------------
function AppRoutes({ user, handleLoginSuccess, handleLogout, ...rest }) {
  return (
    <>
      <NotificationSystem />
      <Routes>
        {/* HOME — platform landing page */}
        <Route path="/" element={<HomePage />} />

        {/* ADMIN LOGIN + STORE SELECTOR */}
        <Route path="/admin" element={
          <AdminLogin onLoginSuccess={(slug) => {
            handleLoginSuccess(slug);
            const params = new URLSearchParams(window.location.search);
            const redirect = params.get('redirect');
            if (redirect) window.location.href = redirect;
          }} />
        } />

        {/* SUPER ADMIN — platform-level dashboard */}
        <Route path="/superadmin" element={<SuperAdmin />} />

        {/* Legacy redirects */}
        <Route path="/login" element={<Navigate to="/admin" replace />} />
        <Route path="/table1" element={<Navigate to="/table/1" replace />} />
        <Route path="/table2" element={<Navigate to="/table/2" replace />} />

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
// App — auth + global state
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

  useEffect(() => { localStorage.setItem('lastActiveTab', activeTab); }, [activeTab]);
  useEffect(() => { localStorage.setItem('wishlist', JSON.stringify(wishlist)); }, [wishlist]);
  useEffect(() => { localStorage.setItem('cart', JSON.stringify(cart)); }, [cart]);

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

  useEffect(() => {
    if (!user?.phoneNumber) return;
    const q = query(collection(db, 'gifts'), where('status', '==', 'active'), orderBy('timestamp', 'desc'));
    return onSnapshot(q, snapshot => {
      const data = [];
      snapshot.forEach(d => {
        const g = d.data();
        if (g.senderPhoneNumber === user.phoneNumber || g.recipientPhoneNumber === user.phoneNumber) data.push({ id: d.id, ...g });
      });
      setGifts(data);
    });
  }, [user?.phoneNumber]);

  const handleGroupedNotification = React.useCallback(async (newMessage) => {
    const sender = newMessage.phoneNumber;
    if ((newMessage.type === 'recommendation' || newMessage.type === 'gift') && sender !== user.phoneNumber) {
      const userDoc = await getDoc(doc(db, 'users', sender)).catch(() => null);
      const name = userDoc?.exists() ? (userDoc.data().name || sender) : sender;
      window.addNotification?.(`${name} ${newMessage.type === 'gift' ? 'gifted' : 'recommended'} "${newMessage.giftedItem || newMessage.recommendedItem}"`, newMessage.type, 6000, { sender: name });
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
        window.addNotification?.(senderName, 'message', 5000, { sender: senderName, messagePreview: count > 1 ? `${count} new messages` : newMessage.text, isMessage: true });
        setGroupedNotifications(p => { const n = { ...p }; delete n[sender]; return n; });
        setNotificationTimeouts(p => { const n = { ...p }; delete n[sender]; return n; });
      }, 1000);
      setNotificationTimeouts(prev => ({ ...prev, [sender]: t }));
    } catch (e) { console.error(e); }
  }, [user?.phoneNumber, groupedNotifications, notificationTimeouts]);

  useEffect(() => {
    if (!user) return;
    const tableNumber = user.tableNumber || user.tableId?.replace('table-', '') || null;
    const col = tableNumber ? `messages-table-${tableNumber}` : 'messages';
    const q = query(collection(db, col), orderBy('timestamp'));
    return onSnapshot(q, snapshot => {
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
  }, [user, currentPage, handleGroupedNotification]);

  useEffect(() => {
    if (!user?.phoneNumber) return;
    const tableNumber = user.tableNumber || user.tableId?.replace('table-', '') || null;
    const docName = tableNumber ? `table-${tableNumber}` : 'chat';
    return onSnapshot(doc(db, 'typing', docName), d => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.phoneNumber, user?.tableNumber, user?.tableId, currentPage]);

  useEffect(() => () => Object.values(notificationTimeouts).forEach(clearTimeout), [notificationTimeouts]);

  const handleCustomerLogin = (customerUser) => {
    setUser(customerUser);
  };

  const handleLoginSuccess = (storeSlug) => {
    const saved = localStorage.getItem('currentUser');
    if (saved) {
      const u = JSON.parse(saved);
      setUser(u);
      if (storeSlug) window.location.href = `/${storeSlug}/admin`;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('lastActiveTab');
    localStorage.removeItem('wishlist');
    setUser(null);
    setWishlist([]);
  };

  const addToWishlist = (item) => setWishlist(prev => {
    const id = item.id || `item-${item.name}-${item.price}`;
    if (prev.some(i => (i.id || `item-${i.name}-${i.price}`) === id)) return prev;
    window.addNotification?.(`${item.name} added to wishlist!`, 'success', 3000);
    return [...prev, item];
  });

  const removeFromWishlist = (itemId) => setWishlist(prev => {
    const item = prev.find(i => (i.id || `item-${i.name}-${i.price}`) === itemId);
    if (item) window.addNotification?.(`${item.name} removed from wishlist`, 'info', 3000);
    return prev.filter(i => (i.id || `item-${i.name}-${i.price}`) !== itemId);
  });

  const isInWishlist = (itemId) => wishlist.some(i => (i.id || `item-${i.name}-${i.price}`) === itemId);

  const addToCart = (item, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id && c.isGift === item.isGift);
      if (existing) return prev.map(c => c.id === item.id && c.isGift === item.isGift ? { ...c, quantity: c.quantity + quantity } : c);
      return [...prev, { ...item, quantity }];
    });
    window.addNotification?.(`${item.name} added to cart`, 'success', 3000);
  };

  const removeFromCart = (itemId) => setCart(prev => {
    const item = prev.find(i => (i.giftId || i.id) === itemId);
    if (item) window.addNotification?.(`${item.name} removed from cart`, 'info', 3000);
    if (item?.giftDocId) deleteDoc(doc(db, 'gifts', item.giftDocId)).catch(console.error);
    return prev.filter(i => (i.giftId || i.id) !== itemId);
  });

  const updateCartQuantity = (itemId, qty) => {
    if (qty <= 0) { removeFromCart(itemId); return; }
    setCart(prev => prev.map(i => (i.giftId || i.id) === itemId ? { ...i, quantity: i.isGift ? 1 : qty } : i));
  };

  const clearCart = () => { setCart([]); window.addNotification?.('Cart cleared', 'info', 3000); };
  const getCartItemCount = () => cart.reduce((s, i) => s + i.quantity, 0);

  const addGiftToCart = async (item, recipientPhoneNumber, senderName, recipientName) => {
    try {
      const existing = await getDocs(query(collection(db, 'gifts'), where('itemId', '==', item.id), where('senderPhoneNumber', '==', user.phoneNumber), where('recipientPhoneNumber', '==', recipientPhoneNumber), where('status', '==', 'active')));
      if (!existing.empty) { window.addNotification?.('You already gifted this item to this person', 'error', 3000); return false; }
      const ref = await addDoc(collection(db, 'gifts'), { itemId: item.id, itemName: item.name, itemPrice: item.price, itemImage: item.image, itemDescription: item.description, itemRating: item.rating, itemReviewCount: item.reviewCount, senderPhoneNumber: user.phoneNumber, senderName, recipientPhoneNumber, recipientName, timestamp: serverTimestamp(), status: 'active', removedBySender: false, removedByReceiver: false });
      setCart(prev => {
        const giftId = `sent-${item.id}-${recipientPhoneNumber}`;
        if (prev.some(i => i.giftId === giftId)) return prev;
        return [...prev, { ...item, quantity: 1, isGift: true, giftedBy: senderName, giftedTo: recipientPhoneNumber, giftedToName: recipientName, originalPrice: item.price, isGiftSent: true, isGiftReceived: false, giftId, giftDocId: ref.id }];
      });
      window.addNotification?.(`Gift sent to ${recipientName}!`, 'success', 3000);
      return true;
    } catch (e) { console.error(e); window.addNotification?.('Failed to send gift', 'error', 3000); return false; }
  };

  const loadMenuProducts = async (storeId = null) => {
    if (menuProductsLoaded && menuProductsStoreId === storeId && Object.keys(menuProducts).length > 0) return menuProducts;
    const cacheKey = `cachedMenuProducts_${storeId || 'global'}`;
    const tsKey = `${cacheKey}_ts`;
    const cached = sessionStorage.getItem(cacheKey);
    const ts = sessionStorage.getItem(tsKey);
    if (cached && ts && Date.now() - parseInt(ts) < 5 * 60 * 1000) {
      try {
        const p = JSON.parse(cached);
        setMenuProducts(p); setMenuProductsLoaded(true); setMenuProductsStoreId(storeId);
        return p;
      } catch (_) {}
    }
    try {
      setMenuProductsLoading(true);
      const { fetchAllProducts } = await import('./utils/productService');
      const p = await fetchAllProducts(storeId);
      setMenuProducts(p); setMenuProductsLoaded(true); setMenuProductsStoreId(storeId);
      sessionStorage.setItem(cacheKey, JSON.stringify(p));
      sessionStorage.setItem(tsKey, Date.now().toString());
      return p;
    } catch (e) { console.error(e); return {}; }
    finally { setMenuProductsLoading(false); }
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
    user, onLogout: handleLogout, onCustomerLogin: handleCustomerLogin,
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

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, setDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useStore } from '../../contexts/StoreContext';
import BottomNav from '../Navigation/BottomNav';
import ChatRoom from '../Chat/ChatRoom';
import Menu from './Menu';
import Wishlist from './Wishlist';
import Cart from './Cart';
import NotificationSystem from '../Notifications/NotificationSystem';
import './Pages.css';

// Sanitize phone for use as a Firestore map key (no special chars in field paths)
const phoneKey = (phone) => (phone || '').replace(/[^a-z0-9]/gi, '');

const Table = ({
  user,
  onLogout,
  wishlist,
  addToWishlist,
  removeFromWishlist,
  isInWishlist,
  addToCart,
  addGiftToCart,
  menuProducts,
  menuProductsLoaded,
  menuProductsLoading,
  loadMenuProducts,
  cart,
  removeFromCart,
  updateCartQuantity,
  clearCart,
  messages,
  messagesLoading,
  typingUsers,
  unreadMessageCount,
  handleTabChange,
  activeTab
}) => {
  const { tableNumber } = useParams();
  const { store } = useStore();
  const storeId = store?.id || null;

  const [tableUser, setTableUser] = useState(null);
  const [tableParticipants, setTableParticipants] = useState([]);
  const [tableWishlists, setTableWishlists] = useState({});
  const [tableCarts, setTableCarts] = useState({});

  // Enrich user with table display info
  useEffect(() => {
    if (user && tableNumber) {
      const tableUserData = {
        ...user,
        tableNumber: `Table ${tableNumber}`,
        tableId: `table-${tableNumber}`
      };
      setTableUser(tableUserData);
      localStorage.setItem('tableUser', JSON.stringify(tableUserData));
    }
  }, [user, tableNumber]);

  // ── Presence tracking (subcollection — one doc per participant) ───────────
  useEffect(() => {
    if (!user?.phoneNumber || !tableNumber || !storeId) return;
    const key = phoneKey(user.phoneNumber);
    const participantsCol = collection(db, 'tablePresence', `${storeId}_table-${tableNumber}`, 'participants');
    const myDocRef = doc(participantsCol, key);

    // Write own presence entry
    setDoc(myDocRef, {
      name: user.name || user.displayName || user.phoneNumber,
      phoneNumber: user.phoneNumber,
      joinedAt: Date.now(),
    }).catch(console.error);

    // Subscribe to all participants in the subcollection
    const STALE_MS = 12 * 60 * 60 * 1000; // 12 hours
    const unsub = onSnapshot(participantsCol, snap => {
      const now = Date.now();
      const participants = snap.docs
        .map(d => d.data())
        .filter(p => p?.phoneNumber && p.phoneNumber !== user.phoneNumber && (now - p.joinedAt) < STALE_MS);
      setTableParticipants(participants);
    });

    return () => {
      unsub();
      deleteDoc(myDocRef).catch(console.error);
    };
  }, [user?.phoneNumber, tableNumber, storeId]);

  // ── Sync own wishlist to Firestore ─────────────────────────────────────────
  useEffect(() => {
    if (!user?.phoneNumber || !tableNumber || !storeId) return;
    const key = phoneKey(user.phoneNumber);
    const ref = doc(db, 'tableWishlists', `${storeId}_table-${tableNumber}`);
    setDoc(ref, {
      [key]: {
        name: user.name || user.displayName || user.phoneNumber,
        phoneNumber: user.phoneNumber,
        items: wishlist,
      }
    }, { merge: true }).catch(console.error);
  }, [wishlist, user?.phoneNumber, tableNumber, storeId]);

  // ── Subscribe to all table wishlists ───────────────────────────────────────
  useEffect(() => {
    if (!tableNumber || !storeId) return;
    const ref = doc(db, 'tableWishlists', `${storeId}_table-${tableNumber}`);
    return onSnapshot(ref, snap => {
      setTableWishlists(snap.exists() ? snap.data() : {});
    });
  }, [tableNumber, storeId]);

  // ── Sync own cart to Firestore ─────────────────────────────────────────────
  useEffect(() => {
    if (!user?.phoneNumber || !tableNumber || !storeId) return;
    const key = phoneKey(user.phoneNumber);
    const ref = doc(db, 'tableCarts', `${storeId}_table-${tableNumber}`);
    setDoc(ref, {
      [key]: {
        name: user.name || user.displayName || user.phoneNumber,
        phoneNumber: user.phoneNumber,
        items: cart,
      }
    }, { merge: true }).catch(console.error);
  }, [cart, user?.phoneNumber, tableNumber, storeId]);

  // ── Subscribe to all table carts ───────────────────────────────────────────
  useEffect(() => {
    if (!tableNumber || !storeId) return;
    const ref = doc(db, 'tableCarts', `${storeId}_table-${tableNumber}`);
    return onSnapshot(ref, snap => {
      setTableCarts(snap.exists() ? snap.data() : {});
    });
  }, [tableNumber, storeId]);

  const renderContent = () => {
    const u = tableUser || user;
    switch (activeTab) {
      case 'menu':
        return <Menu
          user={u}
          onLogout={onLogout}
          wishlist={wishlist}
          addToWishlist={addToWishlist}
          removeFromWishlist={removeFromWishlist}
          isInWishlist={isInWishlist}
          addToCart={addToCart}
          addGiftToCart={addGiftToCart}
          tableParticipants={tableParticipants}
          tableNumber={tableNumber}
          storeId={storeId}
          menuProducts={menuProducts}
          menuProductsLoaded={menuProductsLoaded}
          menuProductsLoading={menuProductsLoading}
          loadMenuProducts={loadMenuProducts}
        />;
      case 'chat':
        return <ChatRoom
          user={u}
          messages={messages}
          loading={messagesLoading}
          typingUsers={typingUsers}
          onLogout={onLogout}
          tableNumber={tableNumber}
        />;
      case 'wishlist':
        return <Wishlist
          user={u}
          onLogout={onLogout}
          wishlist={wishlist}
          removeFromWishlist={removeFromWishlist}
          isInWishlist={isInWishlist}
          tableWishlists={tableWishlists}
        />;
      case 'cart':
        return <Cart
          user={u}
          onLogout={onLogout}
          cart={cart}
          removeFromCart={removeFromCart}
          updateCartQuantity={updateCartQuantity}
          clearCart={clearCart}
          addToCart={addToCart}
          tableCarts={tableCarts}
        />;
      default:
        return <ChatRoom
          user={u}
          messages={messages}
          loading={messagesLoading}
          typingUsers={typingUsers}
          onLogout={onLogout}
          tableNumber={tableNumber}
        />;
    }
  };

  return (
    <div className="table-container">
      <NotificationSystem />
      <main className="main-content">
        {renderContent()}
      </main>
      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        typingUsers={typingUsers}
        wishlistCount={wishlist.length}
        unreadMessageCount={unreadMessageCount}
        cartCount={cart.length}
      />
    </div>
  );
};

export default Table;

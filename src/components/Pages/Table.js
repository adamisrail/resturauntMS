import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import BottomNav from '../Navigation/BottomNav';
import ChatRoom from '../Chat/ChatRoom';
import Menu from './Menu';
import Wishlist from './Wishlist';
import Cart from './Cart';
import NotificationSystem from '../Notifications/NotificationSystem';
import './Pages.css';

const Table = ({
  user,
  onLogout,
  wishlist,
  addToWishlist,
  removeFromWishlist,
  isInWishlist,
  addToCart,
  addGiftToCart,
  getChatParticipants,
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
  const [tableUser, setTableUser] = useState(null);

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
          getChatParticipants={getChatParticipants}
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

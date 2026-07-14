import React, { useState, useMemo, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { fetchProductsByCategory } from '../../utils/productService';
import { useStore } from '../../contexts/StoreContext';
import { useParams } from 'react-router-dom';
import Profile from '../Navigation/Profile';
import './Pages.css';
import './Cart.css';

const phoneKey = (phone) => (phone || '').replace(/[^a-z0-9]/gi, '');

const Cart = ({ user, onLogout, cart, removeFromCart, updateCartQuantity, clearCart, addToCart, tableCarts = {} }) => {
  const { store } = useStore();
  const { tableNumber: urlTableNumber } = useParams();
  const storeId = store?.id || null;

  // tableNumber from URL params takes priority over user object
  const tableNumber = urlTableNumber
    ? `Table ${urlTableNumber}`
    : user?.tableNumber || 'Table 1';

  const [giftAmount] = useState(0);
  const [discountCode, setDiscountCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(0);
  const [calculationsExpanded, setCalculationsExpanded] = useState(false);
  const [showDrinkPopup, setShowDrinkPopup] = useState(false);
  const [availableDrinks, setAvailableDrinks] = useState([]);

  // Fetch this store's drinks
  useEffect(() => {
    fetchProductsByCategory('drinks', storeId)
      .then(setAvailableDrinks)
      .catch(console.error);
  }, [storeId]);

  // Calculate cart totals
  const cartTotals = useMemo(() => {
    // Calculate subtotal for regular items only
    const regularItemsSubtotal = cart.reduce((total, item) => {
      if (!item.isGift) {
        return total + (item.price * item.quantity);
      }
      return total;
    }, 0);
    
    // Calculate gift items amount (items you gifted to others)
    const giftItemsAmount = cart.reduce((total, item) => {
      if (item.isGift && item.isGiftSent) {
        return total + ((item.originalPrice || item.price) * item.quantity);
      }
      return total;
    }, 0);
    
    // Calculate total subtotal (regular + gift items)
    const subtotal = regularItemsSubtotal + giftItemsAmount;
    
    const tax = subtotal * 0.08; // 8% tax
    const discount = discountApplied;
    const total = subtotal + tax + giftAmount - discount;
    
    return {
      regularItemsSubtotal,
      giftItemsAmount,
      subtotal,
      tax,
      discount,
      giftAmount,
      total
    };
  }, [cart, discountApplied, giftAmount]);

  const handleQuantityChange = (itemId, newQuantity) => {
    updateCartQuantity(itemId, parseInt(newQuantity) || 0);
  };

  const handleApplyDiscount = () => {
    if (discountCode.toLowerCase() === 'welcome10') {
      setDiscountApplied(cartTotals.subtotal * 0.1); // 10% discount
      if (window.addNotification) {
        window.addNotification('10% discount applied!', 'success', 3000);
      }
    } else if (discountCode.toLowerCase() === 'save20') {
      setDiscountApplied(cartTotals.subtotal * 0.2); // 20% discount
      if (window.addNotification) {
        window.addNotification('20% discount applied!', 'success', 3000);
      }
    } else {
      setDiscountApplied(0);
      if (window.addNotification) {
        window.addNotification('Invalid discount code', 'error', 3000);
      }
    }
  };

  // Single place order function used by both checkout paths
  const placeOrder = async (specialInstructions = '') => {
    // Scope to store's orders subcollection, fall back to global
    const ordersRef = storeId
      ? collection(db, 'stores', storeId, 'orders')
      : collection(db, 'orders');

    const orderData = {
      storeId: storeId || null,
      storeName: store?.name || null,
      customerId: user?.phoneNumber || 'anonymous',
      customerName: user?.displayName || user?.name || 'Guest',
      customerPhone: user?.phoneNumber || 'N/A',
      tableNumber,
      items: cart.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        category: item.category,
        isGift: item.isGift || false,
        giftInfo: item.isGift ? {
          isGiftSent: item.isGiftSent,
          giftedToName: item.giftedToName,
          giftedBy: item.giftedBy
        } : null
      })),
      subtotal: cartTotals.subtotal,
      tax: cartTotals.tax,
      discount: cartTotals.discount,
      total: cartTotals.total,
      status: 'pending',
      specialInstructions,
      paymentMethod: 'cash',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const orderRef = await addDoc(ordersRef, orderData);
    clearCart();
    window.addNotification?.(
      `Order placed! #${orderRef.id.slice(-6).toUpperCase()}`,
      'success', 5000
    );
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      window.addNotification?.('Your cart is empty', 'warning', 3000);
      return;
    }
    const hasDrink = cart.some(item =>
      availableDrinks.some(d => d.name === item.name && d.price === item.price)
    );
    if (!hasDrink) { setShowDrinkPopup(true); return; }
    try {
      await placeOrder();
    } catch (err) {
      console.error(err);
      window.addNotification?.('Failed to place order. Please try again.', 'error', 5000);
    }
  };

  const handleProceedAnyway = async () => {
    setShowDrinkPopup(false);
    try {
      await placeOrder('Order placed without drink');
    } catch (err) {
      console.error(err);
      window.addNotification?.('Failed to place order. Please try again.', 'error', 5000);
    }
  };

  const handleAddDrink = (drink) => {
    addToCart?.({ ...drink, id: `drink-${drink.name}-${drink.price}`, category: 'drinks' }, 1);
    setShowDrinkPopup(false);
    window.addNotification?.(`${drink.name} added to cart!`, 'success', 3000);
  };

  return (
    <div className="page-container">
      {/* Header with Logo and Profile */}
      <div className="page-header">
        <div className="logo-container">
          <img 
            src="/58c33377dfcbb3022493dec49d098b02.jpg" 
            alt="Restaurant Logo" 
            className="restaurant-logo"
          />
        </div>
        <div className="page-title">
        <h1>Cart</h1>
        <p>Your order items</p>
        </div>
        <Profile user={user} onLogout={onLogout} />
      </div>
      
      <div className="page-content">
                {cart.length === 0 ? (
          <div className="empty-cart">
            <div className="empty-cart-icon">🛒</div>
            <h2>Your cart is empty</h2>
            <p>Add some delicious items to get started</p>
          </div>
        ) : (
          <div className="cart-container">
            {/* Cart Items */}
            <div className="cart-items">
              {cart.map((item) => (
                <div key={item.giftId || item.id} className={`cart-item${item.isGift ? (item.isGiftSent ? ' gift-sent' : ' gift-received') : ''}`}>
                  <div className="cart-item-image">
                    <img src={item.image} alt={item.name} className="cart-item-img" />
                  </div>
                  
                  <div className="cart-item-details">
                    <h3 className="cart-item-name">
                      {item.name}
                      {item.isGift && (
                        <span className="gift-badge">🎁 Gift</span>
                      )}
                    </h3>
                    {item.isGift && (
                      <div className="gift-info-row">
                        <span className="gift-info">
                          {item.isGiftSent
                            ? `Gifted to ${item.giftedToName || 'Unknown User'}`
                            : `Gifted by ${item.giftedBy}`
                          }
                        </span>
                        <span className={`cart-item-price ${item.isGift && !item.isGiftSent ? 'gift-price' : ''}`}>
                          {item.isGiftSent ? (
                            `$${((item.originalPrice || item.price) * item.quantity).toFixed(2)}`
                          ) : (
                            <span className="gift-total">FREE</span>
                          )}
                        </span>
                      </div>
                    )}
                    <div className="gift-icon-row">
                      {!item.isGift && (
                        <>
                          <div className="quantity-controls">
                            <button 
                              className="quantity-btn"
                              onClick={() => handleQuantityChange(item.giftId || item.id, item.quantity - 1)}
                            >
                              -
                            </button>
                            <span className="quantity-display">{item.quantity}</span>
                            <button 
                              className="quantity-btn"
                              onClick={() => handleQuantityChange(item.giftId || item.id, item.quantity + 1)}
                            >
                              +
                            </button>
                          </div>
                          <span className="cart-item-price">{`$${(item.price * item.quantity).toFixed(2)}`}</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Empty div for spacing */}
                  <div className="cart-item-spacer"></div>
                  
                  <button 
                    className="cart-remove-btn"
                    onClick={() => removeFromCart(item.giftId || item.id)}
                    title="Remove from cart"
                  >
                    ❌
                  </button>
                </div>
              ))}
            </div>


          </div>
        )}

        {/* ── Table Members' Carts ───────────────────────── */}
        {(() => {
          const myKey = phoneKey(user?.phoneNumber);
          const others = Object.entries(tableCarts).filter(
            ([key, data]) => key !== myKey && data?.phoneNumber && (data.items || []).length > 0
          );
          if (others.length === 0) return null;
          return (
            <div style={{ marginTop: 24 }}>
              <div style={{ color: '#8696a0', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, paddingLeft: 4 }}>
                🍽️ Table Orders
              </div>
              {others.map(([key, data]) => (
                <div key={key} style={{ background: '#182229', border: '1px solid #2a3942', borderRadius: 16, marginBottom: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #2a3942', color: '#e9edef', fontWeight: 600, fontSize: 14 }}>
                    {data.name}'s Cart
                    <span style={{ color: '#8696a0', fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
                      ({(data.items || []).length} item{data.items?.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                  {(data.items || []).map((item) => (
                    <div key={item.giftId || item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid #1a2730' }}>
                      <img src={item.image} alt={item.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} onError={e => { e.target.style.display = 'none'; }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#e9edef', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                          {item.isGift && <span style={{ fontSize: 11, marginLeft: 6 }}>🎁</span>}
                        </div>
                        <div style={{ color: '#8696a0', fontSize: 12 }}>x{item.quantity}</div>
                      </div>
                      <div style={{ color: '#25D366', fontWeight: 600, fontSize: 13, flexShrink: 0 }}>
                        {item.isGift && !item.isGiftSent ? 'FREE' : `$${(item.price * item.quantity).toFixed(2)}`}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Bottom Calculation Section */}
        {cart.length > 0 && (
          <div className="bottom-calculation">
            <div className="calculation-breakdown">
              {/* Collapsible Calculations */}
              <div className={`calculation-details ${calculationsExpanded ? 'expanded' : 'collapsed'}`}>
                <div className="calculation-row">
                  <span className="calculation-label">Your items amount</span>
                  <span className="calculation-value">${cartTotals.regularItemsSubtotal.toFixed(2)}</span>
                </div>
                
                {cartTotals.giftItemsAmount > 0 && (
                  <div className="calculation-row">
                    <span className="calculation-label">Items you gifted</span>
                    <span className="calculation-value">${cartTotals.giftItemsAmount.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="calculation-row discount-input-row">
                  <span className="calculation-label">Discount</span>
                  <div className="discount-input-container">
                    <input
                      type="text"
                      placeholder="Enter code"
                      value={discountCode}
                      onChange={(e) => setDiscountCode(e.target.value)}
                      className="calculation-discount-input"
                    />
                    <button 
                      className="calculation-apply-btn"
                      onClick={handleApplyDiscount}
                    >
                      Apply
                    </button>
                  </div>
                  <span className="calculation-value" style={{marginLeft: 8}}>
                    -${cartTotals.discount.toFixed(2)}
                  </span>
                </div>
                
                {cartTotals.discount > 0 && (
                  <div className="calculation-row discount-applied-row">
                    <span className="calculation-label">Discount applied</span>
                    <span className="calculation-value">-${cartTotals.discount.toFixed(2)}</span>
                  </div>
                )}
                
                {cartTotals.giftAmount > 0 && (
                  <div className="calculation-row">
                    <span className="calculation-label">Gift amount</span>
                    <span className="calculation-value">${cartTotals.giftAmount.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="calculation-row">
                  <span className="calculation-label">Tax</span>
                  <span className="calculation-value">${cartTotals.tax.toFixed(2)}</span>
                </div>
              </div>
              
              {/* Total Row with Toggle */}
              <div 
                className="calculation-row total-row toggle-row"
                onClick={() => setCalculationsExpanded(!calculationsExpanded)}
              >
                <div className="total-button">
                  <span className="total-label">Total ( Click to expand )</span>
                  <span className="total-value">${cartTotals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Checkout Button */}
            <button 
              className="checkout-btn"
              onClick={handleCheckout}
            >
              Proceed to Checkout
            </button>
        </div>
        )}
      </div>

             {/* Drink Popup */}
       {showDrinkPopup && (
         <div className="drink-popup-overlay">
           <div className="drink-popup-content">
             <h2>Add a Drink to Your Order</h2>
             <p>Add a drink—because chewing is hard work.</p>
             <div className="drink-carousel">
               {availableDrinks.map((drink, index) => {
                 // Ensure unique key - use drink.id if available, otherwise use name-price combination
                 const uniqueKey = drink.id || `drink-${drink.name}-${drink.price}-${index}`;
                 return (
                                        <div key={uniqueKey} className={`drink-option-card ${drink.orderCount > 150 ? 'popular' : ''}`}>
                         <div className="drink-option-header">
                           <img src={drink.image} alt={drink.name} className="drink-option-image" />
                           <h3>{drink.name}</h3>
                         </div>
                   <p>{drink.description}</p>
                   {drink.orderCount > 150 ? (
                     <div className="drink-label">🔥 Most Popular</div>
                   ) : (
                     <div className="drink-label-placeholder"></div>
                   )}
                   <div className="drink-option-footer">
                     <span className="drink-rating">⭐ {drink.rating.toFixed(1)}</span>
                     <span className="drink-price">${drink.price}</span>
                   </div>
                   <button 
                     className="add-to-cart-btn"
                     onClick={() => handleAddDrink(drink)}
                   >
                     Add to Cart
                   </button>
                 </div>
               );
               })}
             </div>
             <button 
               className="proceed-anyway-btn"
               onClick={handleProceedAnyway}
             >
               Proceed Anyway
             </button>
             <button
               className="close-popup-btn"
               onClick={() => setShowDrinkPopup(false)}
             >
               Close
             </button>
           </div>
         </div>
       )}
    </div>
  );
};

export default Cart; 
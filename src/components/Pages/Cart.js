import React, { useState, useMemo } from 'react';
import Profile from '../Navigation/Profile';
import './Pages.css';
import './Cart.css';

const Cart = ({ user, onLogout, cart, removeFromCart, updateCartQuantity, clearCart }) => {
  const [giftAmount, setGiftAmount] = useState(0);
  const [discountCode, setDiscountCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(0);
  const [calculationsExpanded, setCalculationsExpanded] = useState(false);

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

  const handleCheckout = () => {
    if (cart.length === 0) {
      if (window.addNotification) {
        window.addNotification('Your cart is empty', 'warning', 3000);
      }
      return;
    }
    
    if (window.addNotification) {
      window.addNotification('Proceeding to checkout...', 'info', 3000);
    }
    // TODO: Implement checkout logic
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
            {/* Cart Header */}
            <div className="cart-header">
              <h2>Cart Items ({cart.length})</h2>
              <button 
                className="clear-cart-btn"
                onClick={clearCart}
              >
                Clear Cart
              </button>
            </div>
            
            {/* Cart Items */}
            <div className="cart-items">
              {cart.map((item) => (
                <div key={item.giftId || item.id} className={`cart-item${item.isGift ? (item.isGiftSent ? ' gift-sent' : ' gift-received') : ''}`}>
                  <div className="cart-item-image">
                    <span className="cart-item-emoji">{item.image}</span>
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
                  <span className="total-label">Total</span>
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
    </div>
  );
};

export default Cart; 
import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useStore } from '../../contexts/StoreContext';
import { fetchAllProducts } from '../../utils/productService';
import './OnlineOrderPage.css';

// ─── OnlineOrderPage ─────────────────────────────────────────────────────────
// Accessible at /:storeSlug — customers order from home.
// No login required. Lightweight: menu + inline cart + checkout form.
// Orders saved with orderType:'online' to stores/{storeId}/orders
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'main-course', name: 'Main Course', icon: '🍽️' },
  { id: 'appetizers',  name: 'Appetizers',  icon: '🥗' },
  { id: 'drinks',      name: 'Drinks',      icon: '🥤' },
  { id: 'desserts',    name: 'Desserts',     icon: '🍰' },
];

const OnlineOrderPage = () => {
  const { store, loading: storeLoading } = useStore();
  const storeId = store?.id || null;

  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('main-course');
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(null);

  // Checkout form
  const [form, setForm] = useState({ name: '', phone: '', type: 'pickup', address: '', notes: '' });
  const [placing, setPlacing] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    fetchAllProducts(storeId)
      .then(setProducts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [storeId]);

  const addToCart = (item) => {
    setCart(prev => {
      const exists = prev.find(c => c.id === item.id);
      if (exists) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...item, qty: 1 }];
    });
    window.addNotification?.(`${item.name} added`, 'success', 2000);
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev
      .map(c => c.id === id ? { ...c, qty: c.qty + delta } : c)
      .filter(c => c.qty > 0)
    );
  };

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setFormError('Name and phone number are required.');
      return;
    }
    if (form.type === 'delivery' && !form.address.trim()) {
      setFormError('Delivery address is required.');
      return;
    }
    setFormError('');
    setPlacing(true);

    try {
      const ordersRef = storeId
        ? collection(db, 'stores', storeId, 'orders')
        : collection(db, 'orders');

      const tax = cartTotal * 0.08;
      const orderRef = await addDoc(ordersRef, {
        storeId,
        storeName: store?.name || null,
        orderType: 'online',
        customerName: form.name.trim(),
        customerPhone: form.phone.trim(),
        deliveryType: form.type,
        deliveryAddress: form.type === 'delivery' ? form.address.trim() : 'Store Pickup',
        specialInstructions: form.notes.trim(),
        items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.qty, image: i.image, category: i.category })),
        subtotal: cartTotal,
        tax,
        discount: 0,
        total: cartTotal + tax,
        status: 'pending',
        tableNumber: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setOrderPlaced({ orderId: orderRef.id.slice(-6).toUpperCase(), name: form.name });
      setCart([]);
      setShowCheckout(false);
      setShowCart(false);
    } catch (err) {
      console.error(err);
      setFormError('Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  if (storeLoading) return <div className="oop-loading"><div className="oop-spinner" /></div>;

  if (!store) return (
    <div className="oop-loading">
      <p>Store not found.</p>
      <a href="/">Browse all restaurants →</a>
    </div>
  );

  if (orderPlaced) return (
    <div className="oop-success">
      <div className="oop-success-icon">🎉</div>
      <h2>Order Placed!</h2>
      <p>Thank you, <strong>{orderPlaced.name}</strong>!</p>
      <div className="oop-order-id">Order #{orderPlaced.orderId}</div>
      <p className="oop-success-sub">We've received your order and will prepare it shortly.</p>
      <button className="oop-btn-primary" onClick={() => setOrderPlaced(null)}>Order Again</button>
    </div>
  );

  const allItems = CATEGORIES.flatMap(cat => (products[cat.id] || []).map(item => ({ ...item, catId: cat.id })));
  const filtered = search.trim()
    ? allItems.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : products[activeCategory] || [];

  return (
    <div className="oop-page">
      {/* Header */}
      <div className="oop-header">
        <div className="oop-header-left">
          {store.logo && <img src={store.logo} alt={store.name} className="oop-logo" onError={e => { e.target.style.display = 'none'; }} />}
          <div>
            <h1 className="oop-store-name">{store.name}</h1>
            {store.description && <p className="oop-store-desc">{store.description}</p>}
          </div>
        </div>
        <button className="oop-cart-btn" onClick={() => setShowCart(true)}>
          🛒
          {cartCount > 0 && <span className="oop-cart-badge">{cartCount}</span>}
        </button>
      </div>

      {/* Search */}
      <div className="oop-search-wrap">
        <span>🔍</span>
        <input
          className="oop-search"
          type="text"
          placeholder="Search menu..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && <button className="oop-search-clear" onClick={() => setSearch('')}>✕</button>}
      </div>

      {/* Category Tabs */}
      {!search && (
        <div className="oop-cats">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={`oop-cat-btn ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Products */}
      <div className="oop-products">
        {loading ? (
          <div className="oop-loading-small"><div className="oop-spinner" /></div>
        ) : filtered.length === 0 ? (
          <p className="oop-empty">No items found.</p>
        ) : filtered.map(item => (
          <div key={item.id} className="oop-product-card">
            <div className="oop-product-img-wrap">
              <img
                src={item.image}
                alt={item.name}
                className="oop-product-img"
                onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
              />
              <div className="oop-product-img-ph">🍽️</div>
            </div>
            <div className="oop-product-info">
              <div className="oop-product-name">{item.name}</div>
              <div className="oop-product-desc">{item.description}</div>
              <div className="oop-product-meta">
                <span className="oop-product-rating">⭐ {item.rating}</span>
                {item.spiceLevel > 0 && <span>{'🌶️'.repeat(item.spiceLevel)}</span>}
              </div>
            </div>
            <div className="oop-product-right">
              <div className="oop-product-price">${item.price}</div>
              {cart.find(c => c.id === item.id) ? (
                <div className="oop-qty-ctrl">
                  <button onClick={() => updateQty(item.id, -1)}>−</button>
                  <span>{cart.find(c => c.id === item.id)?.qty}</span>
                  <button onClick={() => updateQty(item.id, +1)}>+</button>
                </div>
              ) : (
                <button className="oop-add-btn" onClick={() => addToCart(item)}>Add</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Cart Drawer */}
      {showCart && (
        <div className="oop-drawer-overlay" onClick={() => setShowCart(false)}>
          <div className="oop-drawer" onClick={e => e.stopPropagation()}>
            <div className="oop-drawer-header">
              <h2>Your Order</h2>
              <button className="oop-drawer-close" onClick={() => setShowCart(false)}>✕</button>
            </div>
            {cart.length === 0 ? (
              <p className="oop-empty">Your cart is empty.</p>
            ) : (
              <>
                <div className="oop-cart-items">
                  {cart.map(item => (
                    <div key={item.id} className="oop-cart-row">
                      <div className="oop-cart-info">
                        <span className="oop-cart-name">{item.name}</span>
                        <span className="oop-cart-price">${(item.price * item.qty).toFixed(2)}</span>
                      </div>
                      <div className="oop-qty-ctrl">
                        <button onClick={() => updateQty(item.id, -1)}>−</button>
                        <span>{item.qty}</span>
                        <button onClick={() => updateQty(item.id, +1)}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="oop-cart-total">
                  <span>Subtotal</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
                <div className="oop-cart-total oop-cart-tax">
                  <span>Tax (8%)</span>
                  <span>${(cartTotal * 0.08).toFixed(2)}</span>
                </div>
                <div className="oop-cart-total oop-cart-grand">
                  <strong>Total</strong>
                  <strong>${(cartTotal * 1.08).toFixed(2)}</strong>
                </div>
                <button className="oop-btn-primary" onClick={() => { setShowCart(false); setShowCheckout(true); }}>
                  Proceed to Checkout →
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="oop-drawer-overlay" onClick={() => setShowCheckout(false)}>
          <div className="oop-drawer" onClick={e => e.stopPropagation()}>
            <div className="oop-drawer-header">
              <h2>Checkout</h2>
              <button className="oop-drawer-close" onClick={() => setShowCheckout(false)}>✕</button>
            </div>
            <form onSubmit={handlePlaceOrder} className="oop-checkout-form">
              <div className="oop-form-group">
                <label>Full Name *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your name" required />
              </div>
              <div className="oop-form-group">
                <label>Phone Number *</label>
                <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1234567890" required />
              </div>
              <div className="oop-form-group">
                <label>Order Type</label>
                <div className="oop-type-toggle">
                  <button type="button" className={form.type === 'pickup' ? 'active' : ''} onClick={() => setForm(f => ({ ...f, type: 'pickup' }))}>🏃 Pickup</button>
                  <button type="button" className={form.type === 'delivery' ? 'active' : ''} onClick={() => setForm(f => ({ ...f, type: 'delivery' }))}>🚚 Delivery</button>
                </div>
              </div>
              {form.type === 'delivery' && (
                <div className="oop-form-group">
                  <label>Delivery Address *</label>
                  <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Street, City" />
                </div>
              )}
              <div className="oop-form-group">
                <label>Special Instructions</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Allergies, preferences..." rows={2} />
              </div>
              <div className="oop-cart-total oop-cart-grand" style={{ marginBottom: 16 }}>
                <strong>Total</strong>
                <strong>${(cartTotal * 1.08).toFixed(2)}</strong>
              </div>
              {formError && <p className="oop-form-error">{formError}</p>}
              <button type="submit" className="oop-btn-primary" disabled={placing}>
                {placing ? 'Placing order...' : 'Place Order'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating cart button (mobile) */}
      {cartCount > 0 && !showCart && !showCheckout && (
        <button className="oop-floating-cart" onClick={() => setShowCart(true)}>
          🛒 {cartCount} item{cartCount > 1 ? 's' : ''} — ${cartTotal.toFixed(2)}
        </button>
      )}
    </div>
  );
};

export default OnlineOrderPage;

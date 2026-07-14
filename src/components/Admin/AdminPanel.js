import React, { useState, useEffect, useCallback } from 'react';
import { collection, updateDoc, doc, onSnapshot, orderBy, query, serverTimestamp, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, storage } from '../../firebase/config';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getCacheStats, clearCache } from '../../utils/firebaseOptimizer';
import { fetchAllProductsFlat, addProduct, updateProduct, deleteProduct, initializeDefaultProducts } from '../../utils/productService';
import { updateStore, getStoreStaff, removeStaffMember, updateStaffRole, createStaffAccount, changeStaffPassword } from '../../utils/storeService';
import { useStore as useStoreCtx } from '../../contexts/StoreContext';
import { useStore } from '../../contexts/StoreContext';
import useStoreRole from '../../hooks/useStoreRole';
import { PERM, ROLE_LABELS, ROLE_COLORS } from '../../utils/permissions';
import './AdminStyles.css';
import './AdminPanel.css';

// ─── Main Panel ──────────────────────────────────────────────────────────────
const AdminPanel = ({ user, onLogout }) => {
  const { store, setStore } = useStore();
  const storeId = store?.id || null;
  const { role, loading: roleLoading, can, hasAccess } = useStoreRole(user);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [showChangePw, setShowChangePw] = useState(false);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [staff, setStaff] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showAddProduct, setShowAddProduct] = useState(false);

  const ordersRef = storeId
    ? collection(db, 'stores', storeId, 'orders')
    : collection(db, 'orders');

  const fetchData = useCallback(async () => {
    if (!storeId) return;
    setDataLoading(true);
    try {
      const [prods, staffList] = await Promise.all([
        fetchAllProductsFlat(storeId),
        getStoreStaff(storeId).catch(() => []),
      ]);
      setProducts(prods);
      setStaff(staffList);
    } finally {
      setDataLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    fetchData();
    const q = query(ordersRef, orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() }))), console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  // ── Guard ──
  if (roleLoading) return <div className="admin-loading"><div className="admin-loading-spinner" /><p>Checking access...</p></div>;

  if (!hasAccess) return (
    <div className="admin-no-access">
      <div className="admin-no-access-icon">🔒</div>
      <h2>Access Denied</h2>
      <p>You don't have a staff role for <strong>{store?.name}</strong>.</p>
      <p className="admin-no-access-sub">Ask the store owner to invite you.</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
        <button
          onClick={() => { window.location.href = '/admin'; }}
          style={{ padding: '10px 20px', background: '#25D366', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          Switch Account
        </button>
        <button
          onClick={onLogout}
          style={{ padding: '10px 20px', background: '#2a3942', color: '#e9edef', border: '1px solid #3d5263', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          Logout
        </button>
      </div>
    </div>
  );

  // ── Product handlers ──
  const handleAddProduct = async (data) => {
    await addProduct(data, storeId);
    clearCache('products'); fetchData(); setShowAddProduct(false);
    notify('Product added!', 'success');
  };

  const handleUpdateProduct = async (id, data) => {
    if (!id) return;
    await updateProduct(id, data, storeId);
    clearCache('products'); fetchData(); setSelectedProduct(null);
    notify('Product updated!', 'success');
  };

  const handleDeleteProduct = async (id) => {
    if (!id || !window.confirm('Delete this product?')) return;
    await deleteProduct(id, storeId);
    clearCache('products'); fetchData();
    notify('Product deleted.', 'success');
  };

  const handleSeedProducts = async () => {
    if (!window.confirm('Seed default products?')) return;
    await initializeDefaultProducts(storeId);
    clearCache('products'); fetchData();
    notify('Default products added!', 'success');
  };

  // ── Order handlers ──
  const setOrderStatus = async (tableNumber, status) => {
    const tableOrders = orders.filter(o => o.tableNumber === tableNumber);
    await Promise.all(tableOrders.map(o =>
      updateDoc(doc(db, ...(storeId ? ['stores', storeId, 'orders', o.id] : ['orders', o.id])), { status, updatedAt: serverTimestamp() })
    ));

    // When a table is cleared, also wipe presence, wishlists, and carts
    // so the next group of customers starts fresh
    if (status === 'completed' && storeId) {
      const rawNum = tableNumber.replace(/^Table\s+/i, '').trim();
      const tableKey = `${storeId}_table-${rawNum}`;
      try {
        const batch = writeBatch(db);
        // Delete all participant presence docs
        const presenceSnap = await getDocs(collection(db, 'tablePresence', tableKey, 'participants'));
        presenceSnap.forEach(d => batch.delete(d.ref));
        // Delete shared wishlist and cart docs
        batch.delete(doc(db, 'tableWishlists', tableKey));
        batch.delete(doc(db, 'tableCarts', tableKey));
        await batch.commit();
      } catch (_) { /* ignore if docs don't exist */ }
    }

    notify(`Table ${tableNumber} ${status === 'ready' ? 'marked ready' : 'cleared'}.`, 'success');
  };

  const notify = (msg, type) => window.addNotification?.(msg, type, 3000);

  const tabs = [
    { id: 'dashboard',     label: 'Dashboard',      perm: PERM.VIEW_DASHBOARD },
    { id: 'products',      label: 'Products',        perm: PERM.VIEW_PRODUCTS },
    { id: 'orders',        label: 'Dine-In Orders',  perm: PERM.VIEW_ORDERS },
    { id: 'online-orders', label: 'Online Orders',   perm: PERM.VIEW_ORDERS },
    { id: 'staff',         label: 'Staff',           perm: PERM.VIEW_STAFF },
    { id: 'settings',      label: 'Settings',        perm: PERM.EDIT_SETTINGS },
  ].filter(t => can(t.perm));

  if (dataLoading) return <div className="admin-loading"><div className="admin-loading-spinner" /><p>Loading...</p></div>;

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div className="admin-header-left">
          {store?.logo && <img src={store.logo} alt={store.name} className="admin-header-logo" onError={e => { e.target.style.display = 'none'; }} />}
          <div>
            <h1>{store?.name || 'Admin Panel'}</h1>
            <p>Management Dashboard</p>
          </div>
        </div>
        <div className="admin-header-right">
          <div className="admin-role-badge" style={{ background: ROLE_COLORS[role] + '22', color: ROLE_COLORS[role], border: `1px solid ${ROLE_COLORS[role]}44` }}>
            {ROLE_LABELS[role]}
          </div>
          <div className="admin-user-info">
            <span className="admin-user-name">{user?.name || user?.displayName || user?.email || 'User'}</span>
          </div>
          <button
            className="admin-logout-btn"
            onClick={() => {
              if (window.confirm('Are you sure you want to log out?')) {
                localStorage.removeItem('currentUser');
                localStorage.removeItem('lastActiveTab');
                if (onLogout) onLogout();
                window.location.href = '/admin';
              }
            }}
          >
            Log Out
          </button>
          <button className="admin-change-pw-btn" onClick={() => setShowChangePw(true)}>
            🔑 Change Password
          </button>
        </div>
      </div>

      {/* Change Password Modal */}
      {showChangePw && (
        <ChangePasswordModal
          user={user}
          onClose={() => setShowChangePw(false)}
        />
      )}

      <div className="admin-navigation">
        {tabs.map(t => (
          <button key={t.id} className={`admin-nav-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="admin-content">
        {activeTab === 'dashboard' && <DashboardTab products={products} orders={orders} staff={staff} can={can} />}
        {activeTab === 'products' && (
          <ProductsTab
            products={products}
            can={can}
            storeId={storeId}
            showAddProduct={showAddProduct}
            setShowAddProduct={setShowAddProduct}
            selectedProduct={selectedProduct}
            setSelectedProduct={setSelectedProduct}
            onAdd={handleAddProduct}
            onUpdate={handleUpdateProduct}
            onDelete={handleDeleteProduct}
            onSeed={handleSeedProducts}
          />
        )}
        {activeTab === 'orders' && <OrdersTab orders={orders.filter(o => o.orderType !== 'online')} can={can} storeId={storeId} onSetStatus={setOrderStatus} title="Dine-In Orders" />}
        {activeTab === 'online-orders' && <OnlineOrdersTab orders={orders.filter(o => o.orderType === 'online')} can={can} storeId={storeId} onSetStatus={setOrderStatus} />}
        {activeTab === 'staff' && <StaffTab storeId={storeId} user={user} role={role} can={can} />}
        {activeTab === 'settings' && (
          <StoreSettingsTab store={store} onSave={async (data) => {
            await updateStore(storeId, data);
            setStore(prev => ({ ...prev, ...data }));
            notify('Settings saved!', 'success');
          }} />
        )}
      </div>
    </div>
  );
};

// ─── Dashboard Tab ───────────────────────────────────────────────────────────
const DashboardTab = ({ products, orders, staff, can }) => {
  const uniqueCustomers = new Set(orders.map(o => o.customerPhone).filter(Boolean)).size;
  const onlineOrders  = orders.filter(o => o.orderType === 'online').length;
  const dineInOrders  = orders.filter(o => o.orderType !== 'online').length;
  const revenue = orders.reduce((s, o) => s + (o.total || 0), 0);
  return (
  <div className="admin-dashboard">
    <h2>Dashboard</h2>
    <div className="admin-dashboard-stats">
      <div className="admin-stat-card"><h3>Products</h3><p>{products.length}</p></div>
      <div className="admin-stat-card"><h3>Total Orders</h3><p>{orders.length}</p></div>
      {can(PERM.VIEW_ANALYTICS) && <div className="admin-stat-card"><h3>Dine-In</h3><p>{dineInOrders}</p></div>}
      {can(PERM.VIEW_ANALYTICS) && <div className="admin-stat-card"><h3>Online</h3><p>{onlineOrders}</p></div>}
      {can(PERM.VIEW_ANALYTICS) && <div className="admin-stat-card"><h3>Customers</h3><p>{uniqueCustomers}</p></div>}
      {can(PERM.VIEW_ANALYTICS) && <div className="admin-stat-card"><h3>Staff</h3><p>{staff.length}</p></div>}
      {can(PERM.VIEW_ANALYTICS) && <div className="admin-stat-card"><h3>Revenue</h3><p>${revenue.toFixed(2)}</p></div>}
    </div>
    {can(PERM.VIEW_ANALYTICS) && (
      <div className="admin-dashboard-actions">
        <button className="admin-cache-stats-btn" onClick={() => {
          const s = getCacheStats();
          window.addNotification?.(`Cache: Products(${s.products.cached ? 'Hit' : 'Miss'}), Orders(${s.orders.cached ? 'Hit' : 'Miss'})`, 'info', 5000);
        }}>📊 Cache Stats</button>
      </div>
    )}
  </div>
  );
};

// ─── Products Tab ─────────────────────────────────────────────────────────────
const ProductsTab = ({ products, can, storeId, showAddProduct, setShowAddProduct, selectedProduct, setSelectedProduct, onAdd, onUpdate, onDelete, onSeed }) => (
  <div className="admin-products">
    <div className="admin-products-header">
      <h2>Products</h2>
      <div className="admin-products-actions">
        {can(PERM.SEED_PRODUCTS) && products.length === 0 && (
          <button className="admin-update-ids-btn" onClick={onSeed}>Seed Defaults</button>
        )}
        {can(PERM.ADD_PRODUCT) && (
          <button className="admin-add-product-btn" onClick={() => setShowAddProduct(true)}>+ Add Product</button>
        )}
      </div>
    </div>

    {showAddProduct && can(PERM.ADD_PRODUCT) && (
      <ProductForm title="Add Product" submitLabel="Add Product" storeId={storeId} onSubmit={onAdd} onCancel={() => setShowAddProduct(false)} />
    )}

    <div className="admin-products-grid">
      {products.map(p => (
        <div key={p.id} className="admin-product-card">
          <img src={p.image} alt={p.name} className="admin-product-image"
            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
          <div style={{ display: 'none', width: '100%', height: '120px', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', fontSize: '40px', borderRadius: '8px' }}>🍽️</div>
          <div className="admin-product-info">
            <h3>{p.name}</h3>
            <p>{p.description}</p>
            <p className="admin-product-price">${p.price}</p>
            <p className="admin-product-category">{p.category}</p>
          </div>
          <div className="admin-product-actions">
            {can(PERM.EDIT_PRODUCT) && <button className="admin-edit-btn" onClick={() => setSelectedProduct(p)}>Edit</button>}
            {can(PERM.DELETE_PRODUCT) && <button className="admin-delete-btn" onClick={() => onDelete(p.id)}>Delete</button>}
            {!can(PERM.EDIT_PRODUCT) && !can(PERM.DELETE_PRODUCT) && (
              <span className="admin-read-only-badge">View Only</span>
            )}
          </div>
        </div>
      ))}
    </div>

    {selectedProduct && can(PERM.EDIT_PRODUCT) && (
      <ProductForm
        title="Edit Product"
        submitLabel="Update Product"
        initial={selectedProduct}
        storeId={storeId}
        onSubmit={(data) => onUpdate(selectedProduct.id, data)}
        onCancel={() => setSelectedProduct(null)}
      />
    )}
  </div>
);

// ─── Orders Tab ───────────────────────────────────────────────────────────────
const OrdersTab = ({ orders, can, onSetStatus }) => {
  const byTable = orders.reduce((acc, o) => {
    const t = o.tableNumber || 'Table 1';
    if (!acc[t]) acc[t] = [];
    acc[t].push(o);
    return acc;
  }, {});

  return (
    <div className="admin-orders">
      <div className="admin-orders-header">
        <h2>Orders</h2>
        <div className="admin-orders-summary">
          <span className="admin-total-tables">Tables: {Object.keys(byTable).length}</span>
          <span className="admin-total-orders">Orders: {orders.length}</span>
        </div>
      </div>
      <div className="admin-tables-grid">
        {Object.keys(byTable).map(tableNum => {
          const total = byTable[tableNum].reduce((s, o) => s + (o.total || 0), 0);
          return (
            <div key={tableNum} className="admin-table-card">
              <div className="admin-table-header">
                <h3>{tableNum}</h3>
                <div className="admin-table-status">
                  <span className="admin-order-count">{byTable[tableNum].length} orders</span>
                  <span className="admin-table-total">${total.toFixed(2)}</span>
                </div>
              </div>
              <div className="admin-table-orders">
                {byTable[tableNum].map(order => (
                  <div key={order.id} className="admin-table-order-item">
                    <div className="admin-order-customer">
                      <span className="admin-customer-name">{order.customerName || 'Anonymous'}</span>
                      <span className="admin-order-time">
                        {order.createdAt ? new Date(order.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                      </span>
                    </div>
                    <div className="admin-order-items">
                      {order.items?.map((item, i) => (
                        <div key={i} className="admin-order-item">
                          <span className="admin-item-quantity">{item.quantity}x</span>
                          <span className="admin-item-name">{item.name}</span>
                          <span className="admin-item-price">${item.price}</span>
                        </div>
                      ))}
                    </div>
                    <div className="admin-order-footer">
                      <span className="admin-order-total">${order.total?.toFixed(2) || '0.00'}</span>
                      <span className={`admin-order-status ${order.status || 'pending'}`}>{order.status || 'Pending'}</span>
                    </div>
                  </div>
                ))}
              </div>
              {can(PERM.MANAGE_ORDERS) && (
                <div className="admin-table-actions">
                  <button className="admin-mark-ready-btn" onClick={() => onSetStatus(tableNum, 'ready')}>Mark Ready</button>
                  <button className="admin-clear-table-btn" onClick={() => onSetStatus(tableNum, 'completed')}>Clear Table</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {Object.keys(byTable).length === 0 && (
        <div className="admin-no-tables">
          <p>No active tables</p>
          <p className="admin-no-tables-subtitle">Orders will appear here when customers place them</p>
        </div>
      )}
    </div>
  );
};

// ─── Online Orders Tab ────────────────────────────────────────────────────────
const OnlineOrdersTab = ({ orders, can, storeId, onSetStatus }) => {
  const statusColor = { pending: '#f59e0b', ready: '#25D366', completed: '#8696a0', cancelled: '#ff6b6b' };

  const updateStatus = async (orderId, status) => {
    const { doc, updateDoc } = await import('firebase/firestore');
    const { db: firestore } = await import('../../firebase/config');
    const path = storeId ? ['stores', storeId, 'orders', orderId] : ['orders', orderId];
    await updateDoc(doc(firestore, ...path), { status, updatedAt: new Date() });
    window.addNotification?.('Order status updated.', 'success', 2000);
  };

  return (
    <div className="admin-orders">
      <div className="admin-orders-header">
        <h2>Online Orders</h2>
        <div className="admin-orders-summary">
          <span className="admin-total-orders">Total: {orders.length}</span>
          <span className="admin-total-tables" style={{ color: '#f59e0b' }}>
            Pending: {orders.filter(o => o.status === 'pending').length}
          </span>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="admin-no-tables">
          <p>No online orders yet</p>
          <p className="admin-no-tables-subtitle">Orders placed via the online ordering page will appear here</p>
        </div>
      ) : (
        <div className="online-orders-list">
          {orders.map(order => (
            <div key={order.id} className="online-order-card">
              <div className="online-order-header">
                <div className="online-order-customer">
                  <strong>{order.customerName}</strong>
                  <span className="online-order-phone">{order.customerPhone}</span>
                </div>
                <div className="online-order-meta">
                  <span className="online-order-type">
                    {order.deliveryType === 'delivery' ? '🚚 Delivery' : '🏃 Pickup'}
                  </span>
                  <span className="online-order-time">
                    {order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                </div>
              </div>

              {order.deliveryAddress && (
                <div className="online-order-address">
                  📍 {order.deliveryAddress}
                </div>
              )}

              <div className="admin-order-items">
                {order.items?.map((item, i) => (
                  <div key={i} className="admin-order-item">
                    <span className="admin-item-quantity">{item.quantity}x</span>
                    <span className="admin-item-name">{item.name}</span>
                    <span className="admin-item-price">${item.price}</span>
                  </div>
                ))}
              </div>

              {order.specialInstructions && (
                <div className="online-order-notes">💬 {order.specialInstructions}</div>
              )}

              <div className="online-order-footer">
                <strong className="online-order-total">${order.total?.toFixed(2)}</strong>
                <div className="online-order-actions">
                  <span
                    className="online-order-status"
                    style={{ background: (statusColor[order.status] || '#8696a0') + '22', color: statusColor[order.status] || '#8696a0' }}
                  >
                    {order.status || 'pending'}
                  </span>
                  {can(PERM.MANAGE_ORDERS) && order.status !== 'completed' && (
                    <select
                      className="online-order-status-select"
                      value={order.status || 'pending'}
                      onChange={e => updateStatus(order.id, e.target.value)}
                    >
                      <option value="pending">Pending</option>
                      <option value="preparing">Preparing</option>
                      <option value="ready">Ready</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Staff Tab ────────────────────────────────────────────────────────────────
const generateStaffPassword = () => '1234';

const StaffTab = ({ storeId, user, role, can }) => {
  const { store } = useStoreCtx();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [credentials, setCredentials] = useState(null); // { phone, password, name, role }

  // Invite form state
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('staff');
  const [creating, setCreating] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const loadStaff = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const s = await getStoreStaff(storeId);
    setStaff(s);
    setLoading(false);
  }, [storeId]);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const handleRemove = async (phone) => {
    if (phone === user.phoneNumber) { window.addNotification?.("You can't remove yourself.", 'error', 3000); return; }
    if (!window.confirm('Remove this staff member?')) return;
    await removeStaffMember(storeId, phone);
    window.addNotification?.('Staff member removed.', 'success', 3000);
    loadStaff();
  };

  const handleRoleChange = async (phone, newRole) => {
    if (phone === user.phoneNumber) { window.addNotification?.("You can't change your own role.", 'error', 3000); return; }
    await updateStaffRole(storeId, phone, newRole);
    window.addNotification?.('Role updated.', 'success', 3000);
    loadStaff();
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setInviteError('');
    if (!invitePhone.trim()) { setInviteError('Phone number is required.'); return; }
    setCreating(true);
    const password = generateStaffPassword();
    try {
      await createStaffAccount({
        phoneNumber: invitePhone.trim(),
        password,
        name: inviteName.trim() || invitePhone.trim(),
        storeId,
        storeSlug: store?.slug || '',
        role: inviteRole,
        addedBy: user.phoneNumber,
      });
      setCredentials({ phone: invitePhone.trim(), password, name: inviteName.trim() || invitePhone.trim(), role: inviteRole });
      setShowInviteModal(false);
      setInvitePhone(''); setInviteName(''); setInviteRole('staff');
      loadStaff();
      window.addNotification?.('Staff account created!', 'success', 3000);
    } catch (err) {
      setInviteError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="staff-loading">Loading staff...</div>;

  return (
    <div className="admin-staff">
      <div className="admin-staff-header">
        <h2>Staff Management</h2>
        {(can(PERM.INVITE_STAFF) || can(PERM.INVITE_MANAGER)) && (
          <button className="admin-add-product-btn" onClick={() => { setShowInviteModal(true); setInviteError(''); }}>
            + Add Member
          </button>
        )}
      </div>

      {/* Staff List */}
      <div className="staff-list">
        {staff.length === 0 && <p className="staff-loading">No staff members yet.</p>}
        {staff.map(member => (
          <div key={member.id} className="staff-card">
            <div className="staff-avatar" style={{ background: ROLE_COLORS[member.role] + '22', color: ROLE_COLORS[member.role] }}>
              {(member.name || member.phoneNumber).charAt(0).toUpperCase()}
            </div>
            <div className="staff-info">
              <div className="staff-name">{member.name || member.phoneNumber}</div>
              <div className="staff-phone">{member.phoneNumber}</div>
            </div>
            <div className="staff-actions">
              {can(PERM.REMOVE_STAFF) && member.phoneNumber !== user.phoneNumber ? (
                <select className="staff-role-select" value={member.role} onChange={e => handleRoleChange(member.phoneNumber, e.target.value)} style={{ borderColor: ROLE_COLORS[member.role] }}>
                  <option value="owner">Owner</option>
                  <option value="manager">Manager</option>
                  <option value="staff">Staff</option>
                </select>
              ) : (
                <span className="staff-role-badge" style={{ background: ROLE_COLORS[member.role] + '22', color: ROLE_COLORS[member.role] }}>
                  {ROLE_LABELS[member.role]}{member.phoneNumber === user.phoneNumber && ' (You)'}
                </span>
              )}
              {can(PERM.REMOVE_STAFF) && member.phoneNumber !== user.phoneNumber && (
                <button className="staff-remove-btn" onClick={() => handleRemove(member.phoneNumber)}>Remove</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Member Modal */}
      {showInviteModal && (
        <div className="admin-form-overlay">
          <div className="admin-form-modal">
            <div className="admin-form-modal-header">
              <h3>Add Staff Member</h3>
              <button className="admin-form-close" onClick={() => setShowInviteModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateAccount}>
              <div className="admin-form-group">
                <label>Phone Number *</label>
                <input type="tel" value={invitePhone} onChange={e => setInvitePhone(e.target.value)} placeholder="+1234567890" required autoFocus />
              </div>
              <div className="admin-form-group">
                <label>Name</label>
                <input type="text" value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Staff member's name" />
              </div>
              <div className="admin-form-group">
                <label>Role</label>
                <select className="staff-role-select-modal" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                  {can(PERM.INVITE_MANAGER) && <option value="manager">Manager</option>}
                  {can(PERM.INVITE_STAFF) && <option value="staff">Staff</option>}
                </select>
                <p className="staff-role-desc">
                  {inviteRole === 'manager' ? 'Can manage products, view orders, invite staff. Cannot edit store settings.' : 'Can view products and manage orders only.'}
                </p>
              </div>
              {inviteError && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 10 }}>{inviteError}</p>}
              <div className="admin-form-actions">
                <button type="submit" className="admin-submit-btn" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Account & Generate Password'}
                </button>
                <button type="button" className="admin-cancel-btn" onClick={() => setShowInviteModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {credentials && (
        <div className="admin-form-overlay">
          <div className="admin-form-modal">
            <div className="admin-form-modal-header">
              <h3>✅ Account Created</h3>
            </div>
            <div className="staff-creds-banner">
              <p>Share these credentials with <strong>{credentials.name}</strong>. The password is shown only once.</p>
            </div>
            <div className="staff-creds-grid">
              <StaffCredRow label="Phone Number" value={credentials.phone} />
              <StaffCredRow label="Password" value={credentials.password} secret />
              <StaffCredRow label="Role" value={ROLE_LABELS[credentials.role]} />
              <StaffCredRow label="Login URL" value={`${window.location.origin}/login`} />
            </div>
            <div className="staff-creds-copy-all">
              <button className="invite-copy-btn" style={{ flex: 1 }} onClick={() => {
                navigator.clipboard.writeText(`Phone: ${credentials.phone}\nPassword: ${credentials.password}\nRole: ${ROLE_LABELS[credentials.role]}\nLogin: ${window.location.origin}/login`);
                window.addNotification?.('Credentials copied!', 'success', 2000);
              }}>📋 Copy All</button>
            </div>
            <div className="admin-form-actions" style={{ marginTop: 16 }}>
              <button className="admin-submit-btn" onClick={() => setCredentials(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StaffCredRow = ({ label, value, secret }) => {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="sa-cred-row">
      <label>{label}</label>
      <div className="sa-cred-value-row">
        <span className="sa-cred-value">{secret && !show ? '••••••••••' : value}</span>
        {secret && <button type="button" className="sa-cred-toggle" onClick={() => setShow(s => !s)}>{show ? '🙈' : '👁'}</button>}
        <button type="button" className="sa-cred-copy" onClick={copy}>{copied ? '✅' : '📋'}</button>
      </div>
    </div>
  );
};

// ─── Store Settings Tab ───────────────────────────────────────────────────────
const StoreSettingsTab = ({ store, onSave }) => {
  const [form, setForm] = useState({
    name: store?.name || '',
    description: store?.description || '',
    logo: store?.logo || '',
    tableCount: store?.tableCount || 10,
    primaryColor: store?.theme?.primaryColor || '#25D366',
    accentColor: store?.theme?.accentColor || '#005c4b',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({ name: form.name, description: form.description, logo: form.logo, tableCount: parseInt(form.tableCount), theme: { primaryColor: form.primaryColor, accentColor: form.accentColor } });
    setSaving(false);
  };

  return (
    <div className="admin-store-settings">
      <h2>Store Settings</h2>
      <form onSubmit={handleSubmit} className="admin-settings-form">
        <div className="admin-form-group"><label>Restaurant Name</label><input type="text" value={form.name} onChange={e => set('name', e.target.value)} required /></div>
        <div className="admin-form-group"><label>Description / Tagline</label><input type="text" value={form.description} onChange={e => set('description', e.target.value)} /></div>
        <div className="admin-form-group">
          <label>Logo URL</label>
          <input type="text" value={form.logo} onChange={e => set('logo', e.target.value)} placeholder="https://..." />
          {form.logo && <img src={form.logo} alt="preview" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '12px', marginTop: '8px' }} onError={e => { e.target.style.display = 'none'; }} onLoad={e => { e.target.style.display = 'block'; }} />}
        </div>
        <div className="admin-form-group"><label>Number of Tables</label><input type="number" min="1" max="50" value={form.tableCount} onChange={e => set('tableCount', e.target.value)} /></div>
        <div className="admin-form-row">
          <div className="admin-form-group"><label>Primary Color</label><input type="color" value={form.primaryColor} onChange={e => set('primaryColor', e.target.value)} /></div>
          <div className="admin-form-group"><label>Accent Color</label><input type="color" value={form.accentColor} onChange={e => set('accentColor', e.target.value)} /></div>
        </div>
        <div className="admin-form-group">
          <label>Store URL Slug</label>
          <input type="text" value={store?.slug || ''} disabled style={{ opacity: 0.5 }} />
          <small style={{ color: '#8696a0', fontSize: '12px' }}>Slug cannot be changed after creation</small>
        </div>
        <div className="admin-form-actions">
          <button type="submit" className="admin-submit-btn" disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</button>
        </div>
      </form>
    </div>
  );
};

// ─── Image Picker (upload or URL) ────────────────────────────────────────────
// onUploadingChange lets ProductForm disable submit while upload is in progress
const ImagePicker = ({ value, onChange, storeId, onUploadingChange }) => {
  const [mode, setMode] = useState(value && !value.startsWith('blob') ? 'url' : 'upload');
  const [urlInput, setUrlInput] = useState(value || '');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = React.useRef();

  const setUploadingState = (state) => {
    setUploading(state);
    onUploadingChange?.(state);
  };

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      window.addNotification?.('Please select a valid image file.', 'error', 3000);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      window.addNotification?.('Image must be under 5 MB.', 'error', 3000);
      return;
    }

    // Show local preview immediately while upload runs
    onChange(URL.createObjectURL(file));

    const path = `stores/${storeId || 'global'}/products/${Date.now()}_${file.name.replace(/[^a-z0-9.]/gi, '_')}`;
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file);

    setUploadingState(true);
    setUploadProgress(0);

    task.on('state_changed',
      (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => {
        console.error('Upload error:', err);
        window.addNotification?.('Upload failed: ' + err.message, 'error', 4000);
        onChange(''); // clear the blob preview so no invalid URL is saved
        setUploadingState(false);
      },
      async () => {
        const downloadUrl = await getDownloadURL(task.snapshot.ref);
        onChange(downloadUrl); // replace blob with real Firebase URL
        setUploadingState(false);
        window.addNotification?.('Image uploaded!', 'success', 2000);
      }
    );
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleUrlCommit = () => onChange(urlInput.trim());

  // Only show preview for real URLs, never for blob: (temporary local references)
  const preview = value && !value.startsWith('blob:') ? value : '';

  return (
    <div className="image-picker">
      {/* Mode toggle */}
      <div className="image-picker-tabs">
        <button type="button" className={`ip-tab ${mode === 'upload' ? 'active' : ''}`} onClick={() => setMode('upload')}>
          📁 Upload File
        </button>
        <button type="button" className={`ip-tab ${mode === 'url' ? 'active' : ''}`} onClick={() => setMode('url')}>
          🔗 Paste URL
        </button>
      </div>

      {mode === 'upload' && (
        <div
          className={`ip-dropzone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => e.target.files[0] && handleFile(e.target.files[0])}
          />
          {uploading ? (
            <div className="ip-upload-progress">
              <div className="ip-progress-bar"><div className="ip-progress-fill" style={{ width: `${uploadProgress}%` }} /></div>
              <span>{uploadProgress}% uploading...</span>
            </div>
          ) : (
            <>
              <div className="ip-dropzone-icon">🖼️</div>
              <p className="ip-dropzone-text">Drop image here or <strong>click to browse</strong></p>
              <p className="ip-dropzone-hint">JPG, PNG, WebP — max 5 MB</p>
            </>
          )}
        </div>
      )}

      {mode === 'url' && (
        <div className="ip-url-row">
          <input
            type="text"
            className="ip-url-input"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onBlur={handleUrlCommit}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleUrlCommit())}
            placeholder="https://example.com/image.jpg"
          />
          <button type="button" className="ip-url-apply" onClick={handleUrlCommit}>Apply</button>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="ip-preview-wrap">
          <img
            src={preview}
            alt="preview"
            className="ip-preview-img"
            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
            onLoad={e => { e.target.style.display = 'block'; e.target.nextSibling && (e.target.nextSibling.style.display = 'none'); }}
          />
          <div className="ip-preview-error">⚠️ Cannot load image</div>
          <button
            type="button"
            className="ip-preview-remove"
            onClick={() => { onChange(''); setUrlInput(''); }}
          >✕ Remove</button>
        </div>
      )}
    </div>
  );
};

// ─── Shared Product Form ──────────────────────────────────────────────────────
const ProductForm = ({ title, submitLabel, initial = {}, onSubmit, onCancel, storeId }) => {
  const [form, setForm] = useState({
    name: initial.name || '', description: initial.description || '', fullDescription: initial.fullDescription || '',
    price: initial.price || '', category: initial.category || 'main-course', image: initial.image || '',
    rating: initial.rating || 4.5, spiceLevel: initial.spiceLevel || 0,
    chefSpecial: initial.chefSpecial || false, isAvailable: initial.isAvailable !== false,
    reviewCount: initial.reviewCount || 0, orderCount: initial.orderCount || 0,
  });
  const [imageUploading, setImageUploading] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="admin-form-overlay">
      <div className="admin-form-modal">
        <div className="admin-form-modal-header">
          <h3>{title}</h3>
          <button type="button" className="admin-form-close" onClick={onCancel}>✕</button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSubmit({ ...form, price: parseFloat(form.price), rating: parseFloat(form.rating), spiceLevel: parseInt(form.spiceLevel), reviewCount: parseInt(form.reviewCount), orderCount: parseInt(form.orderCount) }); }}>
          <div className="admin-form-group"><label>Name</label><input type="text" value={form.name} onChange={e => set('name', e.target.value)} required /></div>
          <div className="admin-form-group"><label>Short Description</label><textarea value={form.description} onChange={e => set('description', e.target.value)} required /></div>
          <div className="admin-form-group"><label>Full Description</label><textarea value={form.fullDescription} onChange={e => set('fullDescription', e.target.value)} rows={3} /></div>
          <div className="admin-form-row">
            <div className="admin-form-group"><label>Price ($)</label><input type="number" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} required /></div>
            <div className="admin-form-group"><label>Spice Level (0–3)</label><input type="number" min="0" max="3" value={form.spiceLevel} onChange={e => set('spiceLevel', e.target.value)} /></div>
          </div>
          <div className="admin-form-group">
            <label>Category</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}>
              <option value="main-course">Main Course</option>
              <option value="appetizers">Appetizers</option>
              <option value="desserts">Desserts</option>
              <option value="drinks">Drinks</option>
              <option value="sides">Sides</option>
            </select>
          </div>
          <div className="admin-form-group">
            <label>Product Image</label>
            <ImagePicker
              value={form.image}
              onChange={v => set('image', v)}
              storeId={storeId}
              onUploadingChange={setImageUploading}
            />
            {imageUploading && (
              <p className="ip-uploading-warning">⏳ Waiting for image upload to finish...</p>
            )}
          </div>
          <div className="admin-form-row">
            <label className="admin-form-checkbox"><input type="checkbox" checked={form.chefSpecial} onChange={e => set('chefSpecial', e.target.checked)} />Chef Special</label>
            <label className="admin-form-checkbox"><input type="checkbox" checked={form.isAvailable} onChange={e => set('isAvailable', e.target.checked)} />Available</label>
          </div>
          <div className="admin-form-actions">
            <button type="submit" className="admin-submit-btn" disabled={imageUploading}>
              {imageUploading ? '⏳ Uploading image...' : submitLabel}
            </button>
            <button type="button" className="admin-cancel-btn" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Change Password Modal ────────────────────────────────────────────────────
const ChangePasswordModal = ({ user, onClose }) => {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPw !== confirmPw) { setError('New passwords do not match.'); return; }
    if (newPw.length < 4) { setError('New password must be at least 4 characters.'); return; }
    setSaving(true);
    try {
      await changeStaffPassword(user.phoneNumber, currentPw, newPw);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-form-overlay">
      <div className="admin-form-modal" style={{ maxWidth: 420 }}>
        <div className="admin-form-modal-header">
          <h3>🔑 Change Password</h3>
          <button className="admin-form-close" onClick={onClose}>✕</button>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <p style={{ color: '#2c3e50', fontWeight: 600, marginBottom: 6 }}>Password updated successfully!</p>
            <p style={{ color: '#7f8c8d', fontSize: 13, marginBottom: 20 }}>Use your new password next time you log in.</p>
            <button className="admin-submit-btn" onClick={onClose}>Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="admin-form-group">
              <label>Current Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  placeholder="Enter current password"
                  required
                  autoFocus
                  style={{ paddingRight: 40 }}
                />
                <button type="button" onClick={() => setShowCurrent(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#7f8c8d' }}>
                  {showCurrent ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <div className="admin-form-group">
              <label>New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="At least 4 characters"
                  required
                  style={{ paddingRight: 40 }}
                />
                <button type="button" onClick={() => setShowNew(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#7f8c8d' }}>
                  {showNew ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <div className="admin-form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="Re-enter new password"
                required
              />
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 14 }}>
                {error}
              </div>
            )}

            <div className="admin-form-actions">
              <button type="submit" className="admin-submit-btn" disabled={saving}>
                {saving ? 'Saving...' : 'Update Password'}
              </button>
              <button type="button" className="admin-cancel-btn" onClick={onClose}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;

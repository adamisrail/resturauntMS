import React, { useState, useEffect, useCallback } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { getAllStores, createStore, ensureOwnerRole, slugify, getStoreStaff } from '../../utils/storeService';
import { fetchAllProductsFlat } from '../../utils/productService';
import './SuperAdmin.css';

// ─── Super Admin Password Gate ────────────────────────────────────────────────
const SUPER_ADMIN_PASSWORD = 'superadmin2024';

const generatePassword = () => {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%';
  const all = upper + lower + digits + special;
  const rand = (s) => s[Math.floor(Math.random() * s.length)];
  const core = Array.from({ length: 8 }, () => rand(all)).join('');
  // Guarantee at least one of each type
  return rand(upper) + rand(lower) + rand(digits) + rand(special) + core;
};

// ─── Main SuperAdmin Component ────────────────────────────────────────────────
const SuperAdmin = () => {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('superadmin_authed') === '1');
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');

  const handleAuth = (e) => {
    e.preventDefault();
    if (pwInput === SUPER_ADMIN_PASSWORD) {
      sessionStorage.setItem('superadmin_authed', '1');
      setAuthed(true);
    } else {
      setPwError('Incorrect password.');
    }
  };

  if (!authed) {
    return (
      <div className="sa-gate">
        <div className="sa-gate-card">
          <div className="sa-gate-icon">🔐</div>
          <h2>Super Admin</h2>
          <p>Enter the platform password to continue</p>
          <form onSubmit={handleAuth}>
            <input
              type="password"
              value={pwInput}
              onChange={e => { setPwInput(e.target.value); setPwError(''); }}
              placeholder="Password"
              className="sa-gate-input"
              autoFocus
            />
            {pwError && <p className="sa-error">{pwError}</p>}
            <button type="submit" className="sa-btn-primary">Enter</button>
          </form>
        </div>
      </div>
    );
  }

  return <SuperAdminDashboard />;
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
const SuperAdminDashboard = () => {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [credentials, setCredentials] = useState(null); // { email, password, storeSlug, storeName }

  const loadStores = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getAllStores();
      // Enrich each store with product count and staff
      const enriched = await Promise.all(list.map(async (store) => {
        const [products, staff] = await Promise.all([
          fetchAllProductsFlat(store.id).catch(() => []),
          getStoreStaff(store.id).catch(() => []),
        ]);
        return { ...store, productCount: products.length, staffCount: staff.length, staff };
      }));
      setStores(enriched);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStores(); }, [loadStores]);

  return (
    <div className="sa-panel">
      {/* Header */}
      <div className="sa-header">
        <div>
          <h1>🛠 Platform Admin</h1>
          <p>Manage all restaurant stores</p>
        </div>
        <button className="sa-btn-primary" onClick={() => setShowCreate(true)}>+ Create Store</button>
      </div>

      {/* Stats */}
      <div className="sa-stats">
        <div className="sa-stat"><span>{stores.length}</span><label>Stores</label></div>
        <div className="sa-stat"><span>{stores.reduce((s, st) => s + (st.productCount || 0), 0)}</span><label>Products</label></div>
        <div className="sa-stat"><span>{stores.reduce((s, st) => s + (st.staffCount || 0), 0)}</span><label>Staff</label></div>
      </div>

      {/* Stores Table */}
      {loading ? (
        <div className="sa-loading"><div className="sa-spinner" /><p>Loading stores...</p></div>
      ) : (
        <div className="sa-stores-table">
          <div className="sa-table-header">
            <span>Store</span>
            <span>Slug</span>
            <span>Owner</span>
            <span>Products</span>
            <span>Staff</span>
            <span>Actions</span>
          </div>
          {stores.length === 0 && (
            <div className="sa-empty">No stores yet. Create the first one.</div>
          )}
          {stores.map(store => (
            <div key={store.id} className="sa-table-row">
              <div className="sa-store-name-cell">
                {store.logo
                  ? <img src={store.logo} alt={store.name} className="sa-store-logo" onError={e => { e.target.style.display = 'none'; }} />
                  : <div className="sa-store-logo-placeholder">{store.name.charAt(0)}</div>
                }
                <div>
                  <strong>{store.name}</strong>
                  {store.description && <small>{store.description}</small>}
                </div>
              </div>
              <span className="sa-slug">/{store.slug}</span>
              <span className="sa-owner-email">{store.ownerEmail || '—'}</span>
              <span className="sa-badge sa-badge-blue">{store.productCount || 0}</span>
              <span className="sa-badge sa-badge-green">{store.staffCount || 0}</span>
              <div className="sa-row-actions">
                <button className="sa-btn-sm" onClick={() => setSelectedStore(store)}>View</button>
                <a
                  className="sa-btn-sm sa-btn-sm-outline"
                  href={`/${store.slug}/admin`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Admin ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Store Modal */}
      {showCreate && (
        <CreateStoreModal
          onClose={() => setShowCreate(false)}
          onCreated={(creds) => {
            setShowCreate(false);
            setCredentials(creds);
            loadStores();
          }}
        />
      )}

      {/* Credentials Modal */}
      {credentials && (
        <CredentialsModal
          credentials={credentials}
          onClose={() => setCredentials(null)}
        />
      )}

      {/* Store Detail Drawer */}
      {selectedStore && (
        <StoreDetailDrawer
          store={selectedStore}
          onClose={() => setSelectedStore(null)}
        />
      )}
    </div>
  );
};

// ─── Create Store Modal ───────────────────────────────────────────────────────
const CreateStoreModal = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({ name: '', email: '', description: '', logo: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    const slug = slugify(form.name);
    const password = generatePassword();

    try {
      // 1. Create Firebase Auth account for the store owner
      let firebaseUser;
      try {
        const cred = await createUserWithEmailAndPassword(auth, form.email, password);
        firebaseUser = cred.user;
      } catch (authErr) {
        if (authErr.code === 'auth/email-already-in-use') {
          setError('This email already has an account. Use a different email.');
        } else {
          setError(`Auth error: ${authErr.message}`);
        }
        setCreating(false);
        return;
      }

      // 2. Create store document
      const storeId = await createStore({
        name: form.name.trim(),
        slug,
        description: form.description.trim(),
        logo: form.logo.trim(),
        ownerId: firebaseUser.uid,
        ownerEmail: form.email.trim(),
        plan: 'free',
        tableCount: 10,
      });

      // 3. Register as owner in staff subcollection
      await ensureOwnerRole(storeId, {
        phoneNumber: firebaseUser.uid,
        name: form.name + ' Owner',
        displayName: form.name + ' Owner',
      });

      onCreated({
        email: form.email,
        password,
        storeSlug: slug,
        storeName: form.name,
        storeId,
        loginUrl: `${window.location.origin}/`,
        adminUrl: `${window.location.origin}/${slug}/admin`,
      });
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  };

  return (
    <div className="sa-modal-overlay" onClick={onClose}>
      <div className="sa-modal" onClick={e => e.stopPropagation()}>
        <div className="sa-modal-header">
          <h2>Create New Store</h2>
          <button className="sa-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleCreate}>
          <div className="sa-form-group">
            <label>Store Name *</label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Xander's Kitchen" required />
            {form.name && <span className="sa-slug-preview">URL: /{slugify(form.name)}</span>}
          </div>
          <div className="sa-form-group">
            <label>Owner Email * <small>(login credentials will be sent to this email)</small></label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="owner@restaurant.com" required />
          </div>
          <div className="sa-form-group">
            <label>Description</label>
            <input type="text" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Short tagline" />
          </div>
          <div className="sa-form-group">
            <label>Logo URL</label>
            <input type="text" value={form.logo} onChange={e => set('logo', e.target.value)} placeholder="https://..." />
          </div>
          {error && <p className="sa-error">{error}</p>}
          <div className="sa-form-row">
            <button type="submit" className="sa-btn-primary" disabled={creating}>
              {creating ? 'Creating...' : 'Create Store & Generate Credentials'}
            </button>
            <button type="button" className="sa-btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Credentials Modal ────────────────────────────────────────────────────────
const CredentialsModal = ({ credentials, onClose }) => {
  const [copied, setCopied] = useState('');

  const copy = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const mailtoBody = encodeURIComponent(
    `Hello,\n\nYour restaurant "${credentials.storeName}" has been created on our platform.\n\nHere are your login credentials:\n\nEmail: ${credentials.email}\nPassword: ${credentials.password}\n\nAdmin Panel: ${credentials.adminUrl}\n\nPlease log in and change your password after the first login.\n\nBest regards,\nRestaurant Platform`
  );

  const mailtoLink = `mailto:${credentials.email}?subject=Your%20Restaurant%20Credentials%20-%20${encodeURIComponent(credentials.storeName)}&body=${mailtoBody}`;

  return (
    <div className="sa-modal-overlay">
      <div className="sa-modal sa-creds-modal">
        <div className="sa-modal-header">
          <h2>✅ Store Created Successfully</h2>
        </div>

        <div className="sa-creds-banner">
          <p>Share these credentials with the store owner. <strong>The password is shown only once.</strong></p>
        </div>

        <div className="sa-creds-grid">
          <CredRow label="Store Name" value={credentials.storeName} onCopy={() => copy(credentials.storeName, 'name')} copied={copied === 'name'} />
          <CredRow label="Email" value={credentials.email} onCopy={() => copy(credentials.email, 'email')} copied={copied === 'email'} />
          <CredRow label="Password" value={credentials.password} onCopy={() => copy(credentials.password, 'password')} copied={copied === 'password'} password />
          <CredRow label="Admin URL" value={credentials.adminUrl} onCopy={() => copy(credentials.adminUrl, 'url')} copied={copied === 'url'} />
        </div>

        <div className="sa-creds-copy-all">
          <button
            className="sa-btn-copy-all"
            onClick={() => copy(`Store: ${credentials.storeName}\nEmail: ${credentials.email}\nPassword: ${credentials.password}\nAdmin: ${credentials.adminUrl}`, 'all')}
          >
            {copied === 'all' ? '✅ Copied!' : '📋 Copy All'}
          </button>
          <a href={mailtoLink} className="sa-btn-email">
            📧 Open Email Draft
          </a>
        </div>

        <div className="sa-form-row" style={{ marginTop: 16 }}>
          <button className="sa-btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

const CredRow = ({ label, value, onCopy, copied, password }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="sa-cred-row">
      <label>{label}</label>
      <div className="sa-cred-value-row">
        <span className="sa-cred-value">
          {password && !show ? '••••••••••••' : value}
        </span>
        {password && (
          <button className="sa-cred-toggle" onClick={() => setShow(s => !s)}>{show ? '🙈' : '👁'}</button>
        )}
        <button className="sa-cred-copy" onClick={onCopy}>{copied ? '✅' : '📋'}</button>
      </div>
    </div>
  );
};

// ─── Store Detail Drawer ──────────────────────────────────────────────────────
const StoreDetailDrawer = ({ store, onClose }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllProductsFlat(store.id)
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [store.id]);

  return (
    <div className="sa-drawer-overlay" onClick={onClose}>
      <div className="sa-drawer" onClick={e => e.stopPropagation()}>
        <div className="sa-drawer-header">
          <div className="sa-drawer-title">
            {store.logo
              ? <img src={store.logo} alt={store.name} className="sa-store-logo" onError={e => { e.target.style.display = 'none'; }} />
              : <div className="sa-store-logo-placeholder">{store.name.charAt(0)}</div>
            }
            <div>
              <h2>{store.name}</h2>
              <span className="sa-slug">/{store.slug}</span>
            </div>
          </div>
          <button className="sa-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="sa-drawer-meta">
          <div className="sa-meta-item"><label>Owner Email</label><span>{store.ownerEmail || '—'}</span></div>
          <div className="sa-meta-item"><label>Plan</label><span className="sa-badge sa-badge-blue">{store.plan || 'free'}</span></div>
          <div className="sa-meta-item"><label>Products</label><span>{store.productCount}</span></div>
          <div className="sa-meta-item"><label>Staff</label><span>{store.staffCount}</span></div>
        </div>

        <div className="sa-drawer-actions">
          <a href={`/${store.slug}`} target="_blank" rel="noreferrer" className="sa-btn-sm">Customer View ↗</a>
          <a href={`/${store.slug}/admin`} target="_blank" rel="noreferrer" className="sa-btn-sm">Admin Panel ↗</a>
        </div>

        <h3 className="sa-drawer-section-title">Products ({products.length})</h3>
        {loading ? (
          <div className="sa-loading"><div className="sa-spinner" /></div>
        ) : products.length === 0 ? (
          <p className="sa-empty">No products yet.</p>
        ) : (
          <div className="sa-products-list">
            {products.map(p => (
              <div key={p.id} className="sa-product-row">
                <img
                  src={p.image}
                  alt={p.name}
                  className="sa-product-thumb"
                  onError={e => { e.target.src = ''; e.target.style.display = 'none'; }}
                />
                <div className="sa-product-info">
                  <strong>{p.name}</strong>
                  <small>{p.category} · ${p.price}</small>
                </div>
                <span className={`sa-avail-dot ${p.isAvailable ? 'available' : 'unavailable'}`} title={p.isAvailable ? 'Available' : 'Unavailable'} />
              </div>
            ))}
          </div>
        )}

        {store.staff?.length > 0 && (
          <>
            <h3 className="sa-drawer-section-title">Staff ({store.staff.length})</h3>
            <div className="sa-staff-list">
              {store.staff.map(m => (
                <div key={m.id} className="sa-staff-row">
                  <div className="sa-staff-avatar">{(m.name || m.id).charAt(0).toUpperCase()}</div>
                  <div>
                    <strong>{m.name || m.id}</strong>
                    <small>{m.role}</small>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SuperAdmin;

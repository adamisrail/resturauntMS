import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { verifyStaffLogin, getStoresForUser, createStore, ensureOwnerRole, slugify } from '../../utils/storeService';
import { ROLE_LABELS, ROLE_COLORS } from '../../utils/permissions';
import './AdminLogin.css';

const AdminLogin = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState('login'); // 'login' | 'signup' | 'pick'
  const [stores, setStores] = useState([]);
  const [pickerUser, setPickerUser] = useState(null);

  // When coming from /:storeSlug/admin, the redirect param is e.g. "/zohaib-store/admin"
  // Extract the slug so we can skip the store picker and go directly there.
  const targetSlug = (() => {
    const r = searchParams.get('redirect');
    if (!r) return null;
    const firstSegment = r.split('/').filter(Boolean)[0];
    return firstSegment || null;
  })();

  // If user is already logged in, skip the picker when a target store is known
  useEffect(() => {
    const saved = localStorage.getItem('currentUser');
    if (!saved) return;
    try {
      const u = JSON.parse(saved);
      setPickerUser(u);
      getStoresForUser(u.phoneNumber).then(userStores => {
        if (userStores.length === 0) return;
        if (targetSlug) {
          const match = userStores.find(s => s.slug === targetSlug);
          if (match) {
            onLoginSuccess(match.slug);
            navigate(`/${match.slug}/admin`);
            return;
          }
        }
        setStores(userStores);
        setView('pick');
      });
    } catch (_) {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoginDone = async (userData) => {
    localStorage.setItem('currentUser', JSON.stringify(userData));
    setPickerUser(userData);
    const userStores = await getStoresForUser(userData.phoneNumber);

    if (userStores.length === 0) {
      // No store — superadmin or fresh owner who just signed up
      onLoginSuccess(null);
      navigate('/superadmin');
      return;
    }

    // If the user arrived from a specific store URL, go directly to that store
    if (targetSlug) {
      const match = userStores.find(s => s.slug === targetSlug);
      if (match) {
        onLoginSuccess(match.slug);
        navigate(`/${match.slug}/admin`);
        return;
      }
    }

    if (userData.role === 'owner' || userStores.length > 1) {
      // Owners / multi-store users see the picker when no target store is set
      setStores(userStores);
      setView('pick');
    } else {
      // Staff with exactly 1 store → go directly
      onLoginSuccess(userStores[0].slug);
      navigate(`/${userStores[0].slug}/admin`);
    }
  };

  const handleStoreCreated = (newStore) => {
    setStores(prev => [...prev, { ...newStore, myRole: 'owner' }]);
    setView('pick');
  };

  if (view === 'pick') {
    return (
      <StorePicker
        stores={stores}
        user={pickerUser}
        onSelect={(slug) => { onLoginSuccess(slug); navigate(`/${slug}/admin`); }}
        onCreateNew={() => setView('create')}
        onLogout={() => {
          localStorage.removeItem('currentUser');
          setView('login');
          setStores([]);
          setPickerUser(null);
        }}
      />
    );
  }

  if (view === 'create') {
    return (
      <CreateStoreForm
        user={pickerUser}
        onCreated={handleStoreCreated}
        onCancel={() => setView('pick')}
      />
    );
  }

  if (view === 'signup') {
    return (
      <SignupForm
        onSuccess={handleLoginDone}
        onSwitchToLogin={() => setView('login')}
      />
    );
  }

  return (
    <LoginForm
      onSuccess={handleLoginDone}
      onSwitchToSignup={() => setView('signup')}
    />
  );
};

// ─── Login Form ───────────────────────────────────────────────────────────────
const LoginForm = ({ onSuccess, onSwitchToSignup }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await verifyStaffLogin(identifier.trim(), password);
      if (!result) { setError('Incorrect credentials. Please try again.'); setLoading(false); return; }
      await onSuccess({
        uid: result.phoneNumber,
        phoneNumber: result.phoneNumber,
        displayName: result.name,
        name: result.name,
        isStaffLogin: true,
        storeSlug: result.storeSlug,
        storeId: result.storeId,
        role: result.role,
      });
    } catch (err) {
      setError('Login failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="adminlogin-page">
      <div className="adminlogin-card">
        <div className="adminlogin-logo">🏪</div>
        <h1 className="adminlogin-title">Staff Login</h1>
        <p className="adminlogin-sub">Sign in to manage your restaurant</p>

        <form onSubmit={handleSubmit} className="adminlogin-form">
          <div className="adminlogin-group">
            <label>Email or Phone Number</label>
            <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="email@example.com or +1234567890" required autoFocus />
          </div>
          <div className="adminlogin-group">
            <label>Password</label>
            <div className="adminlogin-pw-row">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required />
              <button type="button" className="adminlogin-pw-toggle" onClick={() => setShowPassword(s => !s)}>{showPassword ? '🙈' : '👁'}</button>
            </div>
          </div>
          {error && <div className="adminlogin-error">{error}</div>}
          <button type="submit" className="adminlogin-btn" disabled={loading}>{loading ? 'Signing in...' : 'Sign In →'}</button>
        </form>

        <p className="adminlogin-note">Use the credentials given to you by your store owner</p>
        <div className="adminlogin-divider" />
        <div className="adminlogin-signup-prompt">
          <p>Want to register your restaurant?</p>
          <button className="adminlogin-signup-link" onClick={onSwitchToSignup}>Create a Store Owner Account →</button>
        </div>
        <div className="adminlogin-divider" />
        <p className="adminlogin-customer-link">Looking to order food? <a href="/">Browse restaurants →</a></p>
      </div>
    </div>
  );
};

// ─── Signup Form ──────────────────────────────────────────────────────────────
const SignupForm = ({ onSuccess, onSwitchToLogin }) => {
  const [form, setForm] = useState({ ownerName: '', storeName: '', email: '', password: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (!form.storeName.trim()) { setError('Store name is required.'); return; }
    setLoading(true);
    try {
      const slug = slugify(form.storeName);
      let firebaseUser;
      try {
        const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
        firebaseUser = cred.user;
      } catch (authErr) {
        const msgs = { 'auth/email-already-in-use': 'This email is already registered. Please sign in.', 'auth/invalid-email': 'Please enter a valid email address.', 'auth/weak-password': 'Password is too weak. Use at least 6 characters.' };
        setError(msgs[authErr.code] || authErr.message);
        setLoading(false);
        return;
      }
      const storeId = await createStore({ name: form.storeName.trim(), slug, description: '', logo: '', ownerId: firebaseUser.uid, ownerEmail: form.email.trim(), plan: 'free' });
      await ensureOwnerRole(storeId, { phoneNumber: firebaseUser.uid, name: form.ownerName.trim() || form.email.trim(), displayName: form.ownerName.trim() || form.email.trim() });
      await onSuccess({ uid: firebaseUser.uid, phoneNumber: firebaseUser.uid, email: firebaseUser.email, displayName: form.ownerName.trim() || form.email.trim(), name: form.ownerName.trim() || form.email.trim(), isStaffLogin: true, storeSlug: slug, storeId, role: 'owner' });
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="adminlogin-page">
      <div className="adminlogin-card">
        <div className="adminlogin-logo">🏗️</div>
        <h1 className="adminlogin-title">Create Your Store</h1>
        <p className="adminlogin-sub">Register as a store owner and set up your restaurant</p>
        <form onSubmit={handleSubmit} className="adminlogin-form">
          <div className="adminlogin-group"><label>Your Name</label><input type="text" value={form.ownerName} onChange={e => set('ownerName', e.target.value)} placeholder="Full name" required autoFocus /></div>
          <div className="adminlogin-group">
            <label>Restaurant / Store Name</label>
            <input type="text" value={form.storeName} onChange={e => set('storeName', e.target.value)} placeholder="e.g. Xander's Kitchen" required />
            {form.storeName && <span className="adminlogin-slug-preview">Your URL: /{slugify(form.storeName)}</span>}
          </div>
          <div className="adminlogin-group"><label>Email Address</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="owner@restaurant.com" required /></div>
          <div className="adminlogin-group">
            <label>Password</label>
            <div className="adminlogin-pw-row">
              <input type={showPw ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)} placeholder="At least 6 characters" required />
              <button type="button" className="adminlogin-pw-toggle" onClick={() => setShowPw(s => !s)}>{showPw ? '🙈' : '👁'}</button>
            </div>
          </div>
          <div className="adminlogin-group"><label>Confirm Password</label><input type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} placeholder="Re-enter password" required /></div>
          {error && <div className="adminlogin-error">{error}</div>}
          <button type="submit" className="adminlogin-btn" disabled={loading}>{loading ? 'Creating your store...' : 'Create Account & Store →'}</button>
        </form>
        <div className="adminlogin-divider" />
        <p className="adminlogin-customer-link">Already have an account? <button className="adminlogin-signup-link" onClick={onSwitchToLogin}>Sign in →</button></p>
      </div>
    </div>
  );
};

// ─── Create Store Form (for existing owners adding a second store) ─────────────
const CreateStoreForm = ({ user, onCreated, onCancel }) => {
  const [storeName, setStoreName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!storeName.trim()) { setError('Store name is required.'); return; }
    setLoading(true);
    setError('');
    try {
      const slug = slugify(storeName);
      const storeId = await createStore({
        name: storeName.trim(),
        slug,
        description: description.trim(),
        logo: '',
        ownerId: user?.phoneNumber || user?.uid,
        ownerEmail: user?.email || null,
        plan: 'free',
      });
      await ensureOwnerRole(storeId, {
        phoneNumber: user?.phoneNumber || user?.uid,
        name: user?.name || user?.displayName || 'Owner',
        displayName: user?.name || user?.displayName || 'Owner',
      });
      onCreated({ id: storeId, name: storeName.trim(), slug, description: description.trim() });
    } catch (err) {
      setError(err.message || 'Failed to create store. Try again.');
      setLoading(false);
    }
  };

  return (
    <div className="adminlogin-page">
      <div className="adminlogin-card">
        <div className="adminlogin-logo">🏗️</div>
        <h1 className="adminlogin-title">New Store</h1>
        <p className="adminlogin-sub">Add another restaurant to your account</p>
        <form onSubmit={handleSubmit} className="adminlogin-form">
          <div className="adminlogin-group">
            <label>Store Name *</label>
            <input type="text" value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="e.g. My Second Restaurant" required autoFocus />
            {storeName && <span className="adminlogin-slug-preview">URL: /{slugify(storeName)}</span>}
          </div>
          <div className="adminlogin-group">
            <label>Description</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Short tagline (optional)" />
          </div>
          {error && <div className="adminlogin-error">{error}</div>}
          <button type="submit" className="adminlogin-btn" disabled={loading}>{loading ? 'Creating...' : 'Create Store →'}</button>
        </form>
        <div className="adminlogin-divider" />
        <p className="adminlogin-customer-link"><button className="adminlogin-signup-link" onClick={onCancel}>← Back to My Stores</button></p>
      </div>
    </div>
  );
};

// ─── Store Picker ─────────────────────────────────────────────────────────────
const StorePicker = ({ stores, user, onSelect, onCreateNew, onLogout }) => (
  <div className="adminlogin-page">
    <div className="adminlogin-card adminlogin-picker-card">
      <div className="adminlogin-picker-header">
        <div>
          <h1 className="adminlogin-title">My Stores</h1>
          <p className="adminlogin-sub">
            {user?.name || user?.email || 'Welcome back'} · {stores.length} store{stores.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="adminlogin-logout-small" onClick={onLogout}>Sign out</button>
      </div>

      <div className="adminlogin-store-list">
        {stores.map(store => (
          <button key={store.id} className="adminlogin-store-row" onClick={() => onSelect(store.slug)}>
            <div className="adminlogin-store-logo">
              {store.logo
                ? <img src={store.logo} alt={store.name} onError={e => { e.target.style.display = 'none'; }} />
                : <span>{store.name.charAt(0)}</span>
              }
            </div>
            <div className="adminlogin-store-info">
              <strong>{store.name}</strong>
              {store.description && <small>{store.description}</small>}
            </div>
            <span className="adminlogin-role-badge" style={{ background: ROLE_COLORS[store.myRole] + '22', color: ROLE_COLORS[store.myRole] }}>
              {ROLE_LABELS[store.myRole]}
            </span>
            <span className="adminlogin-store-arrow">→</span>
          </button>
        ))}

        {/* Create New Store card */}
        <button className="adminlogin-store-row adminlogin-create-row" onClick={onCreateNew}>
          <div className="adminlogin-store-logo adminlogin-store-logo-add">+</div>
          <div className="adminlogin-store-info">
            <strong>Create New Store</strong>
            <small>Add another restaurant to your account</small>
          </div>
        </button>
      </div>
    </div>
  </div>
);

export default AdminLogin;

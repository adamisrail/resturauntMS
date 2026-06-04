import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllStores, createStore, ensureOwnerRole, slugify } from '../../utils/storeService';
import './StoreLanding.css';

const StoreLanding = ({ user }) => {
  const navigate = useNavigate();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', logo: '', description: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    getAllStores()
      .then(setStores)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    setError('');
    try {
      const slug = slugify(form.name);
      const existing = stores.find(s => s.slug === slug);
      if (existing) {
        setError('A store with that name already exists. Choose a different name.');
        setCreating(false);
        return;
      }
      const storeId = await createStore({
        name: form.name.trim(),
        slug,
        logo: form.logo.trim() || '',
        description: form.description.trim(),
        ownerId: user?.phoneNumber || 'unknown',
        plan: 'free'
      });
      // Register the creator as owner in the staff subcollection
      await ensureOwnerRole(storeId, user);
      navigate(`/${slug}/admin`);
      console.log('Store created:', storeId);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="store-landing">
      <div className="store-landing-hero">
        <h1>Restaurant Platform</h1>
        <p>Select a restaurant or create your own</p>
      </div>

      {loading ? (
        <div className="store-landing-loading">
          <div className="store-spinner" />
          <p>Loading restaurants...</p>
        </div>
      ) : (
        <div className="stores-grid">
          {stores.map(store => (
            <div key={store.id} className="store-card" onClick={() => navigate(`/${store.slug}`)}>
              <div className="store-card-logo">
                {store.logo ? (
                  <img src={store.logo} alt={store.name} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                ) : null}
                <div className="store-card-logo-placeholder" style={{ display: store.logo ? 'none' : 'flex' }}>
                  {store.name.charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="store-card-info">
                <h3>{store.name}</h3>
                {store.description && <p>{store.description}</p>}
              </div>
              <div className="store-card-enter">Enter →</div>
            </div>
          ))}

          <div className="store-card store-card-create" onClick={() => setShowCreate(true)}>
            <div className="store-card-logo store-card-logo-add">+</div>
            <div className="store-card-info">
              <h3>Create New Store</h3>
              <p>Set up your restaurant dashboard</p>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="store-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="store-modal" onClick={e => e.stopPropagation()}>
            <h2>Create Your Restaurant</h2>
            <form onSubmit={handleCreate}>
              <div className="store-form-group">
                <label>Restaurant Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Xander's Kitchen"
                  required
                />
                {form.name && (
                  <span className="store-slug-preview">URL: /{slugify(form.name)}</span>
                )}
              </div>
              <div className="store-form-group">
                <label>Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Short tagline or description"
                />
              </div>
              <div className="store-form-group">
                <label>Logo URL (optional)</label>
                <input
                  type="text"
                  value={form.logo}
                  onChange={e => setForm({ ...form, logo: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              {error && <p className="store-form-error">{error}</p>}
              <div className="store-form-actions">
                <button type="submit" className="store-btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Restaurant'}
                </button>
                <button type="button" className="store-btn-secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreLanding;

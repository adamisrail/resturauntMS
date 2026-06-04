import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '../../contexts/StoreContext';
import { acceptInvite, getInvite } from '../../utils/storeService';
import { ROLE_LABELS, ROLE_COLORS } from '../../utils/permissions';
import './StoreLanding.css';

const JoinStore = ({ user }) => {
  const { storeSlug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { store, loading: storeLoading } = useStore();

  const code = searchParams.get('code') || '';

  const [invite, setInvite] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | joining | success | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (storeLoading || !store?.id) return;
    if (!code) { setStatus('error'); setErrorMsg('No invite code provided.'); return; }

    getInvite(store.id, code)
      .then(inv => {
        if (!inv) { setStatus('error'); setErrorMsg('Invite not found or already revoked.'); return; }
        if (inv.usedBy) { setStatus('error'); setErrorMsg('This invite has already been used.'); return; }
        const expires = inv.expiresAt?.toDate ? inv.expiresAt.toDate() : new Date(inv.expiresAt);
        if (expires < new Date()) { setStatus('error'); setErrorMsg('This invite has expired.'); return; }
        setInvite(inv);
        setStatus('ready');
      })
      .catch(err => { setStatus('error'); setErrorMsg(err.message); });
  }, [store?.id, storeLoading, code]);

  const handleAccept = async () => {
    if (!user) { navigate('/'); return; }
    setStatus('joining');
    try {
      await acceptInvite(store.id, code, user);
      setStatus('success');
      setTimeout(() => navigate(`/${storeSlug}/admin`), 1800);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message);
    }
  };

  if (storeLoading || status === 'loading') {
    return (
      <div className="store-landing" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="store-landing-loading"><div className="store-spinner" /><p>Validating invite...</p></div>
      </div>
    );
  }

  return (
    <div className="store-landing" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="store-modal" style={{ maxWidth: 420, margin: '0 auto' }}>

        {status === 'error' && (
          <>
            <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>❌</div>
            <h2 style={{ textAlign: 'center', color: '#ff6b6b', marginBottom: 8 }}>Invalid Invite</h2>
            <p style={{ color: '#8696a0', textAlign: 'center', marginBottom: 24 }}>{errorMsg}</p>
            <button className="store-btn-primary" onClick={() => navigate('/')}>Go to Home</button>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>🎉</div>
            <h2 style={{ textAlign: 'center', color: '#25D366', marginBottom: 8 }}>You're in!</h2>
            <p style={{ color: '#8696a0', textAlign: 'center' }}>Redirecting to the admin panel...</p>
          </>
        )}

        {(status === 'ready' || status === 'joining') && invite && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              {store?.logo
                ? <img src={store.logo} alt={store.name} style={{ width: 64, height: 64, borderRadius: 14, objectFit: 'cover', marginBottom: 12 }} onError={e => { e.target.style.display = 'none'; }} />
                : <div style={{ width: 64, height: 64, borderRadius: 14, background: '#0d2318', color: '#25D366', fontSize: 28, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>{(store?.name || '?').charAt(0)}</div>
              }
              <h2 style={{ margin: '0 0 6px', color: '#e9edef' }}>Join {store?.name}</h2>
              <p style={{ color: '#8696a0', margin: 0, fontSize: 14 }}>You've been invited to join as</p>
              <span style={{
                display: 'inline-block', marginTop: 10, padding: '6px 20px', borderRadius: 20,
                background: ROLE_COLORS[invite.role] + '22', color: ROLE_COLORS[invite.role],
                border: `1px solid ${ROLE_COLORS[invite.role]}44`,
                fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>
                {ROLE_LABELS[invite.role]}
              </span>
            </div>

            <div style={{ background: '#0b141a', borderRadius: 12, padding: '14px 16px', marginBottom: 24, fontSize: 13, color: '#8696a0' }}>
              {invite.role === 'manager'
                ? '✅ Manage products, view orders, invite staff. Cannot edit store settings.'
                : '✅ View products and manage orders. Limited dashboard access.'}
            </div>

            {!user ? (
              <p style={{ color: '#8696a0', textAlign: 'center', fontSize: 13 }}>Please log in first to accept this invite.</p>
            ) : (
              <div className="store-form-actions">
                <button className="store-btn-primary" onClick={handleAccept} disabled={status === 'joining'}>
                  {status === 'joining' ? 'Joining...' : `Accept & Join as ${ROLE_LABELS[invite.role]}`}
                </button>
                <button className="store-btn-secondary" onClick={() => navigate('/')}>Decline</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default JoinStore;

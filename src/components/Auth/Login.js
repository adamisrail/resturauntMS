import React, { useState } from 'react';
import { verifyStaffLogin } from '../../utils/storeService';
import './Login.css';

const Login = ({ onLoginSuccess }) => {
  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Restaurant MS</h1>
          <p>Staff Login</p>
        </div>
        <StaffLogin onLoginSuccess={onLoginSuccess} />
      </div>
    </div>
  );
};

// ─── Customer login (phone number) ───────────────────────────────────────────
// ─── Staff login (email or phone + password) ─────────────────────────────────
const StaffLogin = ({ onLoginSuccess }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await verifyStaffLogin(phone.trim(), password);
      if (!result) {
        setError('Incorrect phone number or password.');
        setLoading(false);
        return;
      }

      // Store session
      localStorage.setItem('currentUser', JSON.stringify({
        uid: result.phoneNumber,
        phoneNumber: result.phoneNumber,
        displayName: result.name,
        name: result.name,
        isStaffLogin: true,
        storeSlug: result.storeSlug,
        storeId: result.storeId,
        role: result.role,
      }));

      onLoginSuccess(result.storeSlug);
    } catch (err) {
      setError('Login failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <div className="form-group">
        <label>Email or Phone Number</label>
        <input
          type="text"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="email@example.com or +1234567890"
          required
          autoFocus
        />
      </div>
      <div className="form-group">
        <label>Password</label>
        <div className="password-input-row">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />
          <button type="button" className="password-toggle" onClick={() => setShowPassword(s => !s)}>
            {showPassword ? '🙈' : '👁'}
          </button>
        </div>
      </div>
      {error && <div className="error-message">{error}</div>}
      <button type="submit" className="login-button" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
      <div className="login-footer-note">Use your email or phone number with the password given to you</div>
    </form>
  );
};

export default Login;

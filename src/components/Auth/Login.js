import React, { useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import './Login.css';

const Login = ({ onLoginSuccess }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, 'users', phoneNumber));
      const userExists = userDoc.exists();
      
      console.log('User exists:', userExists); // Debug log
      console.log('Phone number:', phoneNumber); // Debug log
      
      setIsNewUser(!userExists);

      if (!userExists) {
        // New user - show name input
        console.log('New user detected, showing name input'); // Debug log
        setLoading(false);
      } else {
        // Existing user - create a mock auth session
        const userData = userDoc.data();
        console.log('Existing user data:', userData); // Debug log
        
        const mockUser = {
          uid: phoneNumber,
          phoneNumber: phoneNumber,
          displayName: userData?.name || phoneNumber
        };
        
        // Store in localStorage for session management
        localStorage.setItem('currentUser', JSON.stringify(mockUser));
        onLoginSuccess();
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Failed to check user. Please try again.');
      setLoading(false);
    }
  };

  const handleNameSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('Creating new user account...'); // Debug log
      console.log('Name:', name); // Debug log
      console.log('Phone:', phoneNumber); // Debug log
      
      // Save user data to Firestore
      const userData = {
        name: name,
        phoneNumber: phoneNumber,
        createdAt: new Date(),
        lastLogin: new Date()
      };
      
      console.log('User data to save:', userData); // Debug log
      
      await setDoc(doc(db, 'users', phoneNumber), userData);
      
      console.log('User account created successfully!'); // Debug log
      
      // Create mock auth session
      const mockUser = {
        uid: phoneNumber,
        phoneNumber: phoneNumber,
        displayName: name
      };
      
      localStorage.setItem('currentUser', JSON.stringify(mockUser));
      onLoginSuccess();
    } catch (error) {
      console.error('Error creating account:', error); // Debug log
      setError('Failed to create account. Please try again.');
      setLoading(false);
    }
  };

  const renderPhoneStep = () => (
    <form onSubmit={handlePhoneSubmit} className="login-form">
      <div className="form-group">
        <label htmlFor="phone">Phone Number</label>
        <input
          type="tel"
          id="phone"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="Enter your phone number (e.g., +1234567890)"
          required
        />
      </div>

      <button 
        type="submit" 
        className="login-button"
        disabled={loading}
      >
        {loading ? 'Checking...' : 'Continue'}
      </button>
    </form>
  );

  const renderNameStep = () => (
    <form onSubmit={handleNameSubmit} className="login-form">
      <div className="form-group">
        <label htmlFor="name">Your Name</label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your full name"
          required
        />
      </div>

      <button 
        type="submit" 
        className="login-button"
        disabled={loading}
      >
        {loading ? 'Creating Account...' : 'Create Account'}
      </button>

      <button 
        type="button" 
        className="back-button"
        onClick={() => {
          setIsNewUser(false);
          setName('');
          setError('');
        }}
        disabled={loading}
      >
        Back to Phone Number
      </button>
    </form>
  );

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Restaurant MS</h1>
          <p>{isNewUser ? 'Complete Profile' : 'Enter Phone Number'}</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        {!isNewUser ? renderPhoneStep() : renderNameStep()}

        <div className="login-footer">
          <p>Enter your phone number to sign in or create an account</p>
        </div>
      </div>
    </div>
  );
};

export default Login; 
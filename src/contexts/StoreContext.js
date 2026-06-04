import React, { createContext, useContext, useState, useEffect } from 'react';
import { getStoreBySlug } from '../utils/storeService';

const StoreContext = createContext(null);

export const StoreProvider = ({ children, storeSlug }) => {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!storeSlug) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getStoreBySlug(storeSlug)
      .then(data => {
        if (data) setStore(data);
        else setError(`Store "${storeSlug}" not found`);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [storeSlug]);

  return (
    <StoreContext.Provider value={{ store, loading, error, setStore }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
};

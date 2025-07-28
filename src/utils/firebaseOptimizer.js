import { collection, getDocs, doc, getDoc, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

// Cache for storing fetched data
const cache = {
  products: {
    data: null,
    timestamp: null,
    ttl: 5 * 60 * 1000 // 5 minutes
  },
  users: {
    data: {},
    timestamp: {},
    ttl: 10 * 60 * 1000 // 10 minutes
  },
  orders: {
    data: null,
    timestamp: null,
    ttl: 2 * 60 * 1000 // 2 minutes
  }
};

// Check if cache is valid
const isCacheValid = (cacheKey, subKey = null) => {
  const cacheItem = subKey ? cache[cacheKey][subKey] : cache[cacheKey];
  if (!cacheItem || !cacheItem.timestamp) return false;
  
  const now = Date.now();
  return (now - cacheItem.timestamp) < cacheItem.ttl;
};

// Get cached data
const getCachedData = (cacheKey, subKey = null) => {
  const cacheItem = subKey ? cache[cacheKey][subKey] : cache[cacheKey];
  return cacheItem ? cacheItem.data : null;
};

// Set cached data
const setCachedData = (cacheKey, data, subKey = null) => {
  const now = Date.now();
  if (subKey) {
    cache[cacheKey][subKey] = {
      data,
      timestamp: now
    };
  } else {
    cache[cacheKey] = {
      data,
      timestamp: now
    };
  }
};

// Optimized product fetching with caching
export const getProductsOptimized = async (forceRefresh = false) => {
  if (!forceRefresh && isCacheValid('products')) {
    console.log('📦 Returning cached products');
    return getCachedData('products');
  }

  try {
    console.log('📦 Fetching products from Firestore...');
    const productsSnapshot = await getDocs(collection(db, 'products'));
    const products = productsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    setCachedData('products', products);
    console.log(`📦 Cached ${products.length} products`);
    return products;
  } catch (error) {
    console.error('Error fetching products:', error);
    return getCachedData('products') || [];
  }
};

// Optimized user fetching with caching
export const getUserOptimized = async (phoneNumber, forceRefresh = false) => {
  if (!phoneNumber) return null;
  
  if (!forceRefresh && isCacheValid('users', phoneNumber)) {
    console.log(`👤 Returning cached user: ${phoneNumber}`);
    return getCachedData('users', phoneNumber);
  }

  try {
    console.log(`👤 Fetching user from Firestore: ${phoneNumber}`);
    const userDoc = await getDoc(doc(db, 'users', phoneNumber));
    
    if (userDoc.exists()) {
      const userData = { id: userDoc.id, ...userDoc.data() };
      setCachedData('users', userData, phoneNumber);
      console.log(`👤 Cached user: ${phoneNumber}`);
      return userData;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching user:', error);
    return getCachedData('users', phoneNumber) || null;
  }
};

// Optimized orders fetching with caching
export const getOrdersOptimized = async (forceRefresh = false) => {
  if (!forceRefresh && isCacheValid('orders')) {
    console.log('📋 Returning cached orders');
    return getCachedData('orders');
  }

  try {
    console.log('📋 Fetching orders from Firestore...');
    const ordersSnapshot = await getDocs(collection(db, 'orders'));
    const orders = ordersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    setCachedData('orders', orders);
    console.log(`📋 Cached ${orders.length} orders`);
    return orders;
  } catch (error) {
    console.error('Error fetching orders:', error);
    return getCachedData('orders') || [];
  }
};

// Clear specific cache
export const clearCache = (cacheKey, subKey = null) => {
  if (subKey) {
    delete cache[cacheKey][subKey];
    console.log(`🗑️ Cleared cache for ${cacheKey}/${subKey}`);
  } else {
    cache[cacheKey] = {
      data: null,
      timestamp: null,
      ttl: cache[cacheKey]?.ttl || 5 * 60 * 1000
    };
    console.log(`🗑️ Cleared cache for ${cacheKey}`);
  }
};

// Clear all cache
export const clearAllCache = () => {
  Object.keys(cache).forEach(key => {
    if (typeof cache[key] === 'object' && cache[key].data) {
      cache[key] = {
        data: null,
        timestamp: null,
        ttl: cache[key].ttl
      };
    }
  });
  console.log('🗑️ Cleared all cache');
};

// Optimized real-time listener with caching
export const createOptimizedListener = (collectionName, options = {}) => {
  const { query: queryOptions, callback, cacheKey } = options;
  
  return onSnapshot(
    queryOptions || collection(db, collectionName),
    (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      if (cacheKey) {
        setCachedData(cacheKey, data);
      }
      
      if (callback) {
        callback(data);
      }
    },
    (error) => {
      console.error(`Error in ${collectionName} listener:`, error);
    }
  );
};

// Get cache statistics
export const getCacheStats = () => {
  const stats = {
    products: {
      cached: cache.products.data !== null,
      age: cache.products.timestamp ? Date.now() - cache.products.timestamp : null
    },
    users: {
      cachedCount: Object.keys(cache.users.data).length,
      cachedUsers: Object.keys(cache.users.data)
    },
    orders: {
      cached: cache.orders.data !== null,
      age: cache.orders.timestamp ? Date.now() - cache.orders.timestamp : null
    }
  };
  
  console.log('📊 Cache Statistics:', stats);
  return stats;
}; 
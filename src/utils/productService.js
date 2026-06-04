import { collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export const PRODUCT_CATEGORIES = {
  'main-course': 'Main Course',
  'appetizers': 'Appetizers',
  'drinks': 'Drinks',
  'desserts': 'Desserts'
};

// Returns the correct collection ref: store-scoped or global fallback
const getProductsRef = (storeId) =>
  storeId
    ? collection(db, 'stores', storeId, 'products')
    : collection(db, 'products');

const getProductDocRef = (storeId, productId) =>
  storeId
    ? doc(db, 'stores', storeId, 'products', productId)
    : doc(db, 'products', productId);

// Fetch all products grouped by category
export const fetchAllProducts = async (storeId = null) => {
  try {
    const snapshot = await getDocs(getProductsRef(storeId));
    const products = {};
    const seen = new Set();

    snapshot.forEach((d) => {
      const product = { id: d.id, ...d.data() };
      const category = product.category || 'main-course';
      const key = `${product.name}-${product.price}-${product.category}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (!products[category]) products[category] = [];
      products[category].push(product);
    });

    Object.keys(products).forEach(cat => {
      products[cat].sort((a, b) => b.orderCount - a.orderCount);
    });

    return products;
  } catch (error) {
    console.error('Error fetching products:', error);
    return {};
  }
};

// Fetch products flat list (for admin panel)
export const fetchAllProductsFlat = async (storeId = null) => {
  try {
    const snapshot = await getDocs(getProductsRef(storeId));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
};

export const fetchProductsByCategory = async (category, storeId = null) => {
  try {
    const q = query(
      getProductsRef(storeId),
      where('category', '==', category),
      where('isAvailable', '==', true),
      orderBy('orderCount', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error(`Error fetching ${category} products:`, error);
    return [];
  }
};

export const fetchProductById = async (productId, storeId = null) => {
  try {
    const d = await getDoc(getProductDocRef(storeId, productId));
    return d.exists() ? { id: d.id, ...d.data() } : null;
  } catch (error) {
    console.error('Error fetching product:', error);
    return null;
  }
};

export const addProduct = async (productData, storeId = null) => {
  try {
    const newProduct = {
      name: '',
      price: 0,
      description: '',
      fullDescription: '',
      image: '',
      rating: 4.5,
      spiceLevel: 0,
      chefSpecial: false,
      orderCount: 0,
      reviewCount: 0,
      category: 'main-course',
      isPopular: false,
      isAvailable: true,
      ...productData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const ref = await addDoc(getProductsRef(storeId), newProduct);
    return { id: ref.id, ...newProduct };
  } catch (error) {
    console.error('Error adding product:', error);
    throw error;
  }
};

export const updateProduct = async (productId, updateData, storeId = null) => {
  try {
    await updateDoc(getProductDocRef(storeId, productId), {
      ...updateData,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
};

export const deleteProduct = async (productId, storeId = null) => {
  try {
    await deleteDoc(getProductDocRef(storeId, productId));
    return true;
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
};

export const fetchPopularProducts = async (storeId = null) => {
  try {
    const q = query(
      getProductsRef(storeId),
      where('orderCount', '>', 150),
      where('isAvailable', '==', true),
      orderBy('orderCount', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error fetching popular products:', error);
    return [];
  }
};

// Seed default products — used for new stores
export const initializeDefaultProducts = async (storeId = null) => {
  try {
    const existing = await fetchAllProducts(storeId);
    const total = Object.values(existing).reduce((s, arr) => s + arr.length, 0);
    if (total > 0) {
      console.log(`Found ${total} existing products, skipping initialization`);
      return;
    }
  } catch (error) {
    console.error('Error checking existing products:', error);
  }

  const defaults = {
    'main-course': [
      { name: 'Grilled Chicken Breast', price: 18.99, description: 'Tender grilled chicken with herbs', fullDescription: 'Our signature grilled chicken breast marinated in fresh herbs, garlic, and olive oil. Served with seasonal vegetables.', image: '/images/grilled-chicken.jpg', rating: 4.8, spiceLevel: 2, chefSpecial: true, orderCount: 156, reviewCount: 89, category: 'main-course', isPopular: false, isAvailable: true },
      { name: 'Beef Steak', price: 24.99, description: 'Premium beef steak with garlic butter', fullDescription: 'Premium grade beef steak cooked to your preferred doneness, topped with homemade garlic herb butter.', image: '/images/beef-steak.jpg', rating: 4.9, spiceLevel: 1, chefSpecial: false, orderCount: 203, reviewCount: 124, category: 'main-course', isPopular: false, isAvailable: true },
      { name: 'Salmon Fillet', price: 22.99, description: 'Pan-seared salmon with lemon herb sauce', fullDescription: 'Fresh Atlantic salmon fillet pan-seared to perfection with a crispy skin and tender flaky interior.', image: '/images/salmon-fillet.jpg', rating: 4.6, spiceLevel: 0, chefSpecial: false, orderCount: 98, reviewCount: 52, category: 'main-course', isPopular: false, isAvailable: true },
      { name: 'Lamb Chops', price: 28.99, description: 'Herb-crusted lamb chops with mint sauce', fullDescription: 'Premium lamb chops with a herb crust, grilled to your preference. Served with refreshing mint sauce.', image: '/images/lamb-chops.jpg', rating: 4.7, spiceLevel: 2, chefSpecial: true, orderCount: 134, reviewCount: 76, category: 'main-course', isPopular: false, isAvailable: true }
    ],
    'appetizers': [
      { name: 'Bruschetta', price: 8.99, description: 'Toasted bread with tomatoes and basil', fullDescription: 'Fresh Italian bruschetta with artisanal bread, ripe tomatoes, fresh basil, garlic, and extra virgin olive oil.', image: '/images/bruschetta.jpg', rating: 4.5, spiceLevel: 0, chefSpecial: false, orderCount: 89, reviewCount: 45, category: 'appetizers', isPopular: false, isAvailable: true },
      { name: 'Mozzarella Sticks', price: 7.99, description: 'Crispy mozzarella with marinara', fullDescription: 'Hand-breaded mozzarella sticks fried to golden perfection, served with house-made marinara sauce.', image: '/images/mozzarella-sticks.jpg', rating: 4.4, spiceLevel: 0, chefSpecial: false, orderCount: 134, reviewCount: 67, category: 'appetizers', isPopular: false, isAvailable: true },
      { name: 'Chicken Wings', price: 11.99, description: 'Crispy wings with choice of sauce', fullDescription: 'Crispy fried chicken wings in your choice of buffalo, honey mustard, or barbecue sauce.', image: '/images/chicken-wings.jpg', rating: 4.6, spiceLevel: 2, chefSpecial: false, orderCount: 145, reviewCount: 82, category: 'appetizers', isPopular: false, isAvailable: true }
    ],
    'drinks': [
      { name: 'Fresh Lemonade', price: 4.99, description: 'Homemade lemonade with mint', fullDescription: 'Freshly squeezed lemonade with real lemons, natural sweeteners, and fresh mint. Served over ice.', image: '/images/fresh-lemonade.jpg', rating: 4.7, spiceLevel: 0, chefSpecial: true, orderCount: 267, reviewCount: 156, category: 'drinks', isPopular: true, isAvailable: true },
      { name: 'Iced Coffee', price: 5.99, description: 'Smooth iced coffee with cream', fullDescription: 'Premium cold-brewed coffee served over ice with your choice of cream or milk.', image: '/images/iced-coffee.jpg', rating: 4.8, spiceLevel: 0, chefSpecial: false, orderCount: 198, reviewCount: 112, category: 'drinks', isPopular: true, isAvailable: true },
      { name: 'Berry Smoothie', price: 6.99, description: 'Mixed berries with yogurt', fullDescription: 'Fresh mixed berries blended with Greek yogurt and a touch of honey.', image: '/images/berry-smoothie.jpg', rating: 4.5, spiceLevel: 0, chefSpecial: false, orderCount: 92, reviewCount: 48, category: 'drinks', isPopular: false, isAvailable: true }
    ],
    'desserts': [
      { name: 'Chocolate Cake', price: 8.99, description: 'Rich chocolate cake with ganache', fullDescription: 'Decadent chocolate cake made with premium dark chocolate, layered with rich chocolate ganache.', image: '/images/chocolate-cake.jpg', rating: 4.9, spiceLevel: 0, chefSpecial: true, orderCount: 178, reviewCount: 98, category: 'desserts', isPopular: false, isAvailable: true },
      { name: 'Tiramisu', price: 9.99, description: 'Classic Italian dessert', fullDescription: 'Authentic Italian tiramisu with coffee-soaked ladyfingers, creamy mascarpone, and cocoa powder.', image: '/images/tiramisu.jpg', rating: 4.8, spiceLevel: 0, chefSpecial: false, orderCount: 145, reviewCount: 78, category: 'desserts', isPopular: false, isAvailable: true }
    ]
  };

  for (const products of Object.values(defaults)) {
    for (const product of products) {
      await addProduct(product, storeId);
    }
  }
  console.log('Default products initialized for store:', storeId || 'global');
};

import { collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

// Product categories
export const PRODUCT_CATEGORIES = {
  'main-course': 'Main Course',
  'appetizers': 'Appetizers', 
  'drinks': 'Drinks',
  'desserts': 'Desserts'
};

// Default product structure
const defaultProduct = {
  id: '',
  name: '',
  price: 0,
  description: '',
  fullDescription: '',
  image: '',
  rating: 0,
  spiceLevel: 0,
  chefSpecial: false,
  orderCount: 0,
  reviewCount: 0,
  category: '',
  isPopular: false,
  isAvailable: true,
  createdAt: null,
  updatedAt: null
};

// Fetch all products from Firestore
export const fetchAllProducts = async () => {
  try {
    const productsRef = collection(db, 'products');
    const querySnapshot = await getDocs(productsRef);
    
    const products = {};
    querySnapshot.forEach((doc) => {
      const product = { id: doc.id, ...doc.data() };
      const category = product.category || 'main-course';
      
      if (!products[category]) {
        products[category] = [];
      }
      products[category].push(product);
    });

    // Sort products by orderCount (popularity) within each category
    Object.keys(products).forEach(category => {
      products[category].sort((a, b) => b.orderCount - a.orderCount);
    });

    return products;
  } catch (error) {
    console.error('Error fetching products:', error);
    return {};
  }
};

// Fetch products by category
export const fetchProductsByCategory = async (category) => {
  try {
    const productsRef = collection(db, 'products');
    const q = query(
      productsRef, 
      where('category', '==', category),
      where('isAvailable', '==', true),
      orderBy('orderCount', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    const products = [];
    querySnapshot.forEach((doc) => {
      products.push({ id: doc.id, ...doc.data() });
    });
    
    return products;
  } catch (error) {
    console.error(`Error fetching ${category} products:`, error);
    return [];
  }
};

// Fetch a single product by ID
export const fetchProductById = async (productId) => {
  try {
    const productRef = doc(db, 'products', productId);
    const productDoc = await getDoc(productRef);
    
    if (productDoc.exists()) {
      return { id: productDoc.id, ...productDoc.data() };
    } else {
      console.log('Product not found');
      return null;
    }
  } catch (error) {
    console.error('Error fetching product:', error);
    return null;
  }
};

// Add a new product
export const addProduct = async (productData) => {
  try {
    const productRef = collection(db, 'products');
    const newProduct = {
      ...defaultProduct,
      ...productData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const docRef = await addDoc(productRef, newProduct);
    return { id: docRef.id, ...newProduct };
  } catch (error) {
    console.error('Error adding product:', error);
    throw error;
  }
};

// Update a product
export const updateProduct = async (productId, updateData) => {
  try {
    const productRef = doc(db, 'products', productId);
    const updatePayload = {
      ...updateData,
      updatedAt: new Date()
    };
    
    await updateDoc(productRef, updatePayload);
    return true;
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
};

// Delete a product
export const deleteProduct = async (productId) => {
  try {
    const productRef = doc(db, 'products', productId);
    await deleteDoc(productRef);
    return true;
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
};

// Clear all products from database (use with caution)
export const clearAllProducts = async () => {
  try {
    const productsRef = collection(db, 'products');
    const querySnapshot = await getDocs(productsRef);
    
    const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    console.log('All products cleared from database');
    return true;
  } catch (error) {
    console.error('Error clearing products:', error);
    return false;
  }
};

// Fetch popular products (orderCount > 150)
export const fetchPopularProducts = async () => {
  try {
    const productsRef = collection(db, 'products');
    const q = query(
      productsRef,
      where('orderCount', '>', 150),
      where('isAvailable', '==', true),
      orderBy('orderCount', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    const products = [];
    querySnapshot.forEach((doc) => {
      products.push({ id: doc.id, ...doc.data() });
    });
    
    return products;
  } catch (error) {
    console.error('Error fetching popular products:', error);
    return [];
  }
};

// Initialize default products in database (run once)
export const initializeDefaultProducts = async () => {
  // Check if products already exist to prevent duplicates
  try {
    const existingProducts = await fetchAllProducts();
    const totalExistingProducts = Object.values(existingProducts).reduce((total, products) => total + products.length, 0);
    
    if (totalExistingProducts > 0) {
      console.log(`Found ${totalExistingProducts} existing products, skipping initialization`);
      return;
    }
    
    console.log('No existing products found, initializing database...');
  } catch (error) {
    console.error('Error checking existing products:', error);
  }

  const defaultProducts = {
    'main-course': [
      {
        name: 'Grilled Chicken Breast',
        price: 18.99,
        description: 'Tender grilled chicken with herbs',
        fullDescription: 'Our signature grilled chicken breast is marinated in a blend of fresh herbs, garlic, and olive oil, then perfectly grilled to achieve a juicy interior with a crispy, flavorful exterior. Served with seasonal vegetables and your choice of sauce.',
        image: '/images/grilled-chicken.jpg',
        rating: 4.8,
        spiceLevel: 2,
        chefSpecial: true,
        orderCount: 156,
        reviewCount: 89,
        category: 'main-course',
        isPopular: false,
        isAvailable: true
      },
      {
        name: 'Beef Steak',
        price: 24.99,
        description: 'Premium beef steak with garlic butter',
        fullDescription: 'Premium grade beef steak cooked to your preferred doneness, topped with homemade garlic herb butter that melts perfectly over the meat. Accompanied by roasted potatoes and grilled asparagus for a complete dining experience.',
        image: '/images/beef-steak.jpg',
        rating: 4.9,
        spiceLevel: 1,
        chefSpecial: false,
        orderCount: 203,
        reviewCount: 124,
        category: 'main-course',
        isPopular: false,
        isAvailable: true
      },
      {
        name: 'Salmon Fillet',
        price: 22.99,
        description: 'Pan-seared salmon with lemon herb sauce',
        fullDescription: 'Fresh Atlantic salmon fillet pan-seared to perfection with a crispy skin and tender, flaky interior. Served with a light lemon herb sauce and seasonal vegetables.',
        image: '/images/salmon-fillet.jpg',
        rating: 4.6,
        spiceLevel: 0,
        chefSpecial: false,
        orderCount: 98,
        reviewCount: 52,
        category: 'main-course',
        isPopular: false,
        isAvailable: true
      },
      {
        name: 'Lamb Chops',
        price: 28.99,
        description: 'Herb-crusted lamb chops with mint sauce',
        fullDescription: 'Premium lamb chops coated with a herb crust and grilled to your preference. Served with a refreshing mint sauce and roasted potatoes.',
        image: '/images/lamb-chops.jpg',
        rating: 4.7,
        spiceLevel: 2,
        chefSpecial: true,
        orderCount: 134,
        reviewCount: 76,
        category: 'main-course',
        isPopular: false,
        isAvailable: true
      },
      {
        name: 'Arugula Steak',
        price: 8.40,
        description: 'Charcoal grilled steak with arugula pesto',
        fullDescription: 'Premium charcoal grilled steak served with fresh arugula pesto and sautéed onion mushrooms. A perfect blend of smoky flavors and fresh herbs.',
        image: '/images/arugula-steak.jpg',
        rating: 4.7,
        spiceLevel: 1,
        chefSpecial: true,
        orderCount: 145,
        reviewCount: 78,
        category: 'main-course',
        isPopular: false,
        isAvailable: true
      },
      {
        name: 'Budak Crispy Chicken',
        price: 5.85,
        description: 'Crispy chicken in spicy budak sauce',
        fullDescription: 'Crispy fried chicken tossed in our signature spicy budak sauce, served with fresh Asian slaw in a toasted ciabatta bread. A perfect balance of crunch and spice.',
        image: '/images/budak-chicken.jpg',
        rating: 4.6,
        spiceLevel: 3,
        chefSpecial: false,
        orderCount: 167,
        reviewCount: 92,
        category: 'main-course',
        isPopular: false,
        isAvailable: true
      }
    ],
    'appetizers': [
      {
        name: 'Bruschetta',
        price: 8.99,
        description: 'Toasted bread with tomatoes and basil',
        fullDescription: 'Fresh Italian bruschetta featuring artisanal bread toasted to perfection, topped with diced ripe tomatoes, fresh basil, garlic, and extra virgin olive oil. A perfect starter that captures the authentic flavors of Italy.',
        image: '/images/bruschetta.jpg',
        rating: 4.5,
        spiceLevel: 0,
        chefSpecial: false,
        orderCount: 89,
        reviewCount: 45,
        category: 'appetizers',
        isPopular: false,
        isAvailable: true
      },
      {
        name: 'Mozzarella Sticks',
        price: 7.99,
        description: 'Crispy mozzarella with marinara',
        fullDescription: 'Hand-breaded mozzarella sticks fried to golden perfection, served with our house-made marinara sauce. The cheese is perfectly melted inside with a crispy, seasoned breadcrumb coating that provides the ideal texture contrast.',
        image: '/images/mozzarella-sticks.jpg',
        rating: 4.4,
        spiceLevel: 0,
        chefSpecial: false,
        orderCount: 134,
        reviewCount: 67,
        category: 'appetizers',
        isPopular: false,
        isAvailable: true
      },
      {
        name: 'Chicken Wings',
        price: 11.99,
        description: 'Crispy wings with choice of sauce',
        fullDescription: 'Crispy fried chicken wings tossed in your choice of sauce: buffalo, honey mustard, or barbecue. Served with celery sticks and ranch dressing.',
        image: '/images/chicken-wings.jpg',
        rating: 4.6,
        spiceLevel: 2,
        chefSpecial: false,
        orderCount: 145,
        reviewCount: 82,
        category: 'appetizers',
        isPopular: false,
        isAvailable: true
      },
      {
        name: 'Nachos Supreme',
        price: 12.99,
        description: 'Loaded nachos with all the toppings',
        fullDescription: 'Crispy tortilla chips topped with melted cheese, ground beef, jalapeños, sour cream, guacamole, and fresh salsa. A hearty appetizer perfect for sharing.',
        image: '/images/nachos-supreme.jpg',
        rating: 4.4,
        spiceLevel: 1,
        chefSpecial: false,
        orderCount: 118,
        reviewCount: 65,
        category: 'appetizers',
        isPopular: false,
        isAvailable: true
      },
      {
        name: 'Mediterranean Wrap',
        price: 4.20,
        description: 'Tortilla wrap with smashed avocado and grilled chicken',
        fullDescription: 'Fresh tortilla wrap stuffed with smashed avocado, grilled chicken, Greek yogurt, and Mediterranean vegetables. A healthy and flavorful option perfect for any meal.',
        image: '/images/mediterranean-wrap.jpg',
        rating: 4.5,
        spiceLevel: 0,
        chefSpecial: false,
        orderCount: 123,
        reviewCount: 67,
        category: 'appetizers',
        isPopular: false,
        isAvailable: true
      },
      {
        name: 'Shaved Beef Ciabatta Sandwich',
        price: 5.40,
        description: 'Toasted ciabatta with seared beef and cheddar',
        fullDescription: 'Toasted ciabatta bread filled with tender seared beef, orange cheddar cheese, fresh tomatoes, and caramelized onions. A hearty sandwich with perfect flavor balance.',
        image: '/images/beef-ciabatta.jpg',
        rating: 4.6,
        spiceLevel: 1,
        chefSpecial: false,
        orderCount: 156,
        reviewCount: 89,
        category: 'appetizers',
        isPopular: false,
        isAvailable: true
      }
    ],
    'drinks': [
      {
        name: 'Fresh Lemonade',
        price: 4.99,
        description: 'Homemade lemonade with mint',
        fullDescription: 'Freshly squeezed lemonade made daily with real lemons, natural sweeteners, and a hint of fresh mint. Served over ice with a lemon wedge garnish. Refreshing and perfect for any meal or as a standalone refreshment.',
        image: '/images/fresh-lemonade.jpg',
        rating: 4.7,
        spiceLevel: 0,
        chefSpecial: true,
        orderCount: 267,
        reviewCount: 156,
        category: 'drinks',
        isPopular: true,
        isAvailable: true
      },
      {
        name: 'Iced Coffee',
        price: 5.99,
        description: 'Smooth iced coffee with cream',
        fullDescription: 'Premium cold-brewed coffee served over ice with your choice of cream or milk. Made from carefully selected coffee beans and brewed for 24 hours to extract the perfect flavor profile without bitterness.',
        image: '/images/iced-coffee.jpg',
        rating: 4.8,
        spiceLevel: 0,
        chefSpecial: false,
        orderCount: 198,
        reviewCount: 112,
        category: 'drinks',
        isPopular: true,
        isAvailable: true
      },
      {
        name: 'Berry Smoothie',
        price: 6.99,
        description: 'Mixed berries with yogurt',
        fullDescription: 'Fresh mixed berries blended with Greek yogurt and a touch of honey. A healthy and refreshing drink packed with antioxidants and protein.',
        image: '/images/berry-smoothie.jpg',
        rating: 4.5,
        spiceLevel: 0,
        chefSpecial: false,
        orderCount: 92,
        reviewCount: 48,
        category: 'drinks',
        isPopular: false,
        isAvailable: true
      },
      {
        name: 'Green Tea',
        price: 3.99,
        description: 'Premium Japanese green tea',
        fullDescription: 'High-quality Japanese green tea served hot or iced. Rich in antioxidants and known for its smooth, slightly sweet flavor profile.',
        image: '/images/green-tea.jpg',
        rating: 4.3,
        spiceLevel: 0,
        chefSpecial: false,
        orderCount: 78,
        reviewCount: 41,
        category: 'drinks',
        isPopular: false,
        isAvailable: true
      },
      {
        name: 'Orange Juice',
        price: 4.49,
        description: 'Freshly squeezed orange juice',
        fullDescription: '100% pure orange juice freshly squeezed daily. Rich in vitamin C and natural sweetness, served chilled for maximum refreshment.',
        image: '/images/orange-juice.jpg',
        rating: 4.4,
        spiceLevel: 0,
        chefSpecial: false,
        orderCount: 85,
        reviewCount: 44,
        category: 'drinks',
        isPopular: false,
        isAvailable: true
      },
      {
        name: 'Sparkling Water',
        price: 2.99,
        description: 'Premium sparkling water with lemon',
        fullDescription: 'Premium sparkling water served with a fresh lemon wedge. A crisp, refreshing option that pairs perfectly with any meal.',
        image: '/images/sparkling-water.jpg',
        rating: 4.2,
        spiceLevel: 0,
        chefSpecial: false,
        orderCount: 67,
        reviewCount: 35,
        category: 'drinks',
        isPopular: false,
        isAvailable: true
      }
    ],
    'desserts': [
      {
        name: 'Chocolate Cake',
        price: 8.99,
        description: 'Rich chocolate cake with ganache',
        fullDescription: 'Decadent chocolate cake made with premium dark chocolate and cocoa powder, layered with rich chocolate ganache and topped with chocolate shavings. Each bite offers a perfect balance of sweetness and cocoa intensity.',
        image: '/images/chocolate-cake.jpg',
        rating: 4.9,
        spiceLevel: 0,
        chefSpecial: true,
        orderCount: 178,
        reviewCount: 98,
        category: 'desserts',
        isPopular: false,
        isAvailable: true
      },
      {
        name: 'Tiramisu',
        price: 9.99,
        description: 'Classic Italian dessert',
        fullDescription: 'Authentic Italian tiramisu featuring layers of coffee-soaked ladyfingers, creamy mascarpone cheese, and a dusting of cocoa powder. Made with imported Italian ingredients for the most authentic taste experience.',
        image: '/images/tiramisu.jpg',
        rating: 4.8,
        spiceLevel: 0,
        chefSpecial: false,
        orderCount: 145,
        reviewCount: 78,
        category: 'desserts',
        isPopular: false,
        isAvailable: true
      },
      {
        name: 'Tiramisu Pancake',
        price: 4.20,
        description: 'Fluffy pancake with coffee toffee crunch',
        fullDescription: 'Fluffy pancake served with lady finger biscuit, coffee toffee crunch, and chocolate gelato. A unique twist on the classic tiramisu dessert.',
        image: '/images/tiramisu-pancake.jpg',
        rating: 4.7,
        spiceLevel: 0,
        chefSpecial: true,
        orderCount: 189,
        reviewCount: 112,
        category: 'desserts',
        isPopular: false,
        isAvailable: true
      }
    ]
  };

  try {
    for (const [, products] of Object.entries(defaultProducts)) {
      for (const product of products) {
        await addProduct(product);
      }
    }
    console.log('Default products initialized successfully');
  } catch (error) {
    console.error('Error initializing default products:', error);
  }
}; 
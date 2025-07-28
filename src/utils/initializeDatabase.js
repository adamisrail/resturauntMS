import { initializeDefaultProducts } from './productService';

// Flag to prevent multiple simultaneous initializations
let isInitializing = false;

// Function to initialize the database
export const initializeDatabase = async () => {
  if (isInitializing) {
    console.log('Database initialization already in progress, skipping...');
    return false;
  }
  
  try {
    isInitializing = true;
    console.log('Starting database initialization...');
    await initializeDefaultProducts();
    console.log('Database initialized successfully!');
    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    return false;
  } finally {
    isInitializing = false;
  }
};

// Auto-run initialization when this file is imported
// initializeDatabase(); // Commented out to prevent double initialization 
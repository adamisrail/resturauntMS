import { collection, getDocs, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';

export const updateProductIds = async () => {
  try {
    console.log('Starting product ID update process...');
    
    // Fetch all products
    const productsSnapshot = await getDocs(collection(db, 'products'));
    const products = productsSnapshot.docs;
    
    console.log(`Found ${products.length} products to process`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // First try batch processing
    try {
      // Process products in smaller batches to avoid quota limits
      const batchSize = 5; // Process 5 products at a time
      const delay = 1000; // 1 second delay between batches
      
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchProducts = products.slice(i, i + batchSize);
        
        console.log(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(products.length/batchSize)}`);
        
        for (const productDoc of batchProducts) {
          const productData = productDoc.data();
          const docId = productDoc.id;
          
          console.log(`Processing product: ${productData.name} (Doc ID: ${docId})`);
          
          // Check if the product already has a valid id field (not empty string)
          if (productData.id && productData.id.trim() !== '') {
            console.log(`Product ${productData.name} already has ID: ${productData.id}`);
            skippedCount++;
            continue;
          }
          
          // Generate a unique ID based on name and price
          const productName = productData.name || 'unknown-product';
          const uniqueId = `product-${productName.replace(/\s+/g, '-').toLowerCase()}-${productData.price || 0}`;
          
          console.log(`Updating product ${productData.name} with new ID: ${uniqueId}`);
          
          // Add update to batch
          const productRef = doc(db, 'products', docId);
          batch.update(productRef, { id: uniqueId });
          updatedCount++;
        }
        
        // Commit the batch
        try {
          await batch.commit();
          console.log(`✅ Successfully committed batch ${Math.floor(i/batchSize) + 1}`);
          
          // Add delay between batches to avoid quota limits
          if (i + batchSize < products.length) {
            console.log(`Waiting ${delay}ms before next batch...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } catch (error) {
          console.error(`❌ Error committing batch ${Math.floor(i/batchSize) + 1}:`, error);
          errorCount += batchProducts.length;
          
          // If we hit quota limits, wait longer and try again
          if (error.message.includes('quota') || error.message.includes('limit')) {
            console.log('Quota limit detected, waiting 5 seconds before continuing...');
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      }
    } catch (batchError) {
      console.log('Batch processing failed, trying individual updates...');
      
      // Fallback to individual updates with longer delays
      for (const productDoc of products) {
        const productData = productDoc.data();
        const docId = productDoc.id;
        
        console.log(`Processing product: ${productData.name} (Doc ID: ${docId})`);
        
        // Check if the product already has a valid id field (not empty string)
        if (productData.id && productData.id.trim() !== '') {
          console.log(`Product ${productData.name} already has ID: ${productData.id}`);
          skippedCount++;
          continue;
        }
        
        // Generate a unique ID based on name and price
        const productName = productData.name || 'unknown-product';
        const uniqueId = `product-${productName.replace(/\s+/g, '-').toLowerCase()}-${productData.price || 0}`;
        
        console.log(`Updating product ${productData.name} with new ID: ${uniqueId}`);
        
        try {
          // Update individual product with longer delay
          await updateDoc(doc(db, 'products', docId), { id: uniqueId });
          console.log(`✅ Successfully updated product ${productData.name} with ID: ${uniqueId}`);
          updatedCount++;
          
          // Wait 2 seconds between individual updates to avoid quota limits
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(`❌ Error updating product ${productData.name}:`, error);
          errorCount++;
          
          // If we hit quota limits, wait even longer
          if (error.message.includes('quota') || error.message.includes('limit')) {
            console.log('Quota limit detected, waiting 10 seconds...');
            await new Promise(resolve => setTimeout(resolve, 10000));
          }
        }
      }
    }
    
    console.log(`Product ID update completed!`);
    console.log(`Updated: ${updatedCount} products`);
    console.log(`Skipped: ${skippedCount} products (already had IDs)`);
    console.log(`Errors: ${errorCount} products`);
    
    return {
      success: true,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errorCount,
      total: products.length
    };
    
  } catch (error) {
    console.error('Error updating product IDs:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Function to run the update (can be called from admin panel)
export const runProductIdUpdate = async () => {
  const result = await updateProductIds();
  
  if (result.success) {
    console.log('✅ Product ID update successful!');
    if (window.addNotification) {
      window.addNotification(
        `Updated ${result.updated} products with IDs. ${result.skipped} products already had IDs. ${result.errors} errors.`, 
        'success', 
        5000
      );
    }
  } else {
    console.error('❌ Product ID update failed:', result.error);
    if (window.addNotification) {
      window.addNotification(
        `Failed to update product IDs: ${result.error}`, 
        'error', 
        5000
      );
    }
  }
  
  return result;
}; 
import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { runProductIdUpdate } from '../../utils/updateProductIds';
import { getProductsOptimized, getOrdersOptimized, getCacheStats } from '../../utils/firebaseOptimizer';
import './AdminStyles.css';

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showAddProduct, setShowAddProduct] = useState(false);

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
    
    // Set up real-time listener for orders
    const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrders(ordersData);
      console.log('Orders updated in real-time:', ordersData.length);
    }, (error) => {
      console.error('Error listening to orders:', error);
    });

    // Cleanup listener on unmount
    return () => {
      unsubscribeOrders();
    };
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch products using optimized function
      const productsData = await getProductsOptimized();
      setProducts(productsData);

      // Fetch orders using optimized function
      try {
        const ordersData = await getOrdersOptimized();
        setOrders(ordersData);
      } catch (error) {
        console.log('No orders collection found');
      }

      // Fetch users (if you have a users collection)
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersData = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setUsers(usersData);
      } catch (error) {
        console.log('No users collection found');
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (productData) => {
    try {
      await addDoc(collection(db, 'products'), productData);
      fetchData(); // Refresh data
      setShowAddProduct(false);
    } catch (error) {
      console.error('Error adding product:', error);
    }
  };

  const handleUpdateProduct = async (productId, productData) => {
    try {
      // Validate productId
      if (!productId) {
        console.error('Product ID is missing');
        console.log('Available products:', products);
        console.log('Selected product:', selectedProduct);
        alert('Error: Product ID is missing. Please try again.');
        return;
      }

      console.log('Updating product with ID:', productId);
      console.log('Product data:', productData);
      
      await updateDoc(doc(db, 'products', productId), productData);
      fetchData(); // Refresh data
      setSelectedProduct(null);
      
      // Show success message
      if (window.addNotification) {
        window.addNotification('Product updated successfully!', 'success', 3000);
      }
    } catch (error) {
      console.error('Error updating product:', error);
      alert(`Error updating product: ${error.message}`);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!productId) {
      console.error('Product ID is missing');
      alert('Error: Product ID is missing. Please try again.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        console.log('Deleting product with ID:', productId);
        await deleteDoc(doc(db, 'products', productId));
        fetchData(); // Refresh data
        
        // Show success message
        if (window.addNotification) {
          window.addNotification('Product deleted successfully!', 'success', 3000);
        }
      } catch (error) {
        console.error('Error deleting product:', error);
        alert(`Error deleting product: ${error.message}`);
      }
    }
  };

  const handleUpdateProductIds = async () => {
    if (window.confirm('This will add IDs to all products that are missing them. Continue?')) {
      try {
        const result = await runProductIdUpdate();
        if (result.success) {
          fetchData(); // Refresh data after update
        }
      } catch (error) {
        console.error('Error updating product IDs:', error);
      }
    }
  };

  const handleShowCacheStats = () => {
    const stats = getCacheStats();
    console.log('Cache Statistics:', stats);
    if (window.addNotification) {
      window.addNotification(
        `Cache Stats: Products(${stats.products.cached ? 'Cached' : 'Not Cached'}), Users(${stats.users.cachedCount}), Orders(${stats.orders.cached ? 'Cached' : 'Not Cached'})`,
        'info',
        5000
      );
    }
  };

  const handleMarkTableReady = async (tableNumber) => {
    try {
      // Find all orders for this table
      const tableOrders = orders.filter(order => order.tableNumber === tableNumber);
      
      // Update all orders to 'ready' status
      const updatePromises = tableOrders.map(order => 
        updateDoc(doc(db, 'orders', order.id), {
          status: 'ready',
          updatedAt: serverTimestamp()
        })
      );
      
      await Promise.all(updatePromises);
      
      if (window.addNotification) {
        window.addNotification(
          `${tableNumber} marked as ready!`,
          'success',
          3000
        );
      }
    } catch (error) {
      console.error('Error marking table ready:', error);
      if (window.addNotification) {
        window.addNotification(
          'Error marking table ready',
          'error',
          3000
        );
      }
    }
  };

  const handleClearTable = async (tableNumber) => {
    try {
      // Find all orders for this table
      const tableOrders = orders.filter(order => order.tableNumber === tableNumber);
      
      // Update all orders to 'completed' status
      const updatePromises = tableOrders.map(order => 
        updateDoc(doc(db, 'orders', order.id), {
          status: 'completed',
          updatedAt: serverTimestamp()
        })
      );
      
      await Promise.all(updatePromises);
      
      if (window.addNotification) {
        window.addNotification(
          `${tableNumber} cleared!`,
          'success',
          3000
        );
      }
    } catch (error) {
      console.error('Error clearing table:', error);
      if (window.addNotification) {
        window.addNotification(
          'Error clearing table',
          'error',
          3000
        );
      }
    }
  };

  const renderDashboard = () => (
    <div className="admin-dashboard">
      <h2>Dashboard</h2>
              <div className="admin-dashboard-stats">
          <div className="admin-stat-card">
            <h3>Total Products</h3>
            <p>{products.length}</p>
          </div>
          <div className="admin-stat-card">
            <h3>Total Orders</h3>
            <p>{orders.length}</p>
          </div>
          <div className="admin-stat-card">
            <h3>Total Users</h3>
            <p>{users.length}</p>
          </div>
        </div>
        <div className="admin-dashboard-actions">
          <button 
            className="admin-cache-stats-btn"
            onClick={handleShowCacheStats}
            title="View cache statistics"
          >
            📊 Cache Stats
          </button>
        </div>
    </div>
  );

  const renderProducts = () => (
    <div className="admin-products">
      <div className="admin-products-header">
        <h2>Products Management</h2>
        <div className="admin-products-actions">
          <button 
            className="admin-update-ids-btn"
            onClick={handleUpdateProductIds}
            title="Add IDs to products that are missing them"
          >
            Update Product IDs
          </button>
          <button 
            className="admin-add-product-btn"
            onClick={() => setShowAddProduct(true)}
          >
            Add New Product
          </button>
        </div>
      </div>
      
      {showAddProduct && (
        <AddProductForm 
          onSubmit={handleAddProduct}
          onCancel={() => setShowAddProduct(false)}
        />
      )}

      <div className="admin-products-grid">
        {products.map(product => (
          <div key={product.id} className="admin-product-card">
            <img src={product.image} alt={product.name} className="admin-product-image" />
            <div className="admin-product-info">
              <h3>{product.name}</h3>
              <p>{product.description}</p>
              <p className="admin-product-price">${product.price}</p>
              <p className="admin-product-category">{product.category}</p>
            </div>
            <div className="admin-product-actions">
              <button 
                className="admin-edit-btn"
                onClick={() => {
                  console.log('Edit button clicked for product:', product);
                  console.log('Product ID:', product.id);
                  setSelectedProduct(product);
                }}
              >
                Edit
              </button>
              <button 
                className="admin-delete-btn"
                onClick={() => handleDeleteProduct(product.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedProduct && (
        <EditProductForm 
          product={selectedProduct}
          onSubmit={(data) => {
            console.log('Selected product:', selectedProduct);
            console.log('Product ID:', selectedProduct.id);
            console.log('Product data being submitted:', data);
            handleUpdateProduct(selectedProduct.id, data);
          }}
          onCancel={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );

  const renderOrders = () => {
    // Group orders by table
    const ordersByTable = orders.reduce((acc, order) => {
      const tableNumber = order.tableNumber || 'Table 1';
      if (!acc[tableNumber]) {
        acc[tableNumber] = [];
      }
      acc[tableNumber].push(order);
      return acc;
    }, {});

    // Calculate totals for each table
    const tableTotals = {};
    Object.keys(ordersByTable).forEach(tableNumber => {
      tableTotals[tableNumber] = ordersByTable[tableNumber].reduce((sum, order) => {
        return sum + (order.total || 0);
      }, 0);
    });

    return (
      <div className="admin-orders">
        <div className="admin-orders-header">
          <h2>Orders Management</h2>
          <div className="admin-orders-summary">
            <span className="admin-total-tables">Tables: {Object.keys(ordersByTable).length}</span>
            <span className="admin-total-orders">Orders: {orders.length}</span>
          </div>
        </div>
        
        <div className="admin-tables-grid">
                      {Object.keys(ordersByTable).map(tableNumber => (
              <div key={tableNumber} className="admin-table-card">
                <div className="admin-table-header">
                  <h3>{tableNumber}</h3>
                  <div className="admin-table-status">
                    <span className="admin-order-count">{ordersByTable[tableNumber].length} orders</span>
                    <span className="admin-table-total">${tableTotals[tableNumber].toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="admin-table-orders">
                  {ordersByTable[tableNumber].map(order => (
                    <div key={order.id} className="admin-table-order-item">
                      <div className="admin-order-customer">
                        <span className="admin-customer-name">{order.customerName || 'Anonymous'}</span>
                        <span className="admin-order-time">
                          {order.createdAt ? 
                            new Date(order.createdAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 
                            'N/A'
                          }
                        </span>
                      </div>
                      
                      <div className="admin-order-items">
                        {order.items?.map((item, index) => (
                          <div key={index} className="admin-order-item">
                            <span className="admin-item-quantity">{item.quantity}x</span>
                            <span className="admin-item-name">{item.name}</span>
                            <span className="admin-item-price">${item.price}</span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="admin-order-footer">
                        <span className="admin-order-total">${order.total?.toFixed(2) || '0.00'}</span>
                        <span className={`admin-order-status ${order.status || 'pending'}`}>
                          {order.status || 'Pending'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="admin-table-actions">
                  <button 
                    className="admin-mark-ready-btn"
                    onClick={() => handleMarkTableReady(tableNumber)}
                  >
                    Mark Ready
                  </button>
                  <button 
                    className="admin-clear-table-btn"
                    onClick={() => handleClearTable(tableNumber)}
                  >
                    Clear Table
                  </button>
                </div>
              </div>
            ))}
        </div>
        
        {Object.keys(ordersByTable).length === 0 && (
          <div className="admin-no-tables">
            <p>No active tables</p>
            <p className="admin-no-tables-subtitle">Orders will appear here when customers place them</p>
          </div>
        )}
      </div>
    );
  };

  const renderUsers = () => (
    <div className="admin-users">
      <h2>Users Management</h2>
      <div className="admin-users-list">
        {users.map(user => (
          <div key={user.id} className="admin-user-card">
            <div className="admin-user-info">
              <h3>{user.name || user.displayName || 'Unknown User'}</h3>
              <p>{user.email || user.phoneNumber || 'No contact info'}</p>
              <p className="admin-user-role">{user.role || 'Customer'}</p>
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <p className="admin-no-users">No users found</p>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-loading-spinner"></div>
        <p>Loading admin panel...</p>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>Restaurant Management Panel</h1>
        <p>Admin Dashboard</p>
      </div>
      
      <div className="admin-navigation">
        <button 
          className={`admin-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button 
          className={`admin-nav-btn ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          Products
        </button>
        <button 
          className={`admin-nav-btn ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          Orders
        </button>
        <button 
          className={`admin-nav-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'products' && renderProducts()}
        {activeTab === 'orders' && renderOrders()}
        {activeTab === 'users' && renderUsers()}
      </div>
    </div>
  );
};

// Add Product Form Component
const AddProductForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: 'main-course',
    image: '',
    rating: 4.5,
    reviewCount: 0,
    orderCount: 0
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      price: parseFloat(formData.price),
      rating: parseFloat(formData.rating),
      reviewCount: parseInt(formData.reviewCount),
      orderCount: parseInt(formData.orderCount)
    });
  };

  return (
    <div className="admin-form-overlay">
      <div className="admin-form-modal">
        <h3>Add New Product</h3>
        <form onSubmit={handleSubmit}>
          <div className="admin-form-group">
            <label>Name:</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>
          <div className="admin-form-group">
            <label>Description:</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              required
            />
          </div>
          <div className="admin-form-group">
            <label>Price:</label>
            <input
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData({...formData, price: e.target.value})}
              required
            />
          </div>
          <div className="admin-form-group">
            <label>Category:</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
            >
              <option value="main-course">Main Course</option>
              <option value="appetizers">Appetizers</option>
              <option value="desserts">Desserts</option>
              <option value="drinks">Drinks</option>
              <option value="sides">Sides</option>
            </select>
          </div>
          <div className="admin-form-group">
            <label>Image URL:</label>
            <input
              type="text"
              value={formData.image}
              onChange={(e) => setFormData({...formData, image: e.target.value})}
              required
            />
          </div>
          <div className="admin-form-actions">
            <button type="submit" className="admin-submit-btn">Add Product</button>
            <button type="button" className="admin-cancel-btn" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit Product Form Component
const EditProductForm = ({ product, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: product.name || '',
    description: product.description || '',
    price: product.price || '',
    category: product.category || 'main-course',
    image: product.image || '',
    rating: product.rating || 4.5,
    reviewCount: product.reviewCount || 0,
    orderCount: product.orderCount || 0
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      price: parseFloat(formData.price),
      rating: parseFloat(formData.rating),
      reviewCount: parseInt(formData.reviewCount),
      orderCount: parseInt(formData.orderCount)
    });
  };

  return (
    <div className="admin-form-overlay">
      <div className="admin-form-modal">
        <h3>Edit Product</h3>
        <form onSubmit={handleSubmit}>
          <div className="admin-form-group">
            <label>Name:</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>
          <div className="admin-form-group">
            <label>Description:</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              required
            />
          </div>
          <div className="admin-form-group">
            <label>Price:</label>
            <input
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData({...formData, price: e.target.value})}
              required
            />
          </div>
          <div className="admin-form-group">
            <label>Category:</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
            >
              <option value="main-course">Main Course</option>
              <option value="appetizers">Appetizers</option>
              <option value="desserts">Desserts</option>
              <option value="drinks">Drinks</option>
              <option value="sides">Sides</option>
            </select>
          </div>
          <div className="admin-form-group">
            <label>Image URL:</label>
            <input
              type="text"
              value={formData.image}
              onChange={(e) => setFormData({...formData, image: e.target.value})}
              required
            />
          </div>
          <div className="admin-form-actions">
            <button type="submit" className="admin-submit-btn">Update Product</button>
            <button type="button" className="admin-cancel-btn" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminPanel; 
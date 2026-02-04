// config.js - Production configuration for Render
const CONFIG = {
  BACKEND_URL: 'https://smart-waiter-backend.onrender.com',
  FRONTEND_URL: 'https://smart-waiter-frontend.onrender.com',
  
  // Demo accounts
  DEMO_ACCOUNTS: {
    customer: { email: 'customer@demo.com', password: '123456' },
    chef: { email: 'chef@demo.com', password: '123456' },
    admin: { email: 'admin@demo.com', password: '123456' }
  },
  
  // Real-time settings
  SOCKET_CONFIG: {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    transports: ['websocket', 'polling']
  },
  
  // API endpoints
  API_ENDPOINTS: {
    // Auth
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    FORGOT_PASSWORD: '/api/auth/forgot-password',
    
    // Customer
    CUSTOMER_MENU: '/api/customer/menu',
    CUSTOMER_ORDER: '/api/customer/order',
    CUSTOMER_ORDERS: '/api/customer/orders',
    
    // Chef
    CHEF_ORDERS: '/api/chef/orders',
    CHEF_MENU: '/api/chef/menu',
    CHEF_SERVICE_REQUESTS: '/api/chef/service-requests',
    
    // Admin
    ADMIN_STATS: '/api/admin/stats',
    ADMIN_MENU: '/api/admin/menu',
    ADMIN_TABLES: '/api/admin/tables',
    ADMIN_STAFF: '/api/admin/staff',
    ADMIN_SALES: '/api/admin/sales'
  }
};

window.CONFIG = CONFIG;

// Helper function for API calls
window.API = {
  get: async (endpoint, token = null) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    try {
      const response = await fetch(`${CONFIG.BACKEND_URL}${endpoint}`, { headers });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`API GET Error (${endpoint}):`, error);
      throw error;
    }
  },
  
  post: async (endpoint, data, token = null) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    try {
      const response = await fetch(`${CONFIG.BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`API POST Error (${endpoint}):`, error);
      throw error;
    }
  },
  
  put: async (endpoint, data, token = null) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    try {
      const response = await fetch(`${CONFIG.BACKEND_URL}${endpoint}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`API PUT Error (${endpoint}):`, error);
      throw error;
    }
  },
  
  delete: async (endpoint, token = null) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    try {
      const response = await fetch(`${CONFIG.BACKEND_URL}${endpoint}`, {
        method: 'DELETE',
        headers
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`API DELETE Error (${endpoint}):`, error);
      throw error;
    }
  }
};
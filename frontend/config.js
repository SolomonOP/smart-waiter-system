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
    VERIFY: '/api/auth/verify',
    
    // Customer
    CUSTOMER_MENU: '/api/customer/menu',
    CUSTOMER_ORDER: '/api/customer/order',
    CUSTOMER_ORDERS: '/api/customer/orders',
    
    // Chef
    CHEF_ORDERS: '/api/chef/orders',
    CHEF_MENU: '/api/chef/menu',
    CHEF_SERVICE_REQUESTS: '/api/chef/service-requests',
    CHEF_ORDER_ACCEPT: (id) => `/api/chef/orders/${id}/accept`,
    CHEF_ORDER_REJECT: (id) => `/api/chef/orders/${id}/reject`,
    CHEF_ORDER_COMPLETE: (id) => `/api/chef/orders/${id}/complete`,
    CHEF_ORDER_READY: (id) => `/api/chef/orders/${id}/ready`,
    
    // Admin
    ADMIN_STATS: '/api/admin/stats',
    ADMIN_ORDERS_RECENT: '/api/admin/orders/recent',
    ADMIN_REVENUE_WEEKLY: '/api/admin/revenue/weekly',
    ADMIN_MENU: '/api/admin/menu',
    ADMIN_MENU_ITEM: (id) => `/api/admin/menu/${id}`,
    ADMIN_MENU_AVAILABILITY: (id) => `/api/admin/menu/${id}/availability`,
    ADMIN_TABLES: '/api/admin/tables',
    ADMIN_TABLES_REMOVE: '/api/admin/tables/remove',
    ADMIN_STAFF: '/api/admin/staff',
    ADMIN_STAFF_MEMBER: (id) => `/api/admin/staff/${id}`,
    ADMIN_SALES: '/api/admin/sales',
    ADMIN_SALES_DATE: (date) => `/api/admin/sales/${date}`
  }
};

window.CONFIG = CONFIG;
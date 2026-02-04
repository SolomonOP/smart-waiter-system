// config.js - Fixed version
const CONFIG = {
  BACKEND_URL: 'https://smart-waiter-backend.onrender.com',
  FRONTEND_URL: 'https://smart-waiter-frontend.onrender.com',
  
  DEMO_ACCOUNTS: {
    customer: { email: 'customer@demo.com', password: '123456' },
    chef: { email: 'chef@demo.com', password: '123456' },
    admin: { email: 'admin@demo.com', password: '123456' }
  },
  
  SOCKET_CONFIG: {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    transports: ['websocket', 'polling']
  },
  
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
    CUSTOMER_MENU_ALL: '/api/customer/menu',
    CUSTOMER_MENU_AVAILABLE: '/api/customer/menu?available=true',
    CUSTOMER_MENU_CATEGORY: (category) => `/api/customer/menu?category=${category}`,
    // Chef
    CHEF_ORDERS: '/api/chef/orders',
    CHEF_MENU: '/api/chef/menu',
    CHEF_SERVICE_REQUESTS: '/api/chef/service-requests',
    CHEF_ORDER_ACCEPT: (id) => `/api/chef/orders/${id}/accept`,
    CHEF_ORDER_REJECT: (id) => `/api/chef/orders/${id}/reject`,
    CHEF_ORDER_COMPLETE: (id) => `/api/chef/orders/${id}/complete`,
    CHEF_ORDER_READY: (id) => `/api/chef/orders/${id}/ready`,
    CHEF_MENU_ALL: '/api/chef/menu',
    CHEF_MENU_AVAILABLE: '/api/chef/menu?available=true',
    
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
    ADMIN_SALES_DATE: (date) => `/api/admin/sales/${date}`,
    ADMIN_MENU_ALL: '/api/admin/menu',
    ADMIN_MENU_CATEGORY: (category) => `/api/admin/menu?category=${category}`
  }
};

window.CONFIG = CONFIG;
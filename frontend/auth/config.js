// Production configuration
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
  
  // Features
  FEATURES: {
    realtime: true,
    notifications: true,
    qrCode: true,
    liveTracking: true
  }
};

// Auto-detect environment
if (window.location.hostname.includes('render.com')) {
  CONFIG.BACKEND_URL = 'https://smart-waiter-backend.onrender.com';
}

window.CONFIG = CONFIG;
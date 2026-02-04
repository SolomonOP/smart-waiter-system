// config.js - Updated with comprehensive error handling
const CONFIG = {
  BACKEND_URL: 'https://smart-waiter-backend.onrender.com',
  FRONTEND_URL: 'https://smart-waiter-frontend.onrender.com',
  
  // Demo accounts
  DEMO_ACCOUNTS: {
    customer: { email: 'customer@demo.com', password: '123456', name: 'Demo Customer' },
    chef: { email: 'chef@demo.com', password: '123456', name: 'Demo Chef' },
    admin: { email: 'admin@demo.com', password: '123456', name: 'Demo Admin' }
  },
  
  // Real-time settings
  SOCKET_CONFIG: {
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    transports: ['websocket', 'polling']
  },
  
  // API endpoints
  API_ENDPOINTS: {
    // Health check
    HEALTH: '/health',
    
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
  },
  
  // Timeouts
  TIMEOUTS: {
    API_REQUEST: 10000, // 10 seconds
    SOCKET_CONNECTION: 15000,
    RETRY_DELAY: 2000
  }
};

// Enhanced API Helper with timeout and retry logic
class APIHelper {
  constructor() {
    this.retryCount = 0;
    this.maxRetries = 3;
    this.baseUrl = CONFIG.BACKEND_URL;
    this.isBackendOnline = false;
  }

  async checkBackendHealth() {
    try {
      console.log('Checking backend health...');
      const response = await fetch(`${this.baseUrl}${CONFIG.API_ENDPOINTS.HEALTH}`, {
        signal: AbortSignal.timeout(CONFIG.TIMEOUTS.API_REQUEST),
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      this.isBackendOnline = response.ok;
      if (response.ok) {
        const data = await response.json();
        console.log('Backend health check passed:', data);
        return { online: true, data };
      }
      return { online: false, error: `HTTP ${response.status}` };
    } catch (error) {
      console.error('Backend health check failed:', error.message);
      this.isBackendOnline = false;
      return { online: false, error: error.message };
    }
  }

  async request(method, endpoint, data = null, token = null, retries = this.maxRetries) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      method,
      headers,
      signal: AbortSignal.timeout(CONFIG.TIMEOUTS.API_REQUEST),
      mode: 'cors',
      credentials: 'include'
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`API ${method} attempt ${attempt}/${retries}: ${endpoint}`);
        
        const response = await fetch(url, options);
        
        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } catch {
            // If response is not JSON
          }
          
          // If it's a server error (5xx), retry
          if (response.status >= 500 && attempt < retries) {
            console.log(`Server error ${response.status}, retrying...`);
            await this.delay(attempt * 1000);
            continue;
          }
          
          throw new Error(errorMessage);
        }

        // Reset retry count on success
        this.retryCount = 0;
        
        // Try to parse as JSON, fallback to text
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        } else {
          return await response.text();
        }
      } catch (error) {
        console.error(`API ${method} error (attempt ${attempt}):`, error);
        
        if (attempt === retries) {
          // Check if it's a connection issue
          const isConnectionError = error.name === 'AbortError' || 
                                   error.name === 'TypeError' || 
                                   error.message.includes('Failed to fetch') ||
                                   error.message.includes('NetworkError');
          
          if (isConnectionError) {
            throw new Error('Unable to connect to the server. Please check your internet connection or try again later.');
          }
          
          throw error;
        }
        
        // Exponential backoff
        await this.delay(attempt * 1000);
      }
    }
    
    throw new Error('Maximum retries exceeded');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async get(endpoint, token = null) {
    return this.request('GET', endpoint, null, token);
  }

  async post(endpoint, data, token = null) {
    return this.request('POST', endpoint, data, token);
  }

  async put(endpoint, data, token = null) {
    return this.request('PUT', endpoint, data, token);
  }

  async delete(endpoint, token = null) {
    return this.request('DELETE', endpoint, null, token);
  }
}

// Toast notification helper
class Toast {
  static show(message, type = 'info', duration = 3000) {
    // Remove existing toasts
    document.querySelectorAll('.custom-toast').forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `custom-toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <i class="fas ${this.getIcon(type)}"></i>
        <span>${message}</span>
      </div>
      <button class="toast-close">&times;</button>
    `;
    
    // Add styles
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${this.getBackground(type)};
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 5px 15px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-width: 300px;
      max-width: 400px;
      z-index: 9999;
      animation: slideIn 0.3s ease-out;
      font-family: 'Segoe UI', sans-serif;
    `;
    
    toast.querySelector('.toast-content').style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
    `;
    
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: white;
      font-size: 20px;
      cursor: pointer;
      padding: 0 0 0 15px;
    `;
    
    closeBtn.addEventListener('click', () => {
      toast.style.animation = 'slideOut 0.3s ease-out forwards';
      setTimeout(() => toast.remove(), 300);
    });
    
    document.body.appendChild(toast);
    
    // Auto remove
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'slideOut 0.3s ease-out forwards';
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
    
    // Add animations
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  static getIcon(type) {
    const icons = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    };
    return icons[type] || 'fa-info-circle';
  }
  
  static getBackground(type) {
    const backgrounds = {
      success: '#28a745',
      error: '#dc3545',
      warning: '#ffc107',
      info: '#17a2b8'
    };
    return backgrounds[type] || '#17a2b8';
  }
}

// Loading indicator helper
class Loading {
  static show(message = 'Loading...') {
    // Remove existing loading
    this.hide();
    
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <div class="loading-text mt-3">${message}</div>
      </div>
    `;
    
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9998;
    `;
    
    overlay.querySelector('.loading-spinner').style.cssText = `
      text-align: center;
      color: white;
    `;
    
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
  }
  
  static hide() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.remove();
    }
    document.body.style.overflow = '';
  }
}

// Connection manager
class ConnectionManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.backendOnline = false;
    this.apiHelper = new APIHelper();
    this.listeners = [];
    
    this.init();
  }
  
  async init() {
    this.setupEventListeners();
    
    // Initial health check
    const health = await this.apiHelper.checkBackendHealth();
    this.backendOnline = health.online;
    
    // Notify listeners
    this.notifyStatusChange();
  }
  
  setupEventListeners() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }
  
  handleOnline() {
    this.isOnline = true;
    console.log('Device is online');
    Toast.show('Internet connection restored', 'success');
    this.checkBackendConnection();
  }
  
  handleOffline() {
    this.isOnline = false;
    this.backendOnline = false;
    console.log('Device is offline');
    Toast.show('Internet connection lost', 'warning');
    this.notifyStatusChange();
  }
  
  async checkBackendConnection() {
    if (!this.isOnline) return false;
    
    try {
      const health = await this.apiHelper.checkBackendHealth();
      this.backendOnline = health.online;
      this.notifyStatusChange();
      
      if (health.online) {
        Toast.show('Connected to server', 'success');
      } else {
        Toast.show('Server is offline', 'error');
      }
      
      return health.online;
    } catch (error) {
      this.backendOnline = false;
      this.notifyStatusChange();
      return false;
    }
  }
  
  addListener(listener) {
    this.listeners.push(listener);
  }
  
  notifyStatusChange() {
    const status = {
      deviceOnline: this.isOnline,
      backendOnline: this.backendOnline,
      timestamp: new Date().toISOString()
    };
    
    this.listeners.forEach(listener => listener(status));
  }
  
  getStatus() {
    return {
      deviceOnline: this.isOnline,
      backendOnline: this.backendOnline
    };
  }
}

// Initialize and export
window.CONFIG = CONFIG;
window.API = new APIHelper();
window.Toast = Toast;
window.Loading = Loading;
window.ConnectionManager = ConnectionManager;

// Create connection manager instance
window.connectionManager = new ConnectionManager();

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONFIG, API, Toast, Loading, ConnectionManager };
}
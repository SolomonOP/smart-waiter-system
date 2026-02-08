// utils.js - Complete Utility Functions for Smart Waiter Frontend

// ==================== CONFIGURATION ====================
const CONFIG = {
    BACKEND_URL: 'https://smart-waiter-backend.onrender.com',
    FRONTEND_URL: 'https://smart-waiter-frontend.onrender.com',
    
    // Admin endpoints
    API_ENDPOINTS: {
        // Auth endpoints
        LOGIN: '/api/auth/login',
        REGISTER: '/api/auth/register',
        VERIFY: '/api/auth/verify-token',
        ME: '/api/auth/me',
        LOGOUT: '/api/auth/logout',
        
        // Admin endpoints
        ADMIN_STATS: '/api/admin/stats',
        ADMIN_ORDER_STATUS_STATS: '/api/admin/orders/status-stats',
        ADMIN_ORDERS_RECENT: '/api/admin/orders/recent',
        ADMIN_REVENUE_WEEKLY: '/api/admin/revenue/weekly',
        ADMIN_MENU: '/api/admin/menu',
        ADMIN_MENU_ITEM: (id) => `/api/admin/menu/${id}`,
        ADMIN_MENU_AVAILABILITY: (id) => `/api/admin/menu/${id}/availability`,
        ADMIN_TABLES: '/api/admin/tables',
        ADMIN_TABLE: (id) => `/api/admin/tables/${id}`,
        ADMIN_TABLES_BULK: '/api/admin/tables/bulk',
        ADMIN_TABLES_REMOVE: '/api/admin/tables/remove',
        ADMIN_STAFF: '/api/admin/staff',
        ADMIN_STAFF_MEMBER: (id) => `/api/admin/staff/${id}`,
        ADMIN_SALES: '/api/admin/analytics/sales',
        ADMIN_SALES_DATE: (date) => `/api/admin/analytics/sales/${date}`,
        ADMIN_USERS: '/api/auth/admin/users',
        
        // Customer endpoints
        CUSTOMER_MENU: '/api/customer/menu',
        CUSTOMER_ORDER: '/api/customer/order',
        CUSTOMER_ORDERS: '/api/customer/orders',
        
        // Chef endpoints
        CHEF_ORDERS: '/api/chef/orders',
        CHEF_MENU: '/api/chef/menu',
        
        // Demo endpoints
        DEMO_ACCOUNTS: '/api/auth/demo-accounts',
        DEMO_DATA: '/api/demo',
        
        // Test endpoints
        HEALTH: '/health',
        TEST_DB: '/api/auth/test-db',
        TEST_BCRYPT: '/api/auth/test-bcrypt',
        CHECK_USER: '/api/auth/check-user',
        CREATE_ADMIN: '/api/auth/create-admin'
    },
    
    SOCKET_CONFIG: {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    },
    
    // App settings
    APP_NAME: 'Smart Waiter',
    APP_VERSION: '2.0.0',
    
    // Timeouts
    REQUEST_TIMEOUT: 30000,
    SOCKET_TIMEOUT: 60000,
    
    // Pagination
    ITEMS_PER_PAGE: 10
};

// ==================== TOAST NOTIFICATION SYSTEM ====================
class Toast {
    static show(message, type = 'info', duration = 3000) {
        // Remove existing toasts
        document.querySelectorAll('.custom-toast').forEach(toast => toast.remove());
        
        const toast = document.createElement('div');
        toast.className = `custom-toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas ${this.getIcon(type)} me-2"></i>
                <span>${message}</span>
            </div>
            <button class="toast-close">&times;</button>
        `;
        
        // Styling
        toast.style.position = 'fixed';
        toast.style.top = '20px';
        toast.style.right = '20px';
        toast.style.zIndex = '9999';
        toast.style.padding = '15px 20px';
        toast.style.borderRadius = '8px';
        toast.style.boxShadow = '0 5px 15px rgba(0,0,0,0.2)';
        toast.style.color = 'white';
        toast.style.display = 'flex';
        toast.style.alignItems = 'center';
        toast.style.justifyContent = 'space-between';
        toast.style.minWidth = '300px';
        toast.style.maxWidth = '500px';
        toast.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        toast.style.fontSize = '14px';
        toast.style.animation = 'slideIn 0.3s ease-out';
        
        // Colors
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        toast.style.backgroundColor = colors[type] || colors.info;
        
        // Close button styling
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.style.background = 'transparent';
        closeBtn.style.border = 'none';
        closeBtn.style.color = 'white';
        closeBtn.style.fontSize = '20px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.marginLeft = '15px';
        closeBtn.style.padding = '0 5px';
        
        // Add animation style
        if (!document.querySelector('#toast-animation')) {
            const style = document.createElement('style');
            style.id = 'toast-animation';
            style.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                
                @keyframes slideOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Add event listeners
        closeBtn.addEventListener('click', () => {
            toast.style.animation = 'slideOut 0.3s ease-out forwards';
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 300);
        });
        
        document.body.appendChild(toast);
        
        // Auto remove
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideOut 0.3s ease-out forwards';
                setTimeout(() => {
                    if (toast.parentNode) toast.remove();
                }, 300);
            }
        }, duration);
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
}

// ==================== API HELPER ====================
class API {
    static async request(method, endpoint, data = null, token = null) {
        const url = `${CONFIG.BACKEND_URL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

        const options = {
            method,
            headers,
            mode: 'cors',
            credentials: 'include',
            signal: controller.signal
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = JSON.stringify(data);
        }

        try {
            console.log(`🌐 API ${method} Request:`, { endpoint, data: method !== 'GET' ? data : null });
            
            const response = await fetch(url, options);
            clearTimeout(timeoutId);
            
            console.log(`📡 API Response Status: ${response.status} ${response.statusText}`);
            
            // Handle 401 Unauthorized
            if (response.status === 401) {
                Toast.show('Session expired. Please login again.', 'error');
                localStorage.clear();
                setTimeout(() => {
                    window.location.href = '/auth/index.html';
                }, 1500);
                throw new Error('Unauthorized');
            }
            
            // Handle 503 Service Unavailable (Database not ready)
            if (response.status === 503) {
                Toast.show('System is starting up. Please try again in a moment.', 'warning');
                throw new Error('Service temporarily unavailable');
            }
            
            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorData.error || errorMessage;
                    console.error('API Error Details:', errorData);
                } catch (parseError) {
                    console.error('Failed to parse error response:', parseError);
                }
                
                throw new Error(errorMessage);
            }

            try {
                const responseData = await response.json();
                console.log(`✅ API ${method} Success:`, { endpoint, response: responseData });
                return responseData;
            } catch (jsonError) {
                console.log(`✅ API ${method} Success (No JSON):`, { endpoint, status: response.status });
                return { success: true, status: response.status };
            }
        } catch (error) {
            clearTimeout(timeoutId);
            console.error(`❌ API ${method} Error for ${endpoint}:`, error);
            
            if (error.name === 'AbortError') {
                Toast.show('Request timeout. Please check your connection.', 'error');
                throw new Error('Request timeout');
            }
            
            if (error.message !== 'Unauthorized') {
                Toast.show(error.message || 'Network error. Please try again.', 'error');
            }
            
            throw error;
        }
    }

    static async get(endpoint, token = null) {
        return this.request('GET', endpoint, null, token);
    }

    static async post(endpoint, data, token = null) {
        return this.request('POST', endpoint, data, token);
    }

    static async put(endpoint, data, token = null) {
        return this.request('PUT', endpoint, data, token);
    }

    static async delete(endpoint, token = null) {
        return this.request('DELETE', endpoint, null, token);
    }
}

// ==================== AUTHENTICATION HELPER ====================
class Auth {
    static getUser() {
        try {
            const userData = localStorage.getItem('user');
            return userData ? JSON.parse(userData) : null;
        } catch (error) {
            console.error('Error parsing user data:', error);
            return null;
        }
    }
    
    static getToken() {
        return localStorage.getItem('token');
    }
    
    static check(requiredRole = null) {
        const user = this.getUser();
        const token = this.getToken();
        
        if (!user || !token) {
            console.log('Auth check failed: No user or token');
            window.location.href = '../auth/index.html';
            return false;
        }
        
        if (requiredRole && user.role !== requiredRole) {
            Toast.show(`Access denied. ${requiredRole.charAt(0).toUpperCase() + requiredRole.slice(1)} role required.`, 'error');
            setTimeout(() => {
                window.location.href = '../auth/index.html';
            }, 2000);
            return false;
        }
        
        return true;
    }
    
    static async verify() {
        const token = this.getToken();
        if (!token) return false;
        
        try {
            await API.get(CONFIG.API_ENDPOINTS.VERIFY, token);
            return true;
        } catch (error) {
            console.log('Token verification failed:', error);
            return false;
        }
    }
    
    static logout() {
        const token = this.getToken();
        if (token) {
            // Try to call logout API (but don't wait for it)
            API.post(CONFIG.API_ENDPOINTS.LOGOUT, {}, token).catch(() => {});
        }
        
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('rememberedEmail');
        localStorage.removeItem('lastLoginTime');
        
        // Disconnect socket
        if (window.SocketManager) {
            SocketManager.disconnect();
        }
        
        Toast.show('Logged out successfully', 'success');
        setTimeout(() => {
            window.location.href = '../auth/index.html';
        }, 1000);
    }
    
    static saveLoginData(token, user) {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('lastLoginTime', Date.now());
        
        // Remember email if checkbox is checked
        const rememberCheckbox = document.getElementById('rememberMe');
        if (rememberCheckbox && rememberCheckbox.checked) {
            localStorage.setItem('rememberedEmail', user.email);
        }
    }
    
    static getRememberedEmail() {
        return localStorage.getItem('rememberedEmail');
    }
    
    static clearRememberedEmail() {
        localStorage.removeItem('rememberedEmail');
    }
}

// ==================== LOADING OVERLAY ====================
class Loading {
    static show(message = 'Loading...') {
        // Remove existing loading
        this.hide();
        
        const overlay = document.createElement('div');
        overlay.id = 'global-loading-overlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="text-center">
                <div class="spinner-border text-light" style="width: 3rem; height: 3rem;" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3 text-light" id="loading-text">${message}</p>
            </div>
        `;
        
        // Add styles if not already present
        if (!document.querySelector('#loading-styles')) {
            const style = document.createElement('style');
            style.id = 'loading-styles';
            style.textContent = `
                .loading-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.85);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    z-index: 9999;
                    backdrop-filter: blur(5px);
                }
                .loading-overlay .spinner-border {
                    width: 3rem;
                    height: 3rem;
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
    }
    
    static updateMessage(newMessage) {
        const textElement = document.getElementById('loading-text');
        if (textElement) {
            textElement.textContent = newMessage;
        }
    }
    
    static hide() {
        const overlay = document.getElementById('global-loading-overlay');
        if (overlay) overlay.remove();
        document.body.style.overflow = '';
    }
}

// ==================== SOCKET.IO MANAGER ====================
class SocketManager {
    static socket = null;
    static callbacks = new Map();
    
    static connect() {
        if (!this.socket || !this.socket.connected) {
            console.log('🔌 Connecting to WebSocket...');
            
            this.socket = io(CONFIG.BACKEND_URL, CONFIG.SOCKET_CONFIG);
            
            this.socket.on('connect', () => {
                console.log('✅ WebSocket connected');
                const user = Auth.getUser();
                if (user) {
                    this.socket.emit('register', {
                        userId: user._id,
                        role: user.role
                    });
                    console.log(`👤 Registered socket as ${user.role}: ${user.email}`);
                }
            });
            
            this.socket.on('disconnect', (reason) => {
                console.log('❌ WebSocket disconnected:', reason);
                Toast.show('Connection lost. Attempting to reconnect...', 'warning');
            });
            
            this.socket.on('connect_error', (error) => {
                console.error('WebSocket connection error:', error);
            });
            
            this.socket.on('reconnect', (attemptNumber) => {
                console.log(`✅ WebSocket reconnected after ${attemptNumber} attempts`);
                Toast.show('Connection restored!', 'success');
            });
            
            // Register all stored callbacks
            this.callbacks.forEach((callback, event) => {
                this.socket.on(event, callback);
            });
        }
        
        return this.socket;
    }
    
    static disconnect() {
        if (this.socket) {
            console.log('🔌 Disconnecting WebSocket...');
            this.socket.disconnect();
            this.socket = null;
        }
    }
    
    static on(event, callback) {
        this.callbacks.set(event, callback);
        if (this.socket) {
            this.socket.on(event, callback);
        }
    }
    
    static off(event) {
        this.callbacks.delete(event);
        if (this.socket) {
            this.socket.off(event);
        }
    }
    
    static emit(event, data) {
        if (this.socket && this.socket.connected) {
            this.socket.emit(event, data);
        } else {
            console.warn(`Cannot emit ${event}: WebSocket not connected`);
        }
    }
    
    static isConnected() {
        return this.socket && this.socket.connected;
    }
}

// ==================== FORMATTING UTILITIES ====================
class FormatUtils {
    static formatOrderStatus(status) {
        const statusMap = {
            'pending': '🕒 Pending',
            'preparing': '👨‍🍳 Preparing',
            'ready': '✅ Ready to Serve',
            'completed': '📦 Completed',
            'rejected': '❌ Rejected',
            'cancelled': '🚫 Cancelled'
        };
        return statusMap[status] || status;
    }
    
    static formatCategory(category) {
        const categoryMap = {
            'appetizer': '🍽️ Appetizer',
            'main': '🍖 Main Course',
            'dessert': '🍰 Dessert',
            'drink': '🥤 Drink',
            'breakfast': '🥞 Breakfast',
            'lunch': '🥪 Lunch',
            'dinner': '🍝 Dinner'
        };
        return categoryMap[category] || category;
    }
    
    static getTableStatusClass(status) {
        const statusMap = {
            'available': 'table-available',
            'occupied': 'table-occupied',
            'reserved': 'table-reserved',
            'needs_cleaning': 'table-needs-cleaning'
        };
        return statusMap[status] || 'table-available';
    }
    
    static getTableStatusText(status) {
        const statusMap = {
            'available': 'Available',
            'occupied': 'Occupied',
            'reserved': 'Reserved',
            'needs_cleaning': 'Needs Cleaning'
        };
        return statusMap[status] || status;
    }
    
    static formatPrice(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(amount);
    }
    
    static formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    static formatTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    static capitalize(text) {
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }
    
    static truncate(text, length = 50) {
        if (text.length <= length) return text;
        return text.substring(0, length) + '...';
    }
}

// ==================== VALIDATION UTILITIES ====================
class Validation {
    static isEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    static isPhone(phone) {
        const phoneRegex = /^[0-9]{10}$/;
        return phoneRegex.test(phone);
    }
    
    static isPasswordStrong(password) {
        const minLength = 6;
        if (password.length < minLength) return false;
        return true;
    }
    
    static isEmpty(value) {
        return !value || value.trim().length === 0;
    }
}

// ==================== STORAGE UTILITIES ====================
class Storage {
    static set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Storage set error:', error);
            return false;
        }
    }
    
    static get(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : defaultValue;
        } catch (error) {
            console.error('Storage get error:', error);
            return defaultValue;
        }
    }
    
    static remove(key) {
        localStorage.removeItem(key);
    }
    
    static clear() {
        localStorage.clear();
    }
    
    static getAll() {
        const items = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            try {
                items[key] = JSON.parse(localStorage.getItem(key));
            } catch {
                items[key] = localStorage.getItem(key);
            }
        }
        return items;
    }
}

// ==================== NETWORK UTILITIES ====================
class Network {
    static async checkBackendHealth() {
        try {
            console.log('🩺 Checking backend health...');
            const response = await fetch(`${CONFIG.BACKEND_URL}/health`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            
            const data = await response.json();
            console.log('✅ Backend health:', data.status);
            return {
                online: response.ok,
                status: response.status,
                data: data
            };
        } catch (error) {
            console.error('❌ Backend health check failed:', error);
            return {
                online: false,
                status: 0,
                error: error.message
            };
        }
    }
    
    static isOnline() {
        return navigator.onLine;
    }
    
    static async checkConnection() {
        const online = this.isOnline();
        const backendHealth = await this.checkBackendHealth();
        
        return {
            deviceOnline: online,
            backendOnline: backendHealth.online,
            backendStatus: backendHealth.status,
            backendData: backendHealth.data,
            timestamp: new Date().toISOString()
        };
    }
}

// ==================== UI UTILITIES ====================
class UI {
    static disableForm(formId) {
        const form = document.getElementById(formId);
        if (form) {
            const inputs = form.querySelectorAll('input, button, textarea, select');
            inputs.forEach(input => input.disabled = true);
        }
    }
    
    static enableForm(formId) {
        const form = document.getElementById(formId);
        if (form) {
            const inputs = form.querySelectorAll('input, button, textarea, select');
            inputs.forEach(input => input.disabled = false);
        }
    }
    
    static resetForm(formId) {
        const form = document.getElementById(formId);
        if (form) {
            form.reset();
        }
    }
    
    static showElement(id) {
        const element = document.getElementById(id);
        if (element) element.style.display = 'block';
    }
    
    static hideElement(id) {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
    }
    
    static addClass(id, className) {
        const element = document.getElementById(id);
        if (element) element.classList.add(className);
    }
    
    static removeClass(id, className) {
        const element = document.getElementById(id);
        if (element) element.classList.remove(className);
    }
    
    static setText(id, text) {
        const element = document.getElementById(id);
        if (element) element.textContent = text;
    }
    
    static setHTML(id, html) {
        const element = document.getElementById(id);
        if (element) element.innerHTML = html;
    }
    
    static scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    static scrollToElement(id) {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
}

// ==================== INITIALIZATION ====================
class AppInitializer {
    static async initialize() {
        console.log(`🚀 ${CONFIG.APP_NAME} v${CONFIG.APP_VERSION} Initializing...`);
        
        // Add meta tags if not present
        this.addMetaTags();
        
        // Check network status
        const connection = await Network.checkConnection();
        console.log('📡 Connection Status:', connection);
        
        if (!connection.deviceOnline) {
            Toast.show('You are offline. Some features may not work.', 'warning');
        }
        
        if (!connection.backendOnline) {
            Toast.show('Backend service is unavailable. Please try again later.', 'error');
        }
        
        // Initialize socket if user is logged in
        if (Auth.getUser() && Auth.getToken()) {
            SocketManager.connect();
        }
        
        // Add online/offline event listeners
        window.addEventListener('online', () => {
            Toast.show('You are back online!', 'success');
        });
        
        window.addEventListener('offline', () => {
            Toast.show('You are offline. Some features may not work.', 'warning');
        });
        
        console.log('✅ App initialization complete');
    }
    
    static addMetaTags() {
        // Add viewport meta tag if not present
        if (!document.querySelector('meta[name="viewport"]')) {
            const viewport = document.createElement('meta');
            viewport.name = 'viewport';
            viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
            document.head.appendChild(viewport);
        }
        
        // Add charset if not present
        if (!document.querySelector('meta[charset]')) {
            const charset = document.createElement('meta');
            charset.setAttribute('charset', 'UTF-8');
            document.head.appendChild(charset);
        }
    }
}

// ==================== ERROR HANDLER ====================
class ErrorHandler {
    static handle(error, context = '') {
        console.error(`💥 Error in ${context}:`, error);
        
        let userMessage = 'An unexpected error occurred. Please try again.';
        
        if (error.message.includes('Network Error') || error.message.includes('Failed to fetch')) {
            userMessage = 'Network error. Please check your internet connection.';
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            userMessage = 'Session expired. Please login again.';
            Auth.logout();
        } else if (error.message.includes('404')) {
            userMessage = 'Requested resource not found.';
        } else if (error.message.includes('500')) {
            userMessage = 'Server error. Please try again later or contact support.';
        } else if (error.message.includes('timeout')) {
            userMessage = 'Request timeout. Please try again.';
        } else if (error.message) {
            userMessage = error.message;
        }
        
        Toast.show(userMessage, 'error');
        
        // Return error object for further handling
        return {
            success: false,
            message: userMessage,
            error: error.message,
            context
        };
    }
    
    static async safeAsync(callback, context = '') {
        try {
            return await callback();
        } catch (error) {
            return this.handle(error, context);
        }
    }
}

// ==================== EXPORT TO WINDOW ====================
window.CONFIG = CONFIG;
window.Toast = Toast;
window.API = API;
window.Auth = Auth;
window.Loading = Loading;
window.SocketManager = SocketManager;
window.FormatUtils = FormatUtils;
window.Validation = Validation;
window.Storage = Storage;
window.Network = Network;
window.UI = UI;
window.AppInitializer = AppInitializer;
window.ErrorHandler = ErrorHandler;

// Auto-initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        AppInitializer.initialize();
    });
} else {
    AppInitializer.initialize();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CONFIG,
        Toast,
        API,
        Auth,
        Loading,
        SocketManager,
        FormatUtils,
        Validation,
        Storage,
        Network,
        UI,
        AppInitializer,
        ErrorHandler
    };
}
// utils.js - Shared utilities for all pages

// Toast notification system
class Toast {
    static show(message, type = 'info') {
        const container = document.createElement('div');
        container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        container.style.zIndex = '9999';
        
        const toastId = 'toast-' + Date.now();
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'} border-0`;
        toast.id = toastId;
        toast.setAttribute('role', 'alert');
        
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        container.appendChild(toast);
        document.body.appendChild(container);
        
        const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
        bsToast.show();
        
        toast.addEventListener('hidden.bs.toast', function() {
            container.remove();
        });
    }
}

// API helper
class API {
    static async get(endpoint, token = null) {
        const headers = { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        try {
            const response = await fetch(`${CONFIG.BACKEND_URL}${endpoint}`, { 
                headers,
                credentials: 'include'
            });
            
            if (response.status === 401) {
                Toast.show('Session expired. Please login again.', 'error');
                localStorage.clear();
                setTimeout(() => {
                    window.location.href = '/auth/index.html';
                }, 1500);
                throw new Error('Unauthorized');
            }
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`GET ${endpoint} failed:`, error);
            throw error;
        }
    }
    
    static async post(endpoint, data, token = null) {
        const headers = { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        try {
            const response = await fetch(`${CONFIG.BACKEND_URL}${endpoint}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data),
                credentials: 'include'
            });
            
            if (response.status === 401) {
                Toast.show('Session expired. Please login again.', 'error');
                localStorage.clear();
                setTimeout(() => {
                    window.location.href = '/auth/index.html';
                }, 1500);
                throw new Error('Unauthorized');
            }
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`POST ${endpoint} failed:`, error);
            throw error;
        }
    }
    
    static async put(endpoint, data, token = null) {
        const headers = { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        try {
            const response = await fetch(`${CONFIG.BACKEND_URL}${endpoint}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(data),
                credentials: 'include'
            });
            
            if (response.status === 401) {
                Toast.show('Session expired. Please login again.', 'error');
                localStorage.clear();
                setTimeout(() => {
                    window.location.href = '/auth/index.html';
                }, 1500);
                throw new Error('Unauthorized');
            }
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`PUT ${endpoint} failed:`, error);
            throw error;
        }
    }
    
    static async delete(endpoint, token = null) {
        const headers = { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        try {
            const response = await fetch(`${CONFIG.BACKEND_URL}${endpoint}`, {
                method: 'DELETE',
                headers,
                credentials: 'include'
            });
            
            if (response.status === 401) {
                Toast.show('Session expired. Please login again.', 'error');
                localStorage.clear();
                setTimeout(() => {
                    window.location.href = '/auth/index.html';
                }, 1500);
                throw new Error('Unauthorized');
            }
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`DELETE ${endpoint} failed:`, error);
            throw error;
        }
    }
}

// Authentication helper
class Auth {
    static check(requiredRole = null) {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        
        if (!token || !user) {
            window.location.href = '/auth/index.html';
            return false;
        }
        
        if (requiredRole && user.role !== requiredRole) {
            Toast.show(`Access denied. Required role: ${requiredRole}`, 'error');
            setTimeout(() => {
                window.location.href = '/auth/index.html';
            }, 2000);
            return false;
        }
        
        return true;
    }
    
    static async verify() {
        const token = localStorage.getItem('token');
        if (!token) return false;
        
        try {
            await API.get(CONFIG.API_ENDPOINTS.VERIFY, token);
            return true;
        } catch (error) {
            return false;
        }
    }
    
    static getUser() {
        return JSON.parse(localStorage.getItem('user') || 'null');
    }
    
    static logout() {
        localStorage.clear();
        window.location.href = '/auth/index.html';
    }
}

// Loading overlay
class Loading {
    static show(message = 'Loading...') {
        let overlay = document.getElementById('global-loading-overlay');
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'global-loading-overlay';
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="text-center">
                    <div class="spinner-border text-light" style="width: 3rem; height: 3rem;" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-3" id="loading-text">${message}</p>
                </div>
            `;
            document.body.appendChild(overlay);
            
            // Add styles
            const style = document.createElement('style');
            style.textContent = `
                .loading-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    z-index: 9999;
                    backdrop-filter: blur(5px);
                }
            `;
            document.head.appendChild(style);
        }
        
        overlay.style.display = 'flex';
        document.getElementById('loading-text').textContent = message;
    }
    
    static hide() {
        const overlay = document.getElementById('global-loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
}

// Socket.io helper
class SocketManager {
    static socket = null;
    
    static connect() {
        if (!this.socket || !this.socket.connected) {
            this.socket = io(CONFIG.BACKEND_URL, CONFIG.SOCKET_CONFIG);
            
            this.socket.on('connect', () => {
                console.log('Socket connected');
                const user = Auth.getUser();
                if (user) {
                    this.socket.emit('register', {
                        userId: user._id,
                        role: user.role
                    });
                }
            });
            
            this.socket.on('disconnect', () => {
                console.log('Socket disconnected');
            });
            
            this.socket.on('connect_error', (error) => {
                console.error('Socket connection error:', error);
            });
        }
        
        return this.socket;
    }
    
    static disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
}

// Export to window
window.Toast = Toast;
window.API = API;
window.Auth = Auth;
window.Loading = Loading;
window.SocketManager = SocketManager;
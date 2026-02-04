// auth.js - Authentication utilities

// Email validation
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Phone validation
function isValidPhone(phone) {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10;
}

// Password validation
function isValidPassword(password) {
    return password.length >= 6;
}

// Format phone number
function formatPhoneNumber(phone) {
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
        return '(' + match[1] + ') ' + match[2] + '-' + match[3];
    }
    return phone;
}

// Get user role display name
function getRoleDisplayName(role) {
    switch(role) {
        case 'admin': return 'Administrator';
        case 'chef': return 'Chef';
        case 'customer': return 'Customer';
        default: return 'User';
    }
}

// Check if user can access feature
function canAccess(feature, userRole) {
    const permissions = {
        'view-dashboard': ['admin', 'chef', 'customer'],
        'manage-menu': ['admin', 'chef'],
        'manage-tables': ['admin'],
        'manage-staff': ['admin'],
        'view-analytics': ['admin'],
        'place-orders': ['customer', 'chef'],
        'accept-orders': ['chef'],
        'manage-service-requests': ['chef']
    };
    
    return permissions[feature]?.includes(userRole) || false;
}

// Get user initials
function getUserInitials(firstName, lastName) {
    return (firstName?.[0] || '') + (lastName?.[0] || '');
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Format time
function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Calculate time ago
function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) {
        return interval + ' year' + (interval === 1 ? '' : 's') + ' ago';
    }
    
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) {
        return interval + ' month' + (interval === 1 ? '' : 's') + ' ago';
    }
    
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) {
        return interval + ' day' + (interval === 1 ? '' : 's') + ' ago';
    }
    
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) {
        return interval + ' hour' + (interval === 1 ? '' : 's') + ' ago';
    }
    
    interval = Math.floor(seconds / 60);
    if (interval >= 1) {
        return interval + ' minute' + (interval === 1 ? '' : 's') + ' ago';
    }
    
    return Math.floor(seconds) + ' second' + (seconds === 1 ? '' : 's') + ' ago';
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Export to window
window.AuthUtils = {
    isValidEmail,
    isValidPhone,
    isValidPassword,
    formatPhoneNumber,
    getRoleDisplayName,
    canAccess,
    getUserInitials,
    formatCurrency,
    formatDate,
    formatTime,
    timeAgo,
    debounce,
    throttle
};
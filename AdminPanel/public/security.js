// Security utilities for the admin panel: XSS protection, input validation, and secure API calls

// Escape HTML entities to prevent XSS attacks
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Remove dangerous tags and attributes from user input
function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    
    // Remove any script tags and dangerous attributes
    let sanitized = input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/on\w+\s*=\s*[^\s>]*/gi, '');
    
    return sanitized.trim();
}

// Input validation helpers

// Check if a string is a valid Discord User ID
function isValidUserId(userId) {
    if (typeof userId !== 'string') return false;
    userId = userId.trim();
    return /^\d{17,19}$/.test(userId);
}

// Check if a string is a valid reason or message
function isValidText(text, minLength = 1, maxLength = 500) {
    if (typeof text !== 'string') return false;
    const trimmed = text.trim();
    return trimmed.length >= minLength && trimmed.length <= maxLength;
}

// Check if a value is a valid integer within a range
function isValidNumber(value, min = 0, max = Infinity) {
    const num = Number(value);
    return Number.isInteger(num) && num >= min && num <= max;
}

// Check if a string is a valid email address
function isValidEmail(email) {
    if (typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// The best secure api calls

// Make secure API request with CSRF protection
async function secureApiCall(url, options = {}) {
    // Get CSRF token if available
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    
    // Prepare request
    const requestOptions = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    };
    
    // Add CSRF token if available
    if (csrfToken) {
        requestOptions.headers['X-CSRF-Token'] = csrfToken;
    }
    
    try {
        const response = await fetch(url, requestOptions);
        
        // Check for authentication errors
        if (response.status === 401) {
            console.warn('Unauthorized access - redirecting to login');
            window.location.href = '/login';
            return null;
        }
        
        return response;
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}


async function securePost(url, data) {
    return secureApiCall(url, {
        method: 'POST',
        body: JSON.stringify(data)
    });
}


async function secureDelete(url) {
    return secureApiCall(url, {
        method: 'DELETE'
    });
}


class RateLimiter {
    constructor(maxRequests = 10, windowMs = 60000) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.requests = [];
    }


    isAllowed() {
        const now = Date.now();
        
        // Remove old requests outside the window
        this.requests = this.requests.filter(time => now - time < this.windowMs);
        
        if (this.requests.length < this.maxRequests) {
            this.requests.push(now);
            return true;
        }
        
        return false;
    }

    getRetryAfter() {
        if (this.requests.length === 0) return 0;
        const oldestRequest = this.requests[0];
        return Math.max(0, this.windowMs - (Date.now() - oldestRequest));
    }
}

// Create rate limiters for different operations
const apiRateLimiters = {
    warn: new RateLimiter(10, 60000),
    ban: new RateLimiter(5, 60000),
    timeout: new RateLimiter(10, 60000),
    delete: new RateLimiter(15, 60000)
};


function checkRateLimit(operation) {
    const limiter = apiRateLimiters[operation];
    if (!limiter) return { allowed: true, retryAfter: 0 };
    
    if (limiter.isAllowed()) {
        return { allowed: true, retryAfter: 0 };
    }
    
    return { allowed: false, retryAfter: limiter.getRetryAfter() };
}

// form validation


function validateModerationForm(userId, reason) {
    if (!userId || !reason) {
        return { valid: false, error: 'All fields are required' };
    }
    
    if (!isValidUserId(userId)) {
        return { valid: false, error: 'Invalid User ID format (must be 17-19 digits)' };
    }
    
    if (!isValidText(reason, 1, 500)) {
        return { valid: false, error: 'Reason must be 1-500 characters' };
    }
    
    return { valid: true };
}


function validateWarnForm(userId, reason) {
    return validateModerationForm(userId, reason);
}


function validateBanForm(userId, reason) {
    return validateModerationForm(userId, reason);
}


function validateTimeoutForm(userId, duration, reason) {
    if (!userId || !duration || !reason) {
        return { valid: false, error: 'All fields are required' };
    }
    
    if (!isValidUserId(userId)) {
        return { valid: false, error: 'Invalid User ID format' };
    }
    
    if (!isValidNumber(duration, 1, 2419200)) {
        return { valid: false, error: 'Duration must be between 1 second and 28 days' };
    }
    
    if (!isValidText(reason, 1, 500)) {
        return { valid: false, error: 'Reason must be 1-500 characters' };
    }
    
    return { valid: true };
}

// Ui helper


function showError(message, duration = 5000) {
    const sanitized = escapeHtml(message);
    
    // Try to use existing alert if available
    const alertElement = document.getElementById('errorAlert');
    if (alertElement) {
        alertElement.textContent = sanitized;
        alertElement.style.display = 'block';
        
        if (duration > 0) {
            setTimeout(() => {
                alertElement.style.display = 'none';
            }, duration);
        }
        return;
    }
    
    // Fallback to console
    console.error(sanitized);
}


function showSuccess(message, duration = 5000) {
    const sanitized = escapeHtml(message);
    
    // Try to use existing alert if available
    const alertElement = document.getElementById('successAlert');
    if (alertElement) {
        alertElement.textContent = sanitized;
        alertElement.style.display = 'block';
        
        if (duration > 0) {
            setTimeout(() => {
                alertElement.style.display = 'none';
            }, duration);
        }
        return;
    }
    
    // Fallback to console
    // console.log removed for production
}


function showInfo(message) {
    // console.info removed for production
}


function formatNumber(num) {
    if (typeof num !== 'number') return '0';
    return num.toLocaleString();
}


function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}


function formatDuration(seconds) {
    if (!seconds || seconds < 0) return '0s';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0) parts.push(`${secs}s`);
    
    return parts.length > 0 ? parts.join(' ') : '0s';
}


function formatDate(date) {
    try {
        return new Date(date).toLocaleString();
    } catch {
        return 'Invalid date';
    }
}


// Make functions globally available if needed
if (typeof window !== 'undefined') {
    window.SecurityUtils = {
        escapeHtml,
        sanitizeInput,
        isValidUserId,
        isValidText,
        isValidNumber,
        isValidEmail,
        secureApiCall,
        securePost,
        secureDelete,
        validateModerationForm,
        validateWarnForm,
        validateBanForm,
        validateTimeoutForm,
        showError,
        showSuccess,
        showInfo,
        formatNumber,
        formatBytes,
        formatDuration,
        formatDate,
        RateLimiter,
        checkRateLimit
    };
}

// Tab switching logic for the admin panel


function switchTab(e, tabName) {
    e.preventDefault();
    
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from buttons
    document.querySelectorAll('.tab').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    if (e.target && e.target.classList) {
        e.target.classList.add('active');
    }
}

// Attach event listeners to tabs when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            if (tabName) {
                switchTab(e, tabName);
            }
        });
    });
});
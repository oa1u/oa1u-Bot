(function () {
    const ui = {
        showMessage(element, message, type) {
            if (!element) return;
            element.textContent = message;
            element.classList.remove('hidden');
            if (type === 'error') {
                element.classList.add('error');
                element.classList.remove('success');
            } else if (type === 'success') {
                element.classList.add('success');
                element.classList.remove('error');
            }
        },
        hideMessage(element) {
            if (!element) return;
            element.classList.add('hidden');
        },
        setLoading(element, show) {
            if (!element) return;
            if (show) {
                element.classList.add('show');
            } else {
                element.classList.remove('show');
            }
        },
        setText(id, value) {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        }
    };

    async function requestJson(url, options = {}) {
        const fetchOptions = { ...options, credentials: 'include' };
        const response = await fetch(url, fetchOptions);
        const data = await response.json().catch(() => null);
        return { response, data };
    }

    async function getCsrfToken() {
        // Always get the latest CSRF token from the cookie to avoid using an old one
        const match = document.cookie.match(/csrfToken=([^;]+)/);
        if (match) {
            window._cachedCsrfToken = match[1];
            return match[1];
        }
        // If not found, fetch from the API once per page load
        const res = await fetch('/api/csrf', { credentials: 'include' });
        const data = await res.json().catch(() => null);
        if (data?.csrfToken) {
            window._cachedCsrfToken = data.csrfToken;
            return data.csrfToken;
        }
        return '';
    }

    async function postJson(url, body, options = {}) {
        const csrfToken = await getCsrfToken();
        return requestJson(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken,
                ...(options.headers || {})
            },
            body: JSON.stringify(body),
            ...options
        });
    }

    async function getJson(url, options = {}) {
        return requestJson(url, { method: 'GET', ...options });
    }

    async function getAccountInfo() {
        const { response, data } = await requestJson('/api/account/info');
        if (!response || !response.ok) return {};
        if (typeof data === 'object' && data !== null) {
            // If backend returns {success: true, ...}, remove only-success objects
            if (data.username && data.role) return data;
            return {};
        }
        return {};
    }

    function applyRoleVisibility(data, options = {}) {
        const role = (data?.role || 'user').toLowerCase();
        const {
            moderatorLinkId = 'moderatorLink',
            adminLinkId = 'adminLink',
            ownerLinkId = 'ownerLink',
            ownerNavLinkId = 'ownerNavLink'
        } = options;

        const moderatorLink = moderatorLinkId ? document.getElementById(moderatorLinkId) : null;
        const adminLink = adminLinkId ? document.getElementById(adminLinkId) : null;
        const ownerLink = ownerLinkId ? document.getElementById(ownerLinkId) : null;
        const ownerNavLink = ownerNavLinkId ? document.getElementById(ownerNavLinkId) : null;

        if (moderatorLink) {
            moderatorLink.style.display = (role === 'moderator' || role === 'admin' || role === 'owner') ? 'block' : 'none';
        }
        if (adminLink) {
            adminLink.style.display = (role === 'admin' || role === 'owner') ? 'block' : 'none';
        }
        if (ownerLink) {
            ownerLink.style.display = (role === 'owner') ? 'block' : 'none';
        }
        if (ownerNavLink) {
            ownerNavLink.style.display = (role === 'owner') ? 'block' : 'none';
        }
    }

    async function logout() {
        try {
            await fetch('/api/logout', { method: 'POST' });
        } finally {
            window.location.href = '/login';
        }
    }

    window.AdminPanel = {
        ui,
        api: {
            requestJson,
            postJson,
            getJson,
            getAccountInfo,
            applyRoleVisibility,
            logout
        }
    };

    window.logout = logout;
})();
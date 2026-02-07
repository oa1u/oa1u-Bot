// Handles registration page logic, including invite code validation and password strength checking

const registerBtn = document.getElementById('registerBtn');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const passwordRequirements = document.querySelector('.password-requirements');
const loading = document.getElementById('loading');
const errorMsg = document.getElementById('errorMsg');
const successMsg = document.getElementById('successMsg');
const loginLink = document.getElementById('loginLink');
const { ui, api } = window.AdminPanel || {};

// Set up event listeners for registration form
registerBtn.addEventListener('click', handleRegister);
if (loginLink) {
    loginLink.addEventListener('click', goToLogin);
}
passwordInput.addEventListener('input', validatePassword);
passwordInput.addEventListener('focus', showPasswordRequirements);
passwordInput.addEventListener('blur', hidePasswordRequirementsIfEmpty);
confirmPasswordInput.addEventListener('input', validateForm);
document.getElementById('username').addEventListener('input', validateForm);
document.getElementById('inviteCode').addEventListener('input', validateForm);

function showPasswordRequirements() {
    if (passwordRequirements) {
        passwordRequirements.classList.add('show');
    }
}

function hidePasswordRequirementsIfEmpty() {
    if (passwordRequirements && !passwordInput.value.trim()) {
        passwordRequirements.classList.remove('show');
    }
}

function validatePassword() {
    if (passwordRequirements) {
        passwordRequirements.classList.add('show');
    }
    const password = passwordInput.value;
    
    const requirements = {
        'req-length': password.length >= 8,
        'req-upper': /[A-Z]/.test(password),
        'req-lower': /[a-z]/.test(password),
        'req-number': /\d/.test(password),
        'req-special': /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };

    for (const [id, met] of Object.entries(requirements)) {
        const elem = document.getElementById(id);
        if (met) {
            elem.classList.add('met');
        } else {
            elem.classList.remove('met');
        }
    }

    validateForm();
}

function validateForm() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const inviteCode = document.getElementById('inviteCode').value.trim();

    const passwordValid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/.test(password);
    const usernameValid = /^[a-zA-Z0-9_]{3,30}$/.test(username);
    const passwordMatch = password === confirmPassword && password.length > 0;
    const inviteCodeValid = inviteCode.length > 0;

    registerBtn.disabled = !(passwordValid && usernameValid && passwordMatch && inviteCodeValid);
}

async function handleRegister(e) {
    e.preventDefault();
    // console.log removed for production

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const inviteCode = document.getElementById('inviteCode').value.trim();

    if (!username || !password || !confirmPassword || !inviteCode) {
        ui?.showMessage(errorMsg, 'Please fill in all fields', 'error');
        return;
    }

    if (password !== confirmPassword) {
        ui?.showMessage(errorMsg, 'Passwords do not match', 'error');
        return;
    }

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
        ui?.showMessage(errorMsg, 'Username must be 3-30 characters (letters, numbers, and underscores only)', 'error');
        return;
    }

    // Check password requirements
    if (password.length < 8) {
        ui?.showMessage(errorMsg, 'Password must be at least 8 characters long', 'error');
        return;
    }

    if (!/[A-Z]/.test(password)) {
        ui?.showMessage(errorMsg, 'Password must contain at least one uppercase letter', 'error');
        return;
    }

    if (!/[a-z]/.test(password)) {
        ui?.showMessage(errorMsg, 'Password must contain at least one lowercase letter', 'error');
        return;
    }

    if (!/\d/.test(password)) {
        ui?.showMessage(errorMsg, 'Password must contain at least one number', 'error');
        return;
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        ui?.showMessage(errorMsg, 'Password must contain at least one special character (!@#$%^&* etc.)', 'error');
        return;
    }

    registerBtn.disabled = true;
    ui?.setLoading(loading, true);
    ui?.hideMessage(errorMsg);
    ui?.hideMessage(successMsg);

    try {
        // console.log removed for production
        const { response, data } = await api.postJson('/api/register', { username, password, inviteCode });

        if (response.ok && data?.success) {
            // console.log removed for production
            ui?.showMessage(successMsg, 'Account created! Redirecting to login...', 'success');
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        } else {
            // console.log removed for production
            ui?.showMessage(errorMsg, data?.error || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('🔴 Registration error:', error);
        ui?.showMessage(errorMsg, 'Connection error. Please try again.', 'error');
    } finally {
        registerBtn.disabled = false;
        ui?.setLoading(loading, false);
    }
}

function goToLogin(e) {
    if (e) e.preventDefault();
    window.location.href = '/login';
}

validateForm();
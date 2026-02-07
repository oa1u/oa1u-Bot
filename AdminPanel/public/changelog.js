// changelog.js - Handles user info and navbar for changelog.html
window.addEventListener('DOMContentLoaded', async () => {
    if (window.api && window.api.getAccountInfo) {
        try {
            const info = await window.api.getAccountInfo();
            if (info && info.username && info.role) {
                document.getElementById('userDisplay').textContent = info.username;
                document.getElementById('dropdownUsername').textContent = info.username;
                document.getElementById('roleBadge').textContent = info.role.toUpperCase();
                document.getElementById('dropdownRole').textContent = info.role.toUpperCase();
            }
        } catch (e) {
            // fallback: redirect to login or show guest
        }
    }
});

function toggleUserDropdown() {
    const menu = document.getElementById('userDropdownMenu');
    menu.classList.toggle('show');
}

function logout() {
    if (window.api && window.api.logout) {
        window.api.logout();
    } else {
        window.location.href = '/login';
    }
}

document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('userDropdownMenu');
    const trigger = document.querySelector('.user-dropdown-trigger');
    if (dropdown && !dropdown.contains(event.target) && !trigger.contains(event.target)) {
        dropdown.classList.remove('show');
    }
});
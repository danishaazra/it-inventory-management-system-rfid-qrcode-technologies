// Shared initialization script for admin pages
// Handles sidebar toggle, user info, logout, etc.

// Initialize sidebar toggle
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  const appShell = document.querySelector('.app-shell');
  
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      if (appShell) {
        if (sidebar.classList.contains('collapsed')) {
          appShell.classList.add('has-collapsed-sidebar');
        } else {
          appShell.classList.remove('has-collapsed-sidebar');
        }
      }
    });
  }
}

// Initialize user info (if elements exist)
function initUserInfo() {
  const userNameEl = document.getElementById('user-name');
  if (userNameEl) {
    // Try to get user from localStorage or default
    const userName = localStorage.getItem('userName') || 'User';
    userNameEl.textContent = userName;
  }
  
  const userAvatarEl = document.getElementById('user-avatar');
  if (userAvatarEl) {
    const userName = localStorage.getItem('userName') || 'U';
    userAvatarEl.textContent = userName.charAt(0).toUpperCase();
  }
}

// Initialize logout button
function initLogout() {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('userName');
        // Redirect to login page or home
        window.location.href = '/';
      }
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    initUserInfo();
    initLogout();
  });
} else {
  initSidebar();
  initUserInfo();
  initLogout();
}


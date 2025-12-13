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
    // Try to get user from sessionStorage or default
    const userName = sessionStorage.getItem('userName') || 'User';
    userNameEl.textContent = userName;
  }
  
  const userAvatarEl = document.getElementById('user-avatar');
  if (userAvatarEl) {
    const userName = sessionStorage.getItem('userName') || 'U';
    userAvatarEl.textContent = userName.charAt(0).toUpperCase();
  }
}

// Initialize logout button
function initLogout() {
  const logoutBtn = document.getElementById('logout-btn');
  if (!logoutBtn) {
    console.warn('Logout button not found!');
    return;
  }
  
  console.log('Logout button found and handler attached');
  
  logoutBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Logout button clicked!');
    
    if (confirm('Are you sure you want to logout?')) {
      // Clear session storage
      sessionStorage.clear();
      
      // Always redirect to login/index.html with project folder
      const projectName = 'it-inventory-management-system-rfid-qrcode-technologies';
      const origin = window.location.origin;
      const redirectUrl = origin + '/' + projectName + '/login/index.html';
      
      console.log('=== LOGOUT DEBUG ===');
      console.log('Current URL:', window.location.href);
      console.log('Current pathname:', window.location.pathname);
      console.log('Origin:', origin);
      console.log('Project name:', projectName);
      console.log('Redirecting to:', redirectUrl);
      console.log('===================');
      
      // Force redirect
      window.location.href = redirectUrl;
    }
    
    return false;
  });
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


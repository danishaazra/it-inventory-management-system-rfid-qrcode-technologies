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
      
      // Calculate relative path to login/index.html based on current page location
      const currentPath = window.location.pathname;
      
      // Remove leading slash and split into parts
      const pathParts = currentPath.split('/').filter(part => part && part !== '');
      
      // Remove the filename (last part if it contains .html)
      const directories = pathParts.filter(part => !part.includes('.html'));
      
      // Calculate how many levels up we need to go
      // Examples:
      // /admin/asset/asset.html -> directories = ['admin', 'asset'] -> go up 2 levels -> ../../login/index.html
      // /dashboard/dashboard_admin.html -> directories = ['dashboard'] -> go up 1 level -> ../login/index.html
      // /login/login.html -> directories = ['login'] -> go up 1 level -> ../login/index.html (but we're already there)
      
      let redirectPath;
      if (directories.length === 0) {
        // We're at root
        redirectPath = 'login/index.html';
      } else {
        // Go up N levels, then to login/index.html
        redirectPath = '../'.repeat(directories.length) + 'login/index.html';
      }
      
      console.log('=== LOGOUT DEBUG ===');
      console.log('Current pathname:', currentPath);
      console.log('Directory levels:', directories.length);
      console.log('Redirecting to:', redirectPath);
      console.log('===================');
      
      // Use relative path for redirect
      window.location.href = redirectPath;
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


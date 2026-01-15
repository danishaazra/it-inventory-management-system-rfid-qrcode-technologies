// Authentication check for admin pages
// This ensures only admin users can access admin routes

(function() {
  'use strict';

  // Get current page path
  const currentPath = window.location.pathname;
  const isAdminPage = currentPath.includes('/admin/');

  // Check if user is logged in
  const userName = sessionStorage.getItem('userName');
  const userEmail = sessionStorage.getItem('userEmail');
  const userRole = sessionStorage.getItem('userRole');

  // If no user data, redirect to login
  if (!userName || !userEmail || !userRole) {
    console.warn('User not logged in, redirecting to login...');
    // Calculate relative path to login/index.html
    const pathParts = currentPath.split('/').filter(part => part && part !== '');
    const directories = pathParts.filter(part => !part.includes('.html'));
    let redirectPath;
    if (directories.length === 0) {
      redirectPath = 'login/index.html';
    } else {
      redirectPath = '../'.repeat(directories.length) + 'login/index.html';
    }
    window.location.href = redirectPath;
    return;
  }

  // Check if user is admin - only admins can access admin pages
  if (isAdminPage && userRole !== 'admin') {
    console.warn(`User role '${userRole}' cannot access admin pages, redirecting...`);
    // Redirect non-admin users to their appropriate dashboard
    if (userRole === 'staff') {
      window.location.href = '../../dashboard/dashboard_staff.html';
    } else {
      // Calculate relative path to login/index.html
      const pathParts = currentPath.split('/').filter(part => part && part !== '');
      const directories = pathParts.filter(part => !part.includes('.html'));
      let redirectPath;
      if (directories.length === 0) {
        redirectPath = 'login/index.html';
      } else {
        redirectPath = '../'.repeat(directories.length) + 'login/index.html';
      }
      window.location.href = redirectPath;
    }
    return;
  }

  console.log(`Admin user authenticated: ${userName} (${userRole})`);
})();

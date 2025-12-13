// Authentication check for dashboard pages
// This ensures users are logged in and have the correct role

(function() {
  'use strict';

  // Get current page path
  const currentPath = window.location.pathname;
  const isStaffDashboard = currentPath.includes('dashboard_staff.html');
  const isAdminDashboard = currentPath.includes('dashboard_admin.html');

  // Check if user is logged in
  const userName = sessionStorage.getItem('userName');
  const userEmail = sessionStorage.getItem('userEmail');
  const userRole = sessionStorage.getItem('userRole');

  // If no user data, redirect to login
  if (!userName || !userEmail || !userRole) {
    console.warn('User not logged in, redirecting to role selection...');
    window.location.href = '../login/index.html';
    return;
  }

  // Check role-based access
  if (isStaffDashboard && userRole !== 'staff') {
    console.warn(`User role '${userRole}' cannot access staff dashboard, redirecting...`);
    // Redirect staff users trying to access admin dashboard to their dashboard
    if (userRole === 'admin') {
      window.location.href = 'dashboard_admin.html';
    } else {
      window.location.href = '../login/index.html';
    }
    return;
  }

  if (isAdminDashboard && userRole !== 'admin') {
    console.warn(`User role '${userRole}' cannot access admin dashboard, redirecting...`);
    // Redirect non-admin users trying to access admin dashboard to their dashboard
    if (userRole === 'staff') {
      window.location.href = 'dashboard_staff.html';
    } else {
      window.location.href = '../login/index.html';
    }
    return;
  }

  console.log(`User authenticated: ${userName} (${userRole})`);
})();


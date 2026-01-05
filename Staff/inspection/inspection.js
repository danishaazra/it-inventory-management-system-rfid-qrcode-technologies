// Staff Inspection JavaScript - Load only assigned maintenance tasks

let maintenanceTableBody;

// Get logged-in staff information from sessionStorage
function getCurrentStaff() {
  const userId = sessionStorage.getItem('userId');
  const userEmail = sessionStorage.getItem('userEmail');
  const userName = sessionStorage.getItem('userName');
  
  return {
    id: userId,
    email: userEmail,
    name: userName
  };
}

// Load and display assigned maintenance tasks
async function loadAssignedMaintenance() {
  const staff = getCurrentStaff();
  
  if (!staff.id && !staff.email) {
    maintenanceTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #dc2626;">Please log in to view assigned tasks.</td></tr>';
    return;
  }
  
  try {
    // Build URL with staffId or staffEmail
    let url = '/api/maintenance/assigned?';
    if (staff.id) {
      url += 'staffId=' + encodeURIComponent(staff.id);
    } else if (staff.email) {
      url += 'staffEmail=' + encodeURIComponent(staff.email);
    }
    
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }
    
    const data = await resp.json();
    
    if (!data.ok) {
      throw new Error(data.error || 'Failed to load assigned tasks');
    }
    
    displayMaintenance(data.maintenance || []);
    
  } catch (error) {
    console.error('Error loading assigned maintenance:', error);
    maintenanceTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #dc2626;">Error loading tasks: ${error.message}</td></tr>`;
  }
}

// Display maintenance items in the table
function displayMaintenance(maintenanceItems) {
  if (!maintenanceTableBody) {
    console.error('maintenance-table-body not found');
    return;
  }
  
  maintenanceTableBody.innerHTML = '';
  
  if (maintenanceItems.length === 0) {
    maintenanceTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #888;">No maintenance tasks assigned to you yet.</td></tr>';
    return;
  }
  
  maintenanceItems.forEach(item => {
    const row = document.createElement('tr');
    const frequency = item.frequency || '';
    const frequencyClass = frequency.toLowerCase();
    
    row.innerHTML = `
      <td>${escapeHtml(item.branch || '-')}</td>
      <td>${escapeHtml(item.location || '-')}</td>
      <td>${escapeHtml(item.itemName || '-')}</td>
      <td><span class="frequency-badge frequency-${frequencyClass}">${frequency || '-'}</span></td>
      <td><a href="inspectiontask.html?maintenanceId=${item._id || ''}" class="inspection-tasks-link">View Tasks</a></td>
    `;
    maintenanceTableBody.appendChild(row);
  });
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize page
function init() {
  maintenanceTableBody = document.getElementById('maintenance-table-body');
  
  if (!maintenanceTableBody) {
    console.error('maintenance-table-body element not found!');
    return;
  }
  
  // Load assigned maintenance tasks
  loadAssignedMaintenance();
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


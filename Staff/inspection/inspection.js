// Staff Maintenance Checklist Page
// Shows only assigned maintenance items with Branch, Location, Item Name, and Staff In Charge

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

// DOM Elements
const maintenanceItemsTbody = document.getElementById('maintenance-items-tbody');
const filterYear = document.getElementById('filter-year');
const filterFrequency = document.getElementById('filter-frequency');
const filterSearch = document.getElementById('filter-search');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const pageInfo = document.getElementById('page-info');

// State
let allMaintenanceItems = [];
let filteredItems = [];
let currentPage = 1;
const itemsPerPage = 10;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeYearFilter();
  initializeEventListeners();
  loadMaintenanceItems();
});

// Initialize year filter with current year and previous/next years
function initializeYearFilter() {
  const currentYear = new Date().getFullYear();
  for (let i = currentYear - 2; i <= currentYear + 2; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = i;
    if (i === currentYear) {
      option.selected = true;
    }
    filterYear.appendChild(option);
  }
}

// Initialize event listeners
function initializeEventListeners() {
  filterYear.addEventListener('change', () => {
    currentPage = 1;
    applyFilters();
  });
  filterFrequency.addEventListener('change', () => {
    currentPage = 1;
    applyFilters();
  });
  filterSearch.addEventListener('input', () => {
    currentPage = 1;
    applyFilters();
  });
  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderMaintenanceItems(filteredItems);
    }
  });
  nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderMaintenanceItems(filteredItems);
    }
  });

}

// Load assigned maintenance items for current staff
async function loadMaintenanceItems() {
  const staff = getCurrentStaff();
  
  if (!staff.id && !staff.email) {
    showErrorState('Please log in to view assigned tasks.');
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
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to load assigned maintenance items');
    }
    
    const data = await response.json();
    
    if (data.ok && data.maintenance && data.maintenance.length > 0) {
      allMaintenanceItems = data.maintenance;
      applyFilters();
    } else {
      allMaintenanceItems = [];
      filteredItems = [];
      showEmptyState('No maintenance tasks assigned to you yet.');
    }
  } catch (error) {
    console.error('Error loading assigned maintenance items:', error);
    allMaintenanceItems = [];
    filteredItems = [];
    showErrorState(error.message);
  }
}

// Apply filters
function applyFilters() {
  const year = filterYear.value;
  const frequency = filterFrequency.value;
  const search = filterSearch.value.toLowerCase().trim();
  
  filteredItems = allMaintenanceItems.filter(item => {
    // Year filter (not applicable for maintenance items, but kept for future use)
    // Frequency filter
    if (frequency && item.frequency !== frequency) {
      return false;
    }
    
    // Search filter
    if (search) {
      const branch = (item.branch || '').toLowerCase();
      const location = (item.location || '').toLowerCase();
      const itemName = (item.itemName || '').toLowerCase();
      const staffName = (item.assignedStaffName || '').toLowerCase();
      
      if (!branch.includes(search) && 
          !location.includes(search) && 
          !itemName.includes(search) &&
          !staffName.includes(search)) {
        return false;
      }
    }
    
    return true;
  });
  
  renderMaintenanceItems(filteredItems);
}

// Render maintenance items in table
function renderMaintenanceItems(items) {
  if (items.length === 0) {
    showEmptyState('No maintenance items match the selected filters.');
    updatePaginationControls(0);
    return;
  }

  // Calculate pagination
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, items.length);
  const pageItems = items.slice(startIndex, endIndex);

  const html = pageItems.map((item, index) => {
    const branch = item.branch || 'N/A';
    const location = item.location || 'N/A';
    const itemName = item.itemName || 'N/A';
    const frequency = item.frequency || 'N/A';
    const staffName = item.assignedStaffName || 'Not Assigned';
    const staffEmail = item.assignedStaffEmail || '';
    const staffId = item.assignedStaffId || '';
    
    // Create staff badge
    const staffBadge = staffName !== 'Not Assigned' 
      ? `<span class="staff-badge">${escapeHtml(staffName)}</span>`
      : `<span class="staff-badge empty">Not Assigned</span>`;
    
    // Create row with click handler
    return `
      <tr onclick="openChecklist('${escapeHtml(item._id)}', '${escapeHtml(branch)}', '${escapeHtml(location)}', '${escapeHtml(itemName)}', '${escapeHtml(frequency)}')">
        <td><strong>${escapeHtml(branch)}</strong></td>
        <td>${escapeHtml(location)}</td>
        <td>${escapeHtml(itemName)}</td>
        <td>${escapeHtml(frequency)}</td>
        <td>${staffBadge}</td>
        <td>
          <button class="action-btn" onclick="event.stopPropagation(); openChecklist('${escapeHtml(item._id)}', '${escapeHtml(branch)}', '${escapeHtml(location)}', '${escapeHtml(itemName)}', '${escapeHtml(frequency)}')">
            View Checklist
          </button>
        </td>
      </tr>
    `;
  }).join('');

  maintenanceItemsTbody.innerHTML = html;
  updatePaginationControls(items.length);
}

// Update pagination controls
function updatePaginationControls(totalItems) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalItems);
  
  if (totalItems === 0) {
    pageInfo.textContent = '0-0 of 0';
  } else {
    pageInfo.textContent = `${startIndex}-${endIndex} of ${totalItems}`;
  }
  
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage >= totalPages || totalPages === 0;
}

// Open checklist calendar page (staff version - goes to inspectiontask.html)
window.openChecklist = function(maintenanceId, branch, location, itemName, frequency) {
  // Navigate to staff inspection task page with parameters
  const params = new URLSearchParams({
    maintenanceId: maintenanceId,
    branch: branch,
    location: location,
    itemName: itemName,
    frequency: frequency
  });
  
  window.location.href = `inspectiontask.html?${params.toString()}`;
};

// Show empty state
function showEmptyState(message) {
  maintenanceItemsTbody.innerHTML = `
    <tr>
      <td colspan="6" class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3>No Maintenance Items</h3>
        <p>${escapeHtml(message)}</p>
      </td>
    </tr>
  `;
}

// Show error state
function showErrorState(errorMessage) {
  maintenanceItemsTbody.innerHTML = `
    <tr>
      <td colspan="6" class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>Error Loading Data</h3>
        <p>${escapeHtml(errorMessage)}</p>
      </td>
    </tr>
  `;
}

// Escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}


// Maintenance Checklist Page
// Shows all maintenance items with Branch, Location, Item Name, and Staff In Charge

// DOM Elements
const maintenanceItemsTbody = document.getElementById('maintenance-items-tbody');
const filterYear = document.getElementById('filter-year');
const filterFrequency = document.getElementById('filter-frequency');
const filterSearch = document.getElementById('filter-search');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const pageInfo = document.getElementById('page-info');

// Add Maintenance Elements
let addBtn, addForm;
let addModalOverlay, closeAddModalBtn, cancelAddBtn, frequencySelect, scheduleContainer, scheduleCalendar;

// State
let allMaintenanceItems = [];
let filteredItems = [];
let currentPage = 1;
const itemsPerPage = 10;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initAddMaintenanceElements();
  initializeYearFilter();
  initializeEventListeners();
  loadMaintenanceItems();
});

// Initialize Add Maintenance elements
function initAddMaintenanceElements() {
  addBtn = document.getElementById('add-maintenance-btn');
  addForm = document.getElementById('add-maintenance-form');
  addModalOverlay = document.getElementById('add-modal-overlay');
  closeAddModalBtn = document.getElementById('close-add-modal-btn');
  cancelAddBtn = document.getElementById('cancel-add-btn');
  frequencySelect = document.getElementById('add-frequency');
  scheduleContainer = document.getElementById('add-schedule-container');
  scheduleCalendar = document.getElementById('add-schedule-calendar');
}

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

  // Add Maintenance button handlers
  setupAddMaintenanceListeners();
}

// Load all maintenance items
async function loadMaintenanceItems() {
  try {
    const response = await fetch('/api/maintenance/list');
    if (!response.ok) {
      throw new Error('Failed to load maintenance items');
    }
    
    const data = await response.json();
    
    if (data.ok && data.maintenance && data.maintenance.length > 0) {
      allMaintenanceItems = data.maintenance;
      applyFilters();
    } else {
      allMaintenanceItems = [];
      filteredItems = [];
      showEmptyState('No maintenance items found. Please create maintenance items first.');
    }
  } catch (error) {
    console.error('Error loading maintenance items:', error);
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

// Open checklist calendar page
window.openChecklist = function(maintenanceId, branch, location, itemName, frequency) {
  // Navigate to calendar page with parameters
  const params = new URLSearchParams({
    id: maintenanceId,
    branch: branch,
    location: location,
    itemName: itemName,
    frequency: frequency
  });
  
  window.location.href = `maintenance_checklist_draft.html?${params.toString()}`;
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

// Setup Add Maintenance event listeners
function setupAddMaintenanceListeners() {
  // Add button click handler - directly open modal
  if (addBtn) {
    addBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (addModalOverlay) {
        addModalOverlay.classList.add('open');
        
        // Fetch sample maintenance and set placeholders
        const sampleMaintenance = await fetchSampleMaintenance();
        setMaintenanceFormPlaceholders(sampleMaintenance);
      }
    });
  }

  // Close modal handlers
  if (closeAddModalBtn) {
    closeAddModalBtn.addEventListener('click', closeAddModal);
  }
  if (cancelAddBtn) {
    cancelAddBtn.addEventListener('click', closeAddModal);
  }
  if (addModalOverlay) {
    addModalOverlay.addEventListener('click', (e) => {
      if (e.target === addModalOverlay) {
        closeAddModal();
      }
    });
  }

  // Frequency change handler
  if (frequencySelect) {
    frequencySelect.addEventListener('change', function() {
      const frequency = this.value;
      if (frequency && scheduleContainer && scheduleCalendar) {
        scheduleContainer.style.display = 'block';
        generateScheduleCalendar(frequency);
      } else if (scheduleContainer) {
        scheduleContainer.style.display = 'none';
        if (scheduleCalendar) scheduleCalendar.innerHTML = '';
      }
    });
  }

  // Form submit handler
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(addForm);
      
      // Collect schedule data - normalize date format to YYYY-MM-DD
      const scheduleData = {};
      if (scheduleCalendar) {
        const scheduleInputs = scheduleCalendar.querySelectorAll('[name^="schedule"]');
        console.log('Found schedule inputs:', scheduleInputs.length);
        scheduleInputs.forEach(input => {
          if (input.value) {
            // Normalize date to YYYY-MM-DD format
            let dateValue = input.value;
            if (dateValue.includes('T')) {
              dateValue = dateValue.split('T')[0];
            }
            
            const nameParts = input.name.match(/schedule\[(.*?)\](?:\[(.*?)\])?/);
            if (nameParts) {
              const key1 = nameParts[1];
              const key2 = nameParts[2];
              if (key2) {
                if (!scheduleData[key1]) scheduleData[key1] = {};
                scheduleData[key1][key2] = dateValue;
              } else {
                scheduleData[key1] = dateValue;
              }
            }
          }
        });
      }
      
      console.log('Collected schedule data (normalized):', JSON.stringify(scheduleData, null, 2));
      
      const data = Object.fromEntries(formData.entries());
      if (Object.keys(scheduleData).length > 0) {
        data.maintenanceSchedule = scheduleData;
        console.log('Schedule data added to request:', data.maintenanceSchedule);
      } else {
        console.warn('No schedule data collected - user may not have selected any dates');
      }
      
      try {
        console.log('Sending maintenance data to API:', {
          branch: data.branch,
          location: data.location,
          itemName: data.itemName,
          frequency: data.frequency,
          hasSchedule: !!data.maintenanceSchedule,
          scheduleKeys: data.maintenanceSchedule ? Object.keys(data.maintenanceSchedule) : []
        });
        
        const resp = await fetch('/api/maintenance/add', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(data)
        });
        
        const result = await resp.json();
        console.log('API response:', result);
        
        if (!resp.ok || !result.ok) {
          console.error('Add maintenance error:', result);
          if (resp.status === 409 || result.error === 'Data already exists') {
            return alert(`Data already exists!\n\n${result.message || 'A maintenance item with these details already exists in the database.'}`);
          }
          return alert(`Save failed: ${result.error || 'Unknown error. Please check console for details.'}`);
        }
        
        // Parse inspection tasks to show how many were saved
        const tasksList = data.inspectionTasks ? data.inspectionTasks.split('\n').filter(t => t.trim()) : [];
        const taskCount = tasksList.length;
        
        let successMessage = 'Maintenance item added successfully!';
        if (taskCount > 0) {
          successMessage += `\n\n✓ Saved ${taskCount} inspection task(s) to inspection_tasks collection with schedule.`;
        }
        
        console.log('=== MAINTENANCE ADDED SUCCESSFULLY ===');
        console.log('Maintenance ID:', result.maintenanceId || 'N/A');
        console.log('Inspection tasks saved:', taskCount);
        console.log('Schedule data:', JSON.stringify(scheduleData, null, 2));
        
        alert(successMessage);
        addForm.reset();
        closeAddModal();
        loadMaintenanceItems(); // Refresh table data
      } catch (error) {
        console.error('Error adding maintenance:', error);
        alert(`Save failed: ${error.message || 'Network error. Please try again.'}`);
      }
    });
  }

}

// Function to close the add modal
function closeAddModal() {
  if (addModalOverlay) {
    addModalOverlay.classList.remove('open');
  }
  if (addForm) {
    addForm.reset();
  }
  if (scheduleContainer) {
    scheduleContainer.style.display = 'none';
  }
  if (scheduleCalendar) {
    scheduleCalendar.innerHTML = '';
  }
}

// Generate schedule calendar based on frequency
function generateScheduleCalendar(frequency) {
  if (!scheduleCalendar) return;
  scheduleCalendar.innerHTML = '';
  
  if (frequency === 'Weekly') {
    generateWeeklySchedule();
  } else if (frequency === 'Monthly') {
    generateMonthlySchedule();
  } else if (frequency === 'Quarterly') {
    generateQuarterlySchedule();
  }
}

function generateWeeklySchedule() {
  const currentYear = new Date().getFullYear();
  const yearSelect = document.createElement('div');
  yearSelect.className = 'calendar-year-selector';
  
  const yearLabel = document.createElement('label');
  yearLabel.textContent = 'Year: ';
  const yearDropdown = document.createElement('select');
  yearDropdown.id = 'schedule-year';
  for (let y = currentYear; y <= currentYear + 2; y++) {
    const option = document.createElement('option');
    option.value = y;
    option.textContent = y;
    if (y === currentYear) option.selected = true;
    yearDropdown.appendChild(option);
  }
  
  yearSelect.appendChild(yearLabel);
  yearSelect.appendChild(yearDropdown);
  scheduleCalendar.appendChild(yearSelect);
  
  const monthsDiv = document.createElement('div');
  monthsDiv.className = 'calendar-months';
  
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  
  months.forEach((month, index) => {
    const monthDiv = document.createElement('div');
    monthDiv.className = 'calendar-month';
    monthDiv.dataset.month = month;
    
    const monthHeader = document.createElement('div');
    monthHeader.className = 'calendar-month-header';
    
    const monthName = document.createElement('span');
    monthName.style.fontWeight = '600';
    monthName.style.color = '#374151';
    monthName.textContent = month;
    monthHeader.appendChild(monthName);
    
    const addWeekBtn = document.createElement('button');
    addWeekBtn.type = 'button';
    addWeekBtn.className = 'add-week-btn';
    addWeekBtn.textContent = '+';
    addWeekBtn.title = 'Add week';
    addWeekBtn.dataset.month = month;
    addWeekBtn.addEventListener('click', () => addWeekToMonth(month, monthDiv));
    monthHeader.appendChild(addWeekBtn);
    
    monthDiv.appendChild(monthHeader);
    
    const weeksDiv = document.createElement('div');
    weeksDiv.className = 'calendar-weeks';
    weeksDiv.dataset.month = month;
    monthDiv.appendChild(weeksDiv);
    
    monthsDiv.appendChild(monthDiv);
    
    // Initialize add button state
    updateAddButtonState(monthDiv);
  });
  
  scheduleCalendar.appendChild(monthsDiv);
}

function addWeekToMonth(month, monthDiv) {
  const weeksDiv = monthDiv.querySelector('.calendar-weeks');
  if (!weeksDiv) return;
  
  const existingWeeks = weeksDiv.querySelectorAll('.calendar-week');
  const weekNumber = existingWeeks.length + 1;
  
  // Check if max 4 weeks reached
  if (weekNumber > 4) {
    alert('Maximum 4 weeks per month allowed');
    return;
  }
  
  const weekDiv = document.createElement('div');
  weekDiv.className = 'calendar-week';
  weekDiv.dataset.week = weekNumber;
  
  const weekLabel = document.createElement('div');
  weekLabel.className = 'calendar-week-label';
  weekLabel.textContent = `Week ${weekNumber}:`;
  weekDiv.appendChild(weekLabel);
  
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.className = 'calendar-date-input';
  dateInput.name = `schedule[${month}][Week${weekNumber}]`;
  weekDiv.appendChild(dateInput);
  
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-week-btn';
  removeBtn.textContent = '×';
  removeBtn.title = 'Remove week';
  removeBtn.addEventListener('click', () => {
    weekDiv.remove();
    updateWeekNumbers(weeksDiv);
    updateAddButtonState(monthDiv);
  });
  weekDiv.appendChild(removeBtn);
  
  weeksDiv.appendChild(weekDiv);
  updateAddButtonState(monthDiv);
}

function updateWeekNumbers(weeksDiv) {
  const weeks = weeksDiv.querySelectorAll('.calendar-week');
  weeks.forEach((weekDiv, index) => {
    const weekNumber = index + 1;
    weekDiv.dataset.week = weekNumber;
    const weekLabel = weekDiv.querySelector('.calendar-week-label');
    if (weekLabel) {
      weekLabel.textContent = `Week ${weekNumber}:`;
    }
    const dateInput = weekDiv.querySelector('.calendar-date-input');
    if (dateInput) {
      const month = weeksDiv.dataset.month;
      dateInput.name = `schedule[${month}][Week${weekNumber}]`;
    }
  });
}

function updateAddButtonState(monthDiv) {
  const addWeekBtn = monthDiv.querySelector('.add-week-btn');
  const weeksDiv = monthDiv.querySelector('.calendar-weeks');
  if (addWeekBtn && weeksDiv) {
    const existingWeeks = weeksDiv.querySelectorAll('.calendar-week');
    addWeekBtn.disabled = existingWeeks.length >= 4;
  }
}

function generateMonthlySchedule() {
  const currentYear = new Date().getFullYear();
  const yearSelect = document.createElement('div');
  yearSelect.className = 'calendar-year-selector';
  
  const yearLabel = document.createElement('label');
  yearLabel.textContent = 'Year: ';
  const yearDropdown = document.createElement('select');
  yearDropdown.id = 'schedule-year';
  for (let y = currentYear; y <= currentYear + 2; y++) {
    const option = document.createElement('option');
    option.value = y;
    option.textContent = y;
    if (y === currentYear) option.selected = true;
    yearDropdown.appendChild(option);
  }
  
  yearSelect.appendChild(yearLabel);
  yearSelect.appendChild(yearDropdown);
  scheduleCalendar.appendChild(yearSelect);
  
  const monthsDiv = document.createElement('div');
  monthsDiv.className = 'calendar-months';
  
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  
  months.forEach((month) => {
    const monthDiv = document.createElement('div');
    monthDiv.className = 'calendar-month';
    
    const monthHeader = document.createElement('div');
    monthHeader.className = 'calendar-month-header';
    monthHeader.textContent = month;
    monthDiv.appendChild(monthHeader);
    
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'calendar-date-input';
    dateInput.name = `schedule[${month}]`;
    dateInput.style.width = '100%';
    dateInput.style.marginTop = '0.5rem';
    
    monthDiv.appendChild(dateInput);
    monthsDiv.appendChild(monthDiv);
  });
  
  scheduleCalendar.appendChild(monthsDiv);
}

function generateQuarterlySchedule() {
  const currentYear = new Date().getFullYear();
  const yearSelect = document.createElement('div');
  yearSelect.className = 'calendar-year-selector';
  
  const yearLabel = document.createElement('label');
  yearLabel.textContent = 'Year: ';
  const yearDropdown = document.createElement('select');
  yearDropdown.id = 'schedule-year';
  for (let y = currentYear; y <= currentYear + 2; y++) {
    const option = document.createElement('option');
    option.value = y;
    option.textContent = y;
    if (y === currentYear) option.selected = true;
    yearDropdown.appendChild(option);
  }
  
  yearSelect.appendChild(yearLabel);
  yearSelect.appendChild(yearDropdown);
  scheduleCalendar.appendChild(yearSelect);
  
  const quartersContainer = document.createElement('div');
  quartersContainer.className = 'calendar-quarters';
  
  const quarters = ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)'];
  
  quarters.forEach((quarter) => {
    const quarterDiv = document.createElement('div');
    quarterDiv.className = 'calendar-quarter';
    
    const quarterHeader = document.createElement('div');
    quarterHeader.className = 'calendar-quarter-header';
    quarterHeader.textContent = quarter;
    quarterDiv.appendChild(quarterHeader);
    
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'calendar-date-input';
    dateInput.name = `schedule[${quarter}]`;
    dateInput.style.width = '100%';
    dateInput.style.marginTop = '0.5rem';
    dateInput.style.maxWidth = '300px';
    
    quarterDiv.appendChild(dateInput);
    quartersContainer.appendChild(quarterDiv);
  });
  
  scheduleCalendar.appendChild(quartersContainer);
}

// Fetch a sample maintenance item from database for placeholder examples
async function fetchSampleMaintenance() {
  try {
    const resp = await fetch('/api/maintenance/list');
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.ok && data.maintenance && data.maintenance.length > 0) {
      return data.maintenance[0];
    }
    return null;
  } catch (error) {
    console.error('Error fetching sample maintenance:', error);
    return null;
  }
}

// Set placeholder examples on maintenance form fields
function setMaintenanceFormPlaceholders(sampleMaintenance) {
  if (!sampleMaintenance) return;
  
  const branchField = document.getElementById('add-branch');
  const locationField = document.getElementById('add-location');
  const itemNameField = document.getElementById('add-itemName');
  const inspectionTasksField = document.getElementById('add-inspectionTasks');
  
  if (branchField && sampleMaintenance.branch) {
    branchField.placeholder = `e.g. ${sampleMaintenance.branch}`;
  }
  
  if (locationField && sampleMaintenance.location) {
    locationField.placeholder = `e.g. ${sampleMaintenance.location}`;
  }
  
  if (itemNameField && sampleMaintenance.itemName) {
    itemNameField.placeholder = `e.g. ${sampleMaintenance.itemName}`;
  }
  
  if (inspectionTasksField && sampleMaintenance.inspectionTasks) {
    const tasks = typeof sampleMaintenance.inspectionTasks === 'string' 
      ? sampleMaintenance.inspectionTasks.split('\n').slice(0, 3).join('\n')
      : '';
    if (tasks) {
      inspectionTasksField.placeholder = `e.g.\n${tasks}`;
    }
  }
}

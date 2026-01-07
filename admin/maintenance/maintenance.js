// Wait for DOM to be ready
let addMenu, addBtn, fileInput, addForm, maintenanceTableBody;
let addModalOverlay, closeAddModalBtn, cancelAddBtn, frequencySelect, scheduleContainer, scheduleCalendar;
let searchInput, searchBtn, prevPageBtn, nextPageBtn, pageInfo;

// Pagination state
let allMaintenanceItems = [];
let currentPage = 1;
const itemsPerPage = 10; // Number of items per page

function initElements() {
  addMenu = document.getElementById('add-maintenance-menu');
  addBtn = document.getElementById('add-maintenance-btn');
  fileInput = document.getElementById('maintenance-file-input');
  addForm = document.getElementById('add-maintenance-form');
  maintenanceTableBody = document.getElementById('maintenance-table-body');
  addModalOverlay = document.getElementById('add-modal-overlay');
  closeAddModalBtn = document.getElementById('close-add-modal-btn');
  cancelAddBtn = document.getElementById('cancel-add-btn');
  frequencySelect = document.getElementById('add-frequency');
  scheduleContainer = document.getElementById('add-schedule-container');
  scheduleCalendar = document.getElementById('add-schedule-calendar');
  searchInput = document.getElementById('maintenance-search');
  searchBtn = document.getElementById('maintenance-search-btn');
  prevPageBtn = document.getElementById('prev-page-btn');
  nextPageBtn = document.getElementById('next-page-btn');
  pageInfo = document.getElementById('page-info');
  
  console.log('Elements initialized:', { addBtn, addMenu });
  
  if (!addBtn) {
    console.error('add-maintenance-btn not found!');
  }
  if (!addMenu) {
    console.error('add-maintenance-menu not found!');
  }
}

// Load and display maintenance items in the table (optionally filtered by query)
async function loadMaintenance(query = '') {
  try {
    const params = query ? `?query=${encodeURIComponent(query)}` : '';
    const resp = await fetch(`/api/maintenance/list${params}`);
    if (!resp.ok) {
      console.error('Failed to load maintenance items');
      return;
    }
    const data = await resp.json();
    if (data.ok && data.maintenance) {
      allMaintenanceItems = data.maintenance;
      currentPage = 1; // Reset to first page when loading new data
      displayMaintenance();
    }
  } catch (error) {
    console.error('Error loading maintenance:', error);
  }
}

// Display maintenance items in the table (with pagination)
function displayMaintenance() {
  maintenanceTableBody.innerHTML = '';
  
  if (allMaintenanceItems.length === 0) {
    maintenanceTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #888;">No maintenance items found</td></tr>';
    updatePaginationControls();
    return;
  }
  
  // Calculate pagination
  const totalPages = Math.ceil(allMaintenanceItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, allMaintenanceItems.length);
  const pageItems = allMaintenanceItems.slice(startIndex, endIndex);
  
  // Display items for current page
  pageItems.forEach(item => {
    const row = document.createElement('tr');
    const frequency = item.frequency || '';
    const frequencyClass = frequency.toLowerCase();
    
    row.innerHTML = `
      <td>${item.branch || '-'}</td>
      <td>${item.location || '-'}</td>
      <td>${item.itemName || '-'}</td>
      <td><span class="frequency-badge frequency-${frequencyClass}">${frequency || '-'}</span></td>
      <td><a href="maintenancetask.html?maintenanceId=${item._id || ''}" class="inspection-tasks-link">View Tasks</a></td>
    `;
    maintenanceTableBody.appendChild(row);
  });
  
  // Update pagination controls
  updatePaginationControls();
}

// Update pagination controls (buttons and info)
function updatePaginationControls() {
  const totalPages = Math.ceil(allMaintenanceItems.length / itemsPerPage);
  
  // Update page info
  if (allMaintenanceItems.length === 0) {
    pageInfo.textContent = 'page 0 of 0';
  } else {
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, allMaintenanceItems.length);
    pageInfo.textContent = `page ${currentPage} of ${totalPages} (${startIndex}-${endIndex})`;
  }
  
  // Enable/disable navigation buttons
  if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
  if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages || totalPages === 0;
}


// Initialize everything when DOM is ready
function init() {
  initElements();
  
  if (!addBtn || !addMenu) {
    console.error('Critical elements not found! Retrying...');
    setTimeout(init, 100);
    return;
  }
  
  // Load maintenance when page loads
  loadMaintenance();
  
  // Setup event listeners
  setupEventListeners();
}

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init(); // DOM already loaded
}

// Function to close the add modal
function closeAddModal() {
  addModalOverlay.classList.remove('open');
  addForm.reset();
  scheduleContainer.style.display = 'none';
  scheduleCalendar.innerHTML = '';
}

function setupEventListeners() {
  // Add button click handler - THIS WAS MISSING!
  if (addBtn) {
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('Add button clicked!', addMenu);
      if (addMenu) {
        addMenu.classList.toggle('open');
        console.log('Menu toggled, classList:', addMenu.classList.toString());
      } else {
        console.error('addMenu is null!');
      }
    });
  } else {
    console.error('addBtn is null, cannot add event listener!');
  }

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (addBtn && addMenu && !addBtn.contains(e.target) && !addMenu.contains(e.target)) {
      addMenu.classList.remove('open');
    }
  });

  // Search listeners
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      const q = searchInput?.value || '';
      loadMaintenance(q);
    });
  }
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = searchInput.value || '';
        loadMaintenance(q);
      }
    });
  }

  // Pagination event listeners
  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        displayMaintenance();
        // Scroll to top of table
        maintenanceTableBody.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(allMaintenanceItems.length / itemsPerPage);
      if (currentPage < totalPages) {
        currentPage++;
        displayMaintenance();
        // Scroll to top of table
        maintenanceTableBody.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  // Fetch a sample maintenance item from database for placeholder examples
  async function fetchSampleMaintenance() {
    try {
      const resp = await fetch('/api/maintenance/list');
      if (!resp.ok) return null;
      const data = await resp.json();
      if (data.ok && data.maintenance && data.maintenance.length > 0) {
        // Return the first maintenance item as an example
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
      // Format inspection tasks for placeholder (show first few lines)
      const tasks = typeof sampleMaintenance.inspectionTasks === 'string' 
        ? sampleMaintenance.inspectionTasks.split('\n').slice(0, 3).join('\n')
        : '';
      if (tasks) {
        inspectionTasksField.placeholder = `e.g.\n${tasks}`;
      }
    }
  }

  // Menu click handlers
  if (addMenu) {
    addMenu.addEventListener('click', async (e) => {
      console.log('Menu clicked:', e.target, e.target.dataset.action);
      if (e.target.dataset.action === 'manual') {
        if (addModalOverlay) {
          addModalOverlay.classList.add('open');
        }
        addMenu.classList.remove('open'); // Close menu when opening modal
        
        // Fetch sample maintenance and set placeholders
        const sampleMaintenance = await fetchSampleMaintenance();
        setMaintenanceFormPlaceholders(sampleMaintenance);
      }
      if (e.target.dataset.action === 'upload') {
        // Set accept attribute to include Excel and CSV files
        if (fileInput) {
          fileInput.setAttribute('accept', '.csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv');
          fileInput.click();
        }
      }
    });
  }

  // Close modal when clicking X button
  if (closeAddModalBtn) {
    closeAddModalBtn.addEventListener('click', closeAddModal);
  }

  // Close modal when clicking Cancel button
  if (cancelAddBtn) {
    cancelAddBtn.addEventListener('click', closeAddModal);
  }

  // Close modal when clicking outside (on overlay)
  if (addModalOverlay) {
    addModalOverlay.addEventListener('click', (e) => {
      if (e.target === addModalOverlay) {
        closeAddModal();
      }
    });
  }

  // Handle frequency change to show/hide schedule
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
    
    const monthHeader = document.createElement('div');
    monthHeader.className = 'calendar-month-header';
    monthHeader.textContent = month;
    monthDiv.appendChild(monthHeader);
    
    const weeksDiv = document.createElement('div');
    weeksDiv.className = 'calendar-weeks';
    
    // Get number of weeks in month
    const firstDay = new Date(currentYear, index, 1).getDay();
    const daysInMonth = new Date(currentYear, index + 1, 0).getDate();
    const weeks = Math.ceil((daysInMonth + firstDay) / 7);
    
    for (let week = 1; week <= weeks; week++) {
      const weekDiv = document.createElement('div');
      weekDiv.className = 'calendar-week';
      
      const weekLabel = document.createElement('div');
      weekLabel.className = 'calendar-week-label';
      weekLabel.textContent = `Week ${week}:`;
      
      const dateInput = document.createElement('input');
      dateInput.type = 'date';
      dateInput.className = 'calendar-date-input';
      dateInput.name = `schedule[${month}][Week${week}]`;
      
      weekDiv.appendChild(weekLabel);
      weekDiv.appendChild(dateInput);
      weeksDiv.appendChild(weekDiv);
    }
    
    monthDiv.appendChild(weeksDiv);
    monthsDiv.appendChild(monthDiv);
  });
  
  scheduleCalendar.appendChild(monthsDiv);
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
  
  months.forEach((month, index) => {
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
  if (!scheduleCalendar) return;
  
  const currentYear = new Date().getFullYear();
  
  // Create year selector
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
  
  // Create container for all quarters
  const quartersContainer = document.createElement('div');
  quartersContainer.style.marginTop = '1rem';
  quartersContainer.style.display = 'flex';
  quartersContainer.style.flexDirection = 'column';
  quartersContainer.style.gap = '1rem';
  
  // List all quarters Q1, Q2, Q3, Q4 - each with one date picker
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  
  quarters.forEach(quarter => {
    const quarterDiv = document.createElement('div');
    quarterDiv.className = 'calendar-quarter';
    
    const quarterLabel = document.createElement('div');
    quarterLabel.className = 'calendar-quarter-label';
    quarterLabel.textContent = quarter;
    quarterLabel.style.marginBottom = '0.5rem';
    quarterDiv.appendChild(quarterLabel);
    
    // Add one date input for each quarter (like monthly frequency)
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

// Form submit handler
if (addForm) {
  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    
    const formData = new FormData(addForm);
    
    // Collect schedule data
    const scheduleData = {};
    const scheduleInputs = scheduleCalendar.querySelectorAll('[name^="schedule"]');
    scheduleInputs.forEach(input => {
      if (input.value) {
        const nameParts = input.name.match(/schedule\[(.*?)\](?:\[(.*?)\])?/);
        if (nameParts) {
          const key1 = nameParts[1];
          const key2 = nameParts[2];
          if (key2) {
            if (!scheduleData[key1]) scheduleData[key1] = {};
            scheduleData[key1][key2] = input.value;
          } else {
            scheduleData[key1] = input.value;
          }
        }
      }
    });
    
    const data = Object.fromEntries(formData.entries());
    if (Object.keys(scheduleData).length > 0) {
      data.maintenanceSchedule = scheduleData;
    }
    
    try {
      const resp = await fetch('/api/maintenance/add', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
      });
      
      const result = await resp.json();
      
      if (!resp.ok || !result.ok) {
        console.error('Add maintenance error:', result);
        if (resp.status === 409 || result.error === 'Data already exists') {
          return alert(`Data already exists!\n\n${result.message || 'A maintenance item with these details already exists in the database.'}`);
        }
        return alert(`Save failed: ${result.error || 'Unknown error. Please check console for details.'}`);
      }
      
      alert('Maintenance item added successfully!');
      addForm.reset();
      closeAddModal();
      loadMaintenance(); // Refresh table data
    } catch (error) {
      console.error('Error adding maintenance:', error);
      alert(`Save failed: ${error.message || 'Network error. Please try again.'}`);
    }
  });
}

// File input change handler
if (fileInput) {
  fileInput.addEventListener('change', async () => {
    if (!fileInput.files.length) return;
    const fd = new FormData();
    fd.append('file', fileInput.files[0]);
    
    try {
      const resp = await fetch('./upload_maintenance.php', { method: 'POST', body: fd });
      const data = await resp.json();
      
      if (!resp.ok || !data.ok) {
        console.error('Upload error:', data);
        fileInput.value = '';
        addMenu.classList.remove('open'); // Close menu even on error
        return alert(`Upload failed: ${data.error || 'Unknown error'}`);
      }
      
      if (data.inserted > 0) {
        let message = `Successfully uploaded ${data.inserted} maintenance item(s)!`;
        if (data.duplicates && data.duplicates.length > 0) {
          message += `\n\n${data.duplicates.length} duplicate(s) skipped:\n${data.duplicates.slice(0, 5).join(', ')}${data.duplicates.length > 5 ? '...' : ''}`;
        }
        alert(message);
        loadMaintenance(); // Refresh table data
      } else {
        let message = `No maintenance items were inserted.`;
        if (data.duplicates && data.duplicates.length > 0) {
          message += `\n\n${data.duplicates.length} duplicate(s) found and skipped:\n${data.duplicates.slice(0, 5).join(', ')}${data.duplicates.length > 5 ? '...' : ''}`;
        } else {
          message += `\n\n${data.message || 'Please check that your file has valid data.'}`;
        }
        alert(message);
      }
      
      fileInput.value = '';
      addMenu.classList.remove('open'); // Close the dropdown menu after upload
    } catch (error) {
      console.error('Upload error:', error);
      fileInput.value = '';
      addMenu.classList.remove('open'); // Close menu on error
      alert(`Upload failed: ${error.message || 'Network error. Please try again.'}`);
    }
  });
}

// Info modal elements
const infoIconBtn = document.getElementById('info-icon-btn');
const infoModalOverlay = document.getElementById('info-modal-overlay');
const closeInfoModalBtn = document.getElementById('close-info-modal-btn');
const okInfoModalBtn = document.getElementById('ok-info-modal-btn');

// Function to open info modal
function openInfoModal() {
  if (infoModalOverlay) {
    infoModalOverlay.classList.add('open');
  }
}

// Function to close info modal
function closeInfoModal() {
  if (infoModalOverlay) {
    infoModalOverlay.classList.remove('open');
  }
}

// Wait for DOM to be ready before adding event listeners
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Info icon click handler
    if (infoIconBtn) {
      infoIconBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openInfoModal();
      });
    }

    // Close modal when clicking X button
    if (closeInfoModalBtn) {
      closeInfoModalBtn.addEventListener('click', closeInfoModal);
    }

    // Close modal when clicking OK button
    if (okInfoModalBtn) {
      okInfoModalBtn.addEventListener('click', closeInfoModal);
    }

    // Close modal when clicking outside (on overlay)
    if (infoModalOverlay) {
      infoModalOverlay.addEventListener('click', (e) => {
        if (e.target === infoModalOverlay) {
          closeInfoModal();
        }
      });
    }
  });
} else {
  // DOM already loaded
  if (infoIconBtn) {
    infoIconBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openInfoModal();
    });
  }

  if (closeInfoModalBtn) {
    closeInfoModalBtn.addEventListener('click', closeInfoModal);
  }

  if (okInfoModalBtn) {
    okInfoModalBtn.addEventListener('click', closeInfoModal);
  }

  if (infoModalOverlay) {
    infoModalOverlay.addEventListener('click', (e) => {
      if (e.target === infoModalOverlay) {
        closeInfoModal();
      }
    });
  }
}
}

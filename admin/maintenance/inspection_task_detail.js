// Inspection Task Detail Page
// Loads and displays assets for a specific inspection task

let currentMaintenance = null;
let currentTaskText = '';
let maintenanceAssets = [];

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const maintenanceId = urlParams.get('maintenanceId');
const taskIndex = urlParams.get('taskIndex');
const taskText = urlParams.get('taskText');

// Load maintenance details and assets
async function loadTaskDetails() {
  if (!maintenanceId) {
    document.body.innerHTML = '<div style="padding: 2rem; text-align: center;"><h1>Error</h1><p>Maintenance ID is required.</p><a href="maintenance_checklist_draft.html">← Back</a></div>';
    return;
  }

  try {
    // Load maintenance details
    const response = await fetch(`/api/maintenance/get?maintenanceId=${encodeURIComponent(maintenanceId)}`);
    if (!response.ok) {
      throw new Error('Failed to load maintenance details');
    }

    const data = await response.json();
    if (!data.ok || !data.maintenance) {
      throw new Error('Maintenance item not found');
    }

    currentMaintenance = data.maintenance;

    // Get task text from URL parameter or from maintenance item
    if (taskText) {
      currentTaskText = decodeURIComponent(taskText);
    } else if (currentMaintenance.inspectionTasks) {
      const tasks = currentMaintenance.inspectionTasks.split('\n').filter(t => t.trim());
      const index = parseInt(taskIndex) || 0;
      currentTaskText = tasks[index] || tasks[0] || 'No task description';
    } else {
      currentTaskText = 'No task description available';
    }

    // Set task title
    const taskTitle = document.getElementById('task-title');
    if (taskTitle) {
      taskTitle.textContent = currentTaskText;
    }

    // Set back link
    const backLink = document.getElementById('back-link');
    if (backLink && currentMaintenance) {
      const backUrl = `maintenance_checklist_draft.html?id=${encodeURIComponent(currentMaintenance._id)}&branch=${encodeURIComponent(currentMaintenance.branch)}&location=${encodeURIComponent(currentMaintenance.location)}&itemName=${encodeURIComponent(currentMaintenance.itemName)}&frequency=${encodeURIComponent(currentMaintenance.frequency)}`;
      backLink.href = backUrl;
    }

    // Load assets
    await loadAssets();
  } catch (error) {
    console.error('Error loading task details:', error);
    document.body.innerHTML = `<div style="padding: 2rem; text-align: center;"><h1>Error</h1><p>${error.message || 'Failed to load task details'}</p><a href="maintenance_checklist_draft.html">← Back</a></div>`;
  }
}

// Load assets based on locationDescription matching taskName
async function loadAssets() {
  try {
    if (!currentTaskText || currentTaskText.trim() === '') {
      console.warn('No task name available, cannot load assets by locationDescription');
      maintenanceAssets = [];
      displayAssets();
      return;
    }
    
    console.log(`Loading assets where locationDescription = "${currentTaskText}"`);
    
    // Load all assets and filter by locationDescription
    const resp = await fetch('/api/assets/list');
    const data = await resp.json();

    if (resp.ok && data.ok && data.assets) {
      // Filter assets where locationDescription matches taskName
      const matchingAssets = data.assets.filter(asset => {
        const assetLocation = asset.locationDescription || '';
        return assetLocation.trim() === currentTaskText.trim();
      });
      
      console.log(`Found ${matchingAssets.length} asset(s) with locationDescription="${currentTaskText}"`);
      
      // Also get inspection status from maintenance_assets if they exist
      if (matchingAssets.length > 0 && maintenanceId) {
        try {
          const maintenanceAssetsResp = await fetch(`/api/maintenance/assets?maintenanceId=${encodeURIComponent(maintenanceId)}`);
          const maintenanceAssetsData = await maintenanceAssetsResp.json();
          
          if (maintenanceAssetsResp.ok && maintenanceAssetsData.ok && maintenanceAssetsData.assets) {
            // Create a map of assetId -> inspection status
            const statusMap = {};
            maintenanceAssetsData.assets.forEach(ma => {
              if (ma.assetId) {
                statusMap[ma.assetId] = {
                  inspectionStatus: ma.inspectionStatus || 'open',
                  inspectionNotes: ma.inspectionNotes,
                  solved: ma.solved || false,
                  inspectionDate: ma.inspectionDate
                };
              }
            });
            
            // Merge inspection status into matching assets
            maintenanceAssets = matchingAssets.map(asset => ({
              ...asset,
              inspectionStatus: statusMap[asset.assetId]?.inspectionStatus || 'open',
              inspectionNotes: statusMap[asset.assetId]?.inspectionNotes || '',
              solved: statusMap[asset.assetId]?.solved || false,
              inspectionDate: statusMap[asset.assetId]?.inspectionDate || null
            }));
          } else {
            // No maintenance assets found, use default status
            maintenanceAssets = matchingAssets.map(asset => ({
              ...asset,
              inspectionStatus: 'open',
              inspectionNotes: '',
              solved: false,
              inspectionDate: null
            }));
          }
        } catch (error) {
          console.warn('Could not load inspection status, using defaults:', error);
          maintenanceAssets = matchingAssets.map(asset => ({
            ...asset,
            inspectionStatus: 'open',
            inspectionNotes: '',
            solved: false,
            inspectionDate: null
          }));
        }
      } else {
        maintenanceAssets = matchingAssets.map(asset => ({
          ...asset,
          inspectionStatus: 'open',
          inspectionNotes: '',
          solved: false,
          inspectionDate: null
        }));
      }
    } else {
      maintenanceAssets = [];
    }
    
    displayAssets();
  } catch (error) {
    console.error('Error loading assets:', error);
    maintenanceAssets = [];
    displayAssets();
  }
}

// Display assets in the table
function displayAssets() {
  const assetsTableWrapper = document.getElementById('assets-table-wrapper');
  if (!assetsTableWrapper) {
    console.error('assets-table-wrapper element not found');
    return;
  }

  // Clear the wrapper first
  assetsTableWrapper.innerHTML = '';

  if (!maintenanceAssets || maintenanceAssets.length === 0) {
    assetsTableWrapper.innerHTML = `
      <div class="no-assets">
        <p>No assets found with locationDescription matching "${escapeHtml(currentTaskText)}".</p>
        <p style="margin-top: 0.5rem; font-size: 0.875rem; color: #6b7280;">Assets are automatically displayed when their locationDescription matches the inspection task name.</p>
      </div>
    `;
    return;
  }

  const table = document.createElement('table');
  table.className = 'assets-table';
  
  table.innerHTML = `
    <thead>
      <tr>
        <th>Asset ID</th>
        <th>Asset Description</th>
        <th>Category</th>
        <th>Status</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>
      ${maintenanceAssets.map(asset => {
        if (!asset || !asset.assetId) {
          return ''; // Skip invalid assets
        }
        
        const inspectionStatus = asset.inspectionStatus || 'pending';
        let statusClass = 'pending';
        let statusText = 'Pending';
        
        if (inspectionStatus === 'complete') {
          statusClass = 'complete';
          statusText = 'Complete';
        } else if (inspectionStatus === 'upcoming') {
          statusClass = 'upcoming';
          statusText = 'Upcoming';
        } else {
          statusClass = 'pending';
          statusText = 'Pending';
        }
        
        const safeAssetId = escapeHtml(asset.assetId);
        
        return `
          <tr data-asset-id="${safeAssetId}">
            <td class="asset-id">${safeAssetId}</td>
            <td class="asset-description">${escapeHtml(asset.assetDescription || '-')}</td>
            <td class="asset-category">${escapeHtml(asset.assetCategoryDescription || asset.assetCategory || '-')}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
              <div class="action-buttons">
                <button class="btn-view-details action-btn" onclick="viewAssetDetails('${safeAssetId}')">View Details</button>
                <button class="btn-delete-asset" onclick="removeAsset('${safeAssetId}')">Delete</button>
              </div>
            </td>
          </tr>
        `;
      }).filter(row => row !== '').join('')}
    </tbody>
  `;
  
  assetsTableWrapper.appendChild(table);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// View asset details
function viewAssetDetails(assetId) {
  if (!assetId || !maintenanceId) return;
  // Navigate to inspection asset details page with both assetId and maintenanceId
  const params = new URLSearchParams({
    assetId: assetId,
    maintenanceId: maintenanceId
  });
  window.location.href = `inspection_asset_details.html?${params.toString()}`;
}

// Remove asset from maintenance
window.removeAsset = async function(assetId) {
  if (!assetId || !maintenanceId) {
    alert('Invalid asset or maintenance ID');
    return;
  }

  if (!confirm(`Are you sure you want to unlink this asset from the inspection task?\n\nNote: This asset will still appear because its locationDescription matches the task name, but it will be unlinked from maintenance tracking.`)) {
    return;
  }

  try {
    const resp = await fetch('/api/maintenance/remove-asset', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        maintenanceId: maintenanceId,
        assetId: assetId
      })
    });

    const data = await resp.json();

    if (!resp.ok || !data.ok) {
      alert(`Delete failed: ${data.error || 'Unknown error'}`);
      return;
    }

    // Remove the asset from the local array immediately for better UX
    maintenanceAssets = maintenanceAssets.filter(asset => asset.assetId !== assetId);
    
    // Update the display immediately
    displayAssets();
    
    // Then reload from server to ensure consistency
    await loadAssets();
  } catch (error) {
    console.error('Error removing asset:', error);
    alert(`Delete failed: ${error.message || 'Network error'}`);
    // Reload assets to restore correct state
    await loadAssets();
  }
};

// Setup inspection actions menu
function setupInspectionActions() {
  const inspectionActionsBtn = document.getElementById('inspection-actions-btn');
  const inspectionActionsMenu = document.getElementById('inspection-actions-menu');
  
  if (inspectionActionsBtn && inspectionActionsMenu) {
    inspectionActionsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      inspectionActionsMenu.classList.toggle('open');
    });
    
    document.addEventListener('click', (e) => {
      if (!inspectionActionsBtn.contains(e.target) && !inspectionActionsMenu.contains(e.target)) {
        inspectionActionsMenu.classList.remove('open');
      }
    });
  }
  
  // Edit maintenance button
  const editMaintenanceBtn = document.getElementById('edit-maintenance-btn');
  if (editMaintenanceBtn) {
    editMaintenanceBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (inspectionActionsMenu) inspectionActionsMenu.classList.remove('open');
      openEditMaintenanceModal();
    });
  }
  
  // Delete inspection task button (delete only the current task, not the whole checklist)
  const deleteMaintenanceBtn = document.getElementById('delete-maintenance-btn');
  if (deleteMaintenanceBtn) {
    deleteMaintenanceBtn.addEventListener('click', async () => {
      if (inspectionActionsMenu) inspectionActionsMenu.classList.remove('open');
      
      if (!currentMaintenance) {
        alert('No maintenance item selected');
        return;
      }
      
      // Get the current task index
      const index = parseInt(taskIndex) || 0;
      const tasks = (currentMaintenance.inspectionTasks || '').split('\n').filter(t => t.trim());
      
      if (tasks.length === 0) {
        alert('No inspection tasks found');
        return;
      }
      
      const taskToDelete = tasks[index] || currentTaskText;
      
      if (!confirm(`Are you sure you want to delete this inspection task?\n\nTask: ${taskToDelete}\n\nThis will only delete this task, not the entire checklist.`)) {
        return;
      }
      
      try {
        // Remove the task at the specified index
        tasks.splice(index, 1);
        
        // Update the maintenance item with remaining tasks
        const updatedTasks = tasks.join('\n');
        
        const resp = await fetch('/api/maintenance/update', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            maintenanceId: maintenanceId,
            inspectionTasks: updatedTasks
          })
        });
        
        const data = await resp.json();
        
        if (!resp.ok || !data.ok) {
          alert(`Delete failed: ${data.error || 'Unknown error'}`);
          return;
        }
        
        alert('Inspection task deleted successfully!');
        // Redirect back to checklist page
        const backUrl = `maintenance_checklist_draft.html?id=${encodeURIComponent(currentMaintenance._id)}&branch=${encodeURIComponent(currentMaintenance.branch)}&location=${encodeURIComponent(currentMaintenance.location)}&itemName=${encodeURIComponent(currentMaintenance.itemName)}&frequency=${encodeURIComponent(currentMaintenance.frequency)}`;
        window.location.href = backUrl;
      } catch (error) {
        console.error('Error deleting inspection task:', error);
        alert(`Delete failed: ${error.message || 'Network error'}`);
      }
    });
  }
}

// Open edit maintenance modal
function openEditMaintenanceModal() {
  const modal = document.getElementById('edit-maintenance-modal-overlay');
  if (!modal) {
    console.error('Edit modal not found');
    return;
  }
  
  const taskTextInput = document.getElementById('edit-task-text');
  const scheduleCalendar = document.getElementById('edit-schedule-calendar');
  
  // Populate with current task text (single task from the current task index)
  if (taskTextInput) {
    taskTextInput.value = currentTaskText || '';
  }
  
  // Generate calendar based on current maintenance frequency
  if (currentMaintenance && currentMaintenance.frequency && scheduleCalendar) {
    generateScheduleCalendarForEdit(currentMaintenance.frequency, currentMaintenance.maintenanceSchedule || {});
  }
  
  // Show the modal
  modal.classList.add('open');
}

// Close edit maintenance modal
function closeEditMaintenanceModal() {
  const modal = document.getElementById('edit-maintenance-modal-overlay');
  if (modal) {
    modal.classList.remove('open');
  }
}

// Generate schedule calendar for edit modal (using add maintenance template structure)
function generateScheduleCalendarForEdit(frequency, existingSchedule = {}) {
  const scheduleCalendar = document.getElementById('edit-schedule-calendar');
  if (!scheduleCalendar) return;
  
  scheduleCalendar.innerHTML = '';
  
  if (frequency === 'Weekly') {
    generateEditWeeklySchedule(existingSchedule);
  } else if (frequency === 'Monthly') {
    generateEditMonthlySchedule(existingSchedule);
  } else if (frequency === 'Quarterly') {
    generateEditQuarterlySchedule(existingSchedule);
  }
}

// Generate weekly schedule for edit
function generateEditWeeklySchedule(existingSchedule) {
  const scheduleCalendar = document.getElementById('edit-schedule-calendar');
  const currentYear = new Date().getFullYear();
  
  // Year selector
  const yearSelect = document.createElement('div');
  yearSelect.className = 'calendar-year-selector';
  
  const yearLabel = document.createElement('label');
  yearLabel.textContent = 'Year: ';
  const yearDropdown = document.createElement('select');
  yearDropdown.id = 'edit-schedule-year';
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
    addWeekBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      addWeekToMonthEdit(month, monthDiv);
    });
    monthHeader.appendChild(addWeekBtn);
    
    monthDiv.appendChild(monthHeader);
    
    const weeksDiv = document.createElement('div');
    weeksDiv.className = 'calendar-weeks';
    weeksDiv.dataset.month = month;
    
    // Add existing weeks
    if (existingSchedule[month] && typeof existingSchedule[month] === 'object') {
      Object.keys(existingSchedule[month]).forEach((weekKey, idx) => {
        const weekNumber = idx + 1;
        const dateValue = existingSchedule[month][weekKey];
        const weekDiv = createWeekElementEdit(month, weekNumber, dateValue, weeksDiv);
        weeksDiv.appendChild(weekDiv);
      });
    }
    
    monthDiv.appendChild(weeksDiv);
    monthsDiv.appendChild(monthDiv);
    
    updateAddButtonStateWeeklyEdit(monthDiv);
  });
  
  scheduleCalendar.appendChild(monthsDiv);
}

// Generate monthly schedule for edit
function generateEditMonthlySchedule(existingSchedule) {
  const scheduleCalendar = document.getElementById('edit-schedule-calendar');
  const currentYear = new Date().getFullYear();
  
  // Year selector
  const yearSelect = document.createElement('div');
  yearSelect.className = 'calendar-year-selector';
  
  const yearLabel = document.createElement('label');
  yearLabel.textContent = 'Year: ';
  const yearDropdown = document.createElement('select');
  yearDropdown.id = 'edit-schedule-year';
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
    monthDiv.dataset.month = month;
    
    const monthHeader = document.createElement('div');
    monthHeader.className = 'calendar-month-header';
    
    const monthName = document.createElement('span');
    monthName.style.fontWeight = '600';
    monthName.style.color = '#374151';
    monthName.textContent = month;
    monthHeader.appendChild(monthName);
    
    const addDateBtn = document.createElement('button');
    addDateBtn.type = 'button';
    addDateBtn.className = 'add-week-btn';
    addDateBtn.textContent = '+';
    addDateBtn.title = 'Add date';
    addDateBtn.dataset.month = month;
    addDateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      addDateToMonthEdit(month, monthDiv);
    });
    monthHeader.appendChild(addDateBtn);
    
    monthDiv.appendChild(monthHeader);
    
    const datesDiv = document.createElement('div');
    datesDiv.className = 'calendar-weeks';
    datesDiv.dataset.month = month;
    
    // Add existing date
    if (existingSchedule[month]) {
      const dateDiv = createDateElementEdit(month, existingSchedule[month], datesDiv);
      datesDiv.appendChild(dateDiv);
    }
    
    monthDiv.appendChild(datesDiv);
    monthsDiv.appendChild(monthDiv);
    
    updateAddButtonStateMonthlyEdit(monthDiv);
  });
  
  scheduleCalendar.appendChild(monthsDiv);
}

// Generate quarterly schedule for edit
function generateEditQuarterlySchedule(existingSchedule) {
  const scheduleCalendar = document.getElementById('edit-schedule-calendar');
  const currentYear = new Date().getFullYear();
  
  // Year selector
  const yearSelect = document.createElement('div');
  yearSelect.className = 'calendar-year-selector';
  
  const yearLabel = document.createElement('label');
  yearLabel.textContent = 'Year: ';
  const yearDropdown = document.createElement('select');
  yearDropdown.id = 'edit-schedule-year';
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
    quarterDiv.dataset.quarter = quarter;
    
    const quarterHeader = document.createElement('div');
    quarterHeader.className = 'calendar-quarter-header';
    quarterHeader.textContent = quarter;
    quarterDiv.appendChild(quarterHeader);
    
    const addDateBtn = document.createElement('button');
    addDateBtn.type = 'button';
    addDateBtn.className = 'add-week-btn';
    addDateBtn.textContent = '+';
    addDateBtn.title = 'Add date';
    addDateBtn.dataset.quarter = quarter;
    addDateBtn.style.marginTop = '0.5rem';
    addDateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      addDateToQuarterEdit(quarter, quarterDiv);
    });
    quarterDiv.appendChild(addDateBtn);
    
    const datesDiv = document.createElement('div');
    datesDiv.className = 'calendar-weeks';
    datesDiv.dataset.quarter = quarter;
    datesDiv.style.marginTop = '0.5rem';
    
    // Add existing date
    if (existingSchedule[quarter]) {
      const dateDiv = createQuarterDateElementEdit(quarter, existingSchedule[quarter], datesDiv);
      datesDiv.appendChild(dateDiv);
    }
    
    quarterDiv.appendChild(datesDiv);
    quartersContainer.appendChild(quarterDiv);
    
    updateAddButtonStateQuarterlyEdit(quarterDiv);
  });
  
  scheduleCalendar.appendChild(quartersContainer);
}

// Helper functions for edit calendar (following add maintenance template)
function createWeekElementEdit(month, weekNumber, existingDate, weeksDiv) {
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
  if (existingDate) {
    dateInput.value = existingDate;
  }
  
  // Set min date to today (only future dates editable)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dateInput.min = today.toISOString().split('T')[0];
  
  // Disable if past date
  if (existingDate && new Date(existingDate) < today) {
    dateInput.disabled = true;
    dateInput.style.opacity = '0.6';
    dateInput.style.cursor = 'not-allowed';
  }
  
  weekDiv.appendChild(dateInput);
  
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-week-btn';
  removeBtn.textContent = '×';
  removeBtn.title = 'Remove week';
  
  // Always allow removing dates (even past dates can be removed)
  removeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    weekDiv.remove();
    updateWeekNumbersEdit(weeksDiv);
    const monthDiv = weeksDiv.closest('.calendar-month');
    if (monthDiv) {
      updateAddButtonStateWeeklyEdit(monthDiv);
    }
  });
  
  weekDiv.appendChild(removeBtn);
  
  return weekDiv;
}

function createDateElementEdit(month, existingDate, datesDiv) {
  const dateDiv = document.createElement('div');
  dateDiv.className = 'calendar-week';
  
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.className = 'calendar-date-input';
  dateInput.name = `schedule[${month}]`;
  dateInput.style.width = '100%';
  if (existingDate) {
    dateInput.value = existingDate;
  }
  
  // Set min date to today (only future dates editable)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dateInput.min = today.toISOString().split('T')[0];
  
  // Disable if past date
  if (existingDate && new Date(existingDate) < today) {
    dateInput.disabled = true;
    dateInput.style.opacity = '0.6';
    dateInput.style.cursor = 'not-allowed';
  }
  
  dateDiv.appendChild(dateInput);
  
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-week-btn';
  removeBtn.textContent = '×';
  removeBtn.title = 'Remove date';
  
  // Always allow removing dates (even past dates can be removed)
  removeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dateDiv.remove();
    const monthDiv = datesDiv.closest('.calendar-month');
    if (monthDiv) {
      updateAddButtonStateMonthlyEdit(monthDiv);
    }
  });
  
  dateDiv.appendChild(removeBtn);
  
  return dateDiv;
}

function createQuarterDateElementEdit(quarter, existingDate, datesDiv) {
  const dateDiv = document.createElement('div');
  dateDiv.className = 'calendar-week';
  
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.className = 'calendar-date-input';
  dateInput.name = `schedule[${quarter}]`;
  dateInput.style.width = '100%';
  if (existingDate) {
    dateInput.value = existingDate;
  }
  
  // Set min date to today (only future dates editable)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dateInput.min = today.toISOString().split('T')[0];
  
  // Disable if past date
  if (existingDate && new Date(existingDate) < today) {
    dateInput.disabled = true;
    dateInput.style.opacity = '0.6';
    dateInput.style.cursor = 'not-allowed';
  }
  
  dateDiv.appendChild(dateInput);
  
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-week-btn';
  removeBtn.textContent = '×';
  removeBtn.title = 'Remove date';
  
  // Always allow removing dates (even past dates can be removed)
  removeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dateDiv.remove();
    const quarterDiv = datesDiv.closest('.calendar-quarter');
    if (quarterDiv) {
      updateAddButtonStateQuarterlyEdit(quarterDiv);
    }
  });
  
  dateDiv.appendChild(removeBtn);
  
  return dateDiv;
}

function addWeekToMonthEdit(month, monthDiv) {
  const weeksDiv = monthDiv.querySelector('.calendar-weeks');
  if (!weeksDiv) return;
  
  const existingWeeks = weeksDiv.querySelectorAll('.calendar-week');
  const weekNumber = existingWeeks.length + 1;
  
  if (weekNumber > 4) {
    alert('Maximum 4 weeks per month allowed');
    return;
  }
  
  const weekDiv = createWeekElementEdit(month, weekNumber, null, weeksDiv);
  weeksDiv.appendChild(weekDiv);
  updateAddButtonStateWeeklyEdit(monthDiv);
}

function addDateToMonthEdit(month, monthDiv) {
  const datesDiv = monthDiv.querySelector('.calendar-weeks');
  if (!datesDiv) return;
  
  const existingDates = datesDiv.querySelectorAll('.calendar-week');
  
  if (existingDates.length >= 1) {
    alert('Maximum 1 date per month allowed');
    return;
  }
  
  const dateDiv = createDateElementEdit(month, null, datesDiv);
  datesDiv.appendChild(dateDiv);
  updateAddButtonStateMonthlyEdit(monthDiv);
}

function addDateToQuarterEdit(quarter, quarterDiv) {
  const datesDiv = quarterDiv.querySelector('.calendar-weeks');
  if (!datesDiv) return;
  
  const existingDates = datesDiv.querySelectorAll('.calendar-week');
  
  if (existingDates.length >= 1) {
    alert('Maximum 1 date per quarter allowed');
    return;
  }
  
  const dateDiv = createQuarterDateElementEdit(quarter, null, datesDiv);
  datesDiv.appendChild(dateDiv);
  updateAddButtonStateQuarterlyEdit(quarterDiv);
}

function updateWeekNumbersEdit(weeksDiv) {
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

function updateAddButtonStateWeeklyEdit(monthDiv) {
  const addBtn = monthDiv.querySelector('.add-week-btn');
  const weeksDiv = monthDiv.querySelector('.calendar-weeks');
  if (addBtn && weeksDiv) {
    const existingWeeks = weeksDiv.querySelectorAll('.calendar-week');
    addBtn.disabled = existingWeeks.length >= 4;
  }
}

function updateAddButtonStateMonthlyEdit(monthDiv) {
  const addBtn = monthDiv.querySelector('.add-week-btn');
  const datesDiv = monthDiv.querySelector('.calendar-weeks');
  if (addBtn && datesDiv) {
    const existingDates = datesDiv.querySelectorAll('.calendar-week');
    addBtn.disabled = existingDates.length >= 1;
  }
}

function updateAddButtonStateQuarterlyEdit(quarterDiv) {
  const addBtn = quarterDiv.querySelector('.add-week-btn');
  const datesDiv = quarterDiv.querySelector('.calendar-weeks');
  if (addBtn && datesDiv) {
    const existingDates = datesDiv.querySelectorAll('.calendar-week');
    addBtn.disabled = existingDates.length >= 1;
  }
}

// Setup edit maintenance modal
function setupEditMaintenanceModal() {
  const closeBtn = document.getElementById('close-edit-maintenance-modal-btn');
  const cancelBtn = document.getElementById('cancel-edit-maintenance-btn');
  const saveBtn = document.getElementById('save-edit-maintenance-btn');
  const editForm = document.getElementById('edit-maintenance-form');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', closeEditMaintenanceModal);
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeEditMaintenanceModal);
  }
  
  // Close modal when clicking outside
  const modal = document.getElementById('edit-maintenance-modal-overlay');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeEditMaintenanceModal();
      }
    });
  }
  
  if (editForm) {
    editForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveEditMaintenance();
    });
  }
  
  if (saveBtn) {
    saveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      saveEditMaintenance();
    });
  }
}

// Save edit maintenance
async function saveEditMaintenance() {
  if (!maintenanceId || !currentMaintenance) {
    alert('Maintenance information is missing');
    return;
  }
  
  const updateData = {};
  
  // Get inspection task update
  const taskTextInput = document.getElementById('edit-task-text');
  const newTaskText = taskTextInput?.value.trim() || '';
  
  if (!newTaskText) {
    alert('Inspection task is required');
    return;
  }
  
  // Get current inspection tasks
  const currentTasks = (currentMaintenance.inspectionTasks || '').split('\n').filter(t => t.trim());
  
  // Find the index of the current task
  const taskIndex = parseInt(urlParams.get('taskIndex')) || 0;
  
  // Update the task at the specified index
  if (taskIndex >= 0 && taskIndex < currentTasks.length) {
    currentTasks[taskIndex] = newTaskText;
  } else {
    // If index is invalid, just replace all or append
    currentTasks[0] = newTaskText;
  }
  
  updateData.inspectionTasks = currentTasks.join('\n');
  
  // Get calendar/schedule update
  const scheduleCalendar = document.getElementById('edit-schedule-calendar');
  if (scheduleCalendar) {
    const scheduleData = {};
    const scheduleInputs = scheduleCalendar.querySelectorAll('[name^="schedule"]');
    
    scheduleInputs.forEach(input => {
      if (input.value && !input.disabled) { // Only include enabled (future) dates
        const nameParts = input.name.match(/schedule\[(.*?)\](?:\[(.*?)\])?/);
        if (nameParts) {
          const key1 = nameParts[1];
          const key2 = nameParts[2];
          if (key2) {
            // Weekly: schedule[January][Week1]
            if (!scheduleData[key1]) scheduleData[key1] = {};
            scheduleData[key1][key2] = input.value;
          } else {
            // Monthly/Quarterly: schedule[January] or schedule[Q1 (Jan-Mar)]
            scheduleData[key1] = input.value;
          }
        }
      } else if (input.value && input.disabled) {
        // Include past dates (disabled) as read-only - preserve them
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
    
    // Merge with existing schedule to preserve past dates
    const existingSchedule = currentMaintenance.maintenanceSchedule || {};
    if (Object.keys(existingSchedule).length > 0) {
      // Preserve existing schedule structure
      Object.keys(existingSchedule).forEach(key => {
        if (!scheduleData[key]) {
          scheduleData[key] = existingSchedule[key];
        } else if (typeof existingSchedule[key] === 'object' && typeof scheduleData[key] === 'object') {
          // Merge weekly schedules
          Object.keys(existingSchedule[key]).forEach(subKey => {
            if (!scheduleData[key][subKey]) {
              scheduleData[key][subKey] = existingSchedule[key][subKey];
            }
          });
        }
      });
    }
    
    updateData.maintenanceSchedule = scheduleData;
  }
  
  try {
    const response = await fetch('/api/maintenance/update', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        maintenanceId: maintenanceId,
        ...updateData
      })
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.ok) {
      alert(`Update failed: ${data.error || 'Unknown error'}`);
      return;
    }
    
    // Update local state
    currentTaskText = newTaskText;
    currentMaintenance.inspectionTasks = updateData.inspectionTasks;
    
    if (updateData.maintenanceSchedule) {
      currentMaintenance.maintenanceSchedule = updateData.maintenanceSchedule;
    }
    
    // Update UI
    const taskTitle = document.getElementById('task-title');
    if (taskTitle) {
      taskTitle.textContent = newTaskText;
    }
    
    alert('Maintenance updated successfully!');
    closeEditMaintenanceModal();
  } catch (error) {
    console.error('Error updating maintenance:', error);
    alert(`Update failed: ${error.message || 'Network error'}`);
  }
}


// Old calendar functions removed - using generateScheduleCalendarForEdit instead

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadTaskDetails();
  setupInspectionActions();
  setupEditMaintenanceModal();
});

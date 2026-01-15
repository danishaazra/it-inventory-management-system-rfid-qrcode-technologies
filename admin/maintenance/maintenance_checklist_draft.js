// Preventive Maintenance Checklist System - PKT Format
// Calendar Grid View with Months as Columns
// VERSION: 2026-01-XX-FIX-QUARTERLY-DATES

// State management
let currentFrequency = 'Weekly';
let currentYear = new Date().getFullYear();
let maintenanceItems = []; // Hardware items to inspect
let inspectionData = new Map(); // Map of date+hardware -> inspection status
let currentInspectionDate = null;
let currentInspectionHardware = null;
let currentMaintenanceItem = null; // Current maintenance item from list page
let assetsCache = null; // Cache for assets to match tasks to assets by locationDescription

// DOM Elements
const checklistFormContainer = document.getElementById('checklist-form-container');
const calendarGridContainer = document.getElementById('calendar-grid-container');
const formHeaderInfo = document.getElementById('form-header-info');
const inspectionModal = document.getElementById('inspection-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelBtn = document.getElementById('cancel-btn');
const submitBtn = document.getElementById('submit-btn');
const modalBody = document.getElementById('modal-body');

// Function to open schedule modal (called from table button)
// If itemName is provided, it's editing an existing task
// If itemName is null/empty, it's adding a new task
window.openScheduleModal = function(itemId, itemName) {
  if (addScheduleModal) {
    const isNewTask = !itemName || itemName.trim() === '';
    
    // Store current item info for form submission
    if (addScheduleForm) {
      addScheduleForm.dataset.itemId = itemId || '';
      addScheduleForm.dataset.itemName = itemName || '';
      addScheduleForm.dataset.isNewTask = isNewTask ? 'true' : 'false';
    }
    
    // Find the task's existing schedule from separate collection ONLY (if editing existing task)
    // NO fallback to maintenanceSchedule - each task must have its own schedule
    let existingSchedule = null;
    if (!isNewTask && itemName && currentMaintenanceItem?._id) {
      // Load from inspection_tasks collection ONLY
      fetch(`/api/maintenance/inspection-task?maintenanceId=${encodeURIComponent(currentMaintenanceItem._id)}&taskName=${encodeURIComponent(itemName)}`)
        .then(async response => {
          // Check if response is actually JSON
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('API returned non-JSON response:', text.substring(0, 200));
            throw new Error('API returned non-JSON response');
          }
          return response.json();
        })
        .then(data => {
          if (data.ok && data.task && data.task.schedule) {
            existingSchedule = data.task.schedule;
            console.log(`✓ Loaded schedule for "${itemName}" from new collection`);
          } else {
            console.log(`✗ No schedule found for "${itemName}" in new collection - will start with empty schedule`);
            existingSchedule = null; // Start with empty - no fallback to ensure separation
          }
          
          // Generate calendar with loaded schedule (or empty if none)
          if (addScheduleCalendar) {
            generateScheduleCalendarWithExisting(currentFrequency, existingSchedule);
          }
        })
        .catch(error => {
          console.error('Error loading task schedule:', error);
          existingSchedule = null; // No fallback - ensure complete separation
          if (addScheduleCalendar) {
            generateScheduleCalendar(currentFrequency);
          }
        });
    }
    
    // Generate calendar (will be updated if schedule loads asynchronously)
    // For new tasks, always start with empty calendar
    if (addScheduleCalendar) {
      if (isNewTask) {
        // New task - start with empty calendar
        generateScheduleCalendar(currentFrequency);
      } else if (existingSchedule) {
        // Existing task with schedule - load it
        generateScheduleCalendarWithExisting(currentFrequency, existingSchedule);
      } else {
        // Existing task without schedule - empty calendar
        generateScheduleCalendar(currentFrequency);
      }
    }
    
    // Pre-fill the task name if it's an existing task, clear it for new tasks
    const taskInput = document.getElementById('add-schedule-inspection-tasks');
    if (taskInput) {
      if (isNewTask) {
        taskInput.value = ''; // Clear for new task
        taskInput.disabled = false; // Enable input for new task name
        taskInput.placeholder = 'Enter inspection task name...';
      } else {
        taskInput.value = itemName; // Pre-fill for existing task
        taskInput.disabled = false; // Allow editing task name
        taskInput.placeholder = 'Inspection task name';
      }
    }
    
    // Update modal title
    const modalTitle = addScheduleModal.querySelector('h2');
    if (modalTitle) {
      modalTitle.textContent = isNewTask ? 'Add New Inspection Task' : 'Add Schedule';
    }
    
    addScheduleModal.classList.add('open');
  }
};

// Setup inspection actions menu (three dots)
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
    editMaintenanceBtn.addEventListener('click', () => {
      if (inspectionActionsMenu) inspectionActionsMenu.classList.remove('open');
      openEditMaintenanceModal();
    });
  }
  
  // Assign Staff button
  const assignStaffBtn = document.getElementById('assign-staff-btn');
  if (assignStaffBtn) {
    assignStaffBtn.addEventListener('click', () => {
      if (inspectionActionsMenu) inspectionActionsMenu.classList.remove('open');
      openAssignStaffModal();
    });
  }
  
  // Delete maintenance button
  const deleteMaintenanceBtn = document.getElementById('delete-maintenance-btn');
  if (deleteMaintenanceBtn) {
    deleteMaintenanceBtn.addEventListener('click', async () => {
      if (inspectionActionsMenu) inspectionActionsMenu.classList.remove('open');
      
      if (!currentMaintenanceItem) {
        alert('No maintenance item selected');
        return;
      }
      
      if (!confirm(`Are you sure you want to delete this maintenance item?\n\nBranch: ${currentMaintenanceItem.branch}\nLocation: ${currentMaintenanceItem.location}\nItem: ${currentMaintenanceItem.itemName}\n\nThis action cannot be undone.`)) {
        return;
      }
      
      try {
        const resp = await fetch('/api/maintenance/delete', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            maintenanceId: currentMaintenanceItem._id,
            branch: currentMaintenanceItem.branch,
            location: currentMaintenanceItem.location,
            itemName: currentMaintenanceItem.itemName
          })
        });
        
        const data = await resp.json();
        
        if (!resp.ok || !data.ok) {
          alert(`Delete failed: ${data.error || 'Unknown error'}`);
          return;
        }
        
        alert('Maintenance item deleted successfully!');
        window.location.href = 'maintenance.html';
      } catch (error) {
        console.error('Error deleting maintenance:', error);
        alert(`Delete failed: ${error.message || 'Network error'}`);
      }
    });
  }
}

// Setup edit maintenance modal
function setupEditMaintenanceModal() {
  const editModal = document.getElementById('edit-modal-overlay');
  const editForm = document.getElementById('edit-maintenance-form');
  const closeEditBtn = document.getElementById('close-edit-modal-btn');
  const cancelEditBtn = document.getElementById('cancel-edit-btn');
  
  function closeEditModal() {
    if (editModal) editModal.classList.remove('open');
  }
  
  if (closeEditBtn) {
    closeEditBtn.addEventListener('click', closeEditModal);
  }
  
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', closeEditModal);
  }
  
  if (editModal) {
    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) {
        closeEditModal();
      }
    });
  }
  
  // Form submit
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!currentMaintenanceItem) {
        alert('No maintenance item selected');
        return;
      }
      
      const formData = Object.fromEntries(new FormData(editForm).entries());
      
      const updatedMaintenance = {
        originalBranch: currentMaintenanceItem.branch,
        originalLocation: currentMaintenanceItem.location,
        originalItemName: currentMaintenanceItem.itemName,
        branch: formData.branch,
        location: formData.location,
        itemName: formData.itemName
      };
      
      try {
        const resp = await fetch('/api/maintenance/update', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(updatedMaintenance)
        });
        
        const data = await resp.json();
        
        if (!resp.ok || !data.ok) {
          alert(`Update failed: ${data.error || 'Unknown error'}`);
          return;
        }
        
        alert('Maintenance item updated successfully!');
        closeEditModal();
        // Reload page to reflect changes
        window.location.reload();
      } catch (error) {
        console.error('Error updating maintenance:', error);
        alert(`Update failed: ${error.message || 'Network error'}`);
      }
    });
  }
}

function openEditMaintenanceModal() {
  if (!currentMaintenanceItem) {
    alert('No maintenance item selected');
    return;
  }
  
  const editModal = document.getElementById('edit-modal-overlay');
  const editForm = document.getElementById('edit-maintenance-form');
  
  if (!editModal || !editForm) {
    console.error('Edit modal elements not found');
    return;
  }
  
  // Populate form with current values
  document.getElementById('edit-branch').value = currentMaintenanceItem.branch || '';
  document.getElementById('edit-location').value = currentMaintenanceItem.location || '';
  document.getElementById('edit-itemName').value = currentMaintenanceItem.itemName || '';
  
  editModal.classList.add('open');
}

// Setup assign staff modal
function setupAssignStaffModal() {
  const assignStaffModal = document.getElementById('assign-staff-modal-overlay');
  const closeAssignStaffBtn = document.getElementById('close-assign-staff-modal-btn');
  const cancelAssignStaffBtn = document.getElementById('cancel-assign-staff-btn');
  
  function closeAssignStaffModal() {
    if (assignStaffModal) assignStaffModal.classList.remove('open');
  }
  
  if (closeAssignStaffBtn) {
    closeAssignStaffBtn.addEventListener('click', closeAssignStaffModal);
  }
  
  if (cancelAssignStaffBtn) {
    cancelAssignStaffBtn.addEventListener('click', closeAssignStaffModal);
  }
  
  if (assignStaffModal) {
    assignStaffModal.addEventListener('click', (e) => {
      if (e.target === assignStaffModal) {
        closeAssignStaffModal();
      }
    });
  }
}

// Open assign staff modal
function openAssignStaffModal() {
  if (!currentMaintenanceItem || !currentMaintenanceItem._id) {
    alert('No maintenance item selected');
    return;
  }
  
  const assignStaffModal = document.getElementById('assign-staff-modal-overlay');
  if (assignStaffModal) {
    assignStaffModal.classList.add('open');
    loadStaffList();
  }
}

// Staff assignment state
let selectedStaffId = null;

// Load and display staff list
async function loadStaffList() {
  const staffListEl = document.getElementById('staff-list');
  if (!staffListEl) return;
  
  staffListEl.innerHTML = '<div style="text-align: center; padding: 2rem; color: #9ca3af;">Loading staff...</div>';
  
  try {
    const resp = await fetch('/api/maintenance/staff');
    const data = await resp.json();
    
    if (!resp.ok || !data.ok) {
      staffListEl.innerHTML = `<div style="text-align: center; padding: 2rem; color: #dc2626;">Error loading staff: ${data.error || 'Unknown error'}</div>`;
      return;
    }
    
    const staff = data.staff || [];
    
    if (staff.length === 0) {
      staffListEl.innerHTML = '<div style="text-align: center; padding: 2rem; color: #9ca3af;">No staff members found in the system.</div>';
      return;
    }
    
    // Display staff list
    staffListEl.innerHTML = staff.map(member => {
      const initial = (member.name || 'U').charAt(0).toUpperCase();
      const isSelected = selectedStaffId === member._id ? 'selected' : '';
      return `
        <div class="staff-list-item ${isSelected}" data-staff-id="${member._id}" data-staff-name="${escapeHtml(member.name || 'Unknown')}" style="display: flex; align-items: center; gap: 1rem; padding: 1rem; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 0.75rem; cursor: pointer; transition: all 0.2s; ${isSelected ? 'background: #eff6ff; border-color: #3b82f6;' : 'background: #ffffff;'}">
          <div class="staff-avatar" style="width: 40px; height: 40px; border-radius: 50%; background: #140958; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 1rem;">${initial}</div>
          <div class="staff-info" style="flex: 1;">
            <div class="staff-name" style="font-weight: 600; color: #1a1a1a; margin-bottom: 0.25rem;">${escapeHtml(member.name || 'Unknown')}</div>
            <div class="staff-email" style="font-size: 0.875rem; color: #6b7280;">${escapeHtml(member.email || '')}</div>
          </div>
        </div>
      `;
    }).join('');
    
    // Add click handlers to staff items
    staffListEl.querySelectorAll('.staff-list-item').forEach(item => {
      item.addEventListener('click', () => {
        // Remove previous selection
        staffListEl.querySelectorAll('.staff-list-item').forEach(i => {
          i.classList.remove('selected');
          i.style.background = '#ffffff';
          i.style.borderColor = '#e5e7eb';
        });
        // Select clicked item
        item.classList.add('selected');
        item.style.background = '#eff6ff';
        item.style.borderColor = '#3b82f6';
        selectedStaffId = item.dataset.staffId;
        const staffName = item.dataset.staffName;
        
        // Assign immediately when clicked
        assignStaffToMaintenance(selectedStaffId, staffName);
      });
    });
    
  } catch (error) {
    console.error('Error loading staff:', error);
    staffListEl.innerHTML = `<div style="text-align: center; padding: 2rem; color: #dc2626;">Error loading staff: ${error.message}</div>`;
  }
}

// Assign staff to maintenance task
async function assignStaffToMaintenance(staffId, staffName) {
  if (!currentMaintenanceItem || !currentMaintenanceItem._id) {
    alert('Cannot assign staff: Maintenance item not loaded');
    return;
  }
  
  try {
    const resp = await fetch('/api/maintenance/assign-staff', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        maintenanceId: currentMaintenanceItem._id,
        staffId: staffId
      })
    });
    
    const data = await resp.json();
    
    if (!resp.ok || !data.ok) {
      alert(`Error assigning staff: ${data.error || 'Unknown error'}`);
      return;
    }
    
    // Update current maintenance object
    currentMaintenanceItem.assignedStaffId = data.assignedStaff.id;
    currentMaintenanceItem.assignedStaffName = data.assignedStaff.name;
    currentMaintenanceItem.assignedStaffEmail = data.assignedStaff.email;
    
    // Close modal
    const modal = document.getElementById('assign-staff-modal-overlay');
    if (modal) {
      modal.classList.remove('open');
    }
    
    // Show success message
    alert(`Task assigned to ${data.assignedStaff.name} successfully!`);
    
  } catch (error) {
    console.error('Error assigning staff:', error);
    alert(`Error assigning staff: ${error.message}`);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  initAddScheduleElements();
  setupAddScheduleListeners();
  setupInspectionActions();
  setupEditMaintenanceModal();
  setupAssignStaffModal();
  loadMaintenanceItemFromURL();
});

// Event Listeners
function initializeEventListeners() {
  // Modal controls
  closeModalBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  inspectionModal.addEventListener('click', (e) => {
    if (e.target === inspectionModal) closeModal();
  });

  // Submit inspection
  submitBtn.addEventListener('click', submitInspection);
}

// Load maintenance item from URL parameters
async function loadMaintenanceItemFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const maintenanceId = urlParams.get('id');
  const branch = urlParams.get('branch');
  const location = urlParams.get('location');
  const itemName = urlParams.get('itemName');
  const frequency = urlParams.get('frequency');
  
  if (maintenanceId && branch && location && itemName && frequency) {
    // Set current maintenance item
    currentMaintenanceItem = {
      _id: maintenanceId,
      branch: branch,
      location: location,
      itemName: itemName,
      frequency: frequency
    };
    currentFrequency = frequency;
    
    // Load full maintenance item details to get inspection tasks and schedule
    try {
      const response = await fetch(`/api/maintenance/get?maintenanceId=${encodeURIComponent(maintenanceId)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.ok && data.maintenance) {
          // Update all fields from API response to ensure we have complete data
          currentMaintenanceItem.branch = data.maintenance.branch || branch;
          currentMaintenanceItem.location = data.maintenance.location || location;
          currentMaintenanceItem.itemName = data.maintenance.itemName || itemName;
          currentMaintenanceItem.inspectionTasks = data.maintenance.inspectionTasks || '';
          currentMaintenanceItem.maintenanceSchedule = data.maintenance.maintenanceSchedule || {};
          // Keep old inspectionTaskSchedules for migration purposes
          currentMaintenanceItem.inspectionTaskSchedules = data.maintenance.inspectionTaskSchedules || {};
          currentMaintenanceItem.frequency = data.maintenance.frequency || frequency;
          currentFrequency = data.maintenance.frequency || frequency;
          
          console.log('✓ Loaded maintenance item:', {
            id: currentMaintenanceItem._id,
            tasks: currentMaintenanceItem.inspectionTasks,
            hasOldSchedules: !!currentMaintenanceItem.inspectionTaskSchedules && Object.keys(currentMaintenanceItem.inspectionTaskSchedules).length > 0,
            oldScheduleKeys: Object.keys(currentMaintenanceItem.inspectionTaskSchedules || {})
          });
        }
      }
    } catch (error) {
      console.error('Error loading maintenance details:', error);
    }
    
    // Load maintenance assets (hardware items) for this maintenance item
    loadMaintenanceAssets(maintenanceId);
  } else {
    // No URL params, show error or redirect
    if (calendarGridContainer) {
      calendarGridContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3>No Maintenance Item Selected</h3>
          <p>Please select a maintenance item from the list page.</p>
          <a href="maintenance.html" style="margin-top: 1rem; display: inline-block; color: #140958; text-decoration: underline;">← Back to List</a>
        </div>
      `;
    }
    checklistFormContainer.classList.add('active');
  }
}

// Load maintenance assets (hardware items) for a specific maintenance item
async function loadMaintenanceAssets(maintenanceId) {
  // Show loading in the calendar grid container only (don't wipe out the form structure)
  if (calendarGridContainer) {
    calendarGridContainer.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading hardware items...</p>
      </div>
    `;
  }
  // Show the container
  checklistFormContainer.classList.add('active');
  
  try {
    const response = await fetch(`/api/maintenance/assets?maintenanceId=${maintenanceId}`);
    if (!response.ok) {
      throw new Error('Failed to load maintenance assets');
    }
    
    const data = await response.json();
    
    if (data.ok && data.assets && data.assets.length > 0) {
      // Convert assets to maintenance items format
      maintenanceItems = data.assets.map(asset => ({
        _id: asset.assetId || Math.random().toString(),
        itemName: asset.assetDescription || asset.assetId || 'Unknown Asset',
        branch: currentMaintenanceItem?.branch || 'HQ',
        location: currentMaintenanceItem?.location || 'Unknown',
        frequency: currentFrequency
      }));
      
      console.log('Maintenance assets loaded:', maintenanceItems.length);
      // Render immediately, load inspection data in background
      renderCalendarGrid();
      console.log('Checklist form container activated');
      // Load inspection data asynchronously (non-blocking)
      loadInspectionData().then(() => {
        // Re-render with inspection data
        renderCalendarGrid();
      });
    } else {
      // No assets found, but still show the checklist with inspection tasks
      console.log('No assets found, but displaying checklist with inspection tasks');
      
      // Parse inspection tasks from the maintenance item
      const inspectionTasks = currentMaintenanceItem?.inspectionTasks || '';
      const tasksList = inspectionTasks ? inspectionTasks.split('\n').filter(task => task.trim()) : [];
      
      if (tasksList.length > 0) {
        // Convert inspection tasks to maintenance items format
        maintenanceItems = tasksList.map((task, idx) => ({
          _id: `task-${idx}`,
          text: task.trim(),
          isTask: true
        }));
        
        // Render the calendar grid with inspection tasks
        renderCalendarGrid();
        checklistFormContainer.classList.add('active');
        
        // Load inspection data asynchronously
        loadAssetsForTaskMatching().then(() => {
      loadAssetsForTaskMatching().then(() => {
        loadInspectionData().then(() => {
          renderCalendarGrid();
        });
      });
        });
      } else {
        // No inspection tasks either, show empty state
        if (calendarGridContainer) {
          calendarGridContainer.innerHTML = `
            <div class="empty-state">
              <div class="empty-state-icon">📋</div>
              <h3>No Inspection Tasks Found</h3>
              <p>This maintenance item has no inspection tasks defined. Please add inspection tasks first.</p>
            </div>
          `;
        }
        checklistFormContainer.classList.add('active');
      }
    }
  } catch (error) {
    console.error('Error loading maintenance assets:', error);
    if (calendarGridContainer) {
      calendarGridContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3>Error Loading Data</h3>
          <p>${error.message || 'Failed to load data. Please try again.'}</p>
        </div>
      `;
    }
  }
}

// Load maintenance items (hardware) for the selected frequency
async function loadMaintenanceItems() {
  // Show loading in the calendar grid container only (don't wipe out the form structure)
  if (calendarGridContainer) {
    calendarGridContainer.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading maintenance items...</p>
      </div>
    `;
  }
  // Show the container
  checklistFormContainer.classList.add('active');

  try {
    const response = await fetch(`/api/maintenance/list?frequency=${currentFrequency}`);
    if (!response.ok) {
      throw new Error('Failed to load maintenance items');
    }
    
    const data = await response.json();
    
    if (data.ok && data.maintenance && data.maintenance.length > 0) {
      maintenanceItems = data.maintenance;
      console.log('Maintenance items loaded:', maintenanceItems.length);
      // Render immediately, load inspection data in background
      renderCalendarGrid();
      checklistFormContainer.classList.add('active');
      console.log('Checklist form container activated');
      // Load inspection data asynchronously (non-blocking)
      loadInspectionData().then(() => {
        // Re-render with inspection data
        renderCalendarGrid();
      });
    } else {
      // No maintenance items, try loading from assets
      console.log('No maintenance items found, loading assets as hardware items...');
      loadAssetsAsHardware();
    }
  } catch (error) {
    console.error('Error loading maintenance items:', error);
    // Fallback: load assets as hardware items
    console.log('Falling back to loading assets as hardware items...');
    loadAssetsAsHardware();
  }
}

// Load assets as hardware items (fallback)
async function loadAssetsAsHardware() {
  try {
    const response = await fetch('/api/assets/list');
    if (!response.ok) {
      throw new Error('Failed to load assets');
    }
    
    const data = await response.json();
    
    if (data.ok && data.assets && data.assets.length > 0) {
      // Convert assets to maintenance items format
      maintenanceItems = data.assets.map(asset => ({
        _id: asset.assetId || Math.random().toString(),
        itemName: asset.assetDescription || asset.assetId || 'Unknown Asset',
        branch: currentMaintenanceItem?.branch || 'HQ',
        location: currentMaintenanceItem?.location || 'Unknown',
        frequency: currentFrequency
      }));
      
      console.log('Assets loaded as hardware items:', maintenanceItems.length);
      // Render immediately, load inspection data in background
      renderCalendarGrid();
      checklistFormContainer.classList.add('active');
      console.log('Checklist form container activated');
      // Load inspection data asynchronously (non-blocking)
      loadInspectionData().then(() => {
        // Re-render with inspection data
        renderCalendarGrid();
      });
    } else {
      if (calendarGridContainer) {
        calendarGridContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <h3>No Maintenance Items Found</h3>
            <p>Please create maintenance items or add assets first.</p>
          </div>
        `;
      }
      checklistFormContainer.classList.add('active');
    }
  } catch (error) {
    console.error('Error loading assets:', error);
    if (calendarGridContainer) {
      calendarGridContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3>Error Loading Data</h3>
          <p>${error.message || 'Failed to load data. Please try again.'}</p>
        </div>
      `;
    }
    checklistFormContainer.classList.add('active');
  }
}

// Load assets for matching tasks to assets by locationDescription
async function loadAssetsForTaskMatching() {
  if (assetsCache) {
    return; // Already loaded
  }
  
  try {
    const assetsResp = await fetch('/api/assets/list');
    const assetsData = await assetsResp.json();
    if (assetsResp.ok && assetsData.ok && assetsData.assets) {
      assetsCache = assetsData.assets;
      console.log(`✓ Loaded ${assetsCache.length} assets for task matching`);
    }
  } catch (error) {
    console.warn('Could not load assets for task matching:', error);
    assetsCache = []; // Set empty array to avoid repeated fetches
  }
}

// Load inspection data for current year and frequency
async function loadInspectionData() {
  try {
    // Load assets for task matching first
    await loadAssetsForTaskMatching();
    
    // Load inspections for the current maintenance item
    // Each scheduled date should have its own inspection report
    if (!currentMaintenanceItem?._id) {
      console.log('No maintenance item selected, skipping inspection data load');
      inspectionData.clear();
      return Promise.resolve();
    }
    
    const maintenanceId = currentMaintenanceItem._id;
    
    // Load all inspections for this maintenance item from maintenance_assets collection
    // We'll filter by maintenanceId and group by inspectionDate
    const fetchPromise = fetch(`/api/maintenance/assets?maintenanceId=${encodeURIComponent(maintenanceId)}`);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 5000)
    );
    
    const response = await Promise.race([fetchPromise, timeoutPromise]);
    
    if (response.ok) {
      const data = await response.json();
      if (data.ok && data.assets && Array.isArray(data.assets)) {
        inspectionData.clear();
        
        // Process each inspection record
        // Each record represents one inspection for one asset on one specific date
        data.assets.forEach(ma => {
          if (!ma.assetId || !ma.inspectionDate) {
            return; // Skip invalid records
          }
          
          // Normalize date format to YYYY-MM-DD
          let normalizedDate;
          if (ma.inspectionDate instanceof Date) {
            normalizedDate = ma.inspectionDate.toISOString().split('T')[0];
          } else if (typeof ma.inspectionDate === 'string') {
            normalizedDate = ma.inspectionDate.includes('T') ? ma.inspectionDate.split('T')[0] : ma.inspectionDate;
          } else {
            console.warn('Invalid inspectionDate format:', ma.inspectionDate);
            return;
          }
          
          // Create key: date-assetId (each date has its own inspection report)
          const key = `${normalizedDate}-${ma.assetId}`;
          
          // Map status: 'fault' or 'abnormal' -> 'fault', otherwise 'normal'
          const status = ma.status === 'fault' || ma.status === 'abnormal' ? 'fault' : (ma.status || 'normal');
          
          // Store inspection data - if multiple inspections exist for same date+asset, keep the latest one
          // (based on createdAt/updatedAt)
          const existing = inspectionData.get(key);
          if (!existing || (ma.updatedAt && existing.updatedAt && new Date(ma.updatedAt) > new Date(existing.updatedAt))) {
            inspectionData.set(key, {
              status: status, // 'normal' or 'fault' (fault condition)
              inspectionStatus: ma.inspectionStatus || 'complete', // 'complete' when inspection is done
              remarks: ma.inspectionNotes || ma.notes || '',
              date: normalizedDate,
              updatedAt: ma.updatedAt || ma.createdAt,
              createdAt: ma.createdAt
            });
          }
        });
        
        console.log(`✓ Loaded ${inspectionData.size} inspection records from maintenance_assets collection`);
        console.log(`  Maintenance ID: ${maintenanceId}`);
        console.log(`  Each date has its own inspection report`);
      } else {
        console.log('No inspection data found for this maintenance item');
        inspectionData.clear();
      }
    } else if (response.status === 404) {
      // No inspections found yet - this is normal for new checklists
      console.log('No inspection data found for this maintenance item - starting fresh');
      inspectionData.clear();
    }
  } catch (error) {
    // Timeout or other error - just start with empty inspection data
    console.log('Skipping inspection data load (timeout or error), starting fresh:', error.message);
    inspectionData.clear();
  }
  return Promise.resolve();
}

// Render calendar grid (PKT Format)
async function renderCalendarGrid() {
  console.log('renderCalendarGrid called, maintenanceItems:', maintenanceItems.length);
  
  if (!maintenanceItems || maintenanceItems.length === 0) {
    console.error('No maintenance items to render');
    if (calendarGridContainer) {
      calendarGridContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <h3>No Hardware Items Found</h3>
          <p>Please add assets or maintenance items first.</p>
        </div>
      `;
    }
    return;
  }
  
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  
  const monthAbbreviations = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Load inspection tasks from separate collection
  let inspectionTaskSchedules = {};
  if (currentMaintenanceItem?._id) {
    try {
      const url = `/api/maintenance/inspection-tasks?maintenanceId=${encodeURIComponent(currentMaintenanceItem._id)}`;
      console.log('Loading inspection tasks from:', url);
      
      const response = await fetch(url);
      console.log('Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn('⚠ API endpoint not found (404). Make sure server is running and routes are registered.');
        } else {
          const errorText = await response.text();
          console.error('✗ HTTP error loading inspection tasks:', response.status, errorText);
        }
      } else {
        const data = await response.json();
        console.log('Response data:', data);
        
        if (data.ok && data.tasks && data.tasks.length > 0) {
          // Convert array of tasks to object keyed by taskName
          data.tasks.forEach(task => {
            if (task.taskName && task.schedule) {
              inspectionTaskSchedules[task.taskName] = task.schedule;
            }
          });
          console.log(`✓ Loaded ${data.tasks.length} task(s) from new collection`);
          console.log('Task schedules:', Object.keys(inspectionTaskSchedules));
        } else {
          console.log('✗ No tasks found in new collection (response ok but empty)');
        }
      }
    } catch (error) {
      console.error('✗ Exception loading inspection tasks from collection:', error);
      console.error('Error details:', error.message, error.stack);
    }
    
    // Migration: If new collection is empty but old inspectionTaskSchedules exists, migrate them
    if (Object.keys(inspectionTaskSchedules).length === 0 && currentMaintenanceItem?.inspectionTaskSchedules) {
      const oldSchedules = currentMaintenanceItem.inspectionTaskSchedules;
      const oldScheduleKeys = Object.keys(oldSchedules);
      
      console.log('⚠ Migration needed: Found old inspectionTaskSchedules');
      console.log(`  Old schedule keys:`, oldScheduleKeys);
      console.log(`  Old schedules:`, JSON.stringify(oldSchedules, null, 2));
      
      // Use old schedules for immediate display while migration happens in background
      if (oldScheduleKeys.length > 0) {
        inspectionTaskSchedules = { ...oldSchedules };
        console.log(`✓ Using ${oldScheduleKeys.length} old schedule(s) for display, migrating in background...`);
      }
      
      // Migrate each task schedule to new collection (properly await all promises)
      const migrationPromises = Object.keys(oldSchedules).map(async (taskName) => {
        if (oldSchedules[taskName]) {
          try {
            console.log(`🔄 Migrating schedule for "${taskName}"...`);
            const migrateResponse = await fetch('/api/maintenance/inspection-task', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({
                maintenanceId: currentMaintenanceItem._id,
                taskName: taskName,
                schedule: oldSchedules[taskName]
              })
            });
            
            if (!migrateResponse.ok) {
              const errorText = await migrateResponse.text();
              console.error(`✗ HTTP error ${migrateResponse.status} migrating "${taskName}":`, errorText);
              return { success: false, taskName, error: `HTTP ${migrateResponse.status}` };
            }
            
            const migrateData = await migrateResponse.json();
            if (migrateData.ok) {
              console.log(`✓ Successfully migrated schedule for "${taskName}" to new collection`);
              return { success: true, taskName };
            } else {
              console.error(`✗ Failed to migrate schedule for "${taskName}":`, migrateData.error);
              return { success: false, taskName, error: migrateData.error };
            }
          } catch (error) {
            console.error(`✗ Error migrating task "${taskName}":`, error);
            return { success: false, taskName, error: error.message };
          }
        }
        return { success: false, taskName, error: 'No schedule data' };
      });
      
      // Wait for all migrations to complete and log results
      Promise.all(migrationPromises).then(results => {
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        console.log(`📊 Migration complete: ${successful} succeeded, ${failed} failed`);
        if (failed > 0) {
          console.error('Failed migrations:', results.filter(r => !r.success));
        }
        if (successful > 0) {
          console.log('✓ Collection "inspection_tasks" has been created in MongoDB');
        }
      }).catch(error => {
        console.error('Error during migration:', error);
      });
    }
  }
  
  const maintenanceSchedule = currentMaintenanceItem?.maintenanceSchedule || {};
  
  console.log('=== SCHEDULE DATA CHECK ===');
  console.log('Inspection task schedules (from separate collection):', JSON.stringify(inspectionTaskSchedules, null, 2));
  console.log('Number of task schedules:', Object.keys(inspectionTaskSchedules).length);
  console.log('Maintenance schedule (for hardware only, NOT for tasks):', JSON.stringify(maintenanceSchedule, null, 2));
  console.log('Current year:', currentYear);
  console.log('Current frequency:', currentFrequency);
  
  // Generate default monthDates for table header structure
  // Use maintenanceSchedule as fallback, or combine all task schedules to determine max columns
  // CRITICAL: For quarterly, header should ONLY show dates in the month where they actually fall
  // IMPORTANT: If we have task schedules, use ONLY those (they're in correct format)
  // Don't use maintenanceSchedule if it has wrong format (month names instead of quarter names)
  
  // ALL frequencies now use the same structure: 12 months with 4 week columns each
  // monthDates is still used for extracting dates, but header is always 4 columns per month
  const allTaskSchedules = Object.values(inspectionTaskSchedules);
  let monthDates;
  
  // Build monthDates for date extraction (used for placing dates in correct weeks)
  if (allTaskSchedules.length > 0) {
    // Use ONLY task schedules to extract dates
    console.log(`=== EXTRACTING DATES from ${allTaskSchedules.length} task schedule(s) ===`);
    monthDates = months.map((month, monthIdx) => {
      const allDates = new Set();
      
      // Get dates from each task schedule
      allTaskSchedules.forEach((taskSchedule, taskIdx) => {
        const taskDates = extractDatesForMonth(month, currentYear, taskSchedule, currentFrequency);
        console.log(`  Task schedule ${taskIdx} for ${month}:`, taskDates.map(d => d.getDate()));
        taskDates.forEach(d => allDates.add(d.toISOString().split('T')[0]));
      });
      
      // Convert back to Date objects and sort
      const finalDates = Array.from(allDates)
        .map(dateStr => new Date(dateStr))
        .sort((a, b) => a - b);
      
      console.log(`  Final dates for ${month}:`, finalDates.map(d => d.getDate()));
      return finalDates;
    });
  } else {
    // Fallback to maintenanceSchedule only if no task schedules exist
    console.log('=== EXTRACTING DATES from maintenanceSchedule (no task schedules found) ===');
    monthDates = months.map(month => {
      return extractDatesForMonth(month, currentYear, maintenanceSchedule, currentFrequency);
    });
  }
  
  console.log('=== FINAL EXTRACTED DATES ===');
  monthDates.forEach((dates, idx) => {
    console.log(`  ${months[idx]}:`, dates.map(d => d.getDate()));
  });

  // Build form header info
  const currentDate = new Date();
  const currentMonth = monthAbbreviations[currentDate.getMonth()];
  
  formHeaderInfo.innerHTML = `
    <div class="form-header-info-item">
      <strong>Company Name:</strong>
      <span>PKT LOGISTICS (M) SDN BHD</span>
    </div>
    <div class="form-header-info-item">
      <strong>Branch:</strong>
      <span>${escapeHtml(currentMaintenanceItem?.branch || maintenanceItems[0]?.branch || 'HQ - SHAH ALAM')}</span>
    </div>
    <div class="form-header-info-item">
      <strong>Location:</strong>
      <span>${escapeHtml(currentMaintenanceItem?.location || maintenanceItems[0]?.location || 'SERVER ROOM')}</span>
    </div>
    <div class="form-header-info-item">
      <strong>Item Name:</strong>
      <span>${escapeHtml(currentMaintenanceItem?.itemName || maintenanceItems[0]?.itemName || 'PKT SERVERS')}</span>
    </div>
    <div class="form-header-info-item">
      <strong>Form No:</strong>
      <span>PKT-PMT1</span>
    </div>
    <div class="form-header-info-item">
      <strong>Rev. No:</strong>
      <span>02</span>
    </div>
    <div class="form-header-info-item">
      <strong>Effective Date:</strong>
      <span>${formatDate(new Date())}</span>
    </div>
    <div class="form-header-info-item">
      <strong>Month:</strong>
      <span>${currentMonth}</span>
    </div>
    <div class="form-header-info-item">
      <strong>Year:</strong>
      <span>${currentYear}</span>
    </div>
    <div class="form-header-info-item">
      <strong>Checklist Frequency:</strong>
      <span>${currentFrequency}</span>
    </div>
  `;

  // Build table HTML
  // ALL frequencies now use the same structure: 12 months, each with 4 week columns
  // This matches the form format shown in the image
  let tableHTML = `
    <div class="calendar-grid-wrapper">
      <table class="calendar-grid">
        <colgroup>
          <col style="width: 50px;">
          <col style="width: auto;">
        </colgroup>
        <thead>
          <tr>
            <th class="hardware-col">NO</th>
            <th class="hardware-col">INSPECTION LIST</th>
            ${months.map(month => {
              const monthAbbr = monthAbbreviations[months.indexOf(month)];
              return `<th class="month-header" colspan="4">${monthAbbr}</th>`;
            }).join('')}
          </tr>
          <tr>
            <th class="hardware-col"></th>
            <th class="hardware-col"></th>
            ${months.map(() => {
              return '<th class="date-header">1</th><th class="date-header">2</th><th class="date-header">3</th><th class="date-header">4</th>';
            }).join('')}
          </tr>
        </thead>
        <tbody>
  `;

  // Get inspection tasks from maintenance item
  const inspectionTasks = currentMaintenanceItem?.inspectionTasks || '';
  const tasksList = inspectionTasks ? inspectionTasks.split('\n').filter(t => t.trim()) : [];
  
  // Use inspection tasks if available, otherwise fall back to hardware items
  const itemsToDisplay = tasksList.length > 0 ? tasksList.map((task, idx) => ({ 
    _id: `task-${idx}`, 
    text: task.trim(),
    isTask: true
  })) : maintenanceItems;
  
  // Add rows for each item (inspection task or hardware item)
  itemsToDisplay.forEach((item, index) => {
    const itemId = item._id || item.assetId || `item-${index}`;
    const displayText = item.text || item.itemName || item.assetDescription || 'Unknown';
    
    // Build link URL for inspection task
    const taskLink = item.isTask && currentMaintenanceItem?._id 
      ? `inspection_task_detail.html?maintenanceId=${encodeURIComponent(currentMaintenanceItem._id)}&taskIndex=${index}&taskText=${encodeURIComponent(displayText)}`
      : '#';
    
    // Function to handle task click - initialize pending inspections then navigate
    const taskClickHandler = item.isTask && currentMaintenanceItem?._id
      ? `onclick="handleTaskClick(event, '${encodeURIComponent(currentMaintenanceItem._id)}', '${encodeURIComponent(displayText)}', '${taskLink}'); return false;"`
      : '';
    
    // Item row
    tableHTML += `
      <tr>
        <td class="hardware-cell no-cell">${index + 1}</td>
        <td class="hardware-cell">
          ${item.isTask && currentMaintenanceItem?._id 
            ? `<a href="${taskLink}" ${taskClickHandler} style="color: #140958; text-decoration: none; cursor: pointer; transition: color 0.15s;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${escapeHtml(displayText)}</a>`
            : escapeHtml(displayText)
          }
        </td>
    `;

    // Get schedule for this specific task (if it's a task)
    // Each task MUST have its own schedule in the new collection - NO fallback to maintenanceSchedule
    // This ensures complete separation - editing one task never affects another
    let taskSchedule = null;
    
    if (item.isTask) {
      // Try exact match first
      if (inspectionTaskSchedules[displayText]) {
        taskSchedule = inspectionTaskSchedules[displayText];
      } else {
        // Try trimmed match (in case of whitespace differences)
        const trimmedDisplayText = displayText.trim();
        if (inspectionTaskSchedules[trimmedDisplayText]) {
          taskSchedule = inspectionTaskSchedules[trimmedDisplayText];
        } else {
          // Try to find by checking all keys
          const matchingKey = Object.keys(inspectionTaskSchedules).find(key => 
            key.trim() === displayText.trim() || key.trim() === trimmedDisplayText
          );
          if (matchingKey) {
            taskSchedule = inspectionTaskSchedules[matchingKey];
          }
          // If no match found, taskSchedule remains null - task has no schedule yet
          // This ensures complete separation - no shared schedules
        }
      }
      
      // Debug: Log the schedule being used for this task
      console.log(`Task: "${displayText}"`);
      console.log(`Available task schedules:`, Object.keys(inspectionTaskSchedules));
      if (taskSchedule) {
        console.log(`✓ Task has its own schedule:`, JSON.stringify(taskSchedule, null, 2));
      } else {
        console.log(`✗ Task has NO schedule yet - will show empty dates until schedule is added`);
      }
    } else {
      // For non-task items (hardware), use maintenanceSchedule
      taskSchedule = maintenanceSchedule;
    }
    
    // Generate dates for this specific task
    console.log(`========================================`);
    console.log(`Generating dates for task "${displayText}"`);
    console.log(`Frequency: ${currentFrequency}`);
    console.log(`Schedule object:`, JSON.stringify(taskSchedule, null, 2));
    console.log(`Schedule keys:`, Object.keys(taskSchedule || {}));
    console.log(`========================================`);
    
    const taskMonthDates = months.map(month => {
      const dates = extractDatesForMonth(month, currentYear, taskSchedule, currentFrequency);
      if (item.isTask) {
        if (dates.length > 0) {
          console.log(`  ✓ ${month} dates found:`, dates.map(d => `${d.getDate()} (${d.toISOString().split('T')[0]})`));
        } else {
          console.log(`  ✗ ${month} dates: NONE (schedule might be empty or dates don't match)`);
        }
      }
      return dates;
    });
    
    console.log(`========================================`);
    console.log(`FINAL RESULT for task "${displayText}":`);
    taskMonthDates.forEach((dates, idx) => {
      console.log(`  ${months[idx]}: ${dates.length} date(s) -`, dates.map(d => d.getDate()));
    });
    console.log(`========================================`);
    
    // Add date cells for each month using task-specific dates
    // ALL frequencies now use the same structure: 4 week columns per month
    months.forEach((month, monthIdx) => {
      const dates = taskMonthDates[monthIdx];
      
      // Calculate which week each date falls into (1-4)
      // Week 1: days 1-7, Week 2: days 8-14, Week 3: days 15-21, Week 4: days 22-31
      const weekCells = [null, null, null, null]; // Week 1, 2, 3, 4
      
      dates.forEach(date => {
        const day = date.getDate();
        let weekIndex;
        if (day <= 7) {
          weekIndex = 0; // Week 1
        } else if (day <= 14) {
          weekIndex = 1; // Week 2
        } else if (day <= 21) {
          weekIndex = 2; // Week 3
        } else {
          weekIndex = 3; // Week 4 (days 22-31)
        }
        
        const dateKey = formatDateForStorage(date);
        const inspectionKey = `${dateKey}-${itemId}`;
        const inspection = inspectionData.get(inspectionKey);
        
        // Check completion for THIS SPECIFIC TASK only (not all tasks)
        // Each task should be checked independently
        const completionStatus = checkTaskCompleteForDate(
          dateKey, 
          itemId,
          displayText,
          inspectionData,
          item
        );
        const cellClass = getDateCellClass(date, inspection, completionStatus.allComplete, completionStatus.hasFault);
        
        // If multiple dates fall in same week, keep the first one (or you could combine them)
        if (!weekCells[weekIndex]) {
          weekCells[weekIndex] = {
            dateKey,
            inspectionKey,
            inspection,
            cellClass,
            day
          };
        }
      });
      
      // Render 4 week columns for this month
      for (let weekIdx = 0; weekIdx < 4; weekIdx++) {
        const weekData = weekCells[weekIdx];
        if (weekData) {
          tableHTML += `
            <td>
              <div class="date-cell ${weekData.cellClass}" 
                   data-date="${weekData.dateKey}" 
                   data-hardware-id="${itemId}"
                   data-hardware-name="${escapeHtml(displayText)}"
                   onclick="handleDateClick(this)">
                ${weekData.day}
              </div>
            </td>
          `;
        } else {
          tableHTML += `<td></td>`;
        }
      }
    });

    tableHTML += `</tr>`;
    
    // Add "+" button row only after the last item - for adding NEW inspection task
    if (index === itemsToDisplay.length - 1) {
      tableHTML += `
        <tr class="add-schedule-row">
          <td class="hardware-cell no-cell"></td>
          <td class="hardware-cell">
            <button class="add-schedule-row-btn" onclick="openScheduleModal('', '')" title="Add New Inspection Task">
              <span class="add-icon">＋</span>
            </button>
          </td>
      `;
      
      // Add empty cells for date columns - 4 week columns per month (all frequencies)
      months.forEach(() => {
        for (let weekIdx = 0; weekIdx < 4; weekIdx++) {
          tableHTML += `<td></td>`;
        }
      });
      
      tableHTML += `</tr>`;
    }
  });

  tableHTML += `
        </tbody>
      </table>
    </div>
  `;

  console.log('Setting calendar grid HTML, table length:', tableHTML.length, 'items:', maintenanceItems.length);
  if (!calendarGridContainer) {
    console.error('calendarGridContainer not found!');
    return;
  }
  calendarGridContainer.innerHTML = tableHTML;
  console.log('Calendar grid rendered successfully');
}

// Generate weekly dates for a month
function generateWeeklyDatesForMonth(monthName, year) {
  const monthIndex = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'].indexOf(monthName);
  const dates = [];
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  
  if (currentFrequency === 'Weekly') {
    // Generate weekly dates (every 7 days, typically same day of week)
    // For weekly, we'll use specific dates like 1st, 8th, 15th, 22nd, 29th (or last day of month)
    const weekDays = [1, 8, 15, 22];
    
    weekDays.forEach(day => {
      if (day <= lastDay.getDate()) {
        const date = new Date(year, monthIndex, day);
        dates.push(date);
      }
    });
    
    // Add 29th if it exists in the month
    if (29 <= lastDay.getDate()) {
      dates.push(new Date(year, monthIndex, 29));
    } else if (lastDay.getDate() >= 28) {
      // Use last day if month has 28-30 days
      dates.push(new Date(year, monthIndex, lastDay.getDate()));
    }
  } else if (currentFrequency === 'Monthly') {
    // Monthly: use 15th of each month
    dates.push(new Date(year, monthIndex, 15));
  } else if (currentFrequency === 'Quarterly') {
    // Quarterly: use 15th of February, May, July, October (2nd month of each quarter)
    // Q1: February (monthIndex 1), Q2: May (monthIndex 4), Q3: July (monthIndex 6), Q4: October (monthIndex 9)
    if (monthIndex === 1 || monthIndex === 4 || monthIndex === 6 || monthIndex === 9) {
      dates.push(new Date(year, monthIndex, 15));
    }
  }
  
  return dates;
}

// Extract actual dates from maintenance schedule for a specific month
function extractDatesForMonth(monthName, year, maintenanceSchedule, frequency) {
  const monthIndex = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'].indexOf(monthName);
  const dates = [];
  
  // Debug for quarterly
  if (frequency === 'Quarterly') {
    console.log(`[extractDatesForMonth] month=${monthName} (index=${monthIndex}), schedule:`, JSON.stringify(maintenanceSchedule, null, 2));
  }
  
  if (!maintenanceSchedule || typeof maintenanceSchedule !== 'object') {
    if (frequency === 'Quarterly') {
      console.log(`[extractDatesForMonth] No schedule or invalid schedule object for ${monthName}`);
    }
    return dates;
  }
  
  if (frequency === 'Weekly') {
    // For weekly, schedule structure: { "January": { "Week1": "2025-01-15", "Week2": "2025-01-22", ... }, ... }
    const monthSchedule = maintenanceSchedule[monthName];
    if (monthSchedule && typeof monthSchedule === 'object') {
      console.log(`[extractDatesForMonth] Weekly - Processing ${monthName} (year ${year}), schedule:`, monthSchedule);
      // Extract all dates from the month schedule
      Object.keys(monthSchedule).forEach(weekKey => {
        const dateStr = monthSchedule[weekKey];
        if (dateStr) {
          // Normalize date string (remove time if present)
          let normalizedDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
          
          // Parse the date to extract the day
          const dateParts = normalizedDateStr.split('-');
          if (dateParts.length === 3) {
            const inputDay = parseInt(dateParts[2], 10);
            // Validate day is between 1-31
            if (!isNaN(inputDay) && inputDay >= 1 && inputDay <= 31) {
              // Create date using the requested year and month, with the day from input
              const adjustedDate = new Date(year, monthIndex, inputDay);
              // Validate the date was created correctly (handles invalid days like Feb 30)
              if (adjustedDate.getMonth() === monthIndex && adjustedDate.getDate() === inputDay) {
                dates.push(adjustedDate);
                console.log(`  ✓ Added date: ${weekKey} -> ${normalizedDateStr} (day ${inputDay}) -> ${adjustedDate.toISOString().split('T')[0]}`);
              } else {
                console.log(`  ✗ Invalid date: ${weekKey} -> day ${inputDay} in ${monthName} ${year}`);
              }
            }
          } else {
            // Fallback to Date parsing if format is different
            const date = new Date(normalizedDateStr);
            if (!isNaN(date.getTime())) {
              // Use the day from the stored date, apply to requested year/month
              const adjustedDate = new Date(year, monthIndex, date.getDate());
              if (adjustedDate.getMonth() === monthIndex) {
                dates.push(adjustedDate);
                console.log(`  ✓ Added date (fallback): ${weekKey} -> ${normalizedDateStr} -> ${adjustedDate.toISOString().split('T')[0]}`);
              }
            }
          }
        }
      });
      // Sort dates
      dates.sort((a, b) => a.getTime() - b.getTime());
      console.log(`[extractDatesForMonth] Weekly - ${monthName}: Found ${dates.length} dates`);
    } else {
      console.log(`[extractDatesForMonth] Weekly - ${monthName}: No schedule found`);
    }
  } else if (frequency === 'Monthly') {
    // For monthly, schedule structure: { "January": "2025-01-15", "February": "2025-02-15", ... }
    const dateStr = maintenanceSchedule[monthName];
    if (dateStr) {
      console.log(`[extractDatesForMonth] Monthly - Processing ${monthName} (year ${year}), date string: "${dateStr}"`);
      // Normalize date string (remove time if present)
      let normalizedDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      
      // Parse the date to extract the day
      const dateParts = normalizedDateStr.split('-');
      if (dateParts.length === 3) {
        const inputDay = parseInt(dateParts[2], 10);
        // Validate day is between 1-31
        if (!isNaN(inputDay) && inputDay >= 1 && inputDay <= 31) {
          // Create date using the requested year and month, with the day from input
          const adjustedDate = new Date(year, monthIndex, inputDay);
          // Validate the date was created correctly (handles invalid days like Feb 30)
          if (adjustedDate.getMonth() === monthIndex && adjustedDate.getDate() === inputDay) {
            dates.push(adjustedDate);
            console.log(`  ✓ Added date: ${normalizedDateStr} (day ${inputDay}) -> ${adjustedDate.toISOString().split('T')[0]}`);
          } else {
            console.log(`  ✗ Invalid date: day ${inputDay} in ${monthName} ${year}`);
          }
        }
      } else {
        // Fallback to Date parsing if format is different
        const date = new Date(normalizedDateStr);
        if (!isNaN(date.getTime())) {
          // Use the day from the stored date, apply to requested year/month
          const adjustedDate = new Date(year, monthIndex, date.getDate());
          if (adjustedDate.getMonth() === monthIndex) {
            dates.push(adjustedDate);
            console.log(`  ✓ Added date (fallback): ${normalizedDateStr} -> ${adjustedDate.toISOString().split('T')[0]}`);
          }
        }
      }
      console.log(`[extractDatesForMonth] Monthly - ${monthName}: Found ${dates.length} dates`);
    } else {
      console.log(`[extractDatesForMonth] Monthly - ${monthName}: No date string found`);
    }
  } else if (frequency === 'Quarterly') {
    // ========================================
    // QUARTERLY: COMPLETE REWRITE - SIMPLE & CORRECT
    // ========================================
    // Rule: ONE date per quarter, shown ONLY in the month where it actually falls
    // Example: Q1 = "2026-02-16" → shows "16" ONLY in February, Jan and Mar are EMPTY
    
    // Define quarters and their months
    const quarters = [
      { keys: ['Q1 (Jan-Mar)', 'Q1'], months: [0, 1, 2] },   // Q1: Jan(0), Feb(1), Mar(2)
      { keys: ['Q2 (Apr-Jun)', 'Q2'], months: [3, 4, 5] },   // Q2: Apr(3), May(4), Jun(5)
      { keys: ['Q3 (Jul-Sep)', 'Q3'], months: [6, 7, 8] },   // Q3: Jul(6), Aug(7), Sep(8)
      { keys: ['Q4 (Oct-Dec)', 'Q4'], months: [9, 10, 11] }  // Q4: Oct(9), Nov(10), Dec(11)
    ];
    
    // Find which quarter contains the requested month
    const quarter = quarters.find(q => q.months.includes(monthIndex));
    if (!quarter) {
      return dates; // Month not in any quarter (shouldn't happen)
    }
    
    // Try to find the quarter schedule (support both "Q1 (Jan-Mar)" and "Q1" formats)
    let quarterDateStr = null;
    for (const key of quarter.keys) {
      if (maintenanceSchedule[key]) {
        quarterDateStr = maintenanceSchedule[key];
        break;
      }
    }
    
    if (!quarterDateStr) {
      return dates; // No schedule for this quarter
    }
    
    // Parse the date string
    let dateStr = quarterDateStr;
    if (typeof dateStr !== 'string') {
      return dates; // Invalid format
    }
    
    // Normalize date string (remove time if present)
    dateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    
    // Handle DD/MM/YYYY format if needed
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const yr = parseInt(parts[2], 10);
        if (day > 0 && day <= 31 && month > 0 && month <= 12 && yr > 0) {
          dateStr = `${yr}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      }
    }
    
    // Parse YYYY-MM-DD format
    const dateParts = dateStr.split('-');
    if (dateParts.length !== 3) {
      return dates; // Invalid format
    }
    
    const dateYear = parseInt(dateParts[0], 10);
    const dateMonth = parseInt(dateParts[1], 10) - 1; // JavaScript months are 0-based
    const dateDay = parseInt(dateParts[2], 10);
    
    // Validate
    if (isNaN(dateYear) || isNaN(dateMonth) || isNaN(dateDay) ||
        dateMonth < 0 || dateMonth > 11 || dateDay < 1 || dateDay > 31) {
      return dates; // Invalid date
    }
    
    // CRITICAL CHECK: Only add date if it falls in the requested month
    if (dateMonth === monthIndex) {
      // Create date for display
      const displayDate = new Date(year, monthIndex, dateDay);
      if (displayDate.getMonth() === monthIndex && displayDate.getDate() === dateDay) {
        dates.push(displayDate);
      }
    }
    // If dateMonth !== monthIndex, don't add anything (return empty array)
  }
  
  // Return dates array (empty if no dates found)
  return dates;
}

// Check if all tasks for a specific date are complete
function checkAllTasksCompleteForDate(dateKey, itemsToDisplay, inspectionData, inspectionTaskSchedules, maintenanceSchedule, frequency, year) {
  const targetDate = new Date(dateKey);
  const targetDateKey = formatDateForStorage(targetDate);
  
  // Get all tasks/items that have this date scheduled
  const tasksForDate = [];
  
  itemsToDisplay.forEach((item, index) => {
    const itemId = item._id || item.assetId || `item-${index}`;
    const displayText = item.text || item.itemName || item.assetDescription || 'Unknown';
    
    // Get schedule for this task/item
    let taskSchedule = null;
    if (item.isTask) {
      // Try to find task schedule
      if (inspectionTaskSchedules[displayText]) {
        taskSchedule = inspectionTaskSchedules[displayText];
      } else {
        const trimmedDisplayText = displayText.trim();
        if (inspectionTaskSchedules[trimmedDisplayText]) {
          taskSchedule = inspectionTaskSchedules[trimmedDisplayText];
        } else {
          const matchingKey = Object.keys(inspectionTaskSchedules).find(key => 
            key.trim() === displayText.trim() || key.trim() === trimmedDisplayText
          );
          if (matchingKey) {
            taskSchedule = inspectionTaskSchedules[matchingKey];
          }
        }
      }
    } else {
      // For non-task items, use maintenanceSchedule
      taskSchedule = maintenanceSchedule;
    }
    
    // Check if this date is in the schedule for this task
    if (taskSchedule) {
      // Extract all dates for all months and check if target date is included
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
      
      let hasDate = false;
      months.forEach(month => {
        const dates = extractDatesForMonth(month, year, taskSchedule, frequency);
        dates.forEach(date => {
          const dateKey = formatDateForStorage(date);
          if (dateKey === targetDateKey) {
            hasDate = true;
          }
        });
      });
      
      if (hasDate) {
        tasksForDate.push({ item, itemId, displayText });
      }
    }
  });
  
  // If no tasks have this date scheduled, return false
  if (tasksForDate.length === 0) {
    return false;
  }
  
  // Check if all tasks for this date have completed inspections
  // Use same logic as calendar: if all inspections are complete and none have fault, show green
  // Returns: { allComplete: boolean, hasFault: boolean }
  console.log(`\n=== Checking completion for date ${targetDateKey} ===`);
  console.log(`Tasks for this date (${tasksForDate.length}):`, tasksForDate.map(t => ({ itemId: t.itemId, displayText: t.displayText, isTask: t.item?.isTask })));
  
  // Get all inspection keys that start with this date
  const datePrefix = `${targetDateKey}-`;
  const inspectionsForDate = Array.from(inspectionData.entries()).filter(([key, value]) => 
    key.startsWith(datePrefix)
  );
  
  console.log(`Inspections found for date ${targetDateKey} (${inspectionsForDate.length}):`, inspectionsForDate.map(([key, val]) => ({
    key,
    assetId: key.replace(datePrefix, ''),
    status: val.status,
    inspectionStatus: val.inspectionStatus
  })));
  
  // If no inspections found, not complete
  if (inspectionsForDate.length === 0) {
    console.log(`✗ No inspections found for date ${targetDateKey}\n`);
    return { allComplete: false, hasFault: false };
  }
  
  // Check if ANY inspection has fault status
  let hasFault = false;
  const inspectionsForDateArray = Array.from(inspectionsForDate);
  for (const [key, inspection] of inspectionsForDateArray) {
    if (inspection.status === 'fault' || inspection.status === 'abnormal') {
      hasFault = true;
      break;
    }
  }
  
  if (hasFault) {
    console.log(`⚠ FAULT DETECTED: At least one inspection has fault status for date ${targetDateKey}`);
    return { allComplete: true, hasFault: true }; // Show red even if all complete
  }
  
  // Check if ALL inspections are complete (same logic as calendar)
  const allComplete = inspectionsForDateArray.every(([key, inspection]) => {
    // Inspection is complete if inspectionStatus is 'complete'
    const isComplete = inspection.inspectionStatus === 'complete' || inspection.inspectionStatus === 'completed';
    console.log(`  Inspection ${key}: inspectionStatus=${inspection.inspectionStatus}, isComplete=${isComplete}`);
    return isComplete;
  });
  
  if (allComplete) {
    console.log(`✓ All ${inspectionsForDate.length} inspections are complete (no faults) - date should be GREEN\n`);
    return { allComplete: true, hasFault: false };
  } else {
    console.log(`✗ Not all inspections are complete\n`);
    return { allComplete: false, hasFault: false };
  }
}

// Check if a SPECIFIC TASK has completed inspections for a date
// Each task is checked independently - only this task's inspections matter
function checkTaskCompleteForDate(targetDateKey, taskId, taskName, inspectionData, taskItem) {
  console.log(`\n=== Checking completion for task "${taskName}" (${taskId}) on date ${targetDateKey} ===`);
  
  // First, try to find inspection by task ID
  let inspectionKey = `${targetDateKey}-${taskId}`;
  let inspection = inspectionData.get(inspectionKey);
  
  // If not found by task ID, find assets that match this task by locationDescription
  if (!inspection) {
    // Load assets if not cached
    if (!assetsCache) {
      console.log(`  Assets not cached, cannot match by locationDescription`);
    } else {
      // Find assets where locationDescription matches task name
      const matchingAssets = assetsCache.filter(asset => {
        const assetLocation = asset.locationDescription || '';
        return assetLocation.trim() === taskName.trim();
      });
      
      console.log(`  Found ${matchingAssets.length} asset(s) matching task "${taskName}"`);
      
      if (matchingAssets.length > 0) {
        // Check if ALL matching assets have complete inspections for this date
        const assetInspections = [];
        let hasFaultInAssets = false;
        
        for (const asset of matchingAssets) {
          const assetInspectionKey = `${targetDateKey}-${asset.assetId}`;
          const assetInspection = inspectionData.get(assetInspectionKey);
          
          if (assetInspection) {
            assetInspections.push({ assetId: asset.assetId, inspection: assetInspection });
            if (assetInspection.status === 'fault' || assetInspection.status === 'abnormal') {
              hasFaultInAssets = true;
            }
          }
        }
        
        // If we found inspections for matching assets
        if (assetInspections.length > 0) {
          // Check if ALL matching assets have complete inspections
          const allAssetsComplete = matchingAssets.every(asset => {
            const assetInspectionKey = `${targetDateKey}-${asset.assetId}`;
            const assetInspection = inspectionData.get(assetInspectionKey);
            return assetInspection && 
                   (assetInspection.inspectionStatus === 'complete' || assetInspection.inspectionStatus === 'completed');
          });
          
          if (allAssetsComplete && matchingAssets.length === assetInspections.length) {
            // All assets for this task have complete inspections
            if (hasFaultInAssets) {
              console.log(`⚠ FAULT DETECTED in assets for task "${taskName}" on date ${targetDateKey}`);
              return { allComplete: true, hasFault: true }; // Show red
            }
            console.log(`✓ All ${matchingAssets.length} asset(s) for task "${taskName}" are complete (no fault) - date should be GREEN\n`);
            return { allComplete: true, hasFault: false };
          } else {
            console.log(`✗ Not all assets for task "${taskName}" have complete inspections (${assetInspections.length}/${matchingAssets.length})\n`);
            return { allComplete: false, hasFault: hasFaultInAssets };
          }
        }
      }
    }
    
    // If still not found and item has assetId, try asset ID directly
    if (!inspection && taskItem && taskItem.assetId) {
      inspectionKey = `${targetDateKey}-${taskItem.assetId}`;
      inspection = inspectionData.get(inspectionKey);
      console.log(`  Trying asset ID key: ${inspectionKey}, found: ${!!inspection}`);
    }
  }
  
  // If we found a direct inspection (by task ID or asset ID)
  if (inspection) {
    console.log(`  Found inspection: ${inspectionKey}, status=${inspection.status}, inspectionStatus=${inspection.inspectionStatus}`);
    
    // Check fault status
    const hasFault = inspection.status === 'fault' || inspection.status === 'abnormal';
    
    if (hasFault) {
      console.log(`⚠ FAULT DETECTED for task "${taskName}" on date ${targetDateKey}`);
      return { allComplete: true, hasFault: true }; // Show red
    }
    
    // Check if inspection is complete
    const isComplete = inspection.inspectionStatus === 'complete' || inspection.inspectionStatus === 'completed';
    
    if (isComplete) {
      console.log(`✓ Task "${taskName}" is complete (no fault) - date should be GREEN\n`);
      return { allComplete: true, hasFault: false };
    } else {
      console.log(`✗ Task "${taskName}" inspection is not complete\n`);
      return { allComplete: false, hasFault: false };
    }
  }
  
  // No inspection found for this task
  console.log(`✗ No inspection found for task "${taskName}" on date ${targetDateKey}\n`);
  return { allComplete: false, hasFault: false };
}

// Get date cell class based on status
// Priority: Red (fault) > Green (all complete) > Grey (upcoming) > Black (pending)
function getDateCellClass(date, inspection, allTasksComplete = false, hasFault = false) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const inspectionDate = new Date(date);
  inspectionDate.setHours(0, 0, 0, 0);
  
  // PRIORITY 1: If ANY inspection has fault status, show RED (even if others are complete)
  if (hasFault) {
    return 'fault'; // Red - fault condition detected
  }
  
  // PRIORITY 2: If all tasks are complete AND no faults, show GREEN
  if (allTasksComplete) {
    return 'completed'; // Green - all inspections complete and normal
  }
  
  // PRIORITY 3: If inspection exists and is complete (but not all tasks complete yet)
  if (inspection && inspection.inspectionStatus === 'complete') {
    // Check fault condition: if status is 'abnormal' or 'fault', show red
    if (inspection.status === 'abnormal' || inspection.status === 'fault') {
      return 'fault'; // Red - fault condition detected
    }
    // If status is 'normal', but not all tasks complete, still show pending (black)
    // We only show green when ALL tasks are complete
    return 'pending'; // Black - some tasks still pending
  }
  
  // PRIORITY 4: Future dates - upcoming (grey - upcoming inspections)
  if (inspectionDate > today) {
    return 'upcoming'; // Grey - upcoming inspections
  }
  
  // PRIORITY 5: Past or today - can be inspected (black - pending/ongoing)
  return 'pending'; // Black bg, white text - pending (inspections still ongoing)
}

// Handle date cell click
window.handleDateClick = function(cell) {
  // Future dates (upcoming) - cannot click
  if (cell.classList.contains('upcoming')) {
    return;
  }
  
  const date = cell.dataset.date;
  currentInspectionDate = date;
  
  // Completed dates (green) or fault dates (red) - click to view (read-only)
  if (cell.classList.contains('completed') || cell.classList.contains('fault')) {
    viewInspectionForDate(date);
    return;
  }
  
  // Pending dates - click to inspect (input button) - show all hardware items
  openInspectionModalForDate(date);
};

// State for inspection modal
let currentScannedAsset = null;
let scanMethod = null; // 'rfid' or 'qrcode'
let html5QrcodeScanner = null;
let isScanning = false;

// Web Serial API variables for RFID
let serialPortInspection = null;
let readerInspection = null;
let isConnectedInspection = false;
let readLoopInspection = null;
let serialBufferInspection = '';

// Open inspection modal for a date - show scan selection first
function openInspectionModalForDate(date) {
  const dateStr = formatDate(new Date(date));
  currentInspectionDate = date;
  currentScannedAsset = null;
  scanMethod = null;
  
  // Show scan selection screen
  modalBody.innerHTML = `
    <div class="inspection-date-info">
      <div class="date-icon">📅</div>
      <div class="date-text">
        <strong>Inspection Date: ${dateStr}</strong>
        <span>${currentFrequency} Maintenance</span>
      </div>
    </div>
    <div class="scan-selection-container">
      <h4 style="margin-bottom: 1.5rem; color: #1a1a1a; font-size: 1.1rem;">Select Scan Method</h4>
      <div class="scan-method-buttons">
        <button class="scan-method-btn" onclick="selectScanMethod('rfid')">
          <div class="scan-icon">📡</div>
          <div class="scan-label">RFID Scan</div>
        </button>
        <button class="scan-method-btn" onclick="selectScanMethod('qrcode')">
          <div class="scan-icon">📱</div>
          <div class="scan-label">QR Code Scan</div>
        </button>
      </div>
    </div>
    <div id="scan-interface" style="display: none;">
      <!-- Scan interface will be loaded here -->
    </div>
    <div id="inspection-form-container" style="display: none;">
      <!-- Inspection form will be loaded here after verification -->
    </div>
  `;
  
  submitBtn.style.display = 'none';
  inspectionModal.classList.add('open');
}

// Select scan method (RFID or QR Code)
window.selectScanMethod = function(method) {
  scanMethod = method;
  const scanInterface = document.getElementById('scan-interface');
  const scanSelection = document.querySelector('.scan-selection-container');
  
  if (method === 'rfid') {
    scanInterface.innerHTML = `
      <div class="scan-section">
        <h4 style="margin-bottom: 1rem; color: #1a1a1a;">RFID Scan</h4>
        <div class="arduino-connection-section" style="width: 100%; margin-bottom: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 12px; border: 1px solid #e5e7eb;">
          <h5 style="font-size: 0.95rem; font-weight: 600; color: #1a1a1a; margin-bottom: 0.75rem;">Arduino Connection</h5>
          <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
            <button class="btn-scan-rfid" id="connect-arduino-btn-inspection" style="display: inline-block;">Connect to Arduino</button>
            <button class="btn-scan-rfid" id="disconnect-arduino-btn-inspection" style="display: none;">Disconnect</button>
            <span id="connection-status-inspection" class="connection-status-inspection" style="padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.9rem; font-weight: 500; background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5;">Not connected</span>
          </div>
        </div>
        <div class="rfid-input-group">
          <input type="text" id="rfid-tag-input" class="rfid-input" placeholder="Enter RFID tag ID or scan with RFID reader" autofocus>
          <button class="btn-scan-rfid" onclick="verifyAssetByRfid()">Search Asset</button>
        </div>
        <div id="rfid-scan-result" style="margin-top: 1rem; display: none;"></div>
      </div>
    `;
    scanSelection.style.display = 'none';
    scanInterface.style.display = 'block';
    
    // Initialize Arduino connection handlers
    initializeArduinoConnection();
    
    // Focus on input
    setTimeout(() => {
      const rfidInput = document.getElementById('rfid-tag-input');
      if (rfidInput) rfidInput.focus();
    }, 100);
  } else if (method === 'qrcode') {
    scanInterface.innerHTML = `
      <div class="scan-section">
        <h4 style="margin-bottom: 1rem; color: #1a1a1a;">QR Code Scan</h4>
        <div id="qr-reader" style="width: 100%; margin-bottom: 1rem;"></div>
        <button class="btn-start-scan" onclick="startQRCodeScan()">Start Camera</button>
        <button class="btn-stop-scan" onclick="stopQRCodeScan()" style="display: none;">Stop Camera</button>
        <div id="qr-scan-result" style="margin-top: 1rem; display: none;"></div>
      </div>
    `;
    scanSelection.style.display = 'none';
    scanInterface.style.display = 'block';
  }
};

// Initialize Arduino connection handlers
function initializeArduinoConnection() {
  const connectBtn = document.getElementById('connect-arduino-btn-inspection');
  const disconnectBtn = document.getElementById('disconnect-arduino-btn-inspection');
  
  if (connectBtn) {
    connectBtn.addEventListener('click', connectToArduinoInspection);
  }
  
  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', disconnectFromArduinoInspection);
  }
}

// Connect to Arduino for inspection
async function connectToArduinoInspection() {
  if (!navigator.serial) {
    alert('Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.');
    return;
  }

  try {
    serialPortInspection = await navigator.serial.requestPort();
    await serialPortInspection.open({ baudRate: 9600 });
    
    isConnectedInspection = true;
    updateConnectionUIInspection(true);
    
    startReadingSerialInspection();
  } catch (error) {
    console.error('Error connecting to Arduino:', error);
    if (error.name === 'NotFoundError') {
      alert('No serial port selected.');
    } else {
      alert(`Error connecting: ${error.message}`);
    }
    updateConnectionUIInspection(false);
  }
}

// Disconnect from Arduino
async function disconnectFromArduinoInspection() {
  try {
    if (readLoopInspection) {
      readLoopInspection.abort();
      readLoopInspection = null;
    }
    
    if (readerInspection) {
      await readerInspection.cancel();
      await readerInspection.releaseLock();
      readerInspection = null;
    }
    
    if (serialPortInspection) {
      await serialPortInspection.close();
      serialPortInspection = null;
    }
    
    isConnectedInspection = false;
    serialBufferInspection = '';
    updateConnectionUIInspection(false);
  } catch (error) {
    // Device already disconnected or connection lost - this is normal
    // Only log if it's not a "device lost" error
    if (error.message && !error.message.includes('device has been lost')) {
      console.warn('Error during disconnect (device may already be disconnected):', error.message);
    }
    // Ensure UI is updated even if disconnect fails
    isConnectedInspection = false;
    serialBufferInspection = '';
    updateConnectionUIInspection(false);
  }
}

// Update connection UI
function updateConnectionUIInspection(connected) {
  const connectBtn = document.getElementById('connect-arduino-btn-inspection');
  const disconnectBtn = document.getElementById('disconnect-arduino-btn-inspection');
  const status = document.getElementById('connection-status-inspection');
  
  if (connected) {
    if (connectBtn) connectBtn.style.display = 'none';
    if (disconnectBtn) disconnectBtn.style.display = 'inline-block';
    if (status) {
      status.textContent = 'Connected';
      status.style.background = '#d1fae5';
      status.style.color = '#065f46';
      status.style.border = '1px solid #6ee7b7';
    }
  } else {
    if (connectBtn) connectBtn.style.display = 'inline-block';
    if (disconnectBtn) disconnectBtn.style.display = 'none';
    if (status) {
      status.textContent = 'Not connected';
      status.style.background = '#fee2e2';
      status.style.color = '#991b1b';
      status.style.border = '1px solid #fca5a5';
    }
  }
}

// Read data from serial port
async function startReadingSerialInspection() {
  if (!serialPortInspection) return;
  
  try {
    const decoder = new TextDecoder();
    readerInspection = serialPortInspection.readable.getReader();
    readLoopInspection = new AbortController();
    serialBufferInspection = '';
    
    while (serialPortInspection.readable && !readLoopInspection.signal.aborted) {
      const { value, done } = await readerInspection.read();
      
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      serialBufferInspection += chunk;
      
      const lines = serialBufferInspection.split('\n');
      serialBufferInspection = lines.pop() || '';
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (!trimmedLine) continue;
        
        if (trimmedLine.includes('RFID Reader Ready') || 
            trimmedLine.includes('Waiting for RFID tag') ||
            trimmedLine.includes('RFID Tag Scanned:') ||
            trimmedLine.includes('RFID reader detected') ||
            trimmedLine.includes('Scan a card') ||
            trimmedLine === '---') {
          continue;
        }
        
        let rfidTagId = null;
        
        if (trimmedLine.startsWith('UID:') || trimmedLine.startsWith('uid:')) {
          const hexValues = trimmedLine.replace(/UID:\s*/i, '').trim();
          const combinedHex = hexValues.replace(/\s+/g, '');
          if (/^[0-9A-F]{8,16}$/i.test(combinedHex)) {
            rfidTagId = combinedHex.toUpperCase();
          }
        } else if (/^[0-9A-F]{8,16}$/i.test(trimmedLine)) {
          rfidTagId = trimmedLine.toUpperCase();
        } else if (/^([0-9A-F]{2}\s*)+$/i.test(trimmedLine)) {
          const combinedHex = trimmedLine.replace(/\s+/g, '');
          if (/^[0-9A-F]{8,16}$/i.test(combinedHex)) {
            rfidTagId = combinedHex.toUpperCase();
          }
        }
        
        if (rfidTagId) {
          handleRfidScanInspection(rfidTagId);
        }
      }
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      // Device connection lost - this is normal if device disconnects or browser loses connection
      // Only log as warning, not error, since RFID tag was likely already captured
      if (error.message && error.message.includes('device has been lost')) {
        console.warn('Device connection lost (this is normal if device disconnected):', error.message);
      } else {
        console.error('Error reading serial:', error);
      }
      // Silently disconnect - don't show error to user if tag was already scanned
      try {
        await disconnectFromArduinoInspection();
      } catch (disconnectError) {
        // Ignore disconnect errors - device is already gone
        console.warn('Device already disconnected');
      }
    }
  } finally {
    serialBufferInspection = '';
  }
}

// Handle RFID tag scan from Arduino
function handleRfidScanInspection(rfidTagId) {
  console.log('🎯 RFID Tag scanned:', rfidTagId);
  
  const rfidInput = document.getElementById('rfid-tag-input');
  if (rfidInput) {
    rfidInput.value = rfidTagId.trim();
    rfidInput.style.borderColor = '#16a34a';
    rfidInput.style.borderWidth = '2px';
    rfidInput.style.background = '#f0fdf4';
    rfidInput.style.fontWeight = '600';
    
    setTimeout(() => {
      rfidInput.style.borderColor = '';
      rfidInput.style.borderWidth = '';
      rfidInput.style.background = '';
      rfidInput.style.fontWeight = '';
    }, 2000);
    
    // Automatically search for the asset
    verifyAssetByRfid();
  }
}

// Verify asset by RFID
window.verifyAssetByRfid = async function() {
  const rfidInput = document.getElementById('rfid-tag-input');
  const rfidTagId = rfidInput ? rfidInput.value.trim() : '';
  const resultDiv = document.getElementById('rfid-scan-result');
  
  if (!rfidTagId) {
    if (resultDiv) {
      resultDiv.innerHTML = '<div style="color: #dc2626; padding: 0.75rem; background: #fef2f2; border-radius: 8px;">Please enter RFID Tag ID</div>';
      resultDiv.style.display = 'block';
    }
    return;
  }
  
  try {
    if (resultDiv) {
      resultDiv.innerHTML = '<div style="color: #3b82f6; padding: 0.75rem;">Verifying asset...</div>';
      resultDiv.style.display = 'block';
    }
    
    const resp = await fetch(`/api/assets/get-by-rfid?rfidTagId=${encodeURIComponent(rfidTagId)}`);
    const data = await resp.json();
    
    if (!resp.ok || !data.ok) {
      throw new Error(data.error || 'Asset not found');
    }
    
    currentScannedAsset = data.asset;
    showInspectionForm();
  } catch (error) {
    console.error('Error verifying asset:', error);
    if (resultDiv) {
      resultDiv.innerHTML = `<div style="color: #dc2626; padding: 0.75rem; background: #fef2f2; border-radius: 8px;">Error: ${error.message || 'Asset not found'}</div>`;
      resultDiv.style.display = 'block';
    }
  }
};

// Start QR code scanning
window.startQRCodeScan = async function() {
  if (isScanning) return;
  
  try {
    if (typeof Html5Qrcode === 'undefined') {
      alert('QR Code scanner library not loaded. Please refresh the page.');
      return;
    }
    
    const qrReader = document.getElementById('qr-reader');
    const startBtn = document.querySelector('.btn-start-scan');
    const stopBtn = document.querySelector('.btn-stop-scan');
    
    if (!qrReader) return;
    
    html5QrcodeScanner = new Html5Qrcode("qr-reader");
    
    await html5QrcodeScanner.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      },
      onQRCodeScanSuccess,
      onQRCodeScanError
    );
    
    isScanning = true;
    if (startBtn) startBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'inline-block';
  } catch (error) {
    console.error('Error starting QR scanner:', error);
    alert(`Failed to start camera: ${error.message}`);
  }
};

// Stop QR code scanning
window.stopQRCodeScan = async function() {
  if (!isScanning || !html5QrcodeScanner) return;
  
  try {
    await html5QrcodeScanner.stop();
    html5QrcodeScanner.clear();
    html5QrcodeScanner = null;
    isScanning = false;
    
    const startBtn = document.querySelector('.btn-start-scan');
    const stopBtn = document.querySelector('.btn-stop-scan');
    if (startBtn) startBtn.style.display = 'inline-block';
    if (stopBtn) stopBtn.style.display = 'none';
  } catch (error) {
    console.error('Error stopping scanner:', error);
  }
};

// Handle successful QR code scan
function onQRCodeScanSuccess(decodedText, decodedResult) {
  console.log('QR Code scanned:', decodedText);
  
  stopQRCodeScan();
  
  // Extract assetId from scanned text
  let assetId = decodedText;
  try {
    const url = new URL(decodedText);
    const params = new URLSearchParams(url.search);
    assetId = params.get('assetId') || assetId;
  } catch (e) {
    // Not a URL, use as-is
  }
  
  verifyAssetByQRCode(assetId);
}

// Handle QR code scan error
function onQRCodeScanError(errorMessage) {
  // Ignore continuous scanning errors
}

// Verify asset by QR code
async function verifyAssetByQRCode(assetId) {
  const resultDiv = document.getElementById('qr-scan-result');
  
  try {
    if (resultDiv) {
      resultDiv.innerHTML = '<div style="color: #3b82f6; padding: 0.75rem;">Verifying asset...</div>';
      resultDiv.style.display = 'block';
    }
    
    const resp = await fetch(`/api/assets/get?assetId=${encodeURIComponent(assetId)}`);
    const data = await resp.json();
    
    if (!resp.ok || !data.ok) {
      throw new Error(data.error || 'Asset not found');
    }
    
    currentScannedAsset = data.asset;
    showInspectionForm();
  } catch (error) {
    console.error('Error verifying asset:', error);
    if (resultDiv) {
      resultDiv.innerHTML = `<div style="color: #dc2626; padding: 0.75rem; background: #fef2f2; border-radius: 8px;">Error: ${error.message || 'Asset not found'}</div>`;
      resultDiv.style.display = 'block';
    }
  }
}

// Show inspection form after asset verification
function showInspectionForm() {
  if (!currentScannedAsset) return;
  
  const scanInterface = document.getElementById('scan-interface');
  const formContainer = document.getElementById('inspection-form-container');
  const dateStr = formatDate(new Date(currentInspectionDate));
  
  // Get existing inspection if any
  const inspectionKey = `${currentInspectionDate}-${currentScannedAsset.assetId}`;
  const existingInspection = inspectionData.get(inspectionKey);
  
  formContainer.innerHTML = `
    <div class="verified-asset-info" style="background: #f0fdf4; border: 2px solid #16a34a; border-radius: 12px; padding: 1rem; margin-bottom: 1.5rem;">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <div style="font-size: 1.5rem;">✅</div>
        <div>
          <div style="font-weight: 600; color: #065f46;">Asset Verified</div>
          <div style="font-size: 0.9rem; color: #047857;">${escapeHtml(currentScannedAsset.assetId || 'N/A')} - ${escapeHtml(currentScannedAsset.assetDescription || 'Unknown')}</div>
        </div>
      </div>
    </div>
    <div class="inspection-form-fields">
      <div class="form-field">
        <label>Inspection Date *</label>
        <input type="date" id="inspection-date-input" class="form-input" value="${currentInspectionDate}" required>
      </div>
      <div class="form-field">
        <label>Fault conditions *</label>
        <select id="inspection-status-select" class="form-select" required>
          <option value="normal" ${existingInspection?.status === 'normal' ? 'selected' : ''}>Normal</option>
          <option value="fault" ${existingInspection?.status === 'fault' || existingInspection?.status === 'abnormal' ? 'selected' : ''}>Fault</option>
        </select>
      </div>
      <div class="form-field">
        <label>Remark</label>
        <textarea id="inspection-remark-input" class="form-textarea" rows="4" placeholder="Enter inspection remarks...">${escapeHtml(existingInspection?.remarks || '')}</textarea>
      </div>
    </div>
  `;
  
  if (scanInterface) scanInterface.style.display = 'none';
  if (formContainer) formContainer.style.display = 'block';
  submitBtn.style.display = 'inline-flex';
}

// View completed inspection for a date (read-only) - show all hardware items
function viewInspectionForDate(date) {
  const dateStr = formatDate(new Date(date));
  
  // Build list of all items (tasks or hardware) with their inspection status
  // Use the same itemsToDisplay that's used in the checklist table
  const inspectionTasks = currentMaintenanceItem?.inspectionTasks || '';
  const tasksList = inspectionTasks ? inspectionTasks.split('\n').filter(t => t.trim()) : [];
  const itemsToDisplay = tasksList.length > 0 ? tasksList.map((task, idx) => ({ 
    _id: `task-${idx}`, 
    text: task.trim(),
    isTask: true
  })) : maintenanceItems;
  
  let assetsHTML = '';
  let hasInspections = false;
  
  itemsToDisplay.forEach((item, index) => {
    const itemId = item._id || item.assetId || `item-${index}`;
    const itemName = item.text || item.itemName || item.assetDescription || 'Unknown';
    const inspectionKey = `${date}-${itemId}`;
    const inspection = inspectionData.get(inspectionKey);
    
    if (inspection) {
      hasInspections = true;
      assetsHTML += `
        <div class="asset-inspection-item" data-asset-id="${itemId}">
          <div class="asset-header">
            <div class="asset-info">
              <h4>${index + 1}. ${escapeHtml(itemName)}</h4>
              <p>Hardware Inspection (Completed)</p>
            </div>
            <select class="status-select ${inspection.status}" disabled>
              <option value="normal" ${inspection.status === 'normal' ? 'selected' : ''}>Normal</option>
              <option value="fault" ${inspection.status === 'fault' || inspection.status === 'abnormal' ? 'selected' : ''}>Fault</option>
            </select>
          </div>
          <textarea class="remarks-input" readonly>${escapeHtml(inspection.remarks || 'No remarks')}</textarea>
        </div>
      `;
    }
  });
  
  if (!hasInspections) {
    assetsHTML = '<p style="text-align: center; padding: 2rem; color: #6b7280;">No inspection data found for this date.</p>';
  }
  
  modalBody.innerHTML = `
    <div class="inspection-date-info">
      <div class="date-icon">✓</div>
      <div class="date-text">
        <strong>Inspection Date: ${dateStr}</strong>
        <span>${currentFrequency} Maintenance - All Hardware Items (Completed)</span>
      </div>
    </div>
    <div class="assets-list-container">
      ${assetsHTML}
    </div>
  `;
  
  submitBtn.style.display = 'none';
  cancelBtn.textContent = 'Close';
  inspectionModal.classList.add('open');
}

// Update status select styling
window.updateStatusSelect = function(select) {
  select.classList.remove('normal', 'abnormal', 'fault');
  // Map 'abnormal' to 'fault' for styling (backward compatibility)
  const value = select.value === 'abnormal' ? 'fault' : select.value;
  select.classList.add(value);
};

// Submit inspection
async function submitInspection() {
  if (!currentInspectionDate) {
    alert('Inspection date not set');
    return;
  }
  
  // Collect all asset inspections
  const assets = [];
  
  // First, check for scanned asset form (single asset inspection)
  if (currentScannedAsset) {
    const statusSelect = document.getElementById('inspection-status-select');
    const remarksInput = document.getElementById('inspection-remark-input');
    
    if (statusSelect && remarksInput) {
      assets.push({
        assetId: currentScannedAsset.assetId,
        status: statusSelect.value,
        remarks: remarksInput.value.trim()
      });
      console.log('✓ Added scanned asset to inspection:', currentScannedAsset.assetId);
    } else {
      console.warn('⚠ Scanned asset form fields not found');
    }
  }
  
  // Then, check for multiple asset inspection items (from completed inspections view)
  const assetItems = document.querySelectorAll('.asset-inspection-item');
  
  assetItems.forEach(item => {
    const assetId = item.dataset.assetId;
    const statusSelect = item.querySelector(`.status-select[data-asset-id="${assetId}"]`);
    const remarksInput = item.querySelector(`.remarks-input[data-asset-id="${assetId}"]`);
    
    if (statusSelect && remarksInput && !statusSelect.disabled) {
      // Only add if not already added (avoid duplicates)
      if (!assets.find(a => a.assetId === assetId)) {
        assets.push({
          assetId: assetId,
          status: statusSelect.value,
          remarks: remarksInput.value.trim()
        });
      }
    }
  });
  
  console.log('Collected assets for inspection:', assets.length, assets);
  
  // Allow submission even if no assets (to save inspection date/status)
  if (assets.length === 0) {
    if (!confirm('No assets found for this inspection. Do you want to save the inspection date anyway?')) {
      return;
    }
  }
  
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';
  
  try {
    // Include maintenance information if available
    const payload = {
      frequency: currentFrequency,
      inspectionDate: currentInspectionDate,
      assets: assets
    };
    
    // Add maintenance info if available
    if (currentMaintenanceItem) {
      payload.maintenanceId = currentMaintenanceItem._id;
      payload.branch = currentMaintenanceItem.branch;
      payload.location = currentMaintenanceItem.location;
      payload.itemName = currentMaintenanceItem.itemName;
    }
    
    const response = await fetch('/api/inspections/save-checklist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Failed to save inspection');
    }
    
    // Update local inspection data for all assets
    assets.forEach(asset => {
      // Normalize date format to YYYY-MM-DD
      const normalizedDate = currentInspectionDate.includes('T') ? currentInspectionDate.split('T')[0] : currentInspectionDate;
      const inspectionKey = `${normalizedDate}-${asset.assetId}`;
      // Map 'abnormal' to 'fault' for consistency
      const status = asset.status === 'abnormal' ? 'fault' : (asset.status || 'normal');
      inspectionData.set(inspectionKey, {
        status: status, // 'normal' or 'fault' (fault condition)
        inspectionStatus: 'complete', // Inspection is complete when submitted
        remarks: asset.remarks,
        date: normalizedDate
      });
      
      // Update cell status
      const cell = document.querySelector(`[data-date="${normalizedDate}"][data-hardware-id="${asset.assetId}"]`);
      if (cell) {
        updateCellStatus(cell, status);
      }
    });
    
    // Show success message based on whether assets were saved
    if (assets.length > 0) {
      alert(`✅ Inspection submitted successfully for ${assets.length} asset(s)!\n\nData has been saved to MongoDB database and will persist after page refresh.`);
    } else {
      alert('✅ Inspection date saved successfully!\n\nData has been saved to MongoDB database.');
    }
    closeModal();
    // Reload inspection data from server to ensure consistency after refresh
    setTimeout(() => {
      loadInspectionData().then(() => {
        renderCalendarGrid(); // Re-render after loading data
      });
    }, 300);
    
  } catch (error) {
    console.error('Error submitting inspection:', error);
    alert(`Failed to submit inspection: ${error.message}`);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Inspection';
  }
}

// Update cell status after inspection
function updateCellStatus(cell, status) {
  cell.classList.remove('pending', 'completed', 'abnormal', 'fault');
  // When inspection is submitted, it's always complete
  // Check fault condition: if status is 'abnormal' or 'fault', show red
  if (status === 'abnormal' || status === 'fault') {
    cell.classList.add('fault'); // Red - fault condition
  } else {
    cell.classList.add('completed'); // Green - normal and complete
  }
}

// Close modal
function closeModal() {
  // Stop QR scanning if active
  if (isScanning && html5QrcodeScanner) {
    stopQRCodeScan();
  }
  
  // Disconnect Arduino if connected
  if (isConnectedInspection) {
    disconnectFromArduinoInspection();
  }
  
  inspectionModal.classList.remove('open');
  currentInspectionDate = null;
  currentInspectionHardware = null;
  currentScannedAsset = null;
  scanMethod = null;
  submitBtn.style.display = 'inline-flex';
  submitBtn.disabled = false;
  submitBtn.textContent = 'Submit Inspection';
  cancelBtn.textContent = 'Cancel';
}

// Format date for display
function formatDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

// Format date for storage (YYYY-MM-DD)
function formatDateForStorage(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Add Schedule Modal Functions
let addScheduleModal, addScheduleBtn, addScheduleForm;
let addScheduleContainer, addScheduleCalendar;
let closeAddScheduleModalBtn, cancelAddScheduleBtn;

function initAddScheduleElements() {
  addScheduleModal = document.getElementById('add-schedule-modal-overlay');
  addScheduleBtn = document.getElementById('add-schedule-btn');
  addScheduleForm = document.getElementById('add-schedule-form');
  addScheduleContainer = document.getElementById('add-schedule-container');
  addScheduleCalendar = document.getElementById('add-schedule-calendar');
  closeAddScheduleModalBtn = document.getElementById('close-add-schedule-modal-btn');
  cancelAddScheduleBtn = document.getElementById('cancel-add-schedule-btn');
}

// Flag to prevent duplicate event listeners
let addScheduleListenersSetup = false;

function setupAddScheduleListeners() {
  if (!addScheduleModal) {
    setTimeout(setupAddScheduleListeners, 100);
    return;
  }

  // Prevent duplicate setup
  if (addScheduleListenersSetup) {
    console.log('Add schedule listeners already setup, skipping...');
    return;
  }

  // Close modal handlers
  if (closeAddScheduleModalBtn) {
    closeAddScheduleModalBtn.addEventListener('click', closeAddScheduleModal);
  }
  if (cancelAddScheduleBtn) {
    cancelAddScheduleBtn.addEventListener('click', closeAddScheduleModal);
  }
  if (addScheduleModal) {
    addScheduleModal.addEventListener('click', (e) => {
      if (e.target === addScheduleModal) {
        closeAddScheduleModal();
      }
    });
  }

  // Form submit handler - prevent duplicate listeners
  if (addScheduleForm) {
    // Check if listener already attached
    if (addScheduleForm.dataset.listenerAttached === 'true') {
      console.log('Form submit listener already attached, skipping duplicate setup');
      return;
    }
    
    addScheduleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!currentMaintenanceItem || !currentMaintenanceItem._id) {
        alert('No maintenance item selected');
        return;
      }
      
      const formData = new FormData(addScheduleForm);
      const inspectionTaskText = formData.get('inspectionTasks')?.trim() || '';
      
      if (!inspectionTaskText) {
        alert('Please enter an inspection task');
        return;
      }
      
      // Collect schedule data - normalize date format to YYYY-MM-DD
      // IMPORTANT: For weekly, we need to rebuild the entire structure per month
      // to ensure deleted weeks are properly removed
      const scheduleData = {};
      if (addScheduleCalendar) {
        const scheduleInputs = addScheduleCalendar.querySelectorAll('[name^="schedule"]');
        console.log('Found schedule inputs:', scheduleInputs.length);
        
        // For weekly frequency, we need to ensure we rebuild the month structure completely
        // to remove any deleted weeks
        if (currentFrequency === 'Weekly') {
          // Get all months from the calendar
          const monthDivs = addScheduleCalendar.querySelectorAll('[data-month]');
          monthDivs.forEach(monthDiv => {
            const month = monthDiv.dataset.month;
            const weeksDiv = monthDiv.querySelector('.calendar-weeks');
            if (weeksDiv) {
              const weekInputs = weeksDiv.querySelectorAll('.calendar-date-input');
              if (weekInputs.length > 0) {
                // Initialize month object
                scheduleData[month] = {};
                
                // Only add weeks that have values
                weekInputs.forEach(input => {
                  if (input.value) {
                    // Extract week number from input name (e.g., "schedule[January][Week1]")
                    const nameParts = input.name.match(/schedule\[(.*?)\]\[(.*?)\]/);
                    if (nameParts && nameParts[2]) {
                      const weekKey = nameParts[2]; // e.g., "Week1"
                      let dateValue = input.value;
                      if (dateValue.includes('T')) {
                        dateValue = dateValue.split('T')[0];
                      }
                      scheduleData[month][weekKey] = dateValue;
                      console.log(`  Saved: scheduleData["${month}"]["${weekKey}"] = "${dateValue}"`);
                    }
                  }
                });
                
                // If month has no weeks with values, don't include it in scheduleData
                if (Object.keys(scheduleData[month]).length === 0) {
                  delete scheduleData[month];
                }
              }
            }
          });
        } else {
          // For Monthly and Quarterly, use the original logic
          scheduleInputs.forEach(input => {
            if (input.value) {
              // Normalize date to YYYY-MM-DD format
              let dateValue = input.value;
              if (dateValue.includes('T')) {
                dateValue = dateValue.split('T')[0];
              }
              
              console.log(`Processing input: name="${input.name}", value="${input.value}", normalized="${dateValue}"`);
              
              const nameParts = input.name.match(/schedule\[(.*?)\](?:\[(.*?)\])?/);
              if (nameParts) {
                const key1 = nameParts[1];
                const key2 = nameParts[2];
                if (key2) {
                  if (!scheduleData[key1]) scheduleData[key1] = {};
                  scheduleData[key1][key2] = dateValue;
                  console.log(`  Saved as: scheduleData["${key1}"]["${key2}"] = "${dateValue}"`);
                } else {
                  scheduleData[key1] = dateValue;
                  console.log(`  Saved as: scheduleData["${key1}"] = "${dateValue}"`);
                }
              } else {
                console.warn(`  Could not parse input name: "${input.name}"`);
              }
            } else {
              console.log(`Skipping empty input: name="${input.name}"`);
            }
          });
        }
      }
      
      console.log('Collected schedule data (final):', JSON.stringify(scheduleData, null, 2));
      console.log('Schedule data keys:', Object.keys(scheduleData));
      
      try {
        // Validate that we have the required fields
        if (!currentMaintenanceItem.branch || !currentMaintenanceItem.location || !currentMaintenanceItem.itemName) {
          alert('Missing maintenance item information. Please refresh the page and try again.');
          return;
        }
        
        // Check if this is a new task or editing existing task
        const isNewTask = addScheduleForm.dataset.isNewTask === 'true';
        const oldTaskName = addScheduleForm.dataset.itemName || '';
        
        // Get existing inspection tasks
        const existingTasks = currentMaintenanceItem.inspectionTasks || '';
        const tasksList = existingTasks ? existingTasks.split('\n').filter(t => t.trim()) : [];
        
        if (isNewTask) {
          // Adding a new task - add it to the list if it doesn't exist
          if (!tasksList.includes(inspectionTaskText)) {
            tasksList.push(inspectionTaskText);
            console.log(`Adding new task: "${inspectionTaskText}"`);
          } else {
            alert('This inspection task already exists. Please use a different name.');
            return;
          }
        } else {
          // Editing existing task - replace old name with new name if changed
          if (oldTaskName && oldTaskName !== inspectionTaskText) {
            const oldIndex = tasksList.indexOf(oldTaskName);
            if (oldIndex !== -1) {
              tasksList[oldIndex] = inspectionTaskText;
              console.log(`Renaming task: "${oldTaskName}" -> "${inspectionTaskText}"`);
            } else if (!tasksList.includes(inspectionTaskText)) {
              // Old task not in list but new name doesn't exist - add it
              tasksList.push(inspectionTaskText);
            }
          } else if (!tasksList.includes(inspectionTaskText)) {
            // Task name unchanged but not in list - add it
            tasksList.push(inspectionTaskText);
          }
        }
        
        const updatedTasks = tasksList.join('\n');
        
        // Prepare update data - ensure all fields are strings and not empty
        const originalBranch = String(currentMaintenanceItem.branch || '').trim();
        const originalLocation = String(currentMaintenanceItem.location || '').trim();
        const originalItemName = String(currentMaintenanceItem.itemName || '').trim();
        
        if (!originalBranch || !originalLocation || !originalItemName) {
          console.error('Missing required fields:', {
            branch: originalBranch,
            location: originalLocation,
            itemName: originalItemName,
            currentMaintenanceItem: currentMaintenanceItem
          });
          alert('Missing maintenance item information. Please refresh the page and try again.');
          return;
        }
        
        // Use maintenanceId if available (preferred), otherwise use branch/location/itemName
        const updateData = {
          inspectionTasks: updatedTasks
        };
        
        // Prefer maintenanceId if available
        if (currentMaintenanceItem._id) {
          updateData.maintenanceId = currentMaintenanceItem._id;
        } else {
          // Fallback to branch/location/itemName
          updateData.originalBranch = originalBranch;
          updateData.originalLocation = originalLocation;
          updateData.originalItemName = originalItemName;
        }
        
        // Save inspection tasks list to maintenance item
        console.log('Sending update data to server:', JSON.stringify(updateData, null, 2));
        
        const response = await fetch('/api/maintenance/update', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(updateData)
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.ok) {
          console.error('Update failed:', data);
          alert(`Failed to save: ${data.error || 'Unknown error'}`);
          return;
        }
        
        console.log('=== SAVE SUCCESSFUL ===');
        console.log('Server response:', data);
        
        // Update local state
        currentMaintenanceItem.inspectionTasks = updatedTasks;
        
        // ALWAYS save to separate inspection_tasks collection (even if schedule is empty)
        // This ensures the document exists in the collection
        console.log('=== SAVING TO INSPECTION_TASKS COLLECTION ===');
        console.log('Maintenance ID:', currentMaintenanceItem._id);
        console.log('Task name:', inspectionTaskText);
        console.log('Schedule data being saved:', JSON.stringify(scheduleData, null, 2));
        console.log('Schedule data keys count:', Object.keys(scheduleData).length);
        
        if (!currentMaintenanceItem._id) {
          console.error('ERROR: No maintenanceId available! Cannot save to inspection_tasks collection.');
          alert('Error: Missing maintenance ID. Please refresh the page and try again.');
          return;
        }
        
        try {
          // IMPORTANT: For weekly, if scheduleData is empty or only has empty months, send null to clear the schedule
          // This ensures deletions are properly saved
          let scheduleToSave = null;
          if (Object.keys(scheduleData).length > 0) {
            // Check if schedule has any actual data (not just empty objects)
            const hasData = Object.values(scheduleData).some(monthData => {
              if (typeof monthData === 'object' && monthData !== null) {
                return Object.keys(monthData).length > 0;
              }
              return !!monthData;
            });
            
            if (hasData) {
              scheduleToSave = scheduleData;
            } else {
              console.log('Schedule data is empty (all months/quarters are empty), sending null to clear schedule');
              scheduleToSave = null;
            }
          }
          
          const payload = {
            maintenanceId: currentMaintenanceItem._id,
            taskName: inspectionTaskText,
            schedule: scheduleToSave
          };
          
          console.log('=== SENDING TO API ===');
          console.log('API URL: /api/maintenance/inspection-task');
          console.log('Schedule to save:', scheduleToSave === null ? 'null (clearing schedule)' : JSON.stringify(scheduleToSave, null, 2));
          console.log('Payload:', JSON.stringify(payload, null, 2));
          
          const taskResponse = await fetch('/api/maintenance/inspection-task', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
          });
          
          console.log('Response status:', taskResponse.status);
          console.log('Response ok:', taskResponse.ok);
          
          if (!taskResponse.ok) {
            const errorText = await taskResponse.text();
            console.error('=== HTTP ERROR ===');
            console.error('Status:', taskResponse.status);
            console.error('Response text:', errorText);
            alert(`Failed to save schedule: HTTP ${taskResponse.status}\n\nCheck browser console (F12) for details.`);
            return;
          }
          
          const taskData = await taskResponse.json();
          console.log('Response data:', JSON.stringify(taskData, null, 2));
          
          if (!taskData.ok) {
            console.error('=== API ERROR ===');
            console.error('Error response:', taskData);
            alert(`Failed to save schedule: ${taskData.error || 'Unknown error'}\n\nCheck browser console (F12) for details.`);
            return;
          }
          
          console.log('=== ✅ TASK SCHEDULE SAVE SUCCESSFUL ===');
          console.log('Server response:', taskData);
          console.log('✓ Document saved to "inspection_tasks" collection in MongoDB');
          console.log('✓ Task ID:', taskData.taskId || 'N/A');
          console.log('✓ Maintenance ID:', payload.maintenanceId);
          console.log('✓ Task Name:', payload.taskName);
          console.log('✓ Schedule:', JSON.stringify(payload.schedule, null, 2));
          
          // If editing and task name changed, delete old task from inspection_tasks
          if (!isNewTask && oldTaskName && oldTaskName !== inspectionTaskText) {
            try {
              const deleteResponse = await fetch('/api/maintenance/inspection-task', {
                method: 'DELETE',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                  maintenanceId: currentMaintenanceItem._id,
                  taskName: oldTaskName
                })
              });
              if (deleteResponse.ok) {
                const deleteData = await deleteResponse.json();
                if (deleteData.ok) {
                  console.log(`✓ Deleted old task "${oldTaskName}" from inspection_tasks collection`);
                }
              }
            } catch (error) {
              console.warn('Could not delete old task:', error);
            }
          }
          
          const successMsg = isNewTask 
            ? `New inspection task "${inspectionTaskText}" added successfully with schedule!`
            : `Schedule saved successfully for "${inspectionTaskText}"!`;
          alert(successMsg);
        } catch (error) {
          console.error('=== EXCEPTION ===');
          console.error('Error message:', error.message);
          console.error('Error stack:', error.stack);
          alert(`Failed to save schedule: ${error.message}\n\nCheck browser console (F12) for details.`);
          return;
        }
        
        // Close modal first
        addScheduleForm.reset();
        closeAddScheduleModal();
        
        // Wait for database to update, then reload schedule from database
        // Use a longer delay to ensure database write is complete
        setTimeout(async () => {
          console.log(`🔄 Reloading ${currentFrequency.toLowerCase()} schedule from database after save...`);
          console.log('Task name:', inspectionTaskText);
          console.log('Maintenance ID:', currentMaintenanceItem._id);
          console.log('Frequency:', currentFrequency);
          
          // First, verify the schedule was saved by fetching it directly
          try {
            const verifyResponse = await fetch(`/api/maintenance/inspection-task?maintenanceId=${encodeURIComponent(currentMaintenanceItem._id)}&taskName=${encodeURIComponent(inspectionTaskText)}`);
            if (verifyResponse.ok) {
              const verifyData = await verifyResponse.json();
              if (verifyData.ok && verifyData.task) {
                console.log('✓ Verified schedule in database:', JSON.stringify(verifyData.task.schedule, null, 2));
                console.log('Schedule keys:', Object.keys(verifyData.task.schedule || {}));
              } else {
                console.warn('⚠ Schedule not found in database after save');
              }
            }
          } catch (error) {
            console.warn('Could not verify schedule:', error);
          }
          
          // Force a complete reload by calling renderCalendarGrid which will fetch fresh data from API
          // renderCalendarGrid() creates its own inspectionTaskSchedules by fetching from /api/maintenance/inspection-tasks
          // This ensures we get the latest data from the database
          await renderCalendarGrid();
          
          // Also reload inspection data and re-render one more time to ensure everything is in sync
          await loadInspectionData();
          await renderCalendarGrid();
          
          console.log(`✓ Checklist reloaded with updated ${currentFrequency.toLowerCase()} schedule`);
        }, 1000);
      } catch (error) {
        console.error('Error saving inspection task:', error);
        alert(`Failed to save: ${error.message || 'Network error'}`);
      }
    });
    
    // Mark listener as attached to prevent duplicates
    addScheduleForm.dataset.listenerAttached = 'true';
    console.log('✓ Add schedule form listener attached');
  }
}

function closeAddScheduleModal() {
  if (addScheduleModal) {
    addScheduleModal.classList.remove('open');
  }
  if (addScheduleForm) {
    addScheduleForm.reset();
  }
  if (addScheduleCalendar) {
    addScheduleCalendar.innerHTML = '';
  }
}

// Generate schedule calendar based on frequency
function generateScheduleCalendar(frequency) {
  generateScheduleCalendarWithExisting(frequency, null);
}

// Generate schedule calendar with existing schedule data
function generateScheduleCalendarWithExisting(frequency, existingSchedule) {
  if (!addScheduleCalendar) return;
  addScheduleCalendar.innerHTML = '';
  
  if (frequency === 'Weekly') {
    generateWeeklySchedule(existingSchedule);
  } else if (frequency === 'Monthly') {
    generateMonthlySchedule(existingSchedule);
  } else if (frequency === 'Quarterly') {
    generateQuarterlySchedule(existingSchedule);
  }
}

function generateWeeklySchedule(existingSchedule = null) {
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
  addScheduleCalendar.appendChild(yearSelect);
  
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
    
    updateAddButtonState(monthDiv);
  });
  
  addScheduleCalendar.appendChild(monthsDiv);
  
  // Populate existing schedule if available
  if (existingSchedule) {
    months.forEach(month => {
      if (existingSchedule[month]) {
        const monthDiv = monthsDiv.querySelector(`[data-month="${month}"]`);
        if (monthDiv) {
          const monthSchedule = existingSchedule[month];
          
          // Weekly schedule structure: { "January": { "Week1": "2025-01-15", "Week2": "2025-01-22", ... } }
          if (typeof monthSchedule === 'object' && monthSchedule !== null) {
            // Handle nested object structure (Weekly)
            Object.keys(monthSchedule).forEach(weekKey => {
              const dateValue = monthSchedule[weekKey];
              if (dateValue) {
                let normalizedDate = typeof dateValue === 'string' && dateValue.includes('T') 
                  ? dateValue.split('T')[0] 
                  : dateValue;
                
                // Extract week number from key (e.g., "Week1" -> 1)
                const weekMatch = weekKey.match(/Week(\d+)/);
                if (weekMatch) {
                  const weekNumber = parseInt(weekMatch[1]);
                  const weeksDiv = monthDiv.querySelector('.calendar-weeks');
                  
                  // Add weeks up to the required number
                  while (weeksDiv.querySelectorAll('.calendar-week').length < weekNumber) {
                    addWeekToMonth(month, monthDiv);
                  }
                  
                  // Find the week div and set its date input value
                  const weekDiv = weeksDiv.querySelector(`[data-week="${weekNumber}"]`);
                  if (weekDiv) {
                    const dateInput = weekDiv.querySelector('.calendar-date-input');
                    if (dateInput) {
                      dateInput.value = normalizedDate;
                    }
                  }
                }
              }
            });
          } else if (typeof monthSchedule === 'string') {
            // Handle simple string structure (legacy or Monthly format)
            let normalizedDate = monthSchedule.includes('T') ? monthSchedule.split('T')[0] : monthSchedule;
            addDateToMonth(month, monthDiv);
            const dateInput = monthDiv.querySelector('input[type="date"]');
            if (dateInput) {
              dateInput.value = normalizedDate;
            }
          }
        }
      }
    });
  }
}

function generateMonthlySchedule(existingSchedule = null) {
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
  addScheduleCalendar.appendChild(yearSelect);
  
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
    addDateBtn.addEventListener('click', () => addDateToMonth(month, monthDiv));
    monthHeader.appendChild(addDateBtn);
    
    monthDiv.appendChild(monthHeader);
    
    const datesDiv = document.createElement('div');
    datesDiv.className = 'calendar-weeks';
    datesDiv.dataset.month = month;
    monthDiv.appendChild(datesDiv);
    
    monthsDiv.appendChild(monthDiv);
    updateAddButtonStateMonthly(monthDiv);
  });
  
  addScheduleCalendar.appendChild(monthsDiv);
  
  // Populate existing schedule if available (for Monthly)
  if (existingSchedule) {
    months.forEach(month => {
      if (existingSchedule[month]) {
        const monthDiv = monthsDiv.querySelector(`[data-month="${month}"]`);
        if (monthDiv) {
          const dateValue = existingSchedule[month];
          if (typeof dateValue === 'string') {
            let normalizedDate = dateValue.includes('T') ? dateValue.split('T')[0] : dateValue;
            addDateToMonth(month, monthDiv);
            const dateInput = monthDiv.querySelector('input[type="date"]');
            if (dateInput) {
              dateInput.value = normalizedDate;
            }
          }
        }
      }
    });
  }
}

function addDateToMonth(month, monthDiv) {
  const datesDiv = monthDiv.querySelector('.calendar-weeks');
  if (!datesDiv) return;
  
  const existingDates = datesDiv.querySelectorAll('.calendar-week');
  
  if (existingDates.length >= 1) {
    alert('Maximum 1 date per month allowed');
    return;
  }
  
  const dateDiv = document.createElement('div');
  dateDiv.className = 'calendar-week';
  
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.className = 'calendar-date-input';
  dateInput.name = `schedule[${month}]`;
  dateInput.style.width = '100%';
  dateInput.style.marginTop = '0.5rem';
  dateDiv.appendChild(dateInput);
  
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-week-btn';
  removeBtn.textContent = '×';
  removeBtn.title = 'Remove date';
  removeBtn.addEventListener('click', () => {
    dateDiv.remove();
    updateAddButtonStateMonthly(monthDiv);
  });
  dateDiv.appendChild(removeBtn);
  
  datesDiv.appendChild(dateDiv);
  updateAddButtonStateMonthly(monthDiv);
}

function updateAddButtonStateMonthly(monthDiv) {
  const addDateBtn = monthDiv.querySelector('.add-week-btn');
  const datesDiv = monthDiv.querySelector('.calendar-weeks');
  if (addDateBtn && datesDiv) {
    const existingDates = datesDiv.querySelectorAll('.calendar-week');
    addDateBtn.disabled = existingDates.length >= 1;
  }
}

function addWeekToMonth(month, monthDiv) {
  const weeksDiv = monthDiv.querySelector('.calendar-weeks');
  if (!weeksDiv) return;
  
  const existingWeeks = weeksDiv.querySelectorAll('.calendar-week');
  const weekNumber = existingWeeks.length + 1;
  
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


function generateQuarterlySchedule(existingSchedule = null) {
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
  addScheduleCalendar.appendChild(yearSelect);
  
  const quartersContainer = document.createElement('div');
  quartersContainer.className = 'calendar-months';
  
  const quarters = ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)'];
  
  quarters.forEach((quarter) => {
    const quarterDiv = document.createElement('div');
    quarterDiv.className = 'calendar-month';
    quarterDiv.dataset.quarter = quarter;
    
    const quarterHeader = document.createElement('div');
    quarterHeader.className = 'calendar-month-header';
    
    const quarterName = document.createElement('span');
    quarterName.style.fontWeight = '600';
    quarterName.style.color = '#374151';
    quarterName.textContent = quarter;
    quarterHeader.appendChild(quarterName);
    
    const addDateBtn = document.createElement('button');
    addDateBtn.type = 'button';
    addDateBtn.className = 'add-week-btn';
    addDateBtn.textContent = '+';
    addDateBtn.title = 'Add date';
    addDateBtn.dataset.quarter = quarter;
    addDateBtn.addEventListener('click', () => addDateToQuarter(quarter, quarterDiv));
    quarterHeader.appendChild(addDateBtn);
    
    quarterDiv.appendChild(quarterHeader);
    
    const datesDiv = document.createElement('div');
    datesDiv.className = 'calendar-weeks';
    datesDiv.dataset.quarter = quarter;
    quarterDiv.appendChild(datesDiv);
    
    quartersContainer.appendChild(quarterDiv);
    updateAddButtonStateQuarterly(quarterDiv);
    
    // Populate existing schedule if available
    if (existingSchedule) {
      const quarterKeys = [quarter, quarter.replace(' (Jan-Mar)', '').replace(' (Apr-Jun)', '').replace(' (Jul-Sep)', '').replace(' (Oct-Dec)', '')];
      for (const key of quarterKeys) {
        if (existingSchedule[key]) {
          const dateValue = existingSchedule[key];
          if (typeof dateValue === 'string') {
            // Add the date input with existing value
            addDateToQuarter(quarter, quarterDiv);
            const dateInput = datesDiv.querySelector('input[type="date"]');
            if (dateInput) {
              let normalizedDate = dateValue.includes('T') ? dateValue.split('T')[0] : dateValue;
              dateInput.value = normalizedDate;
            }
            break;
          }
        }
      }
    }
  });
  
  addScheduleCalendar.appendChild(quartersContainer);
}

function addDateToQuarter(quarter, quarterDiv) {
  const datesDiv = quarterDiv.querySelector('.calendar-weeks');
  if (!datesDiv) return;
  
  const existingDates = datesDiv.querySelectorAll('.calendar-week');
  
  if (existingDates.length >= 1) {
    alert('Maximum 1 date per quarter allowed');
    return;
  }
  
  const dateDiv = document.createElement('div');
  dateDiv.className = 'calendar-week';
  
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.className = 'calendar-date-input';
  dateInput.name = `schedule[${quarter}]`;
  dateInput.style.width = '100%';
  dateInput.style.marginTop = '0.5rem';
  
  // Note: existingSchedule is not available here since this function is called
  // when user clicks "+" to add a new date. Existing dates are populated
  // when generateQuarterlySchedule is called initially.
    
    dateDiv.appendChild(dateInput);
  
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-week-btn';
  removeBtn.textContent = '×';
  removeBtn.title = 'Remove date';
  removeBtn.addEventListener('click', () => {
    dateDiv.remove();
    updateAddButtonStateQuarterly(quarterDiv);
  });
  dateDiv.appendChild(removeBtn);
  
  datesDiv.appendChild(dateDiv);
  updateAddButtonStateQuarterly(quarterDiv);
}

function updateAddButtonStateQuarterly(quarterDiv) {
  const addDateBtn = quarterDiv.querySelector('.add-week-btn');
  const datesDiv = quarterDiv.querySelector('.calendar-weeks');
  if (addDateBtn && datesDiv) {
    const existingDates = datesDiv.querySelectorAll('.calendar-week');
    addDateBtn.disabled = existingDates.length >= 1;
  }
}

// Handle task click - initialize pending inspections then navigate
async function handleTaskClick(event, maintenanceId, taskName, taskLink) {
  event.preventDefault();
  
  // Decode parameters (they're encoded in the onclick)
  const decodedMaintenanceId = decodeURIComponent(maintenanceId);
  const decodedTaskName = decodeURIComponent(taskName);
  
  console.log('🔵 handleTaskClick called:', {
    maintenanceId: decodedMaintenanceId,
    taskName: decodedTaskName,
    taskLink: taskLink
  });
  
  // Show loading indicator
  const linkElement = event.target;
  const originalText = linkElement.textContent;
  linkElement.textContent = 'Loading...';
  linkElement.style.opacity = '0.6';
  linkElement.style.pointerEvents = 'none';
  
  try {
    // Initialize pending inspections for this task
    console.log(`📤 Calling API to initialize pending inspections for task: "${decodedTaskName}" (maintenanceId: ${decodedMaintenanceId})`);
    
    const response = await fetch('/api/maintenance/initialize-pending-inspections', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        maintenanceId: decodedMaintenanceId,
        taskName: decodedTaskName
      })
    });
    
    console.log('📥 API Response status:', response.status, response.statusText);
    
    const data = await response.json();
    console.log('📥 API Response data:', data);
    
    if (data.ok) {
      console.log('✅ Pending inspections initialized successfully');
    } else {
      console.warn('⚠️ Failed to initialize pending inspections:', data.error);
      // Continue anyway - don't block navigation
    }
  } catch (error) {
    console.error('❌ Error initializing pending inspections:', error);
    // Continue anyway - don't block navigation
  } finally {
    // Restore link and navigate immediately (no delay)
    linkElement.textContent = originalText;
    linkElement.style.opacity = '1';
    linkElement.style.pointerEvents = 'auto';
    
    // Navigate to the task detail page immediately
    window.location.href = taskLink;
  }
}

// Make function available globally
window.handleTaskClick = handleTaskClick;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initAddScheduleElements();
  setupAddScheduleListeners();
});



// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
// Handle typo: check for both maintenanceId and common typos (maintenanceld with lowercase 'l')
let maintenanceId = urlParams.get('maintenanceId') || urlParams.get('maintenanceld') || urlParams.get('maintenanceid');
// Legacy support
const branch = urlParams.get('branch');
const location = urlParams.get('location');
const itemName = urlParams.get('itemName');

// Fix URL if typo detected - automatically correct it
if (!urlParams.get('maintenanceId') && maintenanceId) {
  const newUrl = new URL(window.location);
  newUrl.searchParams.delete('maintenanceld');
  newUrl.searchParams.delete('maintenanceid');
  if (maintenanceId) {
    newUrl.searchParams.set('maintenanceId', maintenanceId);
  }
  window.history.replaceState({}, '', newUrl);
}

let currentMaintenance = null;
let maintenanceAssets = []; // Assets assigned to this maintenance task
let allAssets = []; // All available assets

// Initialize stats immediately on load
function initializeStats() {
  const totalAssetsEl = document.getElementById('total-assets');
  const assetsRemainingEl = document.getElementById('assets-remaining');
  const daysRemainingEl = document.getElementById('days-remaining');
  
  if (totalAssetsEl) totalAssetsEl.textContent = '0';
  if (assetsRemainingEl) assetsRemainingEl.textContent = '0';
  if (daysRemainingEl) daysRemainingEl.textContent = '-';
}

// Initialize stats immediately when script loads (before DOM ready)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeStats);
} else {
  // DOM already loaded, set immediately
  initializeStats();
}

// Load maintenance details and assets
async function loadMaintenanceAssets() {
  console.log('Loading maintenance assets...', { maintenanceId, branch, location, itemName });
  
  if (!maintenanceId && (!branch || !location || !itemName)) {
    console.error('Missing required parameters');
    document.body.innerHTML = '<div style="padding: 2rem; text-align: center;"><h1>Parameters Required</h1><p>Please provide maintenanceId in the URL.</p><a href="maintenancetask.html">← Back to inspection tasks</a></div>';
    return;
  }

  try {
    // Initialize stats to 0 first
    updateStats();
    
    // Load maintenance details
    const url = maintenanceId 
      ? `./get_maintenance.php?maintenanceId=${encodeURIComponent(maintenanceId)}`
      : `./get_maintenance.php?branch=${encodeURIComponent(branch)}&location=${encodeURIComponent(location)}&itemName=${encodeURIComponent(itemName)}`;
    
    const maintenanceResp = await fetch(url);
    const maintenanceData = await maintenanceResp.json();

    if (!maintenanceResp.ok || !maintenanceData.ok) {
      const backUrl = maintenanceId 
        ? `maintenancetask.html?maintenanceId=${encodeURIComponent(maintenanceId)}`
        : `maintenancetask.html?branch=${encodeURIComponent(branch)}&location=${encodeURIComponent(location)}&itemName=${encodeURIComponent(itemName)}`;
      document.body.innerHTML = `<div style="padding: 2rem; text-align: center;"><h1>Maintenance Item Not Found</h1><p>${maintenanceData.error || 'Could not load maintenance details.'}</p><a href="${backUrl}">← Back to inspection tasks</a></div>`;
      return;
    }

    currentMaintenance = maintenanceData.maintenance;
    console.log('Current maintenance loaded:', currentMaintenance);
    
    // Ensure maintenanceId is set
    if (!maintenanceId && currentMaintenance._id) {
      maintenanceId = currentMaintenance._id;
      // Update URL with maintenanceId for cleaner URL
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('maintenanceId', currentMaintenance._id);
      newUrl.searchParams.delete('branch');
      newUrl.searchParams.delete('location');
      newUrl.searchParams.delete('itemName');
      newUrl.searchParams.delete('maintenanceld'); // Remove typo
      newUrl.searchParams.delete('maintenanceid'); // Remove lowercase version
      window.history.replaceState({}, '', newUrl);
    } else if (currentMaintenance._id) {
      maintenanceId = currentMaintenance._id;
    }
    
    // Update stats with maintenance info (this will calculate days until next maintenance)
    console.log('Updating stats with maintenance data...');
    updateStats();
    
    // Load assets for this maintenance
    await loadAssets();
    
    // Update stats again after loading assets
    updateStats();
    
    // Set back link
    const backLink = document.getElementById('back-link');
    if (backLink) {
      const backUrl = currentMaintenance._id 
        ? `maintenancetask.html?maintenanceId=${encodeURIComponent(currentMaintenance._id)}`
        : `maintenancetask.html?branch=${encodeURIComponent(branch)}&location=${encodeURIComponent(location)}&itemName=${encodeURIComponent(itemName)}`;
      backLink.href = backUrl;
    }
  } catch (error) {
    console.error('Error loading maintenance assets:', error);
    document.body.innerHTML = `<div style="padding: 2rem; text-align: center;"><h1>Error</h1><p>Could not load maintenance assets: ${error.message}</p><a href="maintenancetask.html">← Back to inspection tasks</a></div>`;
  }
}

// Load assets assigned to this maintenance
async function loadAssets() {
  try {
    const id = currentMaintenance?._id || maintenanceId;
    const url = id
      ? `./get_maintenance_assets.php?maintenanceId=${encodeURIComponent(id)}`
      : `./get_maintenance_assets.php?branch=${encodeURIComponent(branch)}&location=${encodeURIComponent(location)}&itemName=${encodeURIComponent(itemName)}`;
    
    const resp = await fetch(url);
    const data = await resp.json();

    if (resp.ok && data.ok) {
      maintenanceAssets = data.assets || [];
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
  const assetsList = document.getElementById('assets-list');
  if (!assetsList) return;

  if (maintenanceAssets.length === 0) {
    assetsList.innerHTML = `
      <div class="no-assets">
        <p>No assets assigned to this maintenance task yet.</p>
        <p style="margin-top: 0.5rem; font-size: 0.9rem; color: #888;">Click "Add Asset" to assign assets for inspection.</p>
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
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      ${maintenanceAssets.map(asset => {
        const inspectionStatus = asset.inspectionStatus || 'open';
        const statusClass = inspectionStatus === 'complete' ? 'status-complete' : 'status-open';
        const statusText = inspectionStatus === 'complete' ? 'Complete' : 'Open';
        
        return `
          <tr>
            <td class="asset-id">${asset.assetId || '-'}</td>
            <td class="asset-name">${asset.assetDescription || '-'}</td>
            <td class="asset-category">${asset.assetCategoryDescription || asset.assetCategory || '-'}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
              <button class="btn-inspect" onclick="openInspectionModal('${asset.assetId}')" ${inspectionStatus === 'complete' ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                ${inspectionStatus === 'complete' ? 'Completed' : 'Inspect'}
              </button>
              <button class="btn-view-more-asset" onclick="viewAssetDetails('${asset.assetId}')">View Details</button>
              <button class="btn-remove-asset" onclick="removeAsset('${asset.assetId}')">Remove</button>
            </td>
          </tr>
        `;
      }).join('')}
    </tbody>
  `;
  
  assetsList.innerHTML = '';
  assetsList.appendChild(table);
}

// Update statistics
function updateStats() {
  // Calculate total assets and remaining (incomplete) assets
  const totalAssets = maintenanceAssets ? maintenanceAssets.length : 0;
  const assetsRemaining = maintenanceAssets ? maintenanceAssets.filter(asset => (asset.inspectionStatus || 'open') !== 'complete').length : 0;
  
  // Update total assets display
  const totalAssetsEl = document.getElementById('total-assets');
  if (totalAssetsEl) {
    totalAssetsEl.textContent = totalAssets;
  }
  
  // Update assets remaining display
  const assetsRemainingEl = document.getElementById('assets-remaining');
  if (assetsRemainingEl) {
    assetsRemainingEl.textContent = assetsRemaining;
  }
  
  // Calculate days until next maintenance
  const daysRemainingEl = document.getElementById('days-remaining');
  if (daysRemainingEl) {
    if (currentMaintenance && currentMaintenance.maintenanceSchedule && currentMaintenance.frequency) {
      try {
        const scheduleDates = extractScheduleDates(currentMaintenance.maintenanceSchedule, currentMaintenance.frequency);
        const nextDate = findNextScheduledDate(scheduleDates);
        const daysUntil = nextDate ? getDaysUntil(nextDate) : null;
        
        if (daysUntil !== null && !isNaN(daysUntil)) {
          if (daysUntil < 0) {
            daysRemainingEl.textContent = `${Math.abs(daysUntil)} days overdue`;
          } else if (daysUntil === 0) {
            daysRemainingEl.textContent = 'Due today';
          } else {
            daysRemainingEl.textContent = `${daysUntil} days`;
          }
        } else {
          daysRemainingEl.textContent = '-';
        }
      } catch (error) {
        console.error('Error calculating days until maintenance:', error);
        daysRemainingEl.textContent = '-';
      }
    } else {
      daysRemainingEl.textContent = '-';
    }
  }
}

// Helper functions from inspectiontask.js
function extractScheduleDates(schedule, frequency) {
  if (!schedule || typeof schedule !== 'object') return [];
  
  const dates = [];
  
  if (frequency === 'Weekly') {
    // schedule format: { "January": { "Week1": "2024-01-05", ... }, ... }
    Object.values(schedule).forEach(monthSchedule => {
      if (typeof monthSchedule === 'object') {
        Object.values(monthSchedule).forEach(dateStr => {
          if (dateStr) {
            const date = new Date(dateStr);
            if (date && !isNaN(date.getTime())) {
              dates.push(date);
            }
          }
        });
      }
    });
  } else if (frequency === 'Monthly') {
    // schedule format: { "January": "2024-01-15", "February": "2024-02-15", ... }
    Object.values(schedule).forEach(dateStr => {
      if (dateStr) {
        const date = new Date(dateStr);
        if (date && !isNaN(date.getTime())) {
          dates.push(date);
        }
      }
    });
  } else if (frequency === 'Quarterly') {
    // schedule format: { "Q1": { "January": "15", "February": "20", ... }, ... }
    const currentYear = new Date().getFullYear();
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    
    Object.entries(schedule).forEach(([quarter, quarterSchedule]) => {
      if (typeof quarterSchedule === 'object') {
        Object.entries(quarterSchedule).forEach(([monthName, dayStr]) => {
          if (dayStr) {
            const monthIndex = months.indexOf(monthName);
            if (monthIndex !== -1) {
              const day = parseInt(dayStr, 10);
              if (day >= 1 && day <= 31) {
                const date = new Date(currentYear, monthIndex, day);
                if (date && !isNaN(date.getTime())) {
                  dates.push(date);
                }
                // Also add for next year
                const dateNextYear = new Date(currentYear + 1, monthIndex, day);
                if (dateNextYear && !isNaN(dateNextYear.getTime())) {
                  dates.push(dateNextYear);
                }
              }
            }
          }
        });
      }
    });
  }
  
  // Sort dates ascending (includes past and future dates)
  dates.sort((a, b) => a - b);
  return dates;
}

function findNextScheduledDate(dates) {
  if (!dates || dates.length === 0) return null;
  
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  for (const date of dates) {
    if (date >= now) {
      return date;
    }
  }
  
  return dates[dates.length - 1];
}

function getDaysUntil(date) {
  if (!date) return null;
  
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  const diffTime = targetDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

// View asset details
window.viewAssetDetails = function(assetId) {
  window.location.href = `../asset/assetdetails.html?assetId=${encodeURIComponent(assetId)}`;
};

// Remove asset from maintenance
window.removeAsset = async function(assetId) {
  if (!confirm(`Are you sure you want to remove this asset from the maintenance task?`)) {
    return;
  }

  try {
    const resp = await fetch('./remove_maintenance_asset.php', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        branch: branch,
        location: location,
        itemName: itemName,
        assetId: assetId
      })
    });

    const data = await resp.json();

    if (!resp.ok || !data.ok) {
      alert(`Remove failed: ${data.error || 'Unknown error'}`);
      return;
    }

    alert('Asset removed successfully!');
    await loadAssets();
    updateStats();
  } catch (error) {
    console.error('Error removing asset:', error);
    alert(`Remove failed: ${error.message || 'Network error'}`);
  }
};

// Open add asset modal
function openAddAssetModal() {
  const modal = document.getElementById('add-asset-modal-overlay');
  if (modal) {
    loadAllAssetsForSelection();
    modal.classList.add('open');
  }
}

// Load all assets for selection
async function loadAllAssetsForSelection() {
  const container = document.getElementById('asset-select-list');
  if (!container) return;
  
  // Show loading state
  container.innerHTML = '<p style="padding: 2rem; text-align: center; color: #6b7280;">Loading assets...</p>';
  
  try {
    const resp = await fetch('../asset/list_assets.php');
    const data = await resp.json();

    if (resp.ok && data.ok) {
      allAssets = data.assets || [];
      
      // Filter out assets already assigned
      const assignedAssetIds = maintenanceAssets.map(a => a.assetId);
      const availableAssets = allAssets.filter(asset => !assignedAssetIds.includes(asset.assetId));
      
      displayAssetSelection(availableAssets);
    } else {
      container.innerHTML = '<p style="padding: 2rem; text-align: center; color: #888;">No assets available</p>';
    }
  } catch (error) {
    console.error('Error loading all assets:', error);
    container.innerHTML = '<p style="padding: 2rem; text-align: center; color: #dc2626;">Error loading assets: ' + (error.message || 'Unknown error') + '</p>';
  }
}

// Display asset selection table
function displayAssetSelection(assets) {
  const container = document.getElementById('asset-select-list');
  if (!container) return;

  if (assets.length === 0) {
    container.innerHTML = '<p style="padding: 2rem; text-align: center; color: #888;">All available assets are already assigned to this maintenance task.</p>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'asset-select-table';
  
  table.innerHTML = `
    <thead>
      <tr>
        <th><input type="checkbox" id="select-all-assets" onchange="toggleAllAssets(this.checked)"></th>
        <th>Asset ID</th>
        <th>Description</th>
        <th>Category</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      ${assets.map(asset => `
        <tr>
          <td><input type="checkbox" class="asset-select-checkbox" value="${asset.assetId}" data-asset-id="${asset.assetId}"></td>
          <td class="asset-select-id">${asset.assetId || '-'}</td>
          <td class="asset-select-name">${asset.assetDescription || '-'}</td>
          <td class="asset-select-category">${asset.assetCategoryDescription || asset.assetCategory || '-'}</td>
          <td><a href="../asset/assetdetails.html?assetId=${encodeURIComponent(asset.assetId)}" class="btn-view-more" target="_blank">View</a></td>
        </tr>
      `).join('')}
    </tbody>
  `;
  
  container.innerHTML = '';
  container.appendChild(table);
}

// Toggle all assets selection
window.toggleAllAssets = function(checked) {
  const checkboxes = document.querySelectorAll('.asset-select-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = checked;
  });
};

// Add selected assets
async function addSelectedAssets() {
  const checkboxes = document.querySelectorAll('.asset-select-checkbox:checked');
  const selectedAssetIds = Array.from(checkboxes).map(cb => cb.value);

  if (selectedAssetIds.length === 0) {
    alert('Please select at least one asset to add.');
    return;
  }

  try {
    const id = currentMaintenance?._id || maintenanceId;
    const payload = { assetIds: selectedAssetIds };
    if (id) {
      payload.maintenanceId = id;
    } else {
      payload.branch = branch;
      payload.location = location;
      payload.itemName = itemName;
    }
    
    const resp = await fetch('./add_maintenance_assets.php', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });

    const data = await resp.json();

    if (!resp.ok || !data.ok) {
      alert(`Add failed: ${data.error || 'Unknown error'}`);
      return;
    }

    alert(`Successfully added ${selectedAssetIds.length} asset(s)!`);
    
    // Close modal
    const modal = document.getElementById('add-asset-modal-overlay');
    if (modal) modal.classList.remove('open');
    
    // Reload assets
    await loadAssets();
    updateStats();
  } catch (error) {
    console.error('Error adding assets:', error);
    alert(`Add failed: ${error.message || 'Network error'}`);
  }
}

// Open inspection modal
window.openInspectionModal = function(assetId) {
  window.currentInspectingAssetId = assetId;
  const modal = document.getElementById('inspection-modal-overlay');
  const form = document.getElementById('inspection-form');
  
  if (modal && form) {
    form.reset();
    modal.classList.add('open');
  }
};

// Setup event listeners
function setupEventListeners() {
  console.log('Setting up event listeners...');
  
  // Add asset button
  const addAssetBtn = document.getElementById('add-asset-btn');
  console.log('Add asset button:', addAssetBtn);
  if (addAssetBtn) {
    addAssetBtn.addEventListener('click', (e) => {
      console.log('Add asset button clicked!');
      e.preventDefault();
      openAddAssetModal();
    });
  } else {
    console.error('Add asset button not found!');
  }

  // Close add asset modal
  const closeAddAssetBtn = document.getElementById('close-add-asset-modal-btn');
  const cancelAddAssetBtn = document.getElementById('cancel-add-asset-btn');
  const addAssetModal = document.getElementById('add-asset-modal-overlay');

  if (closeAddAssetBtn) {
    closeAddAssetBtn.addEventListener('click', () => {
      if (addAssetModal) addAssetModal.classList.remove('open');
    });
  }

  if (cancelAddAssetBtn) {
    cancelAddAssetBtn.addEventListener('click', () => {
      if (addAssetModal) addAssetModal.classList.remove('open');
    });
  }

  if (addAssetModal) {
    addAssetModal.addEventListener('click', (e) => {
      if (e.target === addAssetModal) {
        addAssetModal.classList.remove('open');
      }
    });
  }

  // Save add asset button
  const saveAddAssetBtn = document.getElementById('save-add-asset-btn');
  if (saveAddAssetBtn) {
    saveAddAssetBtn.addEventListener('click', addSelectedAssets);
  }
  
  // Back link - will be set up when data loads, but ensure it's clickable
  const backLink = document.getElementById('back-link');
  console.log('Back link:', backLink);
  if (backLink) {
    // Remove the # href first
    if (backLink.href === '#' || backLink.getAttribute('href') === '#') {
      backLink.href = 'maintenancetask.html';
    }
    
    // Add click handler
    backLink.addEventListener('click', (e) => {
      console.log('Back link clicked!');
      e.preventDefault();
      const id = currentMaintenance?._id || maintenanceId;
      if (id) {
        window.location.href = `maintenancetask.html?maintenanceId=${encodeURIComponent(id)}`;
      } else {
        window.location.href = 'maintenancetask.html';
      }
    });
  } else {
    console.error('Back link not found!');
  }

  // Inspection modal
  const closeInspectionBtn = document.getElementById('close-inspection-modal-btn');
  const cancelInspectionBtn = document.getElementById('cancel-inspection-btn');
  const inspectionModal = document.getElementById('inspection-modal-overlay');
  const inspectionForm = document.getElementById('inspection-form');

  if (closeInspectionBtn) {
    closeInspectionBtn.addEventListener('click', () => {
      if (inspectionModal) inspectionModal.classList.remove('open');
    });
  }

  if (cancelInspectionBtn) {
    cancelInspectionBtn.addEventListener('click', () => {
      if (inspectionModal) inspectionModal.classList.remove('open');
    });
  }

  if (inspectionModal) {
    inspectionModal.addEventListener('click', (e) => {
      if (e.target === inspectionModal) {
        inspectionModal.classList.remove('open');
      }
    });
  }

  // Inspection form submit
  if (inspectionForm) {
    inspectionForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(inspectionForm);
      const id = currentMaintenance?._id || maintenanceId;
      const inspectionData = {
        assetId: window.currentInspectingAssetId,
        notes: formData.get('notes'),
        solved: formData.get('solved') === 'yes'
      };
      
      if (id) {
        inspectionData.maintenanceId = id;
      } else {
        inspectionData.branch = branch;
        inspectionData.location = location;
        inspectionData.itemName = itemName;
      }

      try {
        const resp = await fetch('./save_inspection.php', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(inspectionData)
        });

        const data = await resp.json();

        if (!resp.ok || !data.ok) {
          alert(`Save failed: ${data.error || 'Unknown error'}`);
          return;
        }

        alert('Inspection saved successfully!');
        
        // Close modal
        if (inspectionModal) inspectionModal.classList.remove('open');
        
        // Reload assets
        await loadAssets();
        updateStats();
      } catch (error) {
        console.error('Error saving inspection:', error);
        alert(`Save failed: ${error.message || 'Network error'}`);
      }
    });
  }
}

// Initialize page
function init() {
  console.log('Initializing page...');
  console.log('maintenanceId:', maintenanceId);
  
  // Initialize stats to 0 immediately
  initializeStats();
  
  // Setup event listeners first so they're ready
  setupEventListeners();
  
  // Then load data
  loadMaintenanceAssets();
}

// Start initialization - ensure DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing...');
    init();
  });
} else {
  console.log('DOM already ready, initializing immediately...');
  // Use setTimeout to ensure all scripts are loaded
  setTimeout(init, 100);
}



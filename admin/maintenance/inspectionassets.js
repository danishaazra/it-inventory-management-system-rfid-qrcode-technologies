// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const branch = urlParams.get('branch');
const location = urlParams.get('location');
const itemName = urlParams.get('itemName');
const taskId = urlParams.get('taskId'); // Optional: specific task ID

let currentMaintenance = null;
let maintenanceAssets = []; // Assets assigned to this maintenance task
let allAssets = []; // All available assets

// Load maintenance details and assets
async function loadMaintenanceAssets() {
  if (!branch || !location || !itemName) {
    document.body.innerHTML = '<div style="padding: 2rem; text-align: center;"><h1>Parameters Required</h1><p>Please provide branch, location, and itemName in the URL.</p><a href="maintenancetask.html">← Back to inspection tasks</a></div>';
    return;
  }

  try {
    // Load maintenance details
    const maintenanceResp = await fetch(`./get_maintenance.php?branch=${encodeURIComponent(branch)}&location=${encodeURIComponent(location)}&itemName=${encodeURIComponent(itemName)}`);
    const maintenanceData = await maintenanceResp.json();

    if (!maintenanceResp.ok || !maintenanceData.ok) {
      document.body.innerHTML = `<div style="padding: 2rem; text-align: center;"><h1>Maintenance Item Not Found</h1><p>${maintenanceData.error || 'Could not load maintenance details.'}</p><a href="maintenancetask.html?branch=${encodeURIComponent(branch)}&location=${encodeURIComponent(location)}&itemName=${encodeURIComponent(itemName)}">← Back to inspection tasks</a></div>`;
      return;
    }

    currentMaintenance = maintenanceData.maintenance;
    
    // Load assets for this maintenance
    await loadAssets();
    
    // Calculate stats
    updateStats();
    
    // Set back link
    const backLink = document.getElementById('back-link');
    if (backLink) {
      backLink.href = `maintenancetask.html?branch=${encodeURIComponent(branch)}&location=${encodeURIComponent(location)}&itemName=${encodeURIComponent(itemName)}`;
    }
  } catch (error) {
    console.error('Error loading maintenance assets:', error);
    document.body.innerHTML = `<div style="padding: 2rem; text-align: center;"><h1>Error</h1><p>Could not load maintenance assets: ${error.message}</p><a href="maintenancetask.html">← Back to inspection tasks</a></div>`;
  }
}

// Load assets assigned to this maintenance
async function loadAssets() {
  try {
    const resp = await fetch(`./get_maintenance_assets.php?branch=${encodeURIComponent(branch)}&location=${encodeURIComponent(location)}&itemName=${encodeURIComponent(itemName)}`);
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
  const assetsRemaining = maintenanceAssets.filter(asset => (asset.inspectionStatus || 'open') !== 'complete').length;
  document.getElementById('assets-remaining').textContent = assetsRemaining;
  
  // Calculate days until next maintenance
  if (currentMaintenance && currentMaintenance.maintenanceSchedule) {
    const scheduleDates = extractScheduleDates(currentMaintenance.maintenanceSchedule, currentMaintenance.frequency);
    const nextDate = findNextScheduledDate(scheduleDates);
    const daysUntil = nextDate ? getDaysUntil(nextDate) : null;
    
    if (daysUntil !== null) {
      document.getElementById('days-remaining').textContent = daysUntil < 0 ? `${Math.abs(daysUntil)} days overdue` : `${daysUntil} days`;
    } else {
      document.getElementById('days-remaining').textContent = '-';
    }
  } else {
    document.getElementById('days-remaining').textContent = '-';
  }
}

// Helper functions from inspectiontask.js
function extractScheduleDates(schedule, frequency) {
  if (!schedule || typeof schedule !== 'object') return [];
  
  const dates = [];
  
  if (frequency === 'Weekly') {
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
    Object.values(schedule).forEach(dateStr => {
      if (dateStr) {
        const date = new Date(dateStr);
        if (date && !isNaN(date.getTime())) {
          dates.push(date);
        }
      }
    });
  }
  
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
      document.getElementById('asset-select-list').innerHTML = '<p style="padding: 2rem; text-align: center; color: #888;">No assets available</p>';
    }
  } catch (error) {
    console.error('Error loading all assets:', error);
    document.getElementById('asset-select-list').innerHTML = '<p style="padding: 2rem; text-align: center; color: #dc2626;">Error loading assets</p>';
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
    const resp = await fetch('./add_maintenance_assets.php', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        branch: branch,
        location: location,
        itemName: itemName,
        assetIds: selectedAssetIds
      })
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
  // Add asset button
  const addAssetBtn = document.getElementById('add-asset-btn');
  if (addAssetBtn) {
    addAssetBtn.addEventListener('click', openAddAssetModal);
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
      const inspectionData = {
        branch: branch,
        location: location,
        itemName: itemName,
        assetId: window.currentInspectingAssetId,
        notes: formData.get('notes'),
        solved: formData.get('solved') === 'yes'
      };

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
  loadMaintenanceAssets();
  setupEventListeners();
}

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


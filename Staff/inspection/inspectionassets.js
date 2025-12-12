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
    document.body.innerHTML = '<div style="padding: 2rem; text-align: center;"><h1>Parameters Required</h1><p>Please provide maintenanceId in the URL.</p><a href="inspectiontask.html">← Back to inspection tasks</a></div>';
    return;
  }

  try {
    // Initialize stats to 0 first
    updateStats();
    
    // Load maintenance details
    const url = maintenanceId 
      ? `../../admin/maintenance/get_maintenance.php?maintenanceId=${encodeURIComponent(maintenanceId)}`
      : `../../admin/maintenance/get_maintenance.php?branch=${encodeURIComponent(branch)}&location=${encodeURIComponent(location)}&itemName=${encodeURIComponent(itemName)}`;
    
    const maintenanceResp = await fetch(url);
    const maintenanceData = await maintenanceResp.json();

    if (!maintenanceResp.ok || !maintenanceData.ok) {
      const backUrl = maintenanceId 
        ? `inspectiontask.html?maintenanceId=${encodeURIComponent(maintenanceId)}`
        : `inspectiontask.html?branch=${encodeURIComponent(branch)}&location=${encodeURIComponent(location)}&itemName=${encodeURIComponent(itemName)}`;
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
        ? `inspectiontask.html?maintenanceId=${encodeURIComponent(currentMaintenance._id)}`
        : `inspectiontask.html?branch=${encodeURIComponent(branch)}&location=${encodeURIComponent(location)}&itemName=${encodeURIComponent(itemName)}`;
      backLink.href = backUrl;
    }
  } catch (error) {
    console.error('Error loading maintenance assets:', error);
    document.body.innerHTML = `<div style="padding: 2rem; text-align: center;"><h1>Error</h1><p>Could not load maintenance assets: ${error.message}</p><a href="inspectiontask.html">← Back to inspection tasks</a></div>`;
  }
}

// Load assets assigned to this maintenance
async function loadAssets() {
  try {
    const id = currentMaintenance?._id || maintenanceId;
    const url = id
      ? `../../admin/maintenance/get_maintenance_assets.php?maintenanceId=${encodeURIComponent(id)}`
      : `../../admin/maintenance/get_maintenance_assets.php?branch=${encodeURIComponent(branch)}&location=${encodeURIComponent(location)}&itemName=${encodeURIComponent(itemName)}`;
    
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

// Display assets grouped by upcoming days
function displayAssets() {
  const assetsList = document.getElementById('assets-list');
  if (!assetsList) return;

  if (maintenanceAssets.length === 0) {
    assetsList.innerHTML = `
      <div class="no-assets">
        <p>No assets assigned to this maintenance task yet.</p>
      </div>
    `;
    return;
  }

  // Create cards for each asset
  const assetsHtml = maintenanceAssets.map(asset => {
    const inspectionStatus = asset.inspectionStatus || 'open';
    const statusClass = inspectionStatus === 'complete' ? 'status-complete' : 'status-open';
    const statusText = inspectionStatus === 'complete' ? 'Complete' : 'Open';
    
    return `
      <div class="asset-card" style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.75rem;">
              <div style="font-weight: 600; font-size: 1rem; color: #111827;">${escapeHtml(asset.assetId || '-')}</div>
              <span class="status-badge ${statusClass}" style="padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">${statusText}</span>
            </div>
            <div style="font-weight: 500; color: #374151; margin-bottom: 0.5rem;">${escapeHtml(asset.assetDescription || '-')}</div>
            <div style="font-size: 0.875rem; color: #6b7280;">${escapeHtml(asset.assetCategoryDescription || asset.assetCategory || '-')}</div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <button class="btn-inspect" onclick="openInspectionModal('${asset.assetId}')" ${inspectionStatus === 'complete' ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''} style="padding: 0.5rem 1rem; border: none; border-radius: 8px; background: ${inspectionStatus === 'complete' ? '#10b981' : '#140958'}; color: #ffffff; font-size: 0.875rem; font-weight: 600; cursor: pointer;">
              ${inspectionStatus === 'complete' ? 'Completed' : 'Inspect'}
            </button>
            <button class="btn-view-more-asset" onclick="viewAssetDetails('${asset.assetId}')" style="padding: 0.5rem 1rem; border: 1px solid #d1d5db; border-radius: 8px; background: #ffffff; color: #374151; font-size: 0.875rem; font-weight: 600; cursor: pointer;">
              View Details
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  assetsList.innerHTML = assetsHtml;
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Extract all dates from maintenanceSchedule based on frequency
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
  } else if (frequency === 'Quarterly') {
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
  
  dates.sort((a, b) => a - b);
  return dates;
}

// Update statistics
function updateStats() {
  // Calculate total assets and remaining (incomplete) assets
  const totalAssets = maintenanceAssets ? maintenanceAssets.length : 0;
  const assetsRemaining = maintenanceAssets ? maintenanceAssets.filter(a => (a.inspectionStatus || 'open') !== 'complete').length : 0;
  
  const totalAssetsEl = document.getElementById('total-assets');
  const assetsRemainingEl = document.getElementById('assets-remaining');
  const daysRemainingEl = document.getElementById('days-remaining');
  
  if (totalAssetsEl) totalAssetsEl.textContent = totalAssets.toString();
  if (assetsRemainingEl) assetsRemainingEl.textContent = assetsRemaining.toString();
  
  // Calculate days until next maintenance
  if (daysRemainingEl && currentMaintenance) {
    const daysUntil = getDaysUntilNextMaintenance(currentMaintenance);
    if (daysUntil !== null) {
      daysRemainingEl.textContent = daysUntil >= 0 ? daysUntil.toString() : `Overdue by ${Math.abs(daysUntil)}`;
    } else {
      daysRemainingEl.textContent = '-';
    }
  }
}

// Calculate days until next maintenance
function getDaysUntilNextMaintenance(maintenance) {
  if (!maintenance || !maintenance.maintenanceSchedule || !maintenance.frequency) {
    return null;
  }
  
  const scheduleDates = extractScheduleDates(maintenance.maintenanceSchedule, maintenance.frequency);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  // Find next upcoming date
  const nextDate = scheduleDates.find(d => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    return date >= now;
  });
  
  if (!nextDate) {
    return null;
  }
  
  const next = new Date(nextDate);
  next.setHours(0, 0, 0, 0);
  
  const diffTime = next - now;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

// View asset details - Staff version links to inspectionassetdetails.html
window.viewAssetDetails = function(assetId) {
  const url = `inspectionassetdetails.html?assetId=${encodeURIComponent(assetId)}`;
  const urlWithMaintenance = maintenanceId ? `${url}&maintenanceId=${encodeURIComponent(maintenanceId)}` : url;
  window.location.href = urlWithMaintenance;
};

// Open inspection modal
let currentInspectingAssetId = null;

window.openInspectionModal = function(assetId) {
  currentInspectingAssetId = assetId;
  const modal = document.getElementById('inspection-modal-overlay');
  if (modal) {
    // Reset form
    const form = document.getElementById('inspection-form');
    if (form) {
      form.reset();
    }
    modal.classList.add('open');
  }
};

// Close inspection modal
function closeInspectionModal() {
  const modal = document.getElementById('inspection-modal-overlay');
  if (modal) {
    modal.classList.remove('open');
    currentInspectingAssetId = null;
    const form = document.getElementById('inspection-form');
    if (form) {
      form.reset();
    }
  }
}

// Save inspection
async function saveInspection(formData) {
  if (!currentInspectingAssetId || !maintenanceId && !(branch && location && itemName)) {
    alert('Cannot save inspection: Missing asset or maintenance information');
    return;
  }

  try {
    const url = '../../admin/maintenance/save_inspection.php';
    const body = {
      assetId: currentInspectingAssetId,
      notes: formData.notes,
      solved: formData.solved,
      inspectionStatus: formData.solved === 'yes' ? 'complete' : 'open'
    };
    
    if (maintenanceId) {
      body.maintenanceId = maintenanceId;
    } else {
      body.branch = branch;
      body.location = location;
      body.itemName = itemName;
    }
    
    const resp = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    });

    const data = await resp.json();

    if (!resp.ok || !data.ok) {
      alert(`Save failed: ${data.error || 'Unknown error'}`);
      return;
    }

    alert('Inspection saved successfully!');
    closeInspectionModal();
    await loadAssets();
    updateStats();
  } catch (error) {
    console.error('Error saving inspection:', error);
    alert(`Save failed: ${error.message || 'Network error'}`);
  }
}

// Initialize event listeners
function initEventListeners() {
  // Inspection form submit
  const inspectionForm = document.getElementById('inspection-form');
  if (inspectionForm) {
    inspectionForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(inspectionForm);
      await saveInspection({
        notes: formData.get('notes'),
        solved: formData.get('solved')
      });
    });
  }
  
  // Close inspection modal buttons
  const closeInspectionModalBtn = document.getElementById('close-inspection-modal-btn');
  if (closeInspectionModalBtn) {
    closeInspectionModalBtn.addEventListener('click', closeInspectionModal);
  }
  
  const cancelInspectionBtn = document.getElementById('cancel-inspection-btn');
  if (cancelInspectionBtn) {
    cancelInspectionBtn.addEventListener('click', closeInspectionModal);
  }
  
  // Close modal when clicking outside
  const inspectionModal = document.getElementById('inspection-modal-overlay');
  if (inspectionModal) {
    inspectionModal.addEventListener('click', (e) => {
      if (e.target === inspectionModal) {
        closeInspectionModal();
      }
    });
  }
}

// Initialize page
function init() {
  loadMaintenanceAssets();
  initEventListeners();
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


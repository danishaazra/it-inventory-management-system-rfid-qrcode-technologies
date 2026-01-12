// Inspection Asset Details Page
// Shows detailed inspection information for a specific asset

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const assetId = urlParams.get('assetId');
const maintenanceId = urlParams.get('maintenanceId');

// State
let assetData = null;
let inspectionData = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  updateBackLink();
  loadAssetDetails();
  loadUserInfo();
});

// Update back link
function updateBackLink() {
  const backLink = document.getElementById('back-link');
  if (backLink && maintenanceId) {
    backLink.href = `inspection_task_detail.html?maintenanceId=${encodeURIComponent(maintenanceId)}&taskIndex=0`;
  } else if (backLink) {
    backLink.href = 'maintenance.html';
  }
}

// Load user info
async function loadUserInfo() {
  try {
    const resp = await fetch('/api/auth/me');
    if (resp.ok) {
      const data = await resp.json();
      if (data.ok && data.user) {
        const userNameEl = document.getElementById('user-name');
        const userAvatarEl = document.getElementById('user-avatar');
        if (userNameEl) userNameEl.textContent = data.user.name || data.user.username || 'admin';
        if (userAvatarEl) userAvatarEl.textContent = (data.user.name || data.user.username || 'U').charAt(0).toUpperCase();
      }
    }
  } catch (error) {
    console.error('Error loading user info:', error);
  }
}

// Load asset details
async function loadAssetDetails() {
  if (!assetId) {
    showError('Asset ID is required');
    return;
  }

  try {
    // Load asset data
    const assetResp = await fetch(`/api/assets/get?assetId=${encodeURIComponent(assetId)}`);
    const assetData = await assetResp.json();

    if (!assetResp.ok || !assetData.ok) {
      showError(assetData.error || 'Failed to load asset details');
      return;
    }

    // Load inspection data if maintenanceId is provided
    let inspectionData = null;
    let maintenanceData = null;
    
    if (maintenanceId) {
      try {
        // Load maintenance item to get staff information
        const maintenanceResp = await fetch(`/api/maintenance/get?maintenanceId=${encodeURIComponent(maintenanceId)}`);
        const maintenanceDataResp = await maintenanceResp.json();
        
        if (maintenanceResp.ok && maintenanceDataResp.ok && maintenanceDataResp.maintenance) {
          maintenanceData = maintenanceDataResp.maintenance;
        }
        
        // Load inspection data for the asset
        const inspectionResp = await fetch(`/api/maintenance/assets?maintenanceId=${encodeURIComponent(maintenanceId)}`);
        const inspectionDataResp = await inspectionResp.json();
        
        if (inspectionResp.ok && inspectionDataResp.ok && inspectionDataResp.assets) {
          // Find the specific asset in the maintenance assets
          inspectionData = inspectionDataResp.assets.find(a => a.assetId === assetId);
        }
      } catch (error) {
        console.error('Error loading inspection data:', error);
        // Continue without inspection data
      }
    }

    displayAssetDetails(assetData.asset, inspectionData, maintenanceData);
  } catch (error) {
    console.error('Error loading asset details:', error);
    showError(`Failed to load asset details: ${error.message || 'Network error'}`);
  }
}

// Display asset details
function displayAssetDetails(asset, inspection, maintenance) {
  const contentDiv = document.getElementById('asset-details-content');
  if (!contentDiv) return;

  // Get inspection data
  // Staff in charge - from maintenance item or inspection data
  const staffInCharge = maintenance?.assignedStaffName || 
                        maintenance?.staffName || 
                        inspection?.assignedStaffName || 
                        inspection?.staffName || 
                        '-';
  
  const dateInspection = inspection?.inspectionDate || 
                         inspection?.dateInspected || 
                         inspection?.date || 
                         '-';
  
  const inspectionStatus = inspection?.inspectionStatus || 
                           inspection?.status || 
                           'pending';
  
  const remark = inspection?.remark || 
                 inspection?.inspectionNotes || 
                 inspection?.notes || 
                 '-';

  // Determine status display (Good or Fault)
  let statusClass = 'good';
  let statusText = 'Good';
  
  // Check if inspection has been completed and has a result
  if (inspectionStatus === 'complete' || inspectionStatus === 'abnormal') {
    // Check if there's a specific result/status field indicating fault
    const actualStatus = inspection?.inspectionResult || 
                         inspection?.result || 
                         inspection?.status;
    
    // If solved is false or status indicates fault
    if (inspection?.solved === false || 
        actualStatus === 'Fault' || 
        actualStatus === 'fault' || 
        actualStatus === 'bad' ||
        actualStatus === 'abnormal') {
      statusClass = 'fault';
      statusText = 'Fault';
    } else {
      statusClass = 'good';
      statusText = 'Good';
    }
  } else if (inspectionStatus === 'fault' || inspectionStatus === 'Fault') {
    statusClass = 'fault';
    statusText = 'Fault';
  } else if (inspectionStatus === 'pending' || inspectionStatus === 'upcoming') {
    // If not yet inspected, show as pending
    statusClass = 'good';
    statusText = 'Pending';
  }

  contentDiv.innerHTML = `
    <div class="details-header">
      <h2 class="details-title">Asset Inspection Details</h2>
    </div>
    
    <div class="details-grid">
      <div class="detail-item">
        <span class="detail-label">Asset ID</span>
        <span class="detail-value">${escapeHtml(asset.assetId || '-')}</span>
      </div>
      
      <div class="detail-item">
        <span class="detail-label">Asset Description</span>
        <span class="detail-value">${escapeHtml(asset.assetDescription || '-')}</span>
      </div>
      
      <div class="detail-item">
        <span class="detail-label">Staff in Charge</span>
        <span class="detail-value">${escapeHtml(staffInCharge)}</span>
      </div>
      
      <div class="detail-item">
        <span class="detail-label">Date Inspection</span>
        <span class="detail-value">${formatDate(dateInspection)}</span>
      </div>
      
      <div class="detail-item">
        <span class="detail-label">Inspection Status</span>
        <span class="detail-value">
          <span class="status-badge ${statusClass}">${statusText}</span>
        </span>
      </div>
    </div>
    
    <div class="remark-section">
      <div class="detail-item">
        <span class="detail-label">Remark</span>
        <div class="remark-content">${escapeHtml(remark)}</div>
      </div>
    </div>
  `;
}

// Show error state
function showError(message) {
  const contentDiv = document.getElementById('asset-details-content');
  if (contentDiv) {
    contentDiv.innerHTML = `
      <div class="error-state">
        <h2>Error</h2>
        <p>${escapeHtml(message)}</p>
        <p style="margin-top: 1rem;">
          <a href="${maintenanceId ? `inspection_task_detail.html?maintenanceId=${encodeURIComponent(maintenanceId)}&taskIndex=0` : 'maintenance.html'}" style="color: #140958; font-weight: 600; text-decoration: none;">
            ← Back
          </a>
        </p>
      </div>
    `;
  }
}

// Format date
function formatDate(dateString) {
  if (!dateString || dateString === '-') return '-';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    return dateString;
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '-';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

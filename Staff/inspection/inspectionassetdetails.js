// Inspection Asset Details Page
// Shows detailed inspection information for a specific asset

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const assetId = urlParams.get('assetId');
const maintenanceId = urlParams.get('maintenanceId');

// State
let assetData = null;
let inspectionData = null;
let maintenanceData = null;
let currentAssetData = null; // Store asset data for back link logic

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadAssetDetails();
  loadUserInfo();
  
  // Reload inspection data when page becomes visible (in case inspection was just submitted)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && assetId && maintenanceId) {
      console.log('Page visible again, reloading inspection data...');
      loadAssetDetails();
    }
  });
  
  // Also listen for focus event (when user switches back to tab)
  window.addEventListener('focus', () => {
    if (assetId && maintenanceId) {
      console.log('Window focused, reloading inspection data...');
      loadAssetDetails();
    }
  });
});

// Update back link to go to inspection asset page (staff version)
function updateBackLink() {
  const backLink = document.getElementById('back-link');
  if (!backLink) return;
  
  if (maintenanceData && maintenanceData._id && assetId) {
    // Construct URL for inspectionasset.html (staff version) - need taskText from URL or maintenance data
    const urlParams = new URLSearchParams(window.location.search);
    let taskText = urlParams.get('taskText') || '';
    
    // If taskText not in URL, try to get it from maintenance data (first task as fallback)
    if (!taskText && maintenanceData.inspectionTasks) {
      const tasks = maintenanceData.inspectionTasks.split('\n').filter(t => t.trim());
      if (tasks.length > 0) {
        // Try to find the task that matches the asset's locationDescription
        // First, get the asset's locationDescription
        const assetLocation = currentAssetData?.locationDescription || '';
        // Find matching task
        const matchingTask = tasks.find(task => task.trim() === assetLocation.trim());
        taskText = matchingTask || tasks[0]; // Use matching task or first task as fallback
      }
    }
    
    // Build URL to go back to inspectionasset.html with maintenanceId and taskText
    let backUrl = `inspectionasset.html?maintenanceId=${encodeURIComponent(maintenanceData._id)}`;
    if (taskText) {
      backUrl += `&taskText=${encodeURIComponent(taskText)}`;
    }
    
    backLink.href = backUrl;
    backLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = backUrl;
    });
  } else if (maintenanceId) {
    // If we have maintenanceId but no maintenanceData yet, load it first
    loadMaintenanceDataForBackLink();
  } else {
    // Fallback to inspection.html if no maintenanceId
    backLink.href = 'inspection.html';
  }
}

// Load maintenance data specifically for back link (if not already loaded)
async function loadMaintenanceDataForBackLink() {
  if (!maintenanceId) return;
  
  try {
    const maintenanceResp = await fetch(`/api/maintenance/get?maintenanceId=${encodeURIComponent(maintenanceId)}`);
    const maintenanceDataResp = await maintenanceResp.json();
    
    if (maintenanceResp.ok && maintenanceDataResp.ok && maintenanceDataResp.maintenance) {
      maintenanceData = maintenanceDataResp.maintenance;
      updateBackLink();
    }
  } catch (error) {
    console.warn('Could not load maintenance data for back link:', error);
    // Fallback to inspection.html (staff version)
    const backLink = document.getElementById('back-link');
    if (backLink) {
      backLink.href = 'inspection.html';
    }
  }
}

// Load user info from sessionStorage (same as other admin pages)
function loadUserInfo() {
  try {
    // Get user info from sessionStorage (set during login)
    const userName = sessionStorage.getItem('userName') || 'admin';
    const userEmail = sessionStorage.getItem('userEmail') || '';
    
    const userNameEl = document.getElementById('user-name');
    const userAvatarEl = document.getElementById('user-avatar');
    
    if (userNameEl) {
      userNameEl.textContent = userName;
    }
    if (userAvatarEl) {
      userAvatarEl.textContent = userName.charAt(0).toUpperCase();
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

    // Load inspection data from maintenance_assets collection (primary source)
    let inspectionData = null;
    let maintenanceData = null;
    
    try {
      // Load from maintenance_assets collection via /api/inspections/get endpoint
      // This endpoint now queries maintenance_assets collection only
      const inspectionResp = await fetch(`/api/inspections/get?assetId=${encodeURIComponent(assetId)}`);
      if (inspectionResp.ok) {
        const inspectionDataResp = await inspectionResp.json();
        if (inspectionDataResp.ok && inspectionDataResp.inspection) {
          inspectionData = inspectionDataResp.inspection;
          console.log('✓ Found inspection from maintenance_assets collection:', inspectionData);
        }
      }
    } catch (error) {
      console.warn('Could not load from maintenance_assets collection:', error);
    }
    
    // Fallback: Try maintenance endpoint if main endpoint didn't work
    if (!inspectionData || !inspectionData.notes) {
      try {
        let directInspectionResp;
        if (maintenanceId) {
          directInspectionResp = await fetch(`/api/maintenance/asset-inspection?assetId=${encodeURIComponent(assetId)}&maintenanceId=${encodeURIComponent(maintenanceId)}`);
        } else {
          directInspectionResp = await fetch(`/api/maintenance/asset-inspection?assetId=${encodeURIComponent(assetId)}`);
        }
        
        if (directInspectionResp.ok) {
          const directInspectionData = await directInspectionResp.json();
          if (directInspectionData.ok && directInspectionData.inspection) {
            // Map maintenance_assets format to expected format
            inspectionData = {
              assetId: directInspectionData.inspection.assetId,
              notes: directInspectionData.inspection.inspectionNotes || directInspectionData.inspection.notes,
              solved: directInspectionData.inspection.solved,
              inspectionStatus: directInspectionData.inspection.inspectionStatus,
              inspectionDate: directInspectionData.inspection.inspectionDate,
              status: directInspectionData.inspection.status
            };
            console.log('✓ Found inspection from maintenance_assets (fallback endpoint):', inspectionData);
          }
        }
      } catch (error) {
        console.warn('Could not load inspection via maintenance endpoint:', error);
      }
    }
    
    // Load maintenance data if maintenanceId is provided
    if (maintenanceId) {
      try {
        const maintenanceResp = await fetch(`/api/maintenance/get?maintenanceId=${encodeURIComponent(maintenanceId)}`);
        const maintenanceDataResp = await maintenanceResp.json();
        
        if (maintenanceResp.ok && maintenanceDataResp.ok && maintenanceDataResp.maintenance) {
          maintenanceData = maintenanceDataResp.maintenance;
        }
      } catch (error) {
        console.warn('Could not load maintenance data:', error);
      }
    }

    // Store asset data for back link logic
    currentAssetData = assetData.asset;
    
    // Update back link after loading maintenance data
    updateBackLink();
    
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
  // Staff in charge removed for staff version
  
  // Get inspection date - handle both Date objects and ISO strings
  let dateInspection = '-';
  if (inspection?.inspectionDate) {
    if (inspection.inspectionDate instanceof Date) {
      dateInspection = inspection.inspectionDate.toISOString();
    } else if (typeof inspection.inspectionDate === 'string') {
      dateInspection = inspection.inspectionDate;
    } else if (inspection.inspectionDate.$date) {
      // Handle MongoDB extended JSON format
      dateInspection = inspection.inspectionDate.$date;
    } else {
      // Try to convert to string
      dateInspection = String(inspection.inspectionDate);
    }
  }
  
  // Get inspection status - check both 'status' (from form: normal/fault) and 'inspectionStatus' (legacy: complete/open)
  // Priority: status field (normal/fault) > inspectionStatus (complete/open) > default to pending
  let inspectionStatus = inspection?.status || 
                         inspection?.inspectionStatus || 
                         'pending';
  
  // Convert legacy inspectionStatus values to normal/fault format
  if (inspectionStatus === 'complete') {
    inspectionStatus = 'normal';
  } else if (inspectionStatus === 'open' && inspection?.solved === false) {
    inspectionStatus = 'fault'; // Map to 'fault' instead of 'abnormal'
  } else if (inspectionStatus === 'open' && inspection?.solved === true) {
    inspectionStatus = 'normal';
  }
  
  // Handle legacy 'abnormal' status - map to 'fault'
  if (inspectionStatus === 'abnormal') {
    inspectionStatus = 'fault';
  }
  
  // Get remark - check multiple possible field names (prioritize 'notes' from inspections collection)
  const remark = inspection?.notes || 
                 inspection?.inspectionNotes || 
                 inspection?.remark || 
                 inspection?.remarks ||
                 '-';
  
  console.log('Displaying asset details:', {
    assetId: asset?.assetId,
    hasInspection: !!inspection,
    inspectionStatus: inspectionStatus,
    remark: remark,
    inspectionDate: dateInspection,
    solved: inspection?.solved,
    inspectionObject: inspection
  });

  // Determine fault condition display (Normal/Fault)
  // Status should be 'normal' or 'fault' from the inspection form dropdown
  let statusClass = 'good';
  let statusText = 'Normal'; // Default to Normal
  
  // Get the actual fault condition from the status field (not inspectionStatus)
  // Priority: inspection.status (from maintenance_assets) > inspectionStatus (legacy)
  let faultStatus = inspection?.status;
  
  // If status is not directly available, try to infer from other fields
  if (!faultStatus || faultStatus === 'pending' || faultStatus === 'open') {
    // Check if solved field indicates fault
    if (inspection?.solved === false) {
      faultStatus = 'fault';
    } else if (inspection?.solved === true) {
      faultStatus = 'normal';
    } else {
      faultStatus = inspection?.status || 'normal';
    }
  }
  
  // Normalize 'abnormal' to 'fault' for consistency
  if (faultStatus === 'abnormal') {
    faultStatus = 'fault';
  }
  
  // Check for 'normal' or 'fault' status (from inspection form dropdown)
  if (faultStatus === 'normal' || faultStatus === 'complete') {
    statusClass = 'good';
    statusText = 'Normal';
  } else if (faultStatus === 'fault') {
    statusClass = 'fault';
    statusText = 'Fault';
  } else {
    // Default to Normal for any other status
    statusClass = 'good';
    statusText = 'Normal';
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
        <span class="detail-label">Date Inspection</span>
        <span class="detail-value">${formatDate(dateInspection)}</span>
      </div>
      
      <div class="detail-item">
        <span class="detail-label">Inspection Status</span>
        <span class="detail-value">
          <span class="status-badge ${inspection?.inspectionStatus === 'complete' || inspection?.inspectionStatus === 'completed' ? 'good' : 'pending'}">
            ${inspection?.inspectionStatus === 'complete' || inspection?.inspectionStatus === 'completed' ? 'Complete' : 'Incomplete'}
          </span>
        </span>
      </div>
      
      <div class="detail-item">
        <span class="detail-label">Inspection Fault</span>
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
          <a href="${maintenanceData && maintenanceData._id ? `inspectionasset.html?maintenanceId=${encodeURIComponent(maintenanceData._id)}${urlParams.get('taskText') ? '&taskText=' + encodeURIComponent(urlParams.get('taskText')) : ''}` : 'inspection.html'}" style="color: #140958; font-weight: 600; text-decoration: none;">
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

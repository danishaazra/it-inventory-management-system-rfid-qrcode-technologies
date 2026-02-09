// Inspection Asset Details Page (Staff) - Same logic as admin inspection_asset_details.js
// Shows detailed inspection information for a specific asset

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const assetId = urlParams.get('assetId');
const maintenanceId = urlParams.get('maintenanceId');
const inspectionDate = urlParams.get('inspectionDate'); // Get the specific inspection date (same as admin)
const taskText = urlParams.get('taskText'); // Staff-specific: for back link to inspectionasset.html

// State
let assetData = null;
let inspectionData = null;
let maintenanceData = null;
let maintenanceAssetData = null; // Store maintenance_assets data for fallback
let currentAssetData = null; // For back link logic

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

// Update back link - Staff version: go to inspectionasset.html (not maintenance_checklist_draft.html)
function updateBackLink() {
  const backLink = document.getElementById('back-link');
  if (!backLink) return;
  
  if (maintenanceData && maintenanceData._id) {
    // Staff: Construct URL for inspectionasset.html with maintenanceId and taskText
    let backUrl = `inspectionasset.html?maintenanceId=${encodeURIComponent(maintenanceData._id)}`;
    let taskTextValue = taskText || '';
    
    if (!taskTextValue && maintenanceData.inspectionTasks && currentAssetData) {
      const tasks = maintenanceData.inspectionTasks.split('\n').filter(t => t.trim());
      if (tasks.length > 0) {
        const assetLocation = currentAssetData?.locationDescription || '';
        const matchingTask = tasks.find(t => t.trim() === assetLocation.trim());
        taskTextValue = matchingTask || tasks[0];
      }
    }
    
    if (taskTextValue) {
      backUrl += `&taskText=${encodeURIComponent(taskTextValue)}`;
    }
    
    backLink.href = backUrl;
    backLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = backUrl;
    });
  } else if (maintenanceId) {
    loadMaintenanceDataForBackLink();
  } else {
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
    const backLink = document.getElementById('back-link');
    if (backLink) {
      backLink.href = 'inspection.html';
    }
  }
}

// Load user info from sessionStorage (same as admin)
function loadUserInfo() {
  try {
    const userName = sessionStorage.getItem('userName') || 'staff';
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

// Load asset details - Same logic as admin inspection_asset_details.js
async function loadAssetDetails() {
  if (!assetId) {
    showError('Asset ID is required');
    return;
  }

  try {
    const assetResp = await fetch(`/api/assets/get?assetId=${encodeURIComponent(assetId)}`);
    const assetData = await assetResp.json();

    if (!assetResp.ok || !assetData.ok) {
      showError(assetData.error || 'Failed to load asset details');
      return;
    }

    currentAssetData = assetData.asset;

    // Load inspection data - same as admin
    let inspectionData = null;
    let maintenanceData = null;
    
    try {
      let inspectionUrl = `/api/inspections/get?assetId=${encodeURIComponent(assetId)}`;
      if (maintenanceId) {
        inspectionUrl += `&maintenanceId=${encodeURIComponent(maintenanceId)}`;
      }
      if (inspectionDate) {
        const dateStr = inspectionDate.includes('T') ? inspectionDate.split('T')[0] : inspectionDate;
        inspectionUrl += `&inspectionDate=${encodeURIComponent(dateStr)}`;
        console.log('Loading inspection for specific date:', dateStr);
      }
      
      const inspectionResp = await fetch(inspectionUrl);
      if (inspectionResp.ok) {
        const inspectionDataResp = await inspectionResp.json();
        if (inspectionDataResp.ok && inspectionDataResp.inspection) {
          inspectionData = inspectionDataResp.inspection;
          console.log('✓ Found inspection from maintenance_assets collection for date:', inspectionDate, inspectionData);
        }
      } else if (inspectionResp.status === 404 && inspectionDate) {
        console.log('No inspection found for exact date, trying to get latest inspection...');
        let fallbackUrl = `/api/inspections/get?assetId=${encodeURIComponent(assetId)}`;
        if (maintenanceId) {
          fallbackUrl += `&maintenanceId=${encodeURIComponent(maintenanceId)}`;
        }
        const fallbackResp = await fetch(fallbackUrl);
        if (fallbackResp.ok) {
          const fallbackDataResp = await fallbackResp.json();
          if (fallbackDataResp.ok && fallbackDataResp.inspection) {
            inspectionData = fallbackDataResp.inspection;
            console.log('✓ Found latest inspection (fallback, different date):', inspectionData);
          }
        }
      }
    } catch (error) {
      console.warn('Could not load from maintenance_assets collection:', error);
    }
    
    if (!inspectionData || !inspectionData.notes) {
      try {
        let fallbackUrl = `/api/maintenance/asset-inspection?assetId=${encodeURIComponent(assetId)}`;
        if (maintenanceId) {
          fallbackUrl += `&maintenanceId=${encodeURIComponent(maintenanceId)}`;
        }
        if (inspectionDate) {
          const dateStr = inspectionDate.includes('T') ? inspectionDate.split('T')[0] : inspectionDate;
          fallbackUrl += `&inspectionDate=${encodeURIComponent(dateStr)}`;
        }
        const directInspectionResp = await fetch(fallbackUrl);
        
        if (directInspectionResp.ok) {
          const directInspectionData = await directInspectionResp.json();
          if (directInspectionData.ok && directInspectionData.inspection) {
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
    
    if (maintenanceId) {
      try {
        const maintenanceResp = await fetch(`/api/maintenance/get?maintenanceId=${encodeURIComponent(maintenanceId)}`);
        const maintenanceDataResp = await maintenanceResp.json();
        
        if (maintenanceResp.ok && maintenanceDataResp.ok && maintenanceDataResp.maintenance) {
          maintenanceData = maintenanceDataResp.maintenance;
        }
        
        if (assetId) {
          try {
            const maUrl = `/api/maintenance/assets?maintenanceId=${encodeURIComponent(maintenanceId)}`;
            const maResp = await fetch(maUrl);
            if (maResp.ok) {
              const maData = await maResp.json();
              if (maData.ok && maData.assets) {
                maintenanceAssetData = maData.assets.filter(asset => asset.assetId === assetId);
                console.log('✓ Loaded maintenance_assets for fallback:', maintenanceAssetData);
              }
            }
          } catch (error) {
            console.warn('Could not load maintenance_assets for fallback:', error);
          }
        }
      } catch (error) {
        console.warn('Could not load maintenance data:', error);
      }
    }

    updateBackLink();
    displayAssetDetails(assetData.asset, inspectionData, maintenanceData, maintenanceAssetData);
  } catch (error) {
    console.error('Error loading asset details:', error);
    showError(`Failed to load asset details: ${error.message || 'Network error'}`);
  }
}

// Display asset details - Same as admin (identical logic including Staff in Charge)
function displayAssetDetails(asset, inspection, maintenance, maintenanceAssets = null) {
  const contentDiv = document.getElementById('asset-details-content');
  if (!contentDiv) return;

  const staffInCharge = maintenance?.assignedStaffName || 
                        maintenance?.staffName || 
                        inspection?.assignedStaffName || 
                        inspection?.staffName || 
                        inspection?.inspectorName ||
                        '-';
  
  let dateInspection = '-';
  if (inspectionDate) {
    dateInspection = inspectionDate;
  } else if (inspection?.inspectionDate) {
    if (inspection.inspectionDate instanceof Date) {
      dateInspection = inspection.inspectionDate.toISOString();
    } else if (typeof inspection.inspectionDate === 'string') {
      dateInspection = inspection.inspectionDate;
    } else if (inspection.inspectionDate.$date) {
      dateInspection = inspection.inspectionDate.$date;
    } else {
      dateInspection = String(inspection.inspectionDate);
    }
  }
  
  let inspectionStatus = inspection?.status || 
                         inspection?.inspectionStatus || 
                         'pending';
  
  if (inspectionStatus === 'complete') {
    inspectionStatus = 'normal';
  } else if (inspectionStatus === 'open' && inspection?.solved === false) {
    inspectionStatus = 'fault';
  } else if (inspectionStatus === 'open' && inspection?.solved === true) {
    inspectionStatus = 'normal';
  }
  
  if (inspectionStatus === 'abnormal') {
    inspectionStatus = 'fault';
  }
  
  let inspectionStatusValue = inspection?.inspectionStatus;
  let faultStatus = inspection?.status;
  
  let maRecord = null;
  if (maintenanceAssets && maintenanceAssets.length > 0) {
    if (inspectionDate) {
      const dateStr = inspectionDate.includes('T') ? inspectionDate.split('T')[0] : inspectionDate;
      maRecord = maintenanceAssets.find(ma => {
        if (!ma.inspectionDate) return false;
        const maDateStr = ma.inspectionDate.includes('T') ? ma.inspectionDate.split('T')[0] : ma.inspectionDate;
        return maDateStr === dateStr;
      });
    }
    if (!maRecord && maintenanceAssets.length > 0) {
      maRecord = maintenanceAssets[0];
    }
  }
  
  if (!inspectionStatusValue && maRecord && maRecord.inspectionStatus) {
    inspectionStatusValue = maRecord.inspectionStatus;
  }
  
  if (!faultStatus && maRecord && maRecord.status) {
    faultStatus = maRecord.status;
  }
  
  if (!inspectionStatusValue) {
    inspectionStatusValue = 'pending';
  }
  
  if (!inspection && maRecord) {
    inspection = {
      inspectionStatus: maRecord.inspectionStatus || 'pending',
      status: maRecord.status || 'normal',
      inspectionNotes: maRecord.inspectionNotes || maRecord.notes || '',
      inspectionDate: maRecord.inspectionDate || null,
      inspectorName: maRecord.inspectorName || null
    };
  }
  
  const remark = inspection?.notes || 
                 inspection?.inspectionNotes || 
                 inspection?.remark || 
                 inspection?.remarks ||
                 (maRecord ? (maRecord.inspectionNotes || maRecord.notes || '-') : '-');
  
  let statusClass = 'good';
  let statusText = 'Normal';
  
  if (inspectionStatusValue === 'complete' || inspectionStatusValue === 'completed') {
    if (faultStatus === 'fault' || faultStatus === 'abnormal') {
      statusClass = 'fault';
      statusText = 'Fault';
    } else if (faultStatus === 'normal') {
      statusClass = 'good';
      statusText = 'Normal';
    } else {
      statusClass = 'good';
      statusText = 'Normal';
    }
  } else {
    statusClass = 'pending';
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
          <span class="status-badge ${inspectionStatusValue === 'complete' || inspectionStatusValue === 'completed' ? 'good' : 'pending'}">
            ${inspectionStatusValue === 'complete' || inspectionStatusValue === 'completed' ? 'Complete' : 'Incomplete'}
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

function showError(message) {
  const contentDiv = document.getElementById('asset-details-content');
  if (contentDiv) {
    let backUrl = 'inspection.html';
    if (maintenanceData && maintenanceData._id) {
      backUrl = `inspectionasset.html?maintenanceId=${encodeURIComponent(maintenanceData._id)}`;
      if (taskText) {
        backUrl += `&taskText=${encodeURIComponent(taskText)}`;
      }
    }
    contentDiv.innerHTML = `
      <div class="error-state">
        <h2>Error</h2>
        <p>${escapeHtml(message)}</p>
        <p style="margin-top: 1rem;">
          <a href="${backUrl}" style="color: #140958; font-weight: 600; text-decoration: none;">
            ← Back
          </a>
        </p>
      </div>
    `;
  }
}

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

function escapeHtml(text) {
  if (!text) return '-';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

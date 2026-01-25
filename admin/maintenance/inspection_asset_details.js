// Inspection Asset Details Page
// Shows detailed inspection information for a specific asset

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const assetId = urlParams.get('assetId');
const maintenanceId = urlParams.get('maintenanceId');
const inspectionDate = urlParams.get('inspectionDate'); // Get the specific inspection date

// State
let assetData = null;
let inspectionData = null;
let maintenanceData = null;
let maintenanceAssetData = null; // Store maintenance_assets data for fallback

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

// Update back link to go to maintenance checklist draft
function updateBackLink() {
  const backLink = document.getElementById('back-link');
  if (!backLink) return;
  
  if (maintenanceData && maintenanceData._id) {
    // Construct URL with all required parameters for maintenance_checklist_draft.html
    const backUrl = `maintenance_checklist_draft.html?id=${encodeURIComponent(maintenanceData._id)}&branch=${encodeURIComponent(maintenanceData.branch || '')}&location=${encodeURIComponent(maintenanceData.location || '')}&itemName=${encodeURIComponent(maintenanceData.itemName || '')}&frequency=${encodeURIComponent(maintenanceData.frequency || '')}`;
    backLink.href = backUrl;
    backLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = backUrl;
    });
  } else if (maintenanceId) {
    // If we have maintenanceId but no maintenanceData yet, load it first
    loadMaintenanceDataForBackLink();
  } else {
    // Fallback to maintenance.html if no maintenanceId
    backLink.href = 'maintenance.html';
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
    // Fallback to maintenance.html
    const backLink = document.getElementById('back-link');
    if (backLink) {
      backLink.href = 'maintenance.html';
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
      // Include inspectionDate parameter if provided to filter by specific date
      let inspectionUrl = `/api/inspections/get?assetId=${encodeURIComponent(assetId)}`;
      if (maintenanceId) {
        inspectionUrl += `&maintenanceId=${encodeURIComponent(maintenanceId)}`;
      }
      if (inspectionDate) {
        // Format date as YYYY-MM-DD if needed
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
        // If exact date not found, try without date filter to get latest inspection
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
    
    // Fallback: Try maintenance endpoint if main endpoint didn't work
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
    
    // Load maintenance data if maintenanceId is provided (for staff in charge)
    if (maintenanceId) {
      try {
        const maintenanceResp = await fetch(`/api/maintenance/get?maintenanceId=${encodeURIComponent(maintenanceId)}`);
        const maintenanceDataResp = await maintenanceResp.json();
        
        if (maintenanceResp.ok && maintenanceDataResp.ok && maintenanceDataResp.maintenance) {
          maintenanceData = maintenanceDataResp.maintenance;
        }
        
        // Also load maintenance_assets for this asset to get status fallback (matching table logic)
        // Load ALL maintenance_assets for this asset (not filtered by date) so we can find the matching one
        if (assetId) {
          try {
            // Note: The /api/maintenance/assets endpoint doesn't support date filtering,
            // so we load all records and filter client-side if needed
            const maUrl = `/api/maintenance/assets?maintenanceId=${encodeURIComponent(maintenanceId)}`;
            const maResp = await fetch(maUrl);
            if (maResp.ok) {
              const maData = await maResp.json();
              if (maData.ok && maData.assets) {
                // Filter to only this assetId
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

    // Update back link after loading maintenance data
    updateBackLink();
    
    displayAssetDetails(assetData.asset, inspectionData, maintenanceData, maintenanceAssetData);
  } catch (error) {
    console.error('Error loading asset details:', error);
    showError(`Failed to load asset details: ${error.message || 'Network error'}`);
  }
}

// Display asset details
function displayAssetDetails(asset, inspection, maintenance, maintenanceAssets = null) {
  const contentDiv = document.getElementById('asset-details-content');
  if (!contentDiv) return;

  // Get inspection data
  // Staff in charge - from maintenance item or inspection data
  const staffInCharge = maintenance?.assignedStaffName || 
                        maintenance?.staffName || 
                        inspection?.assignedStaffName || 
                        inspection?.staffName || 
                        inspection?.inspectorName ||
                        '-';
  
  // Get inspection date - prioritize URL parameter, then inspection data
  let dateInspection = '-';
  if (inspectionDate) {
    // Use the date from URL parameter (specific date clicked)
    dateInspection = inspectionDate;
  } else if (inspection?.inspectionDate) {
    // Fallback to inspection date from data
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
  
  console.log('Displaying asset details:', {
    assetId: asset?.assetId,
    hasInspection: !!inspection,
    inspectionStatus: inspectionStatus,
    inspectionDate: dateInspection,
    solved: inspection?.solved,
    inspectionObject: inspection
  });

  // Get inspection status (complete/pending) - match table logic exactly
  // Use same fallback chain as table: inspection?.inspectionStatus || asset.inspectionStatus || 'pending'
  // Fallback to maintenance_assets data if inspection data is not available
  let inspectionStatusValue = inspection?.inspectionStatus;
  
  // Get the actual fault condition from the status field - match table logic exactly
  // Table uses: inspection?.status || asset.status
  // Fallback to maintenance_assets data if available
  let faultStatus = inspection?.status;
  
  // Find the matching maintenance_asset record (for fallback data)
  // If we have an inspectionDate, filter by it, otherwise use the latest
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
    // If no match by date or no date specified, use the first/latest record
    if (!maRecord && maintenanceAssets.length > 0) {
      maRecord = maintenanceAssets[0];
    }
  }
  
  // Use maintenance_assets data as fallback for inspectionStatus
  if (!inspectionStatusValue && maRecord && maRecord.inspectionStatus) {
    inspectionStatusValue = maRecord.inspectionStatus;
    console.log('Got inspectionStatus from maintenance_assets fallback:', inspectionStatusValue);
  }
  
  // Use maintenance_assets data as fallback for faultStatus
  if (!faultStatus && maRecord && maRecord.status) {
    faultStatus = maRecord.status;
    console.log('Got faultStatus from maintenance_assets fallback:', faultStatus);
  }
  
  // Default to 'pending' if still not found
  if (!inspectionStatusValue) {
    inspectionStatusValue = 'pending';
  }
  
  // If we have maRecord but no inspection data, create a minimal inspection object for display
  if (!inspection && maRecord) {
    inspection = {
      inspectionStatus: maRecord.inspectionStatus || 'pending',
      status: maRecord.status || 'normal',
      inspectionNotes: maRecord.inspectionNotes || maRecord.notes || '',
      inspectionDate: maRecord.inspectionDate || null,
      inspectorName: maRecord.inspectorName || null
    };
    console.log('Created inspection object from maintenance_assets:', inspection);
  }
  
  // Get remark - check multiple possible field names (prioritize 'notes' from inspections collection)
  // Also check maintenanceAssets if inspection data is not available
  const remark = inspection?.notes || 
                 inspection?.inspectionNotes || 
                 inspection?.remark || 
                 inspection?.remarks ||
                 (maRecord ? (maRecord.inspectionNotes || maRecord.notes || '-') : '-');
  
  // Debug: Log what we're reading for display
  console.log('Displaying fault condition:', {
    inspectionExists: !!inspection,
    inspectionStatus: inspectionStatusValue,
    faultStatus: faultStatus,
    inspectionStatusField: inspection?.inspectionStatus,
    statusField: inspection?.status,
    fullInspection: inspection
  });
  
  // Determine fault condition display (Normal/Fault) - initialize variables
  let statusClass = 'good';
  let statusText = 'Normal'; // Default to Normal
  
  // Only show fault condition if inspection is complete - match table logic exactly
  if (inspectionStatusValue === 'complete' || inspectionStatusValue === 'completed') {
    // Inspection is complete - show the fault condition
    if (faultStatus === 'fault' || faultStatus === 'abnormal') {
      statusClass = 'fault';
      statusText = 'Fault';
    } else if (faultStatus === 'normal') {
      statusClass = 'good';
      statusText = 'Normal';
    } else {
      // If status is missing but inspection is complete, default to normal (match table logic)
      statusClass = 'good';
      statusText = 'Normal';
    }
  } else {
    // Inspection not complete yet - show pending (match table logic)
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

// Show error state
function showError(message) {
  const contentDiv = document.getElementById('asset-details-content');
  if (contentDiv) {
    contentDiv.innerHTML = `
      <div class="error-state">
        <h2>Error</h2>
        <p>${escapeHtml(message)}</p>
        <p style="margin-top: 1rem;">
          <a href="${maintenanceData && maintenanceData._id ? `maintenance_checklist_draft.html?id=${encodeURIComponent(maintenanceData._id)}&branch=${encodeURIComponent(maintenanceData.branch || '')}&location=${encodeURIComponent(maintenanceData.location || '')}&itemName=${encodeURIComponent(maintenanceData.itemName || '')}&frequency=${encodeURIComponent(maintenanceData.frequency || '')}` : 'maintenance.html'}" style="color: #140958; font-weight: 600; text-decoration: none;">
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

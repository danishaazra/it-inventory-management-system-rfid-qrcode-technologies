// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const assetId = urlParams.get('assetId');
const maintenanceId = urlParams.get('maintenanceId');

// Load asset details
async function loadAssetDetails() {
  const contentArea = document.getElementById('content-area');
  const backLink = document.getElementById('back-link');
  
  console.log('Loading asset details...', { assetId, maintenanceId });
  
  if (!contentArea) {
    console.error('Content area element not found!');
    return;
  }
  
  if (!assetId || !maintenanceId) {
    contentArea.innerHTML = `
      <div class="error">
        <h2>Missing Parameters</h2>
        <p>Please provide assetId and maintenanceId in the URL.</p>
        <p>Current URL params: assetId=${assetId || 'missing'}, maintenanceId=${maintenanceId || 'missing'}</p>
      </div>
    `;
    return;
  }

  // Set back link
  if (backLink) {
    backLink.href = `maintenanceasset.html?maintenanceId=${encodeURIComponent(maintenanceId)}`;
  }

  try {
    const url = `./get_maintenance_asset_details.php?assetId=${encodeURIComponent(assetId)}&maintenanceId=${encodeURIComponent(maintenanceId)}`;
    console.log('Fetching from:', url);
    
    const resp = await fetch(url);
    console.log('Response status:', resp.status);
    
    const data = await resp.json();
    console.log('Response data:', data);

    if (!resp.ok || !data.ok) {
      contentArea.innerHTML = `
        <div class="error">
          <h2>Error Loading Asset</h2>
          <p>${data.error || 'Could not load asset details.'}</p>
        </div>
      `;
      return;
    }

    const { asset, maintenance, inspection } = data;
    console.log('Displaying asset details:', { asset, maintenance, inspection });
    displayAssetDetails(asset, maintenance, inspection);
  } catch (error) {
    console.error('Error loading asset details:', error);
    if (contentArea) {
      contentArea.innerHTML = `
        <div class="error">
          <h2>Error</h2>
          <p>${error.message || 'Network error occurred.'}</p>
          <p style="margin-top: 0.5rem; font-size: 0.85rem; color: #6b7280;">Check browser console for more details.</p>
        </div>
      `;
    }
  }
}

function displayAssetDetails(asset, maintenance, inspection) {
  const contentArea = document.getElementById('content-area');
  const assetIdMeta = document.getElementById('asset-id-meta');
  const assetStatusMeta = document.getElementById('asset-status-meta');
  
  if (!contentArea) {
    console.error('Content area not found when trying to display asset details!');
    return;
  }
  
  console.log('Displaying asset details in content area');
  
  // Update header meta
  if (assetIdMeta) {
    assetIdMeta.textContent = `Asset ID: ${escapeHtml(asset.assetId || '-')}`;
  }

  if (assetStatusMeta) {
    const status = asset.status || 'Unknown';
    const statusColors = {
      'Active': '#10b981',
      'Inactive': '#6b7280',
      'Maintenance': '#f59e0b',
      'Retired': '#ef4444'
    };
    const statusColor = statusColors[status] || '#6b7280';
    assetStatusMeta.innerHTML = `<span style="padding: 0.25rem 0.75rem; border-radius: 999px; background: ${statusColor}20; color: ${statusColor}; font-size: 0.875rem; font-weight: 600;">${status}</span>`;
  }

  // Format inspection date
  let inspectionDateStr = 'Not inspected yet';
  if (inspection && inspection.inspectionDate) {
    // MongoDB UTCDateTime is in milliseconds
    const timestamp = typeof inspection.inspectionDate === 'object' && inspection.inspectionDate.$numberLong 
      ? parseInt(inspection.inspectionDate.$numberLong) 
      : inspection.inspectionDate;
    const date = new Date(timestamp);
    inspectionDateStr = date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Format status
  const inspectionStatus = inspection?.inspectionStatus || 'open';
  const solvedStatus = inspection?.solved !== undefined ? (inspection.solved ? 'Solved' : 'Not Solved') : 'N/A';

  // Update summary cards
  const summaryAssetId = document.getElementById('summary-asset-id');
  const summaryCategory = document.getElementById('summary-category');
  const summaryLocation = document.getElementById('summary-location');
  const summaryOwner = document.getElementById('summary-owner');
  
  if (summaryAssetId) summaryAssetId.textContent = asset.assetId || '-';
  if (summaryCategory) summaryCategory.textContent = asset.assetCategoryDescription || asset.assetCategory || '-';
  if (summaryLocation) summaryLocation.textContent = asset.locationDescription || asset.location || '-';
  if (summaryOwner) summaryOwner.textContent = asset.ownerName || asset.ownerCode || '-';

  // Update specifications list
  const specList = document.getElementById('asset-spec-list');
  if (specList) {
    const specs = [
      { label: 'Asset Description', value: asset.assetDescription },
      { label: 'Asset Category Description', value: asset.assetCategoryDescription },
      { label: 'Model', value: asset.model },
      { label: 'Brand', value: asset.brand },
      { label: 'Serial Number', value: asset.serialNo },
      { label: 'Location', value: asset.location },
      { label: 'Location Description', value: asset.locationDescription },
      { label: 'Area', value: asset.area },
      { label: 'Department Code', value: asset.departmentCode },
      { label: 'Department Description', value: asset.departmentDescription },
      { label: 'Condition', value: asset.condition },
      { label: 'Current User', value: asset.currentUser },
      { label: 'Owner Code', value: asset.ownerCode },
      { label: 'Owner Name', value: asset.ownerName },
      { label: 'Warranty Period', value: asset.warrantyPeriod },
      { label: 'Branch Code', value: asset.branchCode },
      { label: 'No.', value: asset.no },
      { label: 'RFID Tag ID', value: asset.rfidTagId },
    ];

    specList.innerHTML = specs
      .filter(spec => spec.value) // Only show fields with values
      .map(spec => `
        <div class="spec-row">
          <div class="spec-label">${spec.label}</div>
          <div class="spec-value">${escapeHtml(spec.value)}</div>
        </div>
      `).join('');
  }

  // Update inspection section
  const inspectionList = document.getElementById('inspection-spec-list');
  if (inspectionList) {
    inspectionList.innerHTML = `
      <div class="spec-row">
        <div class="spec-label">Staff In Charge</div>
        <div class="spec-value">
          ${escapeHtml(maintenance?.assignedStaffName || 'Not assigned')}
          ${maintenance?.assignedStaffEmail ? `<div style="font-size: 0.8rem; color: #6b7280; margin-top: 0.25rem;">${escapeHtml(maintenance.assignedStaffEmail)}</div>` : ''}
        </div>
      </div>
      <div class="spec-row">
        <div class="spec-label">Inspection Status</div>
        <div class="spec-value">
          <span class="status-badge ${inspectionStatus === 'complete' ? 'complete' : 'open'}">${inspectionStatus === 'complete' ? 'Complete' : 'Open'}</span>
        </div>
      </div>
      <div class="spec-row">
        <div class="spec-label">Solved Status</div>
        <div class="spec-value">
          <span class="status-badge ${inspection?.solved ? 'solved' : 'not-solved'}">${solvedStatus}</span>
        </div>
      </div>
      <div class="spec-row">
        <div class="spec-label">Inspection Date</div>
        <div class="spec-value">${inspectionDateStr}</div>
      </div>
      <div class="spec-row">
        <div class="spec-label">Inspection Notes / Comments</div>
        <div class="spec-value">
          ${inspection?.inspectionNotes ? `<div style="white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(inspection.inspectionNotes)}</div>` : '<span class="muted">No inspection notes available.</span>'}
        </div>
      </div>
    `;
  }
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadAssetDetails);
} else {
  loadAssetDetails();
}

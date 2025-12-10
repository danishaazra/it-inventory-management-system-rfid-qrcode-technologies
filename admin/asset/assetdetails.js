// Get assetId from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const assetId = urlParams.get('assetId');

// Load asset details
async function loadAssetDetails() {
  if (!assetId) {
    document.body.innerHTML = '<div style="padding: 2rem; text-align: center;"><h1>Asset ID Required</h1><p>Please provide an asset ID in the URL.</p><a href="asset.html">← Back to asset list</a></div>';
    return;
  }

  try {
    const resp = await fetch(`../api/get_asset.php?assetId=${encodeURIComponent(assetId)}`);
    const data = await resp.json();

    if (!resp.ok || !data.ok) {
      document.body.innerHTML = `<div style="padding: 2rem; text-align: center;"><h1>Asset Not Found</h1><p>${data.error || 'Could not load asset details.'}</p><a href="asset.html">← Back to asset list</a></div>`;
      return;
    }

    const asset = data.asset;
    displayAssetDetails(asset);
  } catch (error) {
    console.error('Error loading asset:', error);
    document.body.innerHTML = `<div style="padding: 2rem; text-align: center;"><h1>Error</h1><p>Could not load asset details: ${error.message}</p><a href="asset.html">← Back to asset list</a></div>`;
  }
}

// Display asset details in the page
function displayAssetDetails(asset) {
  // Update summary cards
  document.getElementById('summary-asset-id').textContent = asset.assetId || '-';
  document.getElementById('summary-category').textContent = asset.assetCategory || '-';
  document.getElementById('summary-location').textContent = asset.location || asset.locationDescription || '-';
  document.getElementById('summary-owner').textContent = asset.ownerName || asset.ownerCode || '-';

  // Update header meta
  const assetIdMeta = document.getElementById('asset-id-meta');
  if (assetIdMeta) {
    assetIdMeta.textContent = `Asset ID: ${asset.assetId || '-'}`;
  }

  const statusMeta = document.getElementById('asset-status-meta');
  if (statusMeta) {
    const status = asset.status || 'Unknown';
    const statusColors = {
      'Active': '#10b981',
      'Inactive': '#6b7280',
      'Maintenance': '#f59e0b',
      'Retired': '#ef4444'
    };
    const statusColor = statusColors[status] || '#6b7280';
    statusMeta.innerHTML = `<span style="padding: 0.25rem 0.75rem; border-radius: 999px; background: ${statusColor}20; color: ${statusColor}; font-size: 0.875rem; font-weight: 600;">${status}</span>`;
  }

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
    ];

    specList.innerHTML = specs
      .filter(spec => spec.value) // Only show fields with values
      .map(spec => `
        <div class="spec-item">
          <div class="spec-label">${spec.label}</div>
          <div class="spec-value">${spec.value}</div>
        </div>
      `).join('');
  }

  // Store asset data for edit functionality
  window.currentAsset = asset;
}

// Load asset details when page loads
loadAssetDetails();

// TODO: Add edit and delete functionality
const editBtn = document.getElementById('edit-asset-btn');
const deleteBtn = document.getElementById('delete-asset-btn');

if (editBtn) {
  editBtn.addEventListener('click', () => {
    console.log('Edit asset:', assetId);
    // TODO: Open edit modal with asset data
  });
}

if (deleteBtn) {
  deleteBtn.addEventListener('click', () => {
    if (confirm(`Are you sure you want to delete asset "${assetId}"?`)) {
      console.log('Delete asset:', assetId);
      // TODO: Implement delete functionality
    }
  });
}



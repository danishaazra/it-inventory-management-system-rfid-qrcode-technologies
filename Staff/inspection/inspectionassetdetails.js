// Get assetId and maintenanceId from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const assetId = urlParams.get('assetId');
const maintenanceId = urlParams.get('maintenanceId');

// Update back link based on maintenanceId
function updateBackLink() {
  const backLink = document.getElementById('back-link');
  if (backLink && maintenanceId) {
    backLink.href = `inspectionasset.html?maintenanceId=${encodeURIComponent(maintenanceId)}`;
  } else if (backLink) {
    backLink.href = 'inspectionasset.html';
  }
}

// Load asset details
async function loadAssetDetails() {
  if (!assetId) {
    document.body.innerHTML = `<div style="padding: 2rem; text-align: center;"><h1>Asset ID Required</h1><p>Please provide an asset ID in the URL.</p><a href="inspectionasset.html${maintenanceId ? '?maintenanceId=' + encodeURIComponent(maintenanceId) : ''}">← Back to inspection assets</a></div>`;
    return;
  }

  // Update back link before loading
  updateBackLink();

  try {
    const resp = await fetch(`../../admin/asset/get_asset.php?assetId=${encodeURIComponent(assetId)}`);
    const data = await resp.json();

    if (!resp.ok || !data.ok) {
      document.body.innerHTML = `<div style="padding: 2rem; text-align: center;"><h1>Asset Not Found</h1><p>${data.error || 'Could not load asset details.'}</p><a href="inspectionasset.html${maintenanceId ? '?maintenanceId=' + encodeURIComponent(maintenanceId) : ''}">← Back to inspection assets</a></div>`;
      return;
    }

    const asset = data.asset;
    displayAssetDetails(asset);
  } catch (error) {
    console.error('Error loading asset:', error);
    document.body.innerHTML = `<div style="padding: 2rem; text-align: center;"><h1>Error</h1><p>Could not load asset details: ${error.message}</p><a href="inspectionasset.html${maintenanceId ? '?maintenanceId=' + encodeURIComponent(maintenanceId) : ''}">← Back to inspection assets</a></div>`;
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
      { label: 'Owner Code', value: asset.ownerCode },
      { label: 'Owner Name', value: asset.ownerName },
      { label: 'Model', value: asset.model },
      { label: 'Brand', value: asset.brand },
      { label: 'Status', value: asset.status },
      { label: 'Warranty Period', value: asset.warrantyPeriod },
      { label: 'Serial No.', value: asset.serialNo },
      { label: 'Location', value: asset.location },
      { label: 'Location Description', value: asset.locationDescription },
      { label: 'Area', value: asset.area },
      { label: 'Department Code', value: asset.departmentCode },
      { label: 'Department Description', value: asset.departmentDescription },
      { label: 'Condition', value: asset.condition },
      { label: 'Current User', value: asset.currentUser }
    ];

    specList.innerHTML = specs.map(spec => `
      <div class="spec-row">
        <div class="spec-label">${spec.label}</div>
        <div class="spec-value ${!spec.value ? 'muted' : ''}">${spec.value || '-'}</div>
      </div>
    `).join('');
  }

  // Generate QR code
  if (asset.assetId) {
    generateQRCode(asset.assetId);
  }
}

// Generate QR code for the asset
function generateQRCode(assetId) {
  const qrSection = document.getElementById('qr-code-section');
  const qrContainer = document.getElementById('qr-code-container');
  const downloadBtn = document.getElementById('download-qr-btn');
  
  if (!qrSection || !qrContainer) {
    console.warn('QR code elements not found');
    return;
  }
  
  // Check if QRCode library is loaded (use window.QRCode to avoid ReferenceError)
  const QRCodeLib = window.QRCode;
  if (typeof QRCodeLib === 'undefined') {
    console.warn('QRCode library not available');
    qrContainer.innerHTML = '<p style="color: #9ca3af; padding: 1rem; font-size: 0.9rem;">QR Code library is loading... Please wait or refresh the page.</p>';
    return;
  }
  
  // Create URL that links to this asset details page
  // Use full URL so QR code works when scanned from anywhere
  const assetUrl = `${window.location.origin}${window.location.pathname}?assetId=${encodeURIComponent(assetId)}${maintenanceId ? '&maintenanceId=' + encodeURIComponent(maintenanceId) : ''}`;
  
  // Update container style for canvas
  qrContainer.style.display = 'inline-block';
  qrContainer.style.minHeight = 'auto';
  qrContainer.style.alignItems = 'normal';
  qrContainer.style.justifyContent = 'normal';
  
  // Clear previous QR code
  qrContainer.innerHTML = '';
  
  // Generate QR code using the library
  QRCodeLib.toCanvas(qrContainer, assetUrl, {
    width: 256,
    margin: 2,
    color: {
      dark: '#140958',
      light: '#ffffff'
    }
  }, function(error) {
    if (error) {
      console.error('QR code generation error:', error);
      qrContainer.innerHTML = '<p style="color: #dc2626; padding: 1rem; font-size: 0.9rem;">Failed to generate QR code. Please try again.</p>';
      return;
    }
    
    // Show download button
    if (downloadBtn) {
      downloadBtn.style.display = 'inline-flex';
      downloadBtn.onclick = function() {
        const canvas = qrContainer.querySelector('canvas');
        if (canvas) {
          const url = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.download = `asset-${assetId}-qrcode.png`;
          link.href = url;
          link.click();
        }
      };
    }
  });
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadAssetDetails);
} else {
  loadAssetDetails();
}


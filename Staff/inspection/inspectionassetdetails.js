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
  const specList = document.getElementById('asset-spec-list');
  const backLink = document.getElementById('back-link');
  
  // Update back link before loading
  updateBackLink();

  if (!assetId) {
    if (specList) {
      specList.innerHTML = `
        <div class="error" style="padding: 2rem; text-align: center; color: #dc2626;">
          <h2>Asset ID Required</h2>
          <p>Please provide an asset ID in the URL.</p>
          <p style="margin-top: 1rem;">
            <a href="inspectionasset.html${maintenanceId ? '?maintenanceId=' + encodeURIComponent(maintenanceId) : ''}" style="color: #140958; font-weight: 600; text-decoration: none;">
              ← Back to inspection assets
            </a>
          </p>
        </div>
      `;
    }
    return;
  }

  try {
    const resp = await fetch(`/api/assets/get?assetId=${encodeURIComponent(assetId)}`);
    const data = await resp.json();

    if (!resp.ok || !data.ok) {
      if (specList) {
        specList.innerHTML = `
          <div class="error" style="padding: 2rem; text-align: center; color: #dc2626;">
            <h2>Asset Not Found</h2>
            <p>${data.error || 'Could not load asset details.'}</p>
            <p style="margin-top: 1rem;">
              <a href="inspectionasset.html${maintenanceId ? '?maintenanceId=' + encodeURIComponent(maintenanceId) : ''}" style="color: #140958; font-weight: 600; text-decoration: none;">
                ← Back to inspection assets
              </a>
            </p>
          </div>
        `;
      }
      return;
    }

    const asset = data.asset;
    displayAssetDetails(asset);
  } catch (error) {
    console.error('Error loading asset:', error);
    if (specList) {
      specList.innerHTML = `
        <div class="error" style="padding: 2rem; text-align: center; color: #dc2626;">
          <h2>Error</h2>
          <p>Could not load asset details: ${error.message || 'Network error occurred.'}</p>
          <p style="margin-top: 0.5rem; font-size: 0.85rem; color: #6b7280;">Check browser console for more details.</p>
          <p style="margin-top: 1rem;">
            <a href="inspectionasset.html${maintenanceId ? '?maintenanceId=' + encodeURIComponent(maintenanceId) : ''}" style="color: #140958; font-weight: 600; text-decoration: none;">
              ← Back to inspection assets
            </a>
          </p>
        </div>
      `;
    }
  }
}

// Display asset details in the page
function displayAssetDetails(asset) {
  // Update summary cards
  const summaryAssetId = document.getElementById('summary-asset-id');
  const summaryCategory = document.getElementById('summary-category');
  const summaryLocation = document.getElementById('summary-location');
  const summaryOwner = document.getElementById('summary-owner');
  
  if (summaryAssetId) summaryAssetId.textContent = asset.assetId || '-';
  if (summaryCategory) summaryCategory.textContent = asset.assetCategory || '-';
  if (summaryLocation) summaryLocation.textContent = asset.location || asset.locationDescription || '-';
  if (summaryOwner) summaryOwner.textContent = asset.ownerName || asset.ownerCode || '-';

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
    statusMeta.innerHTML = `<span style="padding: 0.25rem 0.75rem; border-radius: 999px; background: ${statusColor}20; color: ${statusColor}; font-size: 0.875rem; font-weight: 600;">${escapeHtml(status)}</span>`;
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

    specList.innerHTML = specs
      .filter(spec => spec.value) // Only show fields with values
      .map(spec => `
        <div class="spec-row">
          <div class="spec-label">${spec.label}</div>
          <div class="spec-value">${escapeHtml(spec.value)}</div>
        </div>
      `).join('');
  }

  // Generate QR code (using server-side PHP, no library needed)
  if (asset.assetId) {
    generateQRCode(asset.assetId);
  }
}

// Generate QR code for the asset (using server-side PHP endpoint)
function generateQRCode(assetId) {
  const qrSection = document.getElementById('qr-code-section');
  const qrContainer = document.getElementById('qr-code-container');
  const downloadBtn = document.getElementById('download-qr-btn');
  
  if (!qrSection || !qrContainer) {
    console.warn('QR code elements not found');
    return;
  }
  
  // Create URL that links to this asset details page
  // Use full URL so QR code works when scanned from anywhere
  const assetUrl = `${window.location.origin}${window.location.pathname}?assetId=${encodeURIComponent(assetId)}${maintenanceId ? '&maintenanceId=' + encodeURIComponent(maintenanceId) : ''}`;
  
  // Generate QR code using server-side PHP endpoint
  const qrCodeImageUrl = `./generate_qrcode.php?data=${encodeURIComponent(assetUrl)}`;
  
  // Clear container and add image
  qrContainer.innerHTML = '';
  qrContainer.style.display = 'flex';
  qrContainer.style.alignItems = 'center';
  qrContainer.style.justifyContent = 'center';
  qrContainer.style.minHeight = '256px';
  
  const img = document.createElement('img');
  img.src = qrCodeImageUrl;
  img.alt = 'QR Code for Asset ' + assetId;
  img.style.maxWidth = '100%';
  img.style.height = 'auto';
  img.style.display = 'block';
  
  img.onload = function() {
    // Show QR code section
    if (qrSection) {
      qrSection.style.display = 'block';
    }
    
    // Show download button
    if (downloadBtn) {
      downloadBtn.style.display = 'inline-flex';
      
      // Add download functionality
      downloadBtn.onclick = function() {
        downloadQRCode(qrCodeImageUrl, assetId);
      };
    }
  };
  
  img.onerror = function() {
    qrContainer.innerHTML = '<p style="color: #dc2626; padding: 1rem; font-size: 0.9rem;">Failed to load QR code image.</p>';
  };
  
  qrContainer.appendChild(img);
}

// Download QR code as PNG
function downloadQRCode(imageUrl, assetId) {
  // Fetch the image and create download link
  fetch(imageUrl)
    .then(response => response.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `asset-${assetId}-qrcode.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    })
    .catch(error => {
      console.error('Error downloading QR code:', error);
      alert('Failed to download QR code');
    });
}

// Helper function to escape HTML (prevent XSS)
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadAssetDetails);
} else {
  loadAssetDetails();
}


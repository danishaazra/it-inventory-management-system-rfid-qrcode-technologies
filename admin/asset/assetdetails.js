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
    const resp = await fetch(`/api/assets/get?assetId=${encodeURIComponent(assetId)}`);
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
      { label: 'RFID Tag ID', value: asset.rfidTagId },
    ];

    specList.innerHTML = specs
      .filter(spec => spec.value) // Only show fields with values
      .map(spec => `
        <div class="spec-row">
          <div class="spec-label">${spec.label}</div>
          <div class="spec-value">${spec.value}</div>
        </div>
      `).join('');
  }

  // Store asset data for edit functionality
  window.currentAsset = asset;
  
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
  
  console.log('Generating QR code for asset:', assetId);
  
  // Create URL that links to this asset details page
  // Use full URL so QR code works when scanned from anywhere
  const assetUrl = `${window.location.origin}${window.location.pathname}?assetId=${encodeURIComponent(assetId)}`;
  
  // Generate QR code using server-side PHP endpoint
  const qrCodeImageUrl = `/api/qrcode/generate?data=${encodeURIComponent(assetUrl)}`;
  
  console.log('QR code image URL:', qrCodeImageUrl);
  
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
    console.log('QR code image loaded successfully');
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
  
  img.onerror = function(e) {
    console.error('Failed to load QR code image:', e);
    qrContainer.innerHTML = '<p style="color: #dc2626; padding: 1rem; font-size: 0.9rem;">Failed to load QR code image. Check console for details.</p>';
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
      link.download = `Asset-${assetId}-QRCode.png`;
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

// Load asset details when page is ready
function initPage() {
  loadAssetDetails();
}

// Asset actions menu toggle
const assetActionsBtn = document.getElementById('asset-actions-btn');
const assetActionsMenu = document.getElementById('asset-actions-menu');

if (assetActionsBtn && assetActionsMenu) {
  assetActionsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    assetActionsMenu.classList.toggle('open');
  });
  
  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!assetActionsBtn.contains(e.target) && !assetActionsMenu.contains(e.target)) {
      assetActionsMenu.classList.remove('open');
    }
  });
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage);
} else {
  initPage();
}

// Edit and Delete functionality
const editBtn = document.getElementById('edit-asset-btn');
const deleteBtn = document.getElementById('delete-asset-btn');
const editModalOverlay = document.getElementById('edit-modal-overlay');
const editForm = document.getElementById('edit-asset-form');
const closeEditModalBtn = document.getElementById('close-modal-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

// Load locations for edit form dropdown
async function loadLocationsForEdit() {
  try {
    const resp = await fetch('/api/assets/locations');
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.ok && data.locations ? data.locations : [];
  } catch (error) {
    console.error('Error loading locations:', error);
    return [];
  }
}

// Populate edit form with asset data
function populateEditForm(asset) {
  // Populate all form fields
  document.getElementById('edit-no').value = asset.no || '';
  document.getElementById('edit-branchCode').value = asset.branchCode || '';
  document.getElementById('edit-assetId').value = asset.assetId || '';
  document.getElementById('edit-assetDescription').value = asset.assetDescription || '';
  document.getElementById('edit-assetCategory').value = asset.assetCategory || '';
  document.getElementById('edit-assetCategoryDescription').value = asset.assetCategoryDescription || '';
  document.getElementById('edit-ownerCode').value = asset.ownerCode || '';
  document.getElementById('edit-ownerName').value = asset.ownerName || '';
  document.getElementById('edit-model').value = asset.model || '';
  document.getElementById('edit-brand').value = asset.brand || '';
  document.getElementById('edit-status').value = asset.status || '';
  document.getElementById('edit-warrantyPeriod').value = asset.warrantyPeriod || '';
  document.getElementById('edit-serialNo').value = asset.serialNo || '';
  document.getElementById('edit-location').value = asset.location || '';
  
  // Populate location description dropdown
  const locationDescSelect = document.getElementById('edit-locationDescription');
  const locationDescCustom = document.getElementById('edit-locationDescription-custom');
  
  // Load and populate locations
  loadLocationsForEdit().then(locations => {
    locationDescSelect.innerHTML = '<option value="">Select location...</option>';
    locations.forEach(loc => {
      const option = document.createElement('option');
      option.value = loc;
      option.textContent = loc;
      option.selected = (loc === asset.locationDescription);
      locationDescSelect.appendChild(option);
    });
    
    // If current location is not in dropdown, show custom input
    if (asset.locationDescription && !locations.includes(asset.locationDescription)) {
      locationDescCustom.value = asset.locationDescription;
      locationDescCustom.style.display = 'block';
      locationDescSelect.style.display = 'none';
      document.getElementById('toggle-custom-location-edit').textContent = 'Use dropdown location';
    }
  });
  
  document.getElementById('edit-area').value = asset.area || '';
  document.getElementById('edit-departmentCode').value = asset.departmentCode || '';
  document.getElementById('edit-departmentDescription').value = asset.departmentDescription || '';
  document.getElementById('edit-condition').value = asset.condition || '';
  document.getElementById('edit-currentUser').value = asset.currentUser || '';
  document.getElementById('edit-rfidTagId').value = asset.rfidTagId || '';
}

// Open edit modal
function openEditModal() {
  if (window.currentAsset) {
    populateEditForm(window.currentAsset);
    editModalOverlay.classList.add('open');
  }
}

// Close edit modal
function closeEditModal() {
  editModalOverlay.classList.remove('open');
  editForm.reset();
}

// Edit button click
if (editBtn) {
  editBtn.addEventListener('click', () => {
    openEditModal();
  });
}

// Delete button click
if (deleteBtn) {
  deleteBtn.addEventListener('click', async () => {
    if (!confirm(`Are you sure you want to delete asset "${assetId}"?\n\nThis action cannot be undone.`)) {
      return;
    }
    
    try {
      const resp = await fetch('/api/assets/delete', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({assetId: assetId})
      });
      
      const data = await resp.json();
      
      if (!resp.ok || !data.ok) {
        alert(`Delete failed: ${data.error || 'Unknown error'}`);
        return;
      }
      
      alert('Asset deleted successfully!');
      // Redirect to asset list
      window.location.href = 'asset.html';
    } catch (error) {
      console.error('Error deleting asset:', error);
      alert(`Delete failed: ${error.message || 'Network error'}`);
    }
  });
}

// Close modal buttons
if (closeEditModalBtn) {
  closeEditModalBtn.addEventListener('click', closeEditModal);
}

if (cancelEditBtn) {
  cancelEditBtn.addEventListener('click', closeEditModal);
}

// Close modal when clicking outside
if (editModalOverlay) {
  editModalOverlay.addEventListener('click', (e) => {
    if (e.target === editModalOverlay) {
      closeEditModal();
    }
  });
}

// Handle edit form submission
if (editForm) {
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = Object.fromEntries(new FormData(editForm).entries());
    
    // Handle custom location description
    const locationDescCustom = document.getElementById('edit-locationDescription-custom');
    if (locationDescCustom.style.display !== 'none' && locationDescCustom.value.trim()) {
      formData.locationDescription = locationDescCustom.value.trim();
    }
    
    // Ensure RFID Tag ID is included (in case it was set programmatically)
    const rfidTagIdField = document.getElementById('edit-rfidTagId');
    if (rfidTagIdField && rfidTagIdField.value.trim()) {
      formData.rfidTagId = rfidTagIdField.value.trim();
    }
    
    // Debug: Log form data to console
    console.log('Submitting form data:', formData);
    
    try {
      const resp = await fetch('/api/assets/update', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(formData)
      });
      
      const data = await resp.json();
      
      if (!resp.ok || !data.ok) {
        alert(`Update failed: ${data.error || 'Unknown error'}`);
        return;
      }
      
      alert('Asset updated successfully!');
      closeEditModal();
      // Reload asset details
      loadAssetDetails();
    } catch (error) {
      console.error('Error updating asset:', error);
      alert(`Update failed: ${error.message || 'Network error'}`);
    }
  });
}

// Toggle custom location in edit form
const toggleCustomLocationEdit = document.getElementById('toggle-custom-location-edit');
const editLocationDescSelect = document.getElementById('edit-locationDescription');
const editLocationDescCustom = document.getElementById('edit-locationDescription-custom');

if (toggleCustomLocationEdit && editLocationDescSelect && editLocationDescCustom) {
  toggleCustomLocationEdit.addEventListener('click', () => {
    const isHidden = editLocationDescCustom.style.display === 'none';
    if (isHidden) {
      editLocationDescCustom.style.display = 'block';
      editLocationDescSelect.style.display = 'none';
      toggleCustomLocationEdit.textContent = 'Use dropdown location';
    } else {
      editLocationDescCustom.style.display = 'none';
      editLocationDescSelect.style.display = 'block';
      toggleCustomLocationEdit.textContent = '+ Add custom location';
      editLocationDescCustom.value = '';
    }
  });
}



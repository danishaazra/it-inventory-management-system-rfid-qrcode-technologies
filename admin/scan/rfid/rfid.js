// RFID Scanner JavaScript

// Get DOM elements
const searchRfidBtn = document.getElementById('search-rfid-btn');
const rfidInput = document.getElementById('rfid-input');
const errorMessage = document.getElementById('error-message');
const scanResult = document.getElementById('scan-result');
const scanResultData = document.getElementById('scan-result-data');
const viewDetailsBtn = document.getElementById('view-details-btn');
const inspectBtn = document.getElementById('inspect-btn');

// RFID search functionality
async function searchAssetByRfid() {
  const rfidTagId = rfidInput ? rfidInput.value.trim() : '';
  
  if (!rfidTagId) {
    showError('Please enter an RFID tag ID');
    return;
  }
  
  // Hide error and result
  hideError();
  if (scanResult) scanResult.classList.remove('show');
  
  // Disable button while searching
  if (searchRfidBtn) {
    searchRfidBtn.disabled = true;
    searchRfidBtn.textContent = 'Searching...';
  }
  
  try {
    // Search for asset by assetId (assuming RFID tag ID = assetId)
    const resp = await fetch(`../../../admin/asset/get_asset.php?assetId=${encodeURIComponent(rfidTagId)}`);
    const data = await resp.json();
    
    if (!resp.ok || !data.ok) {
      throw new Error(data.error || 'Asset not found');
    }
    
    // Display result
    const asset = data.asset;
    displayRfidScanResult(asset);
    
  } catch (error) {
    console.error('Error searching asset:', error);
    showError(`Error: ${error.message || 'Could not find asset with this RFID tag ID'}`);
    if (scanResult) scanResult.classList.remove('show');
  } finally {
    // Re-enable button
    if (searchRfidBtn) {
      searchRfidBtn.disabled = false;
      searchRfidBtn.textContent = 'Search Asset';
    }
  }
}

// Display RFID scan result
function displayRfidScanResult(asset) {
  if (!scanResult || !scanResultData) return;
  
  scanResultData.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 0.5rem;">Asset ID: ${escapeHtml(asset.assetId || '-')}</div>
    <div style="color: #6b7280; margin-bottom: 0.5rem;">${escapeHtml(asset.assetDescription || 'No description')}</div>
    <div style="color: #6b7280; font-size: 0.9rem;">Category: ${escapeHtml(asset.assetCategoryDescription || asset.assetCategory || '-')}</div>
  `;
  
  // Set up action buttons
  if (viewDetailsBtn && asset.assetId) {
    viewDetailsBtn.href = `../../../admin/asset/assetdetails.html?assetId=${encodeURIComponent(asset.assetId)}`;
    viewDetailsBtn.style.display = 'inline-flex';
  }
  
  if (inspectBtn && asset.assetId) {
    // Link to inspection if needed
    inspectBtn.href = `#`;
    inspectBtn.style.display = 'inline-flex';
  }
  
  scanResult.classList.add('show');
  
  // Clear input after successful search
  if (rfidInput) {
    rfidInput.value = '';
  }
}

// Show error message
function showError(message) {
  if (errorMessage) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
  }
}

// Hide error message
function hideError() {
  if (errorMessage) {
    errorMessage.classList.remove('show');
    errorMessage.textContent = '';
  }
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Event listeners
if (searchRfidBtn) {
  searchRfidBtn.addEventListener('click', searchAssetByRfid);
}

if (rfidInput) {
  rfidInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      searchAssetByRfid();
    }
  });
  
  // Auto-focus on page load
  rfidInput.focus();
}


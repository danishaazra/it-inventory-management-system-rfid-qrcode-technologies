// QR Code Scanner JavaScript

let html5QrcodeScanner = null;
let isScanning = false;

// Get DOM elements
const startScanBtn = document.getElementById('start-scan-btn');
const stopScanBtn = document.getElementById('stop-scan-btn');
const scannerWrapper = document.getElementById('scanner-wrapper');
const qrReader = document.getElementById('qr-reader');
const errorMessage = document.getElementById('error-message');
const scanResult = document.getElementById('scan-result');
const scanResultData = document.getElementById('scan-result-data');
const inspectBtn = document.getElementById('inspect-btn');

// Inspection modal elements
const inspectionModal = document.getElementById('inspection-modal-overlay');
const inspectionForm = document.getElementById('inspection-form');
const closeInspectionModalBtn = document.getElementById('close-inspection-modal-btn');
const cancelInspectionBtn = document.getElementById('cancel-inspection-btn');

// Store current asset ID for inspection
let currentAssetId = null;

// Check if HTML5-QRCode library is loaded
if (typeof Html5Qrcode === 'undefined') {
  console.error('HTML5-QRCode library not loaded');
  showError('QR Code scanner library not loaded. Please refresh the page.');
  if (startScanBtn) startScanBtn.disabled = true;
}

// Start QR code scanning
async function startScanning() {
  if (isScanning) return;
  
  try {
    // Check for mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      const mobileNotice = document.getElementById('mobile-notice');
      if (mobileNotice) mobileNotice.style.display = 'block';
    }

    if (typeof Html5Qrcode === 'undefined') {
      throw new Error('QR Code scanner library not available');
    }

    // Hide error and result
    hideError();
    if (scanResult) scanResult.classList.remove('show');

    // Show scanner wrapper
    if (scannerWrapper) scannerWrapper.style.display = 'block';
    if (startScanBtn) startScanBtn.disabled = true;
    if (stopScanBtn) stopScanBtn.style.display = 'block';

    // Initialize scanner
    html5QrcodeScanner = new Html5Qrcode("qr-reader");
    
    // Start scanning
    await html5QrcodeScanner.start(
      { facingMode: "environment" }, // Use back camera if available
      {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      },
      onScanSuccess,
      onScanError
    );

    isScanning = true;
  } catch (error) {
    console.error('Error starting scanner:', error);
    showError(`Failed to start camera: ${error.message}`);
    if (scannerWrapper) scannerWrapper.style.display = 'none';
    if (startScanBtn) startScanBtn.disabled = false;
    if (stopScanBtn) stopScanBtn.style.display = 'none';
  }
}

// Stop QR code scanning
async function stopScanning() {
  if (!isScanning || !html5QrcodeScanner) return;

  try {
    await html5QrcodeScanner.stop();
    html5QrcodeScanner.clear();
    html5QrcodeScanner = null;
    isScanning = false;

    if (scannerWrapper) scannerWrapper.style.display = 'none';
    if (startScanBtn) startScanBtn.disabled = false;
    if (stopScanBtn) stopScanBtn.style.display = 'none';
  } catch (error) {
    console.error('Error stopping scanner:', error);
  }
}

// Handle successful scan
function onScanSuccess(decodedText, decodedResult) {
  console.log('QR Code scanned:', decodedText);
  
  // Stop scanning after successful scan
  stopScanning();
  
  // Extract assetId from the scanned text (could be a URL or just the ID)
  let assetId = decodedText;
  
  // If it's a URL, try to extract assetId from query parameter
  try {
    const url = new URL(decodedText);
    const params = new URLSearchParams(url.search);
    assetId = params.get('assetId') || assetId;
  } catch (e) {
    // Not a URL, use as-is
  }
  
  // Display result and fetch asset details
  displayScanResult(assetId);
  fetchAssetDetails(assetId);
}

// Handle scan error
function onScanError(errorMessage) {
  // Ignore continuous scanning errors, only show critical errors
  // console.log('Scan error:', errorMessage);
}

// Display scan result
function displayScanResult(assetId) {
  if (!scanResult || !scanResultData) return;
  
  scanResultData.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 0.5rem;">Scanned Code:</div>
    <div style="color: #6b7280;">${escapeHtml(assetId)}</div>
  `;
  
  scanResult.classList.add('show');
}

// Fetch asset details from API (with staff assignment check)
async function fetchAssetDetails(assetId) {
  try {
    // Include staffId so backend can verify assignment to this staff's tasks
    const staffId = sessionStorage.getItem('userId') || '';
    let url = `../../../admin/asset/get_asset_by_assetid.php?assetId=${encodeURIComponent(assetId)}`;
    if (staffId) {
      url += `&staffId=${encodeURIComponent(staffId)}`;
    }

    const resp = await fetch(url);
    const data = await resp.json();
    
    if (!resp.ok || !data.ok) {
      // If backend explicitly says this asset is not assigned to the staff,
      // show a clear popup message.
      if (data && data.error === 'ASSET_NOT_ASSIGNED_TO_STAFF') {
        const msg = data.message || 'This asset is not assigned to your maintenance tasks.';
        alert(msg);
        showError(msg);
      } else {
        const msg = (data && (data.message || data.error)) || 'Asset not found';
        showError(`Error: ${msg}`);
      }
      if (scanResult) scanResult.classList.remove('show');
      return;
    }
    
    const asset = data.asset;
    displayAssetResult(asset);
    
  } catch (error) {
    console.error('Error fetching asset:', error);
    if (scanResultData) {
      scanResultData.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 0.5rem; color: #dc2626;">Asset Not Found</div>
        <div style="color: #6b7280;">${escapeHtml(error.message || 'Could not find asset with this QR code')}</div>
      `;
    }
  }
}

// Display asset result
function displayAssetResult(asset) {
  if (!scanResult || !scanResultData) return;
  
  scanResultData.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 0.5rem;">Asset ID: ${escapeHtml(asset.assetId || '-')}</div>
    <div style="color: #6b7280; margin-bottom: 0.5rem;">${escapeHtml(asset.assetDescription || 'No description')}</div>
    <div style="color: #6b7280; font-size: 0.9rem;">Category: ${escapeHtml(asset.assetCategoryDescription || asset.assetCategory || '-')}</div>
  `;
  
  // Store current asset ID for inspection
  currentAssetId = asset.assetId;
  
  // Set up action buttons - Staff version: Show Inspect only (hide View Details)
  if (inspectBtn && asset.assetId) {
    // Set up inspect button click handler to open modal
    inspectBtn.onclick = (e) => {
      e.preventDefault();
      openInspectionModal();
    };
    inspectBtn.style.display = 'inline-flex';
  }
  
  scanResult.classList.add('show');
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

// Inspection Modal Functions
function openInspectionModal() {
  if (!currentAssetId) {
    showError('No asset selected for inspection');
    return;
  }
  
  if (inspectionModal) {
    // Reset form
    if (inspectionForm) {
      inspectionForm.reset();
    }
    inspectionModal.classList.add('open');
  }
}

function closeInspectionModal() {
  if (inspectionModal) {
    inspectionModal.classList.remove('open');
    if (inspectionForm) {
      inspectionForm.reset();
    }
  }
}

// Save inspection
async function saveInspection(formData) {
  if (!currentAssetId) {
    alert('Cannot save inspection: No asset selected');
    return;
  }

  if (!formData.notes || !formData.notes.trim()) {
    alert('Please enter inspection notes');
    return;
  }

  if (!formData.solved) {
    alert('Please select inspection status (Solved or Not Solved)');
    return;
  }

  try {
    const url = './save_inspection.php';
    const body = {
      assetId: currentAssetId,
      notes: formData.notes.trim(),
      solved: formData.solved === 'yes'
    };
    
    const resp = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    });

    const data = await resp.json();

    if (!resp.ok || !data.ok) {
      alert(`Save failed: ${data.error || 'Unknown error'}`);
      return;
    }

    alert('Inspection saved successfully!');
    closeInspectionModal();
  } catch (error) {
    console.error('Error saving inspection:', error);
    alert(`Save failed: ${error.message || 'Network error'}`);
  }
}

// Event listeners
if (startScanBtn) {
  startScanBtn.addEventListener('click', startScanning);
}

if (stopScanBtn) {
  stopScanBtn.addEventListener('click', stopScanning);
}

// Inspection modal event listeners
if (inspectionForm) {
  inspectionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form values
    const notes = document.getElementById('inspection-notes')?.value?.trim() || '';
    const solved = document.querySelector('input[name="solved"]:checked')?.value || '';
    
    // Validate form
    if (!notes) {
      alert('Please enter inspection notes');
      document.getElementById('inspection-notes')?.focus();
      return;
    }
    
    if (!solved) {
      alert('Please select inspection status (Solved or Not Solved)');
      return;
    }
    
    await saveInspection({
      notes: notes,
      solved: solved
    });
  });
}

if (closeInspectionModalBtn) {
  closeInspectionModalBtn.addEventListener('click', closeInspectionModal);
}

if (cancelInspectionBtn) {
  cancelInspectionBtn.addEventListener('click', closeInspectionModal);
}

// Close modal when clicking outside
if (inspectionModal) {
  inspectionModal.addEventListener('click', (e) => {
    if (e.target === inspectionModal) {
      closeInspectionModal();
    }
  });
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (isScanning && html5QrcodeScanner) {
    stopScanning();
  }
});

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
const viewDetailsBtn = document.getElementById('view-details-btn');
const inspectBtn = document.getElementById('inspect-btn');

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

// Fetch asset details from API
async function fetchAssetDetails(assetId) {
  try {
    const resp = await fetch(`../../../admin/asset/get_asset.php?assetId=${encodeURIComponent(assetId)}`);
    const data = await resp.json();
    
    if (!resp.ok || !data.ok) {
      throw new Error(data.error || 'Asset not found');
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
if (startScanBtn) {
  startScanBtn.addEventListener('click', startScanning);
}

if (stopScanBtn) {
  stopScanBtn.addEventListener('click', stopScanning);
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (isScanning && html5QrcodeScanner) {
    stopScanning();
  }
});


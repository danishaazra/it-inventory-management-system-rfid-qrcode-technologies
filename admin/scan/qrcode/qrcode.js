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
    console.log('🔍 Searching for asset with Asset ID:', assetId);
    
    // Search for asset by Asset ID (admin version - no staffId)
    const resp = await fetch(`/api/assets/get-by-assetid?assetId=${encodeURIComponent(assetId)}`);
    const data = await resp.json();
    
    console.log('📦 Response received:', data);
    
    if (!resp.ok || !data.ok) {
      throw new Error(data.error || 'Asset not found');
    }
    
    // Display result
    const asset = data.asset;
    console.log('✅ Asset found:', asset);
    displayAssetResult(asset);
    
  } catch (error) {
    console.error('❌ Error fetching asset:', error);
    if (scanResultData) {
      scanResultData.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 0.5rem; color: #dc2626;">Asset Not Found</div>
        <div style="color: #6b7280;">${escapeHtml(error.message || 'Could not find asset with this QR code')}</div>
      `;
    }
    if (scanResult) scanResult.classList.remove('show');
  }
}

// Display asset result
function displayAssetResult(asset) {
  console.log('📊 Displaying asset result:', asset);
  
  if (!scanResult || !scanResultData) {
    console.error('❌ Scan result elements not found!');
    return;
  }
  
  scanResultData.innerHTML = `
    <div style="margin-bottom: 1rem;">
      <div style="font-weight: 700; font-size: 1.1rem; color: #1a1a1a; margin-bottom: 0.75rem;">Asset Found</div>
      <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; border: 1px solid #e5e7eb;">
        <div style="display: grid; gap: 0.75rem;">
          <div>
            <span style="font-weight: 600; color: #374151;">Asset ID:</span>
            <span style="color: #1a1a1a; margin-left: 0.5rem;">${escapeHtml(asset.assetId || '-')}</span>
          </div>
          <div>
            <span style="font-weight: 600; color: #374151;">Description:</span>
            <span style="color: #1a1a1a; margin-left: 0.5rem;">${escapeHtml(asset.assetDescription || 'No description')}</span>
          </div>
          <div>
            <span style="font-weight: 600; color: #374151;">Category:</span>
            <span style="color: #1a1a1a; margin-left: 0.5rem;">${escapeHtml(asset.assetCategoryDescription || asset.assetCategory || '-')}</span>
          </div>
          ${asset.model ? `<div>
            <span style="font-weight: 600; color: #374151;">Model:</span>
            <span style="color: #1a1a1a; margin-left: 0.5rem;">${escapeHtml(asset.model)}</span>
          </div>` : ''}
          ${asset.locationDescription || asset.location ? `<div>
            <span style="font-weight: 600; color: #374151;">Location:</span>
            <span style="color: #1a1a1a; margin-left: 0.5rem;">${escapeHtml(asset.locationDescription || asset.location || '-')}</span>
          </div>` : ''}
          ${asset.status ? `<div>
            <span style="font-weight: 600; color: #374151;">Status:</span>
            <span style="color: #1a1a1a; margin-left: 0.5rem;">${escapeHtml(asset.status)}</span>
          </div>` : ''}
        </div>
      </div>
    </div>
  `;
  
  // Set up action buttons - Admin version: Show View Details only
  if (viewDetailsBtn && asset.assetId) {
    viewDetailsBtn.href = `../../../admin/asset/assetdetails.html?assetId=${encodeURIComponent(asset.assetId)}`;
    viewDetailsBtn.style.display = 'inline-flex';
  }
  
  scanResult.classList.add('show');
  
  // Scroll to result
  scanResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  
  console.log('✅ Asset result displayed successfully');
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


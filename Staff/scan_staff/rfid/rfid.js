// RFID Scanner JavaScript

// Get DOM elements
const searchRfidBtn = document.getElementById('search-rfid-btn');
const rfidInput = document.getElementById('rfid-input');
const errorMessage = document.getElementById('error-message');
const scanResult = document.getElementById('scan-result');
const scanResultData = document.getElementById('scan-result-data');
const viewDetailsBtn = document.getElementById('view-details-btn');
const inspectBtn = document.getElementById('inspect-btn');
const connectArduinoBtn = document.getElementById('connect-arduino-btn');
const disconnectArduinoBtn = document.getElementById('disconnect-arduino-btn');
const connectionStatus = document.getElementById('connection-status');

// Store current asset ID for inspection
let currentAssetId = null;

// Web Serial API variables
let serialPort = null;
let reader = null;
let isConnected = false;
let readLoop = null;

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
    // Get staff ID from session storage - REQUIRED for staff scanning
    const staffId = sessionStorage.getItem('staffId') || '';
    
    if (!staffId) {
      showAssignmentError('Staff ID not found. Please log in again.');
      return;
    }
    
    // Search for asset by RFID tag ID with staff assignment check
    // ALWAYS include staffId to enforce assignment checking
    const url = `../../../admin/asset/get_asset_by_rfid.php?rfidTagId=${encodeURIComponent(rfidTagId)}&staffId=${encodeURIComponent(staffId)}`;
    console.log('🔍 Searching for asset with RFID Tag ID:', rfidTagId);
    console.log('👤 Staff ID:', staffId);
    console.log('📡 Fetching URL:', url);
    const resp = await fetch(url);
    
    // Check if response is JSON
    const contentType = resp.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await resp.text();
      console.error('❌ Non-JSON response received:', text.substring(0, 200));
      throw new Error(`Server error: Received HTML instead of JSON. The endpoint may not exist. (Status: ${resp.status})`);
    }
    
    const data = await resp.json();
    console.log('📦 Response received:', data);
    
    if (!resp.ok || !data.ok) {
      // Check if it's an assignment error
      if (data.error === 'ASSET_NOT_ASSIGNED_TO_STAFF' || resp.status === 403) {
        const message = data.message || 'This asset is not assigned to your maintenance tasks.';
        showAssignmentError(message);
        if (scanResult) scanResult.classList.remove('show');
        return;
      }
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
  console.log('📊 Displaying asset result:', asset);
  
  if (!scanResult || !scanResultData) {
    console.error('❌ Scan result elements not found!');
    return;
  }
  
  // Store current asset ID
  currentAssetId = asset.assetId || null;
  
  scanResultData.innerHTML = `
    <div style="margin-bottom: 1rem;">
      <div style="font-weight: 700; font-size: 1.1rem; color: #1a1a1a; margin-bottom: 0.75rem;">Asset Found</div>
      <div style="font-weight: 600; margin-bottom: 0.5rem;">Asset ID: ${escapeHtml(asset.assetId || '-')}</div>
      <div style="color: #6b7280; margin-bottom: 0.5rem;">${escapeHtml(asset.assetDescription || 'No description')}</div>
      <div style="color: #6b7280; font-size: 0.9rem;">Category: ${escapeHtml(asset.assetCategoryDescription || asset.assetCategory || '-')}</div>
    </div>
  `;
  
  // Set up action buttons
  if (inspectBtn && asset.assetId) {
    inspectBtn.style.display = 'inline-flex';
    inspectBtn.onclick = (e) => {
      e.preventDefault();
      openInspectionModal();
    };
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

// Show assignment error popup (more prominent)
function showAssignmentError(message) {
  // Remove any existing popup
  const existingPopup = document.getElementById('assignment-error-popup');
  if (existingPopup) {
    existingPopup.remove();
  }
  
  // Create popup overlay
  const popup = document.createElement('div');
  popup.id = 'assignment-error-popup';
  popup.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    animation: fadeIn 0.3s ease-out;
  `;
  
  popup.innerHTML = `
    <div style="
      background: white;
      border-radius: 16px;
      padding: 2rem;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      text-align: center;
      animation: slideUp 0.3s ease-out;
    ">
      <div style="font-size: 4rem; margin-bottom: 1rem;">⚠️</div>
      <h3 style="
        font-size: 1.5rem;
        font-weight: 700;
        color: #dc2626;
        margin-bottom: 1rem;
      ">Access Denied</h3>
      <p style="
        font-size: 1rem;
        color: #374151;
        margin-bottom: 2rem;
        line-height: 1.6;
      ">${escapeHtml(message)}</p>
      <button id="close-assignment-popup-btn" style="
        padding: 0.75rem 2rem;
        background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      ">OK, I Understand</button>
    </div>
  `;
  
  // Add animations if not exists
  if (!document.getElementById('assignment-popup-animations')) {
    const style = document.createElement('style');
    style.id = 'assignment-popup-animations';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from {
          transform: translateY(20px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(popup);
  
  // Close button handler
  const closeBtn = document.getElementById('close-assignment-popup-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      popup.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => {
        if (popup.parentNode) {
          popup.remove();
        }
      }, 300);
    });
  }
  
  // Close on overlay click
  popup.addEventListener('click', (e) => {
    if (e.target === popup) {
      popup.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => {
        if (popup.parentNode) {
          popup.remove();
        }
      }, 300);
    }
  });
  
  // Also show in error message area
  showError(message);
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

// Web Serial API: Connect to Arduino
async function connectToArduino() {
  // Check if Web Serial API is supported
  if (!navigator.serial) {
    showError('Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.');
    return;
  }

  try {
    // Request port access
    serialPort = await navigator.serial.requestPort();
    
    // Open the port with 9600 baud rate (matching Arduino)
    await serialPort.open({ baudRate: 9600 });
    
    isConnected = true;
    updateConnectionUI(true);
    hideError();
    
    // Start reading from serial port
    startReadingSerial();
    
  } catch (error) {
    console.error('Error connecting to Arduino:', error);
    if (error.name === 'NotFoundError') {
      showError('No Arduino device selected. Please try again.');
    } else if (error.name === 'SecurityError') {
      showError('Permission denied. Please allow serial port access.');
    } else {
      showError(`Connection error: ${error.message}`);
    }
    isConnected = false;
    updateConnectionUI(false);
  }
}

// Web Serial API: Disconnect from Arduino
async function disconnectFromArduino() {
  try {
    if (readLoop) {
      readLoop.abort();
      readLoop = null;
    }
    
    if (reader) {
      await reader.cancel();
      await reader.releaseLock();
      reader = null;
    }
    
    if (serialPort) {
      await serialPort.close();
      serialPort = null;
    }
    
    isConnected = false;
    updateConnectionUI(false);
    hideError();
    
  } catch (error) {
    console.error('Error disconnecting:', error);
    showError(`Disconnect error: ${error.message}`);
  }
}

// Buffer for incomplete lines from serial port
let serialBuffer = '';

// Read data from serial port
async function startReadingSerial() {
  if (!serialPort) return;
  
  try {
    const decoder = new TextDecoder();
    reader = serialPort.readable.getReader();
    
    readLoop = new AbortController();
    
    // Reset buffer when starting
    serialBuffer = '';
    
    while (serialPort.readable && !readLoop.signal.aborted) {
      const { value, done } = await reader.read();
      
      if (done) {
        break;
      }
      
      // Decode the chunk and add to buffer
      const chunk = decoder.decode(value, { stream: true });
      serialBuffer += chunk;
      
      // Process complete lines (ending with \n)
      const lines = serialBuffer.split('\n');
      
      // Keep the last incomplete line in buffer
      serialBuffer = lines.pop() || '';
      
      // Process complete lines
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines
        if (!trimmedLine) {
          continue;
        }
        
        // Skip status messages from Arduino
        if (trimmedLine.includes('RFID Reader Ready') || 
            trimmedLine.includes('Waiting for RFID tag') ||
            trimmedLine.includes('RFID Tag Scanned:') ||
            trimmedLine.includes('RFID reader detected') ||
            trimmedLine.includes('Scan a card') ||
            trimmedLine === '---') {
          continue;
        }
        
        // Handle "UID: XX XX XX XX" format from Arduino
        let rfidTagId = null;
        
        console.log('🔍 Processing line:', trimmedLine);
        
        if (trimmedLine.startsWith('UID:') || trimmedLine.startsWith('uid:')) {
          console.log('📋 Detected UID: prefix');
          // Extract hex values after "UID:"
          const hexValues = trimmedLine.replace(/UID:\s*/i, '').trim();
          console.log('📋 Extracted hex values:', hexValues);
          // Remove spaces and combine hex values
          const combinedHex = hexValues.replace(/\s+/g, '');
          console.log('📋 Combined hex:', combinedHex);
          if (/^[0-9A-F]{8,16}$/i.test(combinedHex)) {
            rfidTagId = combinedHex.toUpperCase();
            console.log('✅ Parsed RFID UID from UID: format:', rfidTagId);
          } else {
            console.log('❌ Combined hex does not match pattern:', combinedHex);
          }
        }
        // Check if it's already a valid RFID UID (continuous hex)
        else if (/^[0-9A-F]{8,16}$/i.test(trimmedLine)) {
          rfidTagId = trimmedLine.toUpperCase();
          console.log('✅ Direct RFID UID format:', rfidTagId);
        }
        // Handle space-separated hex format "XX XX XX XX"
        else if (/^([0-9A-F]{2}\s*)+$/i.test(trimmedLine)) {
          const combinedHex = trimmedLine.replace(/\s+/g, '');
          if (/^[0-9A-F]{8,16}$/i.test(combinedHex)) {
            rfidTagId = combinedHex.toUpperCase();
            console.log('✅ Parsed RFID UID from space-separated format:', rfidTagId);
          }
        }
        
        // Process valid RFID UID
        if (rfidTagId) {
          console.log('✅✅✅ Valid RFID UID detected:', rfidTagId);
          console.log('📞 Calling handleRfidScan with:', rfidTagId);
          handleRfidScan(rfidTagId);
        } else {
          console.log('⚠️ Could not parse RFID UID from line:', trimmedLine);
        }
      }
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Error reading serial:', error);
      showError(`Serial read error: ${error.message}`);
      await disconnectFromArduino();
    }
  } finally {
    // Clear buffer on disconnect
    serialBuffer = '';
  }
}

// Handle RFID tag scan from Arduino
function handleRfidScan(rfidTagId) {
  console.log('🎯 RFID Tag scanned:', rfidTagId);
  
  if (!rfidTagId || !rfidTagId.trim()) {
    console.error('❌ Invalid RFID Tag ID:', rfidTagId);
    return;
  }
  
  // Update input field with visual feedback
  if (rfidInput) {
    rfidInput.value = rfidTagId.trim();
    console.log('✅ Input field updated with:', rfidInput.value);
    rfidInput.style.borderColor = '#16a34a';
    rfidInput.style.borderWidth = '2px';
    rfidInput.style.background = '#f0fdf4';
    rfidInput.style.fontWeight = '600';
    
    // Reset styling after 2 seconds
    setTimeout(() => {
      rfidInput.style.borderColor = '';
      rfidInput.style.borderWidth = '';
      rfidInput.style.background = '';
      rfidInput.style.fontWeight = '';
    }, 2000);
  } else {
    console.error('❌ RFID input field not found!');
  }
  
  // Show scan confirmation
  showScanConfirmation(rfidTagId);
  
  // Automatically search for the asset
  console.log('🔍 Starting automatic asset search...');
  searchAssetByRfid();
}

// Show scan confirmation display
function showScanConfirmation(rfidTagId) {
  // Remove any existing confirmation
  const existingConfirm = document.getElementById('rfid-scan-confirmation');
  if (existingConfirm) {
    existingConfirm.remove();
  }
  
  // Create confirmation display
  const confirmation = document.createElement('div');
  confirmation.id = 'rfid-scan-confirmation';
  confirmation.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 1.25rem 1.5rem;
    background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
    border: 3px solid #16a34a;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(22, 163, 74, 0.3);
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
    max-width: 400px;
  `;
  
  confirmation.innerHTML = `
    <div style="display: flex; align-items: center; gap: 1rem;">
      <div style="font-size: 2rem;">✅</div>
      <div style="flex: 1;">
        <div style="font-weight: 700; color: #065f46; font-size: 0.95rem; margin-bottom: 0.5rem;">
          RFID Tag Scanned Successfully!
        </div>
        <div style="font-family: 'Courier New', monospace; font-size: 1.3rem; font-weight: 700; color: #047857; letter-spacing: 0.1em; background: #ffffff; padding: 0.5rem 0.75rem; border-radius: 6px; border: 2px solid #16a34a;">
          ${rfidTagId}
        </div>
        <div style="font-size: 0.8rem; color: #059669; margin-top: 0.5rem;">
          Searching for asset...
        </div>
      </div>
    </div>
  `;
  
  // Add animation style if not exists
  if (!document.getElementById('rfid-scan-animations')) {
    const style = document.createElement('style');
    style.id = 'rfid-scan-animations';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(confirmation);
  
  // Add pulse animation
  confirmation.style.animation = 'slideIn 0.3s ease-out, pulse 0.5s ease-in-out 0.3s';
  
  // Remove after 5 seconds
  setTimeout(() => {
    confirmation.style.transition = 'all 0.3s ease-out';
    confirmation.style.opacity = '0';
    confirmation.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (confirmation.parentNode) {
        confirmation.remove();
      }
    }, 300);
  }, 5000);
}

// Update connection UI
function updateConnectionUI(connected) {
  if (connectArduinoBtn) {
    connectArduinoBtn.style.display = connected ? 'none' : 'inline-block';
  }
  
  if (disconnectArduinoBtn) {
    disconnectArduinoBtn.style.display = connected ? 'inline-block' : 'none';
  }
  
  if (connectionStatus) {
    if (connected) {
      connectionStatus.textContent = '✓ Connected to Arduino';
      connectionStatus.className = 'connection-status connected';
    } else {
      connectionStatus.textContent = 'Not connected';
      connectionStatus.className = 'connection-status disconnected';
    }
  }
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

if (connectArduinoBtn) {
  connectArduinoBtn.addEventListener('click', connectToArduino);
}

if (disconnectArduinoBtn) {
  disconnectArduinoBtn.addEventListener('click', disconnectFromArduino);
}

// Inspection Modal Functions
function openInspectionModal() {
  if (!currentAssetId) {
    showError('No asset selected for inspection');
    return;
  }
  
  const inspectionModal = document.getElementById('inspection-modal-overlay');
  if (inspectionModal) {
    inspectionModal.classList.add('open');
  }
}

function closeInspectionModal() {
  const inspectionModal = document.getElementById('inspection-modal-overlay');
  if (inspectionModal) {
    inspectionModal.classList.remove('open');
  }
  
  // Reset form
  const inspectionForm = document.getElementById('inspection-form');
  if (inspectionForm) {
    inspectionForm.reset();
  }
}

// Set up inspection modal event listeners
const inspectionModal = document.getElementById('inspection-modal-overlay');
const inspectionForm = document.getElementById('inspection-form');
const closeInspectionModalBtn = document.getElementById('close-inspection-modal-btn');
const cancelInspectionBtn = document.getElementById('cancel-inspection-btn');

if (closeInspectionModalBtn) {
  closeInspectionModalBtn.addEventListener('click', closeInspectionModal);
}

if (cancelInspectionBtn) {
  cancelInspectionBtn.addEventListener('click', closeInspectionModal);
}

if (inspectionModal) {
  inspectionModal.addEventListener('click', function(e) {
    if (e.target === inspectionModal) {
      closeInspectionModal();
    }
  });
}

if (inspectionForm) {
  inspectionForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (!currentAssetId) {
      showError('No asset selected for inspection');
      return;
    }
    
    const notes = document.getElementById('inspection-notes')?.value.trim() || '';
    const solved = document.querySelector('input[name="solved"]:checked')?.value || '';
    
    if (!notes) {
      showError('Please enter inspection notes');
      return;
    }
    
    if (!solved) {
      showError('Please select a status (Solved/Not Solved)');
      return;
    }
    
    const saveBtn = document.getElementById('save-inspection-btn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }
    
    try {
      const staffId = sessionStorage.getItem('staffId') || '';
      const response = await fetch('../../../admin/scan/rfid/save_inspection.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assetId: currentAssetId,
          staffId: staffId,
          notes: notes,
          solved: solved === 'yes'
        })
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to save inspection');
      }
      
      alert('Inspection saved successfully!');
      closeInspectionModal();
      hideError();
      
      // Clear scan result
      if (scanResult) {
        scanResult.classList.remove('show');
      }
      if (rfidInput) {
        rfidInput.value = '';
        rfidInput.focus();
      }
      
    } catch (error) {
      console.error('Error saving inspection:', error);
      showError(`Failed to save inspection: ${error.message}`);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Inspection';
      }
    }
  });
}


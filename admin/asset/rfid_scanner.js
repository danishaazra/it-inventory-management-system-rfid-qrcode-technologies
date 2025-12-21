// RFID Scanner functionality for asset forms
// This module provides Arduino connection and RFID scanning for asset forms

let serialPort = null;
let reader = null;
let isConnected = false;
let readLoop = null;
let currentCallback = null; // Callback function to call when RFID is scanned

// Connect to Arduino
async function connectToArduino(connectionStatusElement) {
  if (!navigator.serial) {
    if (connectionStatusElement) {
      connectionStatusElement.textContent = 'Web Serial API not supported. Use Chrome/Edge browser.';
      connectionStatusElement.style.color = '#dc2626';
    }
    return false;
  }

  try {
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: 9600 });
    
    isConnected = true;
    if (connectionStatusElement) {
      connectionStatusElement.textContent = '✓ Connected to Arduino';
      connectionStatusElement.style.color = '#16a34a';
    }
    
    startReadingSerial();
    return true;
  } catch (error) {
    console.error('Error connecting to Arduino:', error);
    isConnected = false;
    
    // Don't show error if user cancelled the port selection
    if (error.name === 'NotFoundError' || error.name === 'SecurityError') {
      if (connectionStatusElement) {
        connectionStatusElement.textContent = 'Connection cancelled or not available';
        connectionStatusElement.style.color = '#6b7280';
      }
      return false;
    }
    
    // Check for port conflict (most common: Serial Monitor is open)
    if (error.name === 'NetworkError' || error.name === 'InvalidStateError' || 
        error.message?.includes('busy') || error.message?.includes('already') ||
        error.message?.includes('access') || error.message?.includes('permission')) {
      if (connectionStatusElement) {
        connectionStatusElement.innerHTML = '⚠️ Port is busy - Close Arduino IDE Serial Monitor first!';
        connectionStatusElement.style.color = '#dc2626';
        connectionStatusElement.style.fontWeight = '600';
      }
      // Show detailed alert
      alert('⚠️ Serial Port Conflict!\n\n' +
            'The Arduino serial port is currently being used by another application.\n\n' +
            'To fix this:\n' +
            '1. Close Arduino IDE Serial Monitor (if open)\n' +
            '2. Close any other programs using the COM port\n' +
            '3. Try connecting again\n\n' +
            'The port can only be used by ONE application at a time.');
      return false;
    }
    
    // Show error for other connection issues
    if (connectionStatusElement) {
      connectionStatusElement.textContent = `Connection error: ${error.message || 'Unknown error'}`;
      connectionStatusElement.style.color = '#dc2626';
    }
    return false;
  }
}

// Disconnect from Arduino
async function disconnectFromArduino(connectionStatusElement) {
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
    if (connectionStatusElement) {
      connectionStatusElement.textContent = 'Not connected - Click "Scan RFID" to connect';
      connectionStatusElement.style.color = '#6b7280';
    }
  } catch (error) {
    console.error('Error disconnecting:', error);
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
        
        // Skip status messages
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
        
        if (trimmedLine.startsWith('UID:')) {
          // Extract hex values after "UID:"
          const hexValues = trimmedLine.replace(/UID:\s*/i, '').trim();
          // Remove spaces and combine hex values
          const combinedHex = hexValues.replace(/\s+/g, '');
          if (/^[0-9A-F]{8,16}$/i.test(combinedHex)) {
            rfidTagId = combinedHex.toUpperCase();
          }
        }
        // Check if it's already a valid RFID UID (continuous hex)
        else if (/^[0-9A-F]{8,16}$/i.test(trimmedLine)) {
          rfidTagId = trimmedLine.toUpperCase();
        }
        // Handle space-separated hex format "XX XX XX XX"
        else if (/^([0-9A-F]{2}\s*)+$/i.test(trimmedLine)) {
          const combinedHex = trimmedLine.replace(/\s+/g, '');
          if (/^[0-9A-F]{8,16}$/i.test(combinedHex)) {
            rfidTagId = combinedHex.toUpperCase();
          }
        }
        
        // Process valid RFID UID
        if (rfidTagId) {
          console.log('✅ Valid RFID UID detected:', rfidTagId);
          // Call the callback if set
          if (currentCallback) {
            console.log('📞 Calling RFID callback...');
            currentCallback(rfidTagId);
          } else {
            console.warn('⚠️ RFID callback not set!');
          }
        }
        // Only log non-RFID lines if they're longer (to reduce console spam)
        else if (trimmedLine.length > 3 && !trimmedLine.includes('UID:')) {
          console.log('Skipping line (not RFID format):', trimmedLine);
        }
      }
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Error reading serial:', error);
      await disconnectFromArduino();
    }
  } finally {
    // Clear buffer on disconnect
    serialBuffer = '';
  }
}

// Set callback function for RFID scans
function setRfidCallback(callback) {
  currentCallback = callback;
}

// Show custom styled alert for RFID scan (for edit form)
function showScanAlert(rfidTagId) {
  // Remove any existing alert
  const existingAlert = document.getElementById('rfid-scan-alert-overlay');
  if (existingAlert) {
    existingAlert.remove();
  }
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'rfid-scan-alert-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
    animation: fadeIn 0.2s ease-out;
  `;
  
  // Create alert box
  const alertBox = document.createElement('div');
  alertBox.style.cssText = `
    background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
    border: 3px solid #16a34a;
    border-radius: 16px;
    padding: 2rem;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 20px 60px rgba(22, 163, 74, 0.4);
    animation: slideUp 0.3s ease-out;
  `;
  
  alertBox.innerHTML = `
    <div style="text-align: center;">
      <div style="font-size: 4rem; margin-bottom: 1rem;">✅</div>
      <h2 style="color: #065f46; font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem;">
        RFID Tag Scanned Successfully!
      </h2>
      <div style="background: #ffffff; border: 2px solid #16a34a; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
        <div style="font-size: 0.9rem; color: #6b7280; margin-bottom: 0.5rem;">RFID Tag ID:</div>
        <div style="font-family: 'Courier New', monospace; font-size: 1.5rem; font-weight: 700; color: #047857; letter-spacing: 0.1em;">
          ${rfidTagId}
        </div>
      </div>
      <div style="color: #059669; font-size: 0.95rem; margin-bottom: 1.5rem;">
        The RFID Tag ID has been automatically filled in the form.
      </div>
      <button id="rfid-alert-ok-btn" style="
        background: linear-gradient(135deg, #16a34a 0%, #059669 100%);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 0.75rem 2rem;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3);
        transition: all 0.2s;
      ">
        OK
      </button>
    </div>
  `;
  
  // Add animations if not exists
  if (!document.getElementById('rfid-alert-animations')) {
    const style = document.createElement('style');
    style.id = 'rfid-alert-animations';
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
  
  overlay.appendChild(alertBox);
  document.body.appendChild(overlay);
  
  // Handle OK button click
  const okBtn = alertBox.querySelector('#rfid-alert-ok-btn');
  okBtn.addEventListener('click', () => {
    overlay.style.transition = 'opacity 0.2s';
    overlay.style.opacity = '0';
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.remove();
      }
    }, 200);
  });
  
  // Close on overlay click (outside alert box)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.style.transition = 'opacity 0.2s';
      overlay.style.opacity = '0';
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.remove();
        }
      }, 200);
    }
  });
  
  // Auto-close after 5 seconds
  setTimeout(() => {
    if (overlay.parentNode) {
      overlay.style.transition = 'opacity 0.2s';
      overlay.style.opacity = '0';
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.remove();
        }
      }, 200);
    }
  }, 5000);
  
  // Hover effect for button
  okBtn.addEventListener('mouseenter', () => {
    okBtn.style.transform = 'translateY(-2px)';
    okBtn.style.boxShadow = '0 6px 16px rgba(22, 163, 74, 0.4)';
  });
  okBtn.addEventListener('mouseleave', () => {
    okBtn.style.transform = 'translateY(0)';
    okBtn.style.boxShadow = '0 4px 12px rgba(22, 163, 74, 0.3)';
  });
}

// Track initialized scanners to prevent double initialization
const initializedScanners = new Set();

// Initialize RFID scanner for a form
export function initRfidScanner(scanButtonId, inputFieldId, statusElementId) {
  const scanBtn = document.getElementById(scanButtonId);
  const inputField = document.getElementById(inputFieldId);
  const statusElement = document.getElementById(statusElementId);
  
  if (!scanBtn || !inputField) {
    console.warn(`RFID scanner elements not found: ${scanButtonId}, ${inputFieldId}`);
    return;
  }
  
  // Prevent double initialization
  const scannerKey = `${scanButtonId}-${inputFieldId}`;
  if (initializedScanners.has(scannerKey)) {
    console.log(`RFID scanner already initialized: ${scannerKey}`);
    return;
  }
  initializedScanners.add(scannerKey);
  
  // Create scan result display element - store reference globally for callback access
  const scanResultDisplayId = statusElementId + '-scan-result';
  let scanResultDisplay = document.getElementById(scanResultDisplayId);
  
  if (!scanResultDisplay && statusElement) {
    scanResultDisplay = document.createElement('div');
    scanResultDisplay.id = scanResultDisplayId;
    scanResultDisplay.style.cssText = 'margin-top: 0.75rem; padding: 1rem; background: #d1fae5; border: 2px solid #16a34a; border-radius: 8px; display: none;';
    // Insert after the status element
    if (statusElement.nextSibling) {
      statusElement.parentNode.insertBefore(scanResultDisplay, statusElement.nextSibling);
    } else {
      statusElement.parentNode.appendChild(scanResultDisplay);
    }
  }
  
  // Set callback to update input field when RFID is scanned
  setRfidCallback((rfidTagId) => {
    console.log('🎯 RFID Tag scanned callback triggered:', rfidTagId);
    console.log('📝 Input field element:', inputField);
    console.log('📝 Input field ID:', inputFieldId);
    
    // Verify input field exists
    if (!inputField) {
      console.error('❌ Input field not found!', inputFieldId);
      return;
    }
    
    // Update input field immediately
    inputField.value = rfidTagId;
    console.log('✅ Input field value set to:', inputField.value);
    
    inputField.style.borderColor = '#16a34a';
    inputField.style.borderWidth = '2px';
    inputField.style.background = '#f0fdf4';
    inputField.style.fontWeight = '600';
    
    // Trigger input event to notify form
    inputField.dispatchEvent(new Event('input', { bubbles: true }));
    inputField.dispatchEvent(new Event('change', { bubbles: true }));
    inputField.dispatchEvent(new Event('blur', { bubbles: true }));
    
    console.log('✅ Events dispatched');
    
    // Show alert notification (especially for edit form)
    if (inputFieldId.includes('edit-rfidTagId')) {
      // Custom styled alert for edit form
      console.log('📢 Showing scan alert for edit form');
      showScanAlert(rfidTagId);
    } else {
      // Simple alert for add form
      console.log('📢 Showing alert for add form');
      alert(`✅ RFID Tag Scanned Successfully!\n\nTag ID: ${rfidTagId}\n\nThe RFID Tag ID has been automatically filled in the form.`);
    }
    
    // Get or create scan result display (in case it wasn't created yet)
    let displayElement = document.getElementById(scanResultDisplayId);
    if (!displayElement && statusElement) {
      displayElement = document.createElement('div');
      displayElement.id = scanResultDisplayId;
      displayElement.style.cssText = 'margin-top: 0.75rem; padding: 1rem; background: #d1fae5; border: 2px solid #16a34a; border-radius: 8px;';
      if (statusElement.nextSibling) {
        statusElement.parentNode.insertBefore(displayElement, statusElement.nextSibling);
      } else {
        statusElement.parentNode.appendChild(displayElement);
      }
    }
    
    // Show prominent scan result display
    if (displayElement) {
      displayElement.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div style="font-size: 1.5rem;">✅</div>
          <div style="flex: 1;">
            <div style="font-weight: 600; color: #065f46; font-size: 0.9rem; margin-bottom: 0.25rem;">RFID Tag Scanned Successfully!</div>
            <div style="font-family: 'Courier New', monospace; font-size: 1.1rem; font-weight: 700; color: #047857; letter-spacing: 0.05em; background: #ffffff; padding: 0.5rem; border-radius: 4px;">${rfidTagId}</div>
          </div>
        </div>
      `;
      displayElement.style.display = 'block';
      displayElement.style.opacity = '1';
      displayElement.style.animation = 'pulse 0.5s ease-in-out';
      
      // Scroll into view if needed
      displayElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    // Reset input field styling after 3 seconds (keep it longer)
    setTimeout(() => {
      inputField.style.borderColor = '';
      inputField.style.borderWidth = '';
      inputField.style.background = '';
      inputField.style.fontWeight = '';
    }, 3000);
    
    // Keep display visible for 8 seconds, then fade
    if (displayElement) {
      setTimeout(() => {
        displayElement.style.transition = 'opacity 0.5s';
        displayElement.style.opacity = '0.7';
      }, 5000);
    }
    
    // Update status element
    if (statusElement) {
      statusElement.textContent = `✓ Scanned: ${rfidTagId} - Ready for next scan`;
      statusElement.style.color = '#16a34a';
      statusElement.style.fontWeight = '600';
    }
  });
  
  // Update button text based on connection state
  function updateButtonState() {
    if (isConnected) {
      scanBtn.textContent = '🔌 Disconnect';
      scanBtn.style.background = '#dc2626';
    } else {
      scanBtn.textContent = '📡 Scan RFID';
      scanBtn.style.background = '';
    }
  }
  
  // Handle scan button click
  scanBtn.addEventListener('click', async () => {
    if (!isConnected) {
      // Check if Web Serial API is available
      if (!navigator.serial) {
        alert('Web Serial API is not supported in this browser.\n\nPlease use Chrome, Edge, or Opera browser to connect Arduino.\n\nAlternatively, you can manually type the RFID Tag ID in the field above.');
        return;
      }
      
      try {
        const connected = await connectToArduino(statusElement);
        if (connected) {
          updateButtonState();
          if (statusElement) {
            statusElement.textContent = '✓ Connected - Scan an RFID tag now';
            statusElement.style.color = '#16a34a';
          }
        } else {
          // Only show error if it wasn't a user cancellation
          // The connectToArduino function already updates statusElement
          updateButtonState();
        }
      } catch (error) {
        console.error('Unexpected error:', error);
        if (statusElement) {
          statusElement.textContent = `Error: ${error.message}`;
          statusElement.style.color = '#dc2626';
        }
        updateButtonState();
      }
    } else {
      await disconnectFromArduino(statusElement);
      updateButtonState();
    }
  });
  
  // Initial button state
  updateButtonState();
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', async () => {
    if (isConnected) {
      await disconnectFromArduino(statusElement);
    }
  });
}


const addMenu = document.getElementById('add-asset-menu-table');
const addBtn = document.getElementById('add-asset-btn-table');
const fileInput = document.getElementById('asset-file-input');
const addForm = document.getElementById('add-asset-form');
const assetTableBody = document.getElementById('asset-table-body');

// Filter elements
const searchInput = document.getElementById('asset-search');
const searchBtn = document.getElementById('asset-search-btn');

// Pagination elements
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const pageInfo = document.getElementById('page-info');

// Pagination state
let allAssets = [];
let currentPage = 1;
const itemsPerPage = 10; // Number of items per page

// Load and display assets in the table (optionally filtered by query)
async function loadAssets(query = '') {
  try {
    const params = query ? `?query=${encodeURIComponent(query)}` : '';
    const resp = await fetch(`./list_assets.php${params}`);
    if (!resp.ok) {
      console.error('Failed to load assets');
      return;
    }
    const data = await resp.json();
    if (data.ok && data.assets) {
      allAssets = data.assets;
      currentPage = 1; // Reset to first page when loading new data
      displayAssets();
    }
  } catch (error) {
    console.error('Error loading assets:', error);
  }
}

// Display assets in the table (with pagination)
function displayAssets() {
  assetTableBody.innerHTML = '';
  
  if (allAssets.length === 0) {
    assetTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #888;">No assets found</td></tr>';
    updatePaginationControls();
    return;
  }
  
  // Calculate pagination
  const totalPages = Math.ceil(allAssets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, allAssets.length);
  const pageAssets = allAssets.slice(startIndex, endIndex);
  
  // Display assets for current page
  pageAssets.forEach(asset => {
    const row = document.createElement('tr');
    const assetId = asset.assetId || '';
    row.innerHTML = `
      <td>${assetId || '-'}</td>
      <td>${asset.assetDescription || '-'}</td>
      <td>${asset.assetCategory || '-'}</td>
      <td>${asset.model || '-'}</td>
      <td>${asset.serialNo || '-'}</td>
      <td>${asset.location || '-'}</td>
      <td>${asset.area || '-'}</td>
      <td><a href="assetdetails.html?assetId=${encodeURIComponent(assetId)}" class="action-link">View</a></td>
    `;
    assetTableBody.appendChild(row);
  });
  
  // Update pagination controls
  updatePaginationControls();
}

// Update pagination controls (buttons and info)
function updatePaginationControls() {
  const totalPages = Math.ceil(allAssets.length / itemsPerPage);
  
  // Update page info
  if (allAssets.length === 0) {
    pageInfo.textContent = 'page 0 of 0';
  } else {
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, allAssets.length);
    pageInfo.textContent = `page ${currentPage} of ${totalPages} (${startIndex}-${endIndex})`;
  }
  
  // Enable/disable navigation buttons
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage >= totalPages || totalPages === 0;
}

// Pagination event listeners
if (prevPageBtn) {
  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      displayAssets();
      // Scroll to top of table
      assetTableBody.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

if (nextPageBtn) {
  nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(allAssets.length / itemsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      displayAssets();
      // Scroll to top of table
      assetTableBody.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

// Search listeners
if (searchBtn) {
  searchBtn.addEventListener('click', () => {
    const q = searchInput?.value || '';
    loadAssets(q);
  });
}
if (searchInput) {
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = searchInput.value || '';
      loadAssets(q);
    }
  });
}

// View asset details function (kept for compatibility, but using direct links now)
function viewAsset(assetId) {
  if (!assetId) {
    console.error('Asset ID is required');
    return;
  }
  // Navigate to asset details page with assetId as URL parameter
  window.location.href = `assetdetails.html?assetId=${encodeURIComponent(assetId)}`;
}

// Load assets when page loads
loadAssets();

// Modal elements
const addModalOverlay = document.getElementById('add-modal-overlay');
const closeAddModalBtn = document.getElementById('close-add-modal-btn');
const cancelAddBtn = document.getElementById('cancel-add-btn');
const toggleCustomLocationBtn = document.getElementById('toggle-custom-location');
const customLocationInput = document.getElementById('add-locationDescription-custom');
const locationDescriptionSelect = document.getElementById('add-locationDescription');

// Function to close the add modal
function closeAddModal() {
  addModalOverlay.classList.remove('open');
  addForm.reset();
}

// Close modal when clicking X button
closeAddModalBtn.addEventListener('click', closeAddModal);

// Close modal when clicking Cancel button
cancelAddBtn.addEventListener('click', closeAddModal);

// Close modal when clicking outside (on overlay)
addModalOverlay.addEventListener('click', (e) => {
  if (e.target === addModalOverlay) {
    closeAddModal();
  }
});

// Toggle custom location input
toggleCustomLocationBtn.addEventListener('click', () => {
  const isHidden = customLocationInput.style.display === 'none';
  if (isHidden) {
    customLocationInput.style.display = 'block';
    locationDescriptionSelect.style.display = 'none';
    toggleCustomLocationBtn.textContent = 'Use dropdown location';
  } else {
    customLocationInput.style.display = 'none';
    locationDescriptionSelect.style.display = 'block';
    toggleCustomLocationBtn.textContent = '+ Add custom location';
    customLocationInput.value = '';
  }
});

addBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  addMenu.classList.toggle('open');
});

// Close menu when clicking outside
document.addEventListener('click', (e) => {
  if (!addBtn.contains(e.target) && !addMenu.contains(e.target)) {
    addMenu.classList.remove('open');
  }
});

// Load existing locations for dropdown
async function loadLocations() {
  try {
    const resp = await fetch('./get_locations.php');
    if (!resp.ok) {
      console.warn('Failed to load locations');
      return [];
    }
    const data = await resp.json();
    if (data.ok && data.locations) {
      return data.locations;
    }
    return [];
  } catch (error) {
    console.error('Error loading locations:', error);
    return [];
  }
}

// Populate location dropdown with existing locations
function populateLocationDropdown(locations) {
  // Clear existing options except the first "Select location..." option
  locationDescriptionSelect.innerHTML = '<option value="">Select location...</option>';
  
  // Add each location as an option
  locations.forEach(location => {
    const option = document.createElement('option');
    option.value = location;
    option.textContent = location;
    locationDescriptionSelect.appendChild(option);
  });
}

addMenu.addEventListener('click', async (e) => {
  if (e.target.dataset.action === 'manual') {
    addModalOverlay.classList.add('open');
    addMenu.classList.remove('open'); // Close menu when opening modal
    // Reset custom location toggle when opening modal
    customLocationInput.style.display = 'none';
    locationDescriptionSelect.style.display = 'block';
    toggleCustomLocationBtn.textContent = '+ Add custom location';
    
    // Load and populate existing locations
    const locations = await loadLocations();
    populateLocationDropdown(locations);
    
    // Initialize RFID scanner when modal opens
    if (window.initAddAssetRfidScanner) {
      setTimeout(() => {
        window.initAddAssetRfidScanner();
      }, 100);
    }
  }
  if (e.target.dataset.action === 'upload') {
    // Set accept attribute to include Excel and CSV files
    fileInput.setAttribute('accept', '.csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv');
    fileInput.click();
    // Note: Menu will close after file upload completes (handled in fileInput change event)
  }
});

addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = Object.fromEntries(new FormData(addForm).entries());
  
  // Use custom location if it's visible and has a value
  if (customLocationInput.style.display !== 'none' && customLocationInput.value.trim()) {
    formData.locationDescription = customLocationInput.value.trim();
  }
  
  // Ensure RFID Tag ID is included (in case it was set programmatically)
  const rfidTagIdField = document.getElementById('add-rfidTagId');
  if (rfidTagIdField && rfidTagIdField.value.trim()) {
    formData.rfidTagId = rfidTagIdField.value.trim();
  }
  
  // Debug: Log form data to console
  console.log('Submitting form data:', formData);
  
  try {
    const resp = await fetch('./add_asset.php', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(formData)
    });
    
    const data = await resp.json();
    
    if (!resp.ok || !data.ok) {
      console.error('Add asset error:', data);
      if (resp.status === 409 || data.error === 'Data already exists') {
        return alert(`Data already exists!\n\n${data.message || 'An asset with this Asset ID already exists in the database.'}`);
      }
      return alert(`Save failed: ${data.error || 'Unknown error. Please check console for details.'}`);
    }
    
  alert('Asset added successfully!');
  addForm.reset();
  closeAddModal();
  loadAssets(); // Refresh table data
  
  // Reload locations after adding (in case a new location was added)
  const locations = await loadLocations();
  populateLocationDropdown(locations);
  } catch (error) {
    console.error('Error adding asset:', error);
    alert(`Save failed: ${error.message || 'Network error. Please try again.'}`);
  }
});

fileInput.addEventListener('change', async () => {
  if (!fileInput.files.length) return;
  const fd = new FormData();
  fd.append('file', fileInput.files[0]);
  
  try {
    const resp = await fetch('./upload_assets.php', { method: 'POST', body: fd });
    const data = await resp.json();
    
    if (!resp.ok || !data.ok) {
      console.error('Upload error:', data);
      fileInput.value = '';
      addMenu.classList.remove('open'); // Close menu even on error
      return alert(`Upload failed: ${data.error || 'Unknown error'}`);
    }
    
    if (data.inserted > 0) {
      let message = `Successfully uploaded ${data.inserted} asset(s)!`;
      if (data.duplicates && data.duplicates.length > 0) {
        message += `\n\n${data.duplicates.length} duplicate(s) skipped:\n${data.duplicates.slice(0, 5).join(', ')}${data.duplicates.length > 5 ? '...' : ''}`;
      }
      alert(message);
      loadAssets(); // Refresh table data
    } else {
      let message = `No assets were inserted.`;
      if (data.duplicates && data.duplicates.length > 0) {
        message += `\n\n${data.duplicates.length} duplicate(s) found and skipped:\n${data.duplicates.slice(0, 5).join(', ')}${data.duplicates.length > 5 ? '...' : ''}`;
      } else {
        message += `\n\n${data.message || 'Please check that your file has valid data with assetId column.'}`;
      }
      alert(message);
    }
    
    fileInput.value = '';
    addMenu.classList.remove('open'); // Close the dropdown menu after upload
  } catch (error) {
    console.error('Upload error:', error);
    fileInput.value = '';
    addMenu.classList.remove('open'); // Close menu on error
    alert(`Upload failed: ${error.message || 'Network error. Please try again.'}`);
  }
});

// Info modal elements
const infoIconBtn = document.getElementById('info-icon-btn');
const infoModalOverlay = document.getElementById('info-modal-overlay');
const closeInfoModalBtn = document.getElementById('close-info-modal-btn');
const okInfoModalBtn = document.getElementById('ok-info-modal-btn');

// Function to open info modal
function openInfoModal() {
  if (infoModalOverlay) {
    infoModalOverlay.classList.add('open');
  }
}

// Function to close info modal
function closeInfoModal() {
  if (infoModalOverlay) {
    infoModalOverlay.classList.remove('open');
  }
}

// Info icon click handler
if (infoIconBtn) {
  infoIconBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openInfoModal();
  });
}

// Close modal when clicking X button
if (closeInfoModalBtn) {
  closeInfoModalBtn.addEventListener('click', closeInfoModal);
}

// Close modal when clicking OK button
if (okInfoModalBtn) {
  okInfoModalBtn.addEventListener('click', closeInfoModal);
}

// Close modal when clicking outside (on overlay)
if (infoModalOverlay) {
  infoModalOverlay.addEventListener('click', (e) => {
    if (e.target === infoModalOverlay) {
      closeInfoModal();
    }
  });
}
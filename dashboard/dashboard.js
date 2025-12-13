// Dashboard JavaScript for loading real data from database

// Load dashboard statistics
async function loadDashboardStats() {
  try {
    console.log('Loading dashboard statistics...');
    
    // Load assets count
    const assetsResp = await fetch('../admin/asset/list_assets.php');
    if (!assetsResp.ok) {
      throw new Error(`Assets API returned ${assetsResp.status}`);
    }
    const assetsData = await assetsResp.json();
    console.log('Assets data:', assetsData);
    
    // Load maintenance count
    const maintenanceResp = await fetch('../admin/maintenance/list_maintenance.php');
    if (!maintenanceResp.ok) {
      throw new Error(`Maintenance API returned ${maintenanceResp.status}`);
    }
    const maintenanceData = await maintenanceResp.json();
    console.log('Maintenance data:', maintenanceData);
    
    // Update total assets - use real data only
    const totalAssetsEl = document.getElementById('total-assets-stat');
    if (totalAssetsEl) {
      if (assetsData.ok && assetsData.assets) {
        const totalAssets = assetsData.assets.length;
        totalAssetsEl.textContent = totalAssets;
      } else {
        totalAssetsEl.textContent = '0';
        console.warn('Assets data not available:', assetsData.error || 'Unknown error');
      }
    }
    
    // Update maintenance items count - use real data only
    const totalMaintenanceEl = document.getElementById('total-maintenance-stat');
    if (totalMaintenanceEl) {
      if (maintenanceData.ok && maintenanceData.maintenance) {
        const totalMaintenance = maintenanceData.maintenance.length;
        totalMaintenanceEl.textContent = totalMaintenance;
      } else {
        totalMaintenanceEl.textContent = '0';
        console.warn('Maintenance data not available:', maintenanceData.error || 'Unknown error');
      }
    }
    
    // Load recent assets for the table - use real data only
    const tbody = document.getElementById('assets-table-body');
    if (assetsData.ok && assetsData.assets && assetsData.assets.length > 0) {
      // Sort by assetId descending to show newest first, then take first 10
      const sortedAssets = [...assetsData.assets].sort((a, b) => {
        return (b.assetId || '').localeCompare(a.assetId || '');
      });
      displayRecentAssets(sortedAssets.slice(0, 10));
    } else {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #888;">No assets found in database</td></tr>';
      }
    }
  } catch (error) {
    console.error('Error loading dashboard stats:', error);
    const totalAssetsEl = document.getElementById('total-assets-stat');
    const totalMaintenanceEl = document.getElementById('total-maintenance-stat');
    const tbody = document.getElementById('assets-table-body');
    
    if (totalAssetsEl) totalAssetsEl.textContent = '0';
    if (totalMaintenanceEl) totalMaintenanceEl.textContent = '0';
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #dc2626;">Error loading data: ${error.message}</td></tr>`;
    }
  }
}

// Display recent assets in the table (real data only)
function displayRecentAssets(assets) {
  const tbody = document.getElementById('assets-table-body');
  if (!tbody) {
    console.error('Assets table body not found');
    return;
  }
  
  if (!assets || assets.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #888;">No assets found in database</td></tr>';
    return;
  }
  
  // Map real asset data to table rows
  tbody.innerHTML = assets.map(asset => {
    // Use real data from database, fallback to '-' if field is null/undefined
    const assetId = asset.assetId || '-';
    const description = asset.assetDescription || '-';
    const category = asset.assetCategoryDescription || asset.assetCategory || '-';
    const model = asset.model || '-';
    const serialNumber = asset.serialNo || asset.serialNumber || '-';
    const location = asset.locationDescription || asset.location || '-';
    const area = asset.area || asset.locationArea || '-';
    
    // Only create link if we have a valid assetId
    const viewLink = assetId !== '-' 
      ? `<a class="action-link" href="../admin/asset/assetdetails.html?assetId=${encodeURIComponent(assetId)}">View more</a>`
      : '<span style="color: #999;">-</span>';
    
    return `
      <tr>
        <td>${escapeHtml(assetId)}</td>
        <td>${escapeHtml(description)}</td>
        <td>${escapeHtml(category)}</td>
        <td>${escapeHtml(model)}</td>
        <td>${escapeHtml(serialNumber)}</td>
        <td>${escapeHtml(location)}</td>
        <td>${escapeHtml(area)}</td>
        <td>${viewLink}</td>
      </tr>
    `;
  }).join('');
}

// Helper function to escape HTML (prevent XSS)
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize dashboard
function init() {
  loadDashboardStats();
}

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

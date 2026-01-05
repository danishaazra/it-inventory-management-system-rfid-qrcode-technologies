// Dashboard JavaScript for loading real data from database

// Load dashboard statistics
async function loadDashboardStats() {
  try {
    console.log('Loading dashboard statistics...');
    
    // Load assets count
    const assetsResp = await fetch('/api/assets/list');
    if (!assetsResp.ok) {
      throw new Error(`Assets API returned ${assetsResp.status}`);
    }
    const assetsData = await assetsResp.json();
    console.log('Assets data:', assetsData);
    
    // Load maintenance count
    const maintenanceResp = await fetch('/api/maintenance/list');
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

// Load saved reports
async function loadSavedReports() {
  try {
    const response = await fetch('/api/reports/saved');
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Failed to load saved reports');
    }

    displaySavedReports(data.reports || []);
  } catch (error) {
    console.error('Error loading saved reports:', error);
    const reportsList = document.getElementById('saved-reports-list');
    if (reportsList) {
      reportsList.innerHTML = '<div class="no-saved-reports">Error loading saved reports</div>';
    }
  }
}

// Display saved reports
function displaySavedReports(reports) {
  const reportsList = document.getElementById('saved-reports-list');
  if (!reportsList) return;

  // Show only the 6 most recent reports
  const recentReports = reports.slice(0, 6);

  if (recentReports.length === 0) {
    reportsList.innerHTML = '<div class="no-saved-reports">No saved reports yet. <a href="../admin/report/report.html" style="color: #140958; font-weight: 600;">Generate a report</a> to get started.</div>';
    return;
  }

  reportsList.innerHTML = recentReports.map(report => {
    const date = report.createdAt ? new Date(report.createdAt).toLocaleString() : 'Unknown date';
    const typeLabels = {
      'asset': 'Asset Report',
      'maintenance': 'Maintenance Report',
      'inspection': 'Inspection Report',
      'checklist': 'Checklist Report'
    };
    const typeLabel = typeLabels[report.reportType] || report.reportType;

    return `
      <div class="saved-report-card">
        <div class="saved-report-header">
          <div>
            <div class="saved-report-title">${escapeHtml(report.reportName || report.reportTitle || 'Untitled Report')}</div>
            <span class="saved-report-type">${escapeHtml(typeLabel)}</span>
          </div>
        </div>
        <div class="saved-report-date">Created: ${date}</div>
        <div class="saved-report-actions">
          <a href="../admin/report/report.html?loadReport=${encodeURIComponent(report._id)}" class="btn-load">Load</a>
          <button class="btn-delete" onclick="deleteSavedReport('${report._id}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

// Delete a saved report
async function deleteSavedReport(reportId) {
  if (!confirm('Are you sure you want to delete this saved report?')) {
    return;
  }

  try {
    const response = await fetch('/api/reports/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reportId: reportId })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Failed to delete report');
    }

    alert('Report deleted successfully!');
    await loadSavedReports();
  } catch (error) {
    console.error('Error deleting report:', error);
    alert(`Failed to delete report: ${error.message}`);
  }
}

// Make deleteSavedReport available globally
window.deleteSavedReport = deleteSavedReport;

// Load maintenance assignments
async function loadMaintenanceAssignments() {
  try {
    const response = await fetch('/api/maintenance/list');
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Failed to load maintenance assignments');
    }

    displayMaintenanceAssignments(data.maintenance || []);
  } catch (error) {
    console.error('Error loading maintenance assignments:', error);
    const tbody = document.getElementById('maintenance-assignments-body');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #dc2626;">Error loading maintenance assignments</td></tr>';
    }
  }
}

// Display maintenance assignments
function displayMaintenanceAssignments(maintenanceItems) {
  const tbody = document.getElementById('maintenance-assignments-body');
  if (!tbody) return;

  // Filter to show only items with assigned staff, limit to 10 most recent
  const assignedItems = maintenanceItems
    .filter(item => item.assignedStaffName && item.assignedStaffEmail)
    .slice(0, 10);

  if (assignedItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #888;">No maintenance items with assigned staff found</td></tr>';
    return;
  }

  tbody.innerHTML = assignedItems.map(item => {
    const itemName = item.itemName || '-';
    const location = item.location || '-';
    const branch = item.branch || '-';
    const frequency = item.frequency || '-';
    const staffName = item.assignedStaffName || '-';
    const staffEmail = item.assignedStaffEmail || '-';
    const maintenanceId = item._id;
    const totalInspections = item.totalInspections || 0;
    const completedInspections = item.completedInspections || 0;
    const openInspections = item.openInspections || 0;
    
    // Format inspection status
    let inspectionStatus = '';
    if (totalInspections === 0) {
      inspectionStatus = '<span style="color: #6b7280;">No inspections</span>';
    } else {
      inspectionStatus = `<span style="color: #059669; font-weight: 600;">${completedInspections}/${totalInspections} completed</span>`;
      if (openInspections > 0) {
        inspectionStatus += ` <span style="color: #dc2626; font-weight: 600;">(${openInspections} open)</span>`;
      }
    }

    const viewLink = maintenanceId 
      ? `<a class="action-link" href="../admin/maintenance/maintenancetask.html?maintenanceId=${encodeURIComponent(maintenanceId)}">View Details</a>`
      : '<span style="color: #999;">-</span>';

    return `
      <tr>
        <td>${escapeHtml(itemName)}</td>
        <td>${escapeHtml(location)}</td>
        <td>${escapeHtml(branch)}</td>
        <td>${escapeHtml(frequency)}</td>
        <td>${escapeHtml(staffName)}</td>
        <td>${escapeHtml(staffEmail)}</td>
        <td>${inspectionStatus}</td>
        <td>${viewLink}</td>
      </tr>
    `;
  }).join('');
}

// Initialize dashboard
function init() {
  loadDashboardStats();
  loadSavedReports();
  loadMaintenanceAssignments();
}

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

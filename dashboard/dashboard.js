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
    
    // Removed: Pending Maintenance Inspection section
  } catch (error) {
    console.error('Error loading dashboard stats:', error);
    const totalAssetsEl = document.getElementById('total-assets-stat');
    
    if (totalAssetsEl) totalAssetsEl.textContent = '0';
  }
}

// Removed: loadTodayInspections function - Today's Maintenance Inspections section removed

// Removed: updateBarChart function - Chart functionality removed

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

// Helper function to extract scheduled dates from maintenance schedule
// Simplified version that directly parses date strings (matching staff dashboard)
function extractScheduleDates(schedule, frequency) {
  const dates = [];
  if (!schedule || typeof schedule !== 'object') {
    return dates;
  }
  
  if (!frequency) {
    return dates;
  }
  
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  
  if (frequency === 'Weekly') {
    months.forEach(month => {
      if (schedule[month] && typeof schedule[month] === 'object') {
        Object.values(schedule[month]).forEach(dateStr => {
          if (dateStr) {
            // Handle both date string formats and date objects
            let date;
            if (typeof dateStr === 'string') {
              // Remove time portion if present
              const normalizedDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
              date = new Date(normalizedDateStr);
            } else if (dateStr && typeof dateStr === 'object' && dateStr.date) {
              // Handle object format: { date: "2025-01-15" }
              const normalizedDateStr = dateStr.date.includes('T') ? dateStr.date.split('T')[0] : dateStr.date;
              date = new Date(normalizedDateStr);
            } else {
              return; // Skip invalid formats
            }
            
            if (!isNaN(date.getTime())) {
              date.setHours(0, 0, 0, 0);
              dates.push(date);
            }
          }
        });
      }
    });
  } else if (frequency === 'Monthly') {
    months.forEach(month => {
      if (schedule[month]) {
        let date;
        if (typeof schedule[month] === 'string') {
          const normalizedDateStr = schedule[month].includes('T') ? schedule[month].split('T')[0] : schedule[month];
          date = new Date(normalizedDateStr);
        } else if (schedule[month] && typeof schedule[month] === 'object' && schedule[month].date) {
          const normalizedDateStr = schedule[month].date.includes('T') ? schedule[month].date.split('T')[0] : schedule[month].date;
          date = new Date(normalizedDateStr);
        } else {
          return; // Skip invalid formats
        }
        
        if (!isNaN(date.getTime())) {
          date.setHours(0, 0, 0, 0);
          dates.push(date);
        }
      }
    });
  } else if (frequency === 'Quarterly') {
    const quarters = ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)'];
    quarters.forEach(quarter => {
      if (schedule[quarter]) {
        let date;
        if (typeof schedule[quarter] === 'string') {
          const normalizedDateStr = schedule[quarter].includes('T') ? schedule[quarter].split('T')[0] : schedule[quarter];
          date = new Date(normalizedDateStr);
        } else if (schedule[quarter] && typeof schedule[quarter] === 'object' && schedule[quarter].date) {
          const normalizedDateStr = schedule[quarter].date.includes('T') ? schedule[quarter].date.split('T')[0] : schedule[quarter].date;
          date = new Date(normalizedDateStr);
        } else {
          return; // Skip invalid formats
        }
        
        if (!isNaN(date.getTime())) {
          date.setHours(0, 0, 0, 0);
          dates.push(date);
        }
      }
    });
  }
  
  // Sort dates chronologically
  dates.sort((a, b) => a - b);
  return dates;
}

// Helper function to format date as YYYY-MM-DD for comparison (same as checklist)
function formatDateKey(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    console.warn('Invalid date passed to formatDateKey:', date);
    return '';
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper function to escape HTML (prevent XSS)
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Update welcome username when user name is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Wait for init.js to set the user-name, then update welcome username
  const updateWelcomeUsername = () => {
    const userNameEl = document.getElementById('user-name');
    const welcomeUsernameEl = document.getElementById('welcome-username');
    if (userNameEl && welcomeUsernameEl && userNameEl.textContent !== 'Loading...') {
      welcomeUsernameEl.textContent = userNameEl.textContent;
    }
  };
  
  // Try immediately
  updateWelcomeUsername();
  
  // Also try after a short delay in case init.js hasn't run yet
  setTimeout(updateWelcomeUsername, 100);
  
  // Watch for changes to user-name element
  const userNameEl = document.getElementById('user-name');
  if (userNameEl) {
    const observer = new MutationObserver(updateWelcomeUsername);
    observer.observe(userNameEl, { childList: true, characterData: true, subtree: true });
  }
});

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


// Initialize dashboard
function init() {
  loadDashboardStats();
  loadSavedReports();
}

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

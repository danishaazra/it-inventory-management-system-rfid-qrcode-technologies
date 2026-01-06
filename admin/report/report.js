// Report Type Selection
let selectedReportType = null;
let currentReportData = null;
let reportOptions = { locations: [], branches: [], staff: [] };

const reportTypes = document.querySelectorAll('.report-type-card');
const criteriaForm = document.getElementById('criteria-form');
const criteriaFields = document.getElementById('criteria-fields');
const criteriaTitle = document.getElementById('criteria-title');
const reportResults = document.getElementById('report-results');
const reportTable = document.getElementById('report-table');
const reportTableHead = document.getElementById('report-table-head');
const reportTableBody = document.getElementById('report-table-body');
const reportTitle = document.getElementById('report-title');
const loadingMessage = document.getElementById('loading-message');
const reportCriteriaForm = document.getElementById('report-criteria-form');
const cancelBtn = document.getElementById('cancel-btn');
const generateBtn = document.getElementById('generate-btn');
const exportPdfBtn = document.getElementById('export-pdf-btn');
const exportCsvBtn = document.getElementById('export-csv-btn');
const saveReportBtn = document.getElementById('save-report-btn');
const savedReportsList = document.getElementById('saved-reports-list');

// Report type configurations
const reportConfigs = {
  asset: {
    title: 'Asset Report',
    fields: [
      { name: 'dateFrom', label: 'Date From', type: 'date' },
      { name: 'dateTo', label: 'Date To', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', options: ['', 'Active', 'Inactive', 'Maintenance', 'Retired'] },
      { name: 'category', label: 'Category', type: 'select', options: ['', 'IT Equipment', 'Furniture', 'Vehicle', 'Other'] },
      { name: 'location', label: 'Location', type: 'select', dynamic: 'locations' },
      { name: 'branch', label: 'Branch', type: 'select', dynamic: 'branches' }
    ]
  },
  maintenance: {
    title: 'Maintenance Report',
    fields: [
      { name: 'dateFrom', label: 'Date From', type: 'date' },
      { name: 'dateTo', label: 'Date To', type: 'date' },
      { name: 'frequency', label: 'Frequency', type: 'select', options: ['', 'Weekly', 'Monthly', 'Quarterly'] },
      { name: 'branch', label: 'Branch', type: 'select', dynamic: 'branches' },
      { name: 'location', label: 'Location', type: 'select', dynamic: 'locations' },
      { name: 'assignedStaff', label: 'Assigned Staff', type: 'select', dynamic: 'staff' }
    ]
  },
  inspection: {
    title: 'Inspection Report',
    fields: [
      { name: 'dateFrom', label: 'Date From', type: 'date' },
      { name: 'dateTo', label: 'Date To', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', options: ['', 'Pending', 'Completed', 'Overdue'] },
      { name: 'branch', label: 'Branch', type: 'select', dynamic: 'branches' },
      { name: 'location', label: 'Location', type: 'select', dynamic: 'locations' },
      { name: 'assignedStaff', label: 'Assigned Staff', type: 'select', dynamic: 'staff' }
    ]
  },
  checklist: {
    title: 'Checklist Report',
    fields: [
      { name: 'year', label: 'Year', type: 'number', placeholder: '2025' },
      { name: 'frequency', label: 'Frequency', type: 'select', options: ['', 'Weekly', 'Monthly', 'Quarterly'] },
      { name: 'branch', label: 'Branch', type: 'select', dynamic: 'branches' },
      { name: 'location', label: 'Location', type: 'select', dynamic: 'locations' },
      { name: 'itemName', label: 'Item Name', type: 'text', placeholder: 'e.g., RF SCANNER' }
    ]
  }
};

// Load report options (locations and branches)
async function loadReportOptions() {
  try {
    const resp = await fetch('/api/reports/options');
    if (!resp.ok) {
      console.warn('Failed to load report options');
      return;
    }
    const data = await resp.json();
    if (data.ok) {
      reportOptions.locations = data.locations || [];
      reportOptions.branches = data.branches || [];
      reportOptions.staff = data.staff || [];
    }
  } catch (error) {
    console.error('Error loading report options:', error);
  }
}

// Initialize
async function init() {
  await loadReportOptions();
  setupEventListeners();
}

// Setup event listeners
function setupEventListeners() {
  // Report type selection
  reportTypes.forEach(card => {
    card.addEventListener('click', () => {
      const type = card.dataset.type;
      selectReportType(type);
    });
  });

  // Cancel button
  cancelBtn.addEventListener('click', () => {
    resetForm();
  });

  // Generate report
  reportCriteriaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await generateReport();
  });

  // Export buttons
  exportPdfBtn.addEventListener('click', () => {
    exportReport('pdf');
  });

  exportCsvBtn.addEventListener('click', () => {
    exportReport('csv');
  });

  // Save report button
  saveReportBtn.addEventListener('click', async () => {
    await saveReport();
  });
}

// Select report type
function selectReportType(type) {
  selectedReportType = type;
  
  // Update UI
  reportTypes.forEach(card => {
    card.classList.remove('selected');
    if (card.dataset.type === type) {
      card.classList.add('selected');
    }
  });

  // Show criteria form
  const config = reportConfigs[type];
  criteriaTitle.textContent = `${config.title} - Criteria`;
  renderCriteriaFields(config.fields);
  criteriaForm.classList.add('active');
  reportResults.classList.remove('active');
  
  // Scroll to form
  criteriaForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Render criteria fields
function renderCriteriaFields(fields) {
  criteriaFields.innerHTML = '';
  
  fields.forEach(field => {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'form-field';
    
    const label = document.createElement('label');
    label.textContent = field.label;
    label.setAttribute('for', field.name);
    
    let input;
    if (field.type === 'select') {
      input = document.createElement('select');
      input.id = field.name;
      input.name = field.name;
      
      // Check if field has dynamic options
      if (field.dynamic && reportOptions[field.dynamic]) {
        // Add "All" option first
        const allOption = document.createElement('option');
        allOption.value = '';
        allOption.textContent = 'All';
        input.appendChild(allOption);
        
        // Add dynamic options
        reportOptions[field.dynamic].forEach(option => {
          const optionEl = document.createElement('option');
          optionEl.value = option;
          optionEl.textContent = option;
          input.appendChild(optionEl);
        });
      } else if (field.options) {
        // Use static options
        field.options.forEach(option => {
          const optionEl = document.createElement('option');
          optionEl.value = option;
          optionEl.textContent = option || 'All';
          input.appendChild(optionEl);
        });
      }
    } else {
      input = document.createElement('input');
      input.type = field.type;
      input.id = field.name;
      input.name = field.name;
      if (field.placeholder) {
        input.placeholder = field.placeholder;
      }
    }
    
    fieldDiv.appendChild(label);
    fieldDiv.appendChild(input);
    criteriaFields.appendChild(fieldDiv);
  });
}

// Generate report
async function generateReport() {
  if (!selectedReportType) return;
  
  // Show loading
  reportResults.classList.add('active');
  reportTable.style.display = 'none';
  loadingMessage.style.display = 'block';
  reportTitle.textContent = `${reportConfigs[selectedReportType].title} Results`;
  
  // Get form data
  const formData = new FormData(reportCriteriaForm);
  const criteria = Object.fromEntries(formData.entries());
  
  try {
    // Call appropriate API endpoint
    let endpoint = '';
    switch(selectedReportType) {
      case 'asset':
        endpoint = '/api/reports/generate-asset';
        break;
      case 'maintenance':
        endpoint = '/api/reports/generate-maintenance';
        break;
      case 'inspection':
        endpoint = '/api/reports/generate-inspection';
        break;
      case 'checklist':
        endpoint = '/api/reports/generate-checklist';
        break;
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(criteria)
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Failed to generate report');
    }
    
    // Store report data
    currentReportData = data;
    
    // Display report
    displayReport(data);
    
    // Ensure save button is visible after report is displayed
    setTimeout(() => {
      if (saveReportBtn) {
        saveReportBtn.style.display = 'inline-flex';
      }
    }, 100);
    
  } catch (error) {
    console.error('Error generating report:', error);
    loadingMessage.textContent = `Error: ${error.message}`;
    alert(`Failed to generate report: ${error.message}`);
  }
}

// Display report
function displayReport(data) {
  loadingMessage.style.display = 'none';
  reportTable.style.display = 'table';
  
  // Show save report button after report is generated
  if (saveReportBtn) {
    saveReportBtn.style.display = 'inline-flex';
  }
  
  // Clear previous data
  reportTableHead.innerHTML = '';
  reportTableBody.innerHTML = '';
  
  if (!data.report || data.report.length === 0) {
    reportTableBody.innerHTML = '<tr><td colspan="100%" class="no-results">No data found matching the criteria</td></tr>';
    return;
  }
  
  // Handle checklist format differently
  if (selectedReportType === 'checklist') {
    displayChecklistReport(data.report);
  } else {
    // Get headers from first row
    const headers = Object.keys(data.report[0]);
    
    // Create header row
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
      const th = document.createElement('th');
      th.textContent = formatHeader(header);
      headerRow.appendChild(th);
    });
    reportTableHead.appendChild(headerRow);
    
    // Create data rows
    data.report.forEach(row => {
      const tr = document.createElement('tr');
      headers.forEach(header => {
        const td = document.createElement('td');
        const value = row[header];
        td.textContent = value !== null && value !== undefined ? value : '-';
        tr.appendChild(td);
      });
      reportTableBody.appendChild(tr);
    });
  }
  
  // Scroll to results
  reportResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Display checklist report
function displayChecklistReport(checklistData) {
  console.log('Displaying checklist report, data:', checklistData);
  
  if (!checklistData || !Array.isArray(checklistData) || checklistData.length === 0) {
    reportTableBody.innerHTML = '<tr><td colspan="100%" class="no-results">No checklist data available</td></tr>';
    return;
  }

  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  
  // Create header row
  const headerRow = document.createElement('tr');
  const noHeader = document.createElement('th');
  noHeader.textContent = 'NO';
  noHeader.style.width = '50px';
  headerRow.appendChild(noHeader);
  
  const taskHeader = document.createElement('th');
  taskHeader.textContent = 'INSPECTION HARDWARE';
  taskHeader.style.width = '250px';
  headerRow.appendChild(taskHeader);
  
  // Add month headers with 4 sub-columns
  months.forEach(month => {
    const monthHeader = document.createElement('th');
    monthHeader.colSpan = 4;
    monthHeader.textContent = month;
    monthHeader.style.textAlign = 'center';
    headerRow.appendChild(monthHeader);
  });
  reportTableHead.appendChild(headerRow);
  
  // Create sub-header row for periods
  const subHeaderRow = document.createElement('tr');
  subHeaderRow.appendChild(document.createElement('th')); // NO column
  subHeaderRow.appendChild(document.createElement('th')); // Task column
  for (let i = 0; i < 12; i++) {
    for (let p = 1; p <= 4; p++) {
      const periodHeader = document.createElement('th');
      periodHeader.textContent = p;
      periodHeader.style.textAlign = 'center';
      periodHeader.style.width = '40px';
      subHeaderRow.appendChild(periodHeader);
    }
  }
  reportTableHead.appendChild(subHeaderRow);
  
  // Create data rows
  let rowNum = 1;
  checklistData.forEach(item => {
    console.log('Processing checklist item:', item);
    
    // Handle inspectionTasks - can be array or string
    let tasks = [];
    if (Array.isArray(item.inspectionTasks)) {
      tasks = item.inspectionTasks;
    } else if (typeof item.inspectionTasks === 'string' && item.inspectionTasks.trim()) {
      // Split by newlines if it's a string
      tasks = item.inspectionTasks.split('\n').map(t => t.trim()).filter(t => t);
    }
    
    const schedule = item.schedule || {};
    
    if (tasks.length === 0) {
      tasks.push(item.itemName || 'No tasks defined');
    }
    
    tasks.forEach(task => {
      const tr = document.createElement('tr');
      
      // NO column
      const noCell = document.createElement('td');
      noCell.textContent = rowNum;
      noCell.style.textAlign = 'center';
      tr.appendChild(noCell);
      
      // Task column
      const taskCell = document.createElement('td');
      taskCell.textContent = task || '-';
      tr.appendChild(taskCell);
      
      // Month/period cells
      for (let month = 1; month <= 12; month++) {
        for (let period = 1; period <= 4; period++) {
          const cell = document.createElement('td');
          cell.style.textAlign = 'center';
          if (schedule[month] && schedule[month][period]) {
            const dates = schedule[month][period];
            if (Array.isArray(dates)) {
              // Dates are day numbers (e.g., "17", "14", "20"), join with commas
              cell.textContent = dates.join(', ');
            } else {
              cell.textContent = String(dates);
            }
          }
          tr.appendChild(cell);
        }
      }
      
      reportTableBody.appendChild(tr);
      rowNum++;
    });
  });
  
  console.log('Checklist report displayed, total rows:', rowNum - 1);
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Format header text
function formatHeader(header) {
  return header
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

// Export report
function exportReport(format) {
  if (!currentReportData || !selectedReportType) {
    alert('Please generate a report first');
    return;
  }
  
  const criteria = Object.fromEntries(new FormData(reportCriteriaForm).entries());
  
  // Create form for export
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = '/api/reports/export';
  form.target = '_blank';
  form.enctype = 'application/x-www-form-urlencoded';
  
  // Add report type
  const typeInput = document.createElement('input');
  typeInput.type = 'hidden';
  typeInput.name = 'reportType';
  typeInput.value = selectedReportType;
  form.appendChild(typeInput);
  
  // Add format
  const formatInput = document.createElement('input');
  formatInput.type = 'hidden';
  formatInput.name = 'format';
  formatInput.value = format;
  form.appendChild(formatInput);
  
  // Add criteria as JSON
  const criteriaInput = document.createElement('input');
  criteriaInput.type = 'hidden';
  criteriaInput.name = 'criteria';
  criteriaInput.value = JSON.stringify(criteria);
  form.appendChild(criteriaInput);
  
  // Add report data
  const dataInput = document.createElement('input');
  dataInput.type = 'hidden';
  dataInput.name = 'reportData';
  dataInput.value = JSON.stringify(currentReportData.report);
  form.appendChild(dataInput);
  
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

// Reset form
function resetForm() {
  selectedReportType = null;
  currentReportData = null;
  
  reportTypes.forEach(card => {
    card.classList.remove('selected');
  });
  
  criteriaForm.classList.remove('active');
  reportResults.classList.remove('active');
  reportCriteriaForm.reset();
  
  // Hide save report button when form is reset
  if (saveReportBtn) {
    saveReportBtn.style.display = 'none';
  }
}

// Save report
async function saveReport() {
  if (!currentReportData || !selectedReportType) {
    alert('Please generate a report first');
    return;
  }

  const criteria = Object.fromEntries(new FormData(reportCriteriaForm).entries());
  const reportTitle = prompt('Enter a name for this report:', `${reportConfigs[selectedReportType].title} - ${new Date().toLocaleDateString()}`);
  
  if (!reportTitle || !reportTitle.trim()) {
    return;
  }

  try {
    const response = await fetch('/api/reports/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reportType: selectedReportType,
        reportName: reportTitle.trim(),
        criteria: criteria,
        reportData: currentReportData.report
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Failed to save report');
    }

    alert('Report saved successfully!');
    await loadSavedReports();
  } catch (error) {
    console.error('Error saving report:', error);
    alert(`Failed to save report: ${error.message}`);
  }
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
    savedReportsList.innerHTML = '<div class="no-saved-reports">Error loading saved reports</div>';
  }
}

// Display saved reports
function displaySavedReports(reports) {
  if (reports.length === 0) {
    savedReportsList.innerHTML = '<div class="no-saved-reports">No saved reports yet</div>';
    return;
  }

  savedReportsList.innerHTML = reports.map(report => {
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
            <div class="saved-report-title">${escapeHtml(report.reportTitle)}</div>
            <span class="saved-report-type">${escapeHtml(typeLabel)}</span>
          </div>
        </div>
        <div class="saved-report-date">Created: ${date}</div>
        <div class="saved-report-actions">
          <button class="btn-load" onclick="loadSavedReport('${report._id}')">Load</button>
          <button class="btn-delete" onclick="deleteSavedReport('${report._id}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

// Load a saved report
window.loadSavedReport = async function(reportId) {
  try {
    const response = await fetch(`/api/reports/load?reportId=${encodeURIComponent(reportId)}`);
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Failed to load report');
    }

    const report = data.report;
    
    // Set the report type
    selectedReportType = report.reportType;
    
    // Update UI
    reportTypes.forEach(card => {
      card.classList.remove('selected');
      if (card.dataset.type === report.reportType) {
        card.classList.add('selected');
      }
    });

    // Show criteria form and populate it
    const config = reportConfigs[report.reportType];
    criteriaTitle.textContent = `${config.title} - Criteria`;
    renderCriteriaFields(config.fields);
    criteriaForm.classList.add('active');

    // Populate form fields with saved criteria
    Object.keys(report.criteria).forEach(key => {
      const field = document.getElementById(key);
      if (field) {
        field.value = report.criteria[key] || '';
      }
    });

    // Display the report data
    currentReportData = { report: report.reportData };
    displayReport(currentReportData);
    reportResults.classList.add('active');

    // Scroll to results
    reportResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    console.error('Error loading saved report:', error);
    alert(`Failed to load report: ${error.message}`);
  }
};

// Delete a saved report
window.deleteSavedReport = async function(reportId) {
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
};

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Check if we need to load a report from URL parameter
function checkUrlForReport() {
  const urlParams = new URLSearchParams(window.location.search);
  const reportId = urlParams.get('loadReport');
  if (reportId) {
    // Clear the URL parameter
    window.history.replaceState({}, document.title, window.location.pathname);
    // Load the report
    loadSavedReport(reportId);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
    loadSavedReports();
    checkUrlForReport();
  });
} else {
  init();
  loadSavedReports();
  checkUrlForReport();
}


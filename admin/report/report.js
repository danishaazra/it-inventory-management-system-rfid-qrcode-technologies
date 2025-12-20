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
  }
};

// Load report options (locations and branches)
async function loadReportOptions() {
  try {
    const resp = await fetch('./get_report_options.php');
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
        endpoint = './generate_asset_report.php';
        break;
      case 'maintenance':
        endpoint = './generate_maintenance_report.php';
        break;
      case 'inspection':
        endpoint = './generate_inspection_report.php';
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
  
  // Clear previous data
  reportTableHead.innerHTML = '';
  reportTableBody.innerHTML = '';
  
  if (!data.report || data.report.length === 0) {
    reportTableBody.innerHTML = '<tr><td colspan="100%" class="no-results">No data found matching the criteria</td></tr>';
    return;
  }
  
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
  
  // Scroll to results
  reportResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
  form.action = './export_report.php';
  form.target = '_blank';
  
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
  
  // Add criteria
  Object.keys(criteria).forEach(key => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = criteria[key];
    form.appendChild(input);
  });
  
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
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


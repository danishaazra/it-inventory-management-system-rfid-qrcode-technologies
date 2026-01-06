// Report Type Selection
let selectedReportType = null;
let currentReportData = null;
let reportOptions = { locations: [], branches: [], staff: [] };

// Element references - will be initialized in init()
let reportTypes, criteriaForm, criteriaFields, criteriaTitle, reportResults;
let reportTable, reportTableHead, reportTableBody, reportTitle, loadingMessage;
let reportCriteriaForm, cancelBtn, generateBtn, exportPdfBtn, exportCsvBtn;
let saveReportBtn, savedReportsList;

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
  // Initialize element references
  reportTypes = document.querySelectorAll('.report-type-card');
  criteriaForm = document.getElementById('criteria-form');
  criteriaFields = document.getElementById('criteria-fields');
  criteriaTitle = document.getElementById('criteria-title');
  reportResults = document.getElementById('report-results');
  reportTable = document.getElementById('report-table');
  reportTableHead = document.getElementById('report-table-head');
  reportTableBody = document.getElementById('report-table-body');
  reportTitle = document.getElementById('report-title');
  loadingMessage = document.getElementById('loading-message');
  reportCriteriaForm = document.getElementById('report-criteria-form');
  cancelBtn = document.getElementById('cancel-btn');
  generateBtn = document.getElementById('generate-btn');
  exportPdfBtn = document.getElementById('export-pdf-btn');
  exportCsvBtn = document.getElementById('export-csv-btn');
  saveReportBtn = document.getElementById('save-report-btn');
  savedReportsList = document.getElementById('saved-reports-list');

  // Check if all required elements exist
  if (!reportCriteriaForm || !cancelBtn || !generateBtn || !exportPdfBtn || !exportCsvBtn || !saveReportBtn) {
    console.error('Some required elements are missing from the DOM');
    console.error('Missing elements:', {
      reportCriteriaForm: !reportCriteriaForm,
      cancelBtn: !cancelBtn,
      generateBtn: !generateBtn,
      exportPdfBtn: !exportPdfBtn,
      exportCsvBtn: !exportCsvBtn,
      saveReportBtn: !saveReportBtn
    });
    return;
  }

  console.log('All elements found, initializing...');
  
  // Test if buttons are accessible
  console.log('Button accessibility test:', {
    cancelBtn: cancelBtn ? 'found' : 'missing',
    generateBtn: generateBtn ? 'found' : 'missing',
    exportPdfBtn: exportPdfBtn ? 'found' : 'missing',
    exportCsvBtn: exportCsvBtn ? 'found' : 'missing',
    saveReportBtn: saveReportBtn ? 'found' : 'missing'
  });
  
  // Test click on buttons to see if they're blocked
  if (cancelBtn) {
    console.log('Cancel button styles:', window.getComputedStyle(cancelBtn).pointerEvents);
  }
  
  await loadReportOptions();
  setupEventListeners();
  console.log('Event listeners attached successfully');
  
  // Add a test click handler to verify buttons work
  if (cancelBtn) {
    cancelBtn.onclick = function(e) {
      console.log('Cancel button clicked (onclick handler)');
    };
  }
}

// Setup event listeners
function setupEventListeners() {
  console.log('Setting up event listeners...');
  
  // Use event delegation for report type cards (more reliable)
  const reportTypesContainer = document.getElementById('report-types');
  if (reportTypesContainer) {
    reportTypesContainer.addEventListener('click', (e) => {
      const card = e.target.closest('.report-type-card');
      if (card && card.dataset.type) {
        const type = card.dataset.type;
        console.log('Report type selected:', type);
        selectReportType(type);
      }
    });
    console.log('Report type cards listener attached');
  } else {
    console.error('Report types container not found');
  }

  // Cancel button
  if (cancelBtn) {
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Cancel button clicked');
      resetForm();
    });
    console.log('Cancel button listener attached');
  } else {
    console.error('Cancel button not found');
  }

  // Generate report
  if (reportCriteriaForm) {
    reportCriteriaForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('Generate report form submitted');
      await generateReport();
    });
    console.log('Generate form listener attached');
  } else {
    console.error('Report criteria form not found');
  }

  // Export buttons
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Export PDF clicked');
      exportReport('pdf');
    });
    console.log('Export PDF button listener attached');
  } else {
    console.error('Export PDF button not found');
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Export CSV clicked');
      exportReport('csv');
    });
    console.log('Export CSV button listener attached');
  } else {
    console.error('Export CSV button not found');
  }

  // Save report button
  if (saveReportBtn) {
    saveReportBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('Save report clicked');
      await saveReport();
    });
    console.log('Save report button listener attached');
  } else {
    console.error('Save report button not found');
  }

  console.log('All event listeners setup complete');
}

// Select report type
function selectReportType(type) {
  selectedReportType = type;
  
  // Update UI
  if (reportTypes && reportTypes.length > 0) {
    reportTypes.forEach(card => {
      card.classList.remove('selected');
      if (card.dataset.type === type) {
        card.classList.add('selected');
      }
    });
  }

  // Show criteria form
  const config = reportConfigs[type];
  if (criteriaTitle) criteriaTitle.textContent = `${config.title} - Criteria`;
  renderCriteriaFields(config.fields);
  if (criteriaForm) criteriaForm.classList.add('active');
  if (reportResults) reportResults.classList.remove('active');
  
  // Scroll to form
  if (criteriaForm) {
    criteriaForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// Render criteria fields
function renderCriteriaFields(fields) {
  if (!criteriaFields) return;
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
  if (!reportResults || !reportTable || !loadingMessage || !reportTitle || !reportCriteriaForm) {
    console.error('Required elements not found');
    return;
  }
  
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
    if (loadingMessage) loadingMessage.textContent = `Error: ${error.message}`;
    alert(`Failed to generate report: ${error.message}`);
  }
}

// Display report
function displayReport(data) {
  if (!loadingMessage || !reportTable || !reportTableHead || !reportTableBody) {
    console.error('Required elements not found for display');
    return;
  }
  
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

  // Clear existing table headers
  reportTableHead.innerHTML = '';
  reportTableBody.innerHTML = '';

  // Get the first item for header information (assuming all items in report have same branch/location/itemName)
  const firstItem = checklistData[0];
  const headerInfo = {
    companyName: firstItem.companyName || 'PKT LOGISTICS (M) SDN BHD',
    branch: firstItem.branch || '-',
    location: firstItem.location || '-',
    itemName: firstItem.itemName || '-',
    month: firstItem.month || 'NOV',
    year: firstItem.year || new Date().getFullYear(),
    frequency: firstItem.frequency || 'Monthly'
  };

  // Create and display header section
  createChecklistHeader(headerInfo);

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

// Create checklist header section
function createChecklistHeader(headerInfo) {
  const reportTableContainer = document.getElementById('report-table-container');
  if (!reportTableContainer) return;

  // Remove existing header if any
  const existingHeader = document.getElementById('checklist-header-section');
  if (existingHeader) {
    existingHeader.remove();
  }

  // Create header section
  const headerSection = document.createElement('div');
  headerSection.id = 'checklist-header-section';
  headerSection.style.cssText = `
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    font-family: 'Inter', sans-serif;
  `;

  // Company name and title
  const titleSection = document.createElement('div');
  titleSection.style.cssText = 'text-align: center; margin-bottom: 1.5rem;';
  titleSection.innerHTML = `
    <h2 style="font-size: 1.5rem; font-weight: 700; color: #1a1a1a; margin-bottom: 0.5rem;">${escapeHtml(headerInfo.companyName)}</h2>
    <h3 style="font-size: 1.25rem; font-weight: 600; color: #374151;">ICT - PREVENTIVE MAINTENANCE CHECKLIST</h3>
  `;
  headerSection.appendChild(titleSection);

  // Info grid
  const infoGrid = document.createElement('div');
  infoGrid.style.cssText = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1rem;';
  
  const infoItems = [
    { label: 'COMPANY NAME:', value: headerInfo.companyName },
    { label: 'BRANCH:', value: headerInfo.branch },
    { label: 'LOCATION:', value: headerInfo.location },
    { label: 'ITEM NAME:', value: headerInfo.itemName },
    { label: 'MONTH:', value: headerInfo.month },
    { label: 'YEAR:', value: headerInfo.year }
  ];

  infoItems.forEach(item => {
    const infoItem = document.createElement('div');
    infoItem.style.cssText = 'display: flex; gap: 0.5rem;';
    const label = document.createElement('span');
    label.style.cssText = 'font-weight: 600; color: #374151;';
    label.textContent = item.label;
    const value = document.createElement('span');
    value.style.cssText = 'color: #1a1a1a;';
    value.textContent = item.value;
    infoItem.appendChild(label);
    infoItem.appendChild(value);
    infoGrid.appendChild(infoItem);
  });

  headerSection.appendChild(infoGrid);

  // Frequency/Check type
  const checkSection = document.createElement('div');
  checkSection.style.cssText = 'display: flex; align-items: center; gap: 1rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;';
  const checkLabel = document.createElement('span');
  checkLabel.style.cssText = 'font-weight: 600; color: #374151;';
  checkLabel.textContent = 'CHECK:';
  checkSection.appendChild(checkLabel);

  const frequencies = ['Weekly', 'Monthly', 'Quarterly'];
  frequencies.forEach(freq => {
    const checkOption = document.createElement('span');
    checkOption.style.cssText = 'display: flex; align-items: center; gap: 0.5rem;';
    const checkbox = document.createElement('span');
    checkbox.style.cssText = `
      width: 18px;
      height: 18px;
      border: 2px solid #374151;
      border-radius: 3px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      ${headerInfo.frequency === freq ? 'background: #140958; border-color: #140958;' : ''}
    `;
    if (headerInfo.frequency === freq) {
      checkbox.innerHTML = '✓';
      checkbox.style.color = '#ffffff';
      checkbox.style.fontSize = '12px';
    }
    const label = document.createElement('span');
    label.textContent = freq;
    checkOption.appendChild(checkbox);
    checkOption.appendChild(label);
    checkSection.appendChild(checkOption);
  });

  headerSection.appendChild(checkSection);

  // Insert header before table
  const reportTable = document.getElementById('report-table');
  if (reportTable && reportTable.parentNode) {
    reportTable.parentNode.insertBefore(headerSection, reportTable);
  } else {
    reportTableContainer.appendChild(headerSection);
  }
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
async function startApp() {
  try {
    console.log('Starting app initialization...');
    await init();
    await loadSavedReports();
    checkUrlForReport();
    console.log('Report page initialized successfully');
  } catch (error) {
    console.error('Error initializing report page:', error);
    console.error(error.stack);
  }
}

// Wait for DOM to be fully ready
function waitForDOM() {
  return new Promise((resolve) => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      // DOM is ready, but wait a bit more for all scripts to load
      setTimeout(resolve, 200);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(resolve, 200);
      });
    }
  });
}

// Start the app
waitForDOM().then(() => {
  console.log('DOM ready, starting app...');
  startApp();
});


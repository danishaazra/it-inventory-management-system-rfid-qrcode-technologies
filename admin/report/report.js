// Report Type Selection
let selectedReportType = null;
let currentReportData = null;
let reportOptions = { locations: [], branches: [], staff: [], categories: [] };

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

// Modal elements
const addReportModalOverlay = document.getElementById('add-report-modal-overlay');
const modalReportTypes = document.querySelectorAll('#modal-report-types .report-type-card') || document.querySelectorAll('#modal-report-types .report-type-card');
const modalCriteriaForm = document.getElementById('modal-criteria-form');
const modalCriteriaFields = document.getElementById('modal-criteria-fields');
const modalCriteriaTitle = document.getElementById('modal-criteria-title');
const modalReportCriteriaForm = document.getElementById('modal-report-criteria-form');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalGenerateBtn = document.getElementById('modal-generate-btn');
const modalReportResults = document.getElementById('modal-report-results');
const modalReportTable = document.getElementById('modal-report-table');
const modalReportTableHead = document.getElementById('modal-report-table-head');
const modalReportTableBody = document.getElementById('modal-report-table-body');
const modalLoadingMessage = document.getElementById('modal-loading-message');
const modalExportPdfBtn = document.getElementById('modal-export-pdf-btn');
const modalExportCsvBtn = document.getElementById('modal-export-csv-btn');
const modalSaveReportBtn = document.getElementById('modal-save-report-btn');

// Report type configurations
const reportConfigs = {
  asset: {
    title: 'Asset Report',
    fields: [
      { name: 'status', label: 'Status', type: 'select', options: ['', 'Active', 'Inactive', 'Maintenance', 'Retired'] },
      { name: 'category', label: 'Category', type: 'select', dynamic: 'categories' },
      { name: 'location', label: 'Location', type: 'select', dynamic: 'locations' },
      { name: 'branch', label: 'Branch', type: 'select', dynamic: 'branches' }
    ]
  },
  maintenance: {
    title: 'Maintenance Report',
    fields: [
      { name: 'year', label: 'Year', type: 'number', placeholder: '2025' },
      { name: 'frequency', label: 'Frequency', type: 'select', options: ['', 'Weekly', 'Monthly', 'Quarterly'] },
      { name: 'branch', label: 'Branch', type: 'select', dynamic: 'branches' },
      { name: 'location', label: 'Location', type: 'select', dynamic: 'locations' },
      { name: 'itemName', label: 'Item Name', type: 'text', placeholder: 'e.g., PKT SERVERS' },
      { name: 'assignedStaff', label: 'Assigned Staff', type: 'select', dynamic: 'staff' }
    ]
  },
  inspection: {
    title: 'Inspection Report',
    fields: [
      { name: 'branch', label: 'Branch', type: 'select', dynamic: 'branches' },
      { name: 'location', label: 'Location', type: 'select', dynamic: 'locations' },
      { name: 'itemName', label: 'Item Name', type: 'text', placeholder: 'e.g., PKT Servers' },
      { name: 'frequency', label: 'Inspection Type', type: 'select', options: ['', 'Weekly', 'Monthly', 'Quarterly'] },
      { name: 'status', label: 'Status', type: 'select', options: ['', 'normal', 'fault'] },
      { name: 'dateFrom', label: 'Date From', type: 'date', placeholder: 'YYYY-MM-DD' },
      { name: 'dateTo', label: 'Date To', type: 'date', placeholder: 'YYYY-MM-DD' }
    ]
  },
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
      reportOptions.categories = data.categories || [];
    }
  } catch (error) {
    console.error('Error loading report options:', error);
  }
}

// Initialize
async function init() {
  await loadReportOptions();
  setupEventListeners();
  // Load and display saved reports by default
  await loadSavedReports();
  // Show saved reports view by default, hide report generation view
  showSavedReportsView();
}

// Setup event listeners
function setupEventListeners() {
  // Add Report button
  const addReportBtn = document.getElementById('add-report-btn');
  if (addReportBtn) {
    addReportBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Add Report button clicked');
      if (typeof window.openAddReportModal === 'function') {
        window.openAddReportModal();
      } else {
        console.error('openAddReportModal function not found');
      }
    });
  } else {
    console.warn('Add Report button not found');
  }

  // Report type selection (original page)
  reportTypes.forEach(card => {
    card.addEventListener('click', () => {
      const type = card.dataset.type;
      selectReportType(type);
    });
  });

  // Modal report type selection
  const modalReportTypeCards = document.querySelectorAll('#modal-report-types .report-type-card');
  modalReportTypeCards.forEach(card => {
    card.addEventListener('click', () => {
      const type = card.dataset.type;
      selectReportTypeInModal(type);
    });
  });

  // Cancel button (original page)
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      // If viewing a saved report, go back to saved reports view
      const savedReportsSection = document.getElementById('saved-reports-section');
      const reportResults = document.getElementById('report-results');
      if (savedReportsSection && savedReportsSection.style.display === 'none' && reportResults && reportResults.classList.contains('active')) {
        // We're viewing a saved report, go back to saved reports
        showSavedReportsView();
      } else {
        // Normal form reset
        resetForm();
      }
    });
  }

  // Close modal button
  const closeModalBtn = document.getElementById('close-add-report-modal-btn');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      closeAddReportModal();
    });
  }

  // Close modal when clicking overlay
  const addReportModalOverlay = document.getElementById('add-report-modal-overlay');
  if (addReportModalOverlay) {
    addReportModalOverlay.addEventListener('click', (e) => {
      if (e.target === addReportModalOverlay) {
        closeAddReportModal();
      }
    });
  }

  // Generate report (original page)
  if (reportCriteriaForm) {
    reportCriteriaForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await generateReport();
    });
  }

  // Modal form submit
  const modalReportCriteriaForm = document.getElementById('modal-report-criteria-form');
  if (modalReportCriteriaForm) {
    modalReportCriteriaForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await generateReportInModal();
    });
  }

  // Export buttons (original page)
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
      exportReport('pdf');
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      exportReport('csv');
    });
  }

  // Save report button (original page)
  if (saveReportBtn) {
    saveReportBtn.addEventListener('click', async () => {
      await saveReport();
    });
  }

  // Modal export buttons
  const modalExportPdfBtn = document.getElementById('modal-export-pdf-btn');
  const modalExportCsvBtn = document.getElementById('modal-export-csv-btn');
  const modalSaveReportBtn = document.getElementById('modal-save-report-btn');
  
  if (modalExportPdfBtn) {
    modalExportPdfBtn.addEventListener('click', () => {
      exportReport('pdf');
    });
  }

  if (modalExportCsvBtn) {
    modalExportCsvBtn.addEventListener('click', () => {
      exportReport('csv');
    });
  }

  if (modalSaveReportBtn) {
    modalSaveReportBtn.addEventListener('click', async () => {
      await saveReport();
      // After saving, close modal and refresh saved reports
      closeAddReportModal();
      await loadSavedReports();
      // Switch back to saved reports view after saving
      showSavedReportsView();
    });
  }
  
  // Close view report modal button
  const closeViewReportModalBtn = document.getElementById('close-view-report-modal-btn');
  if (closeViewReportModalBtn) {
    closeViewReportModalBtn.addEventListener('click', () => {
      if (typeof window.closeViewReportModal === 'function') {
        window.closeViewReportModal();
      }
    });
  }
  
  // View report export buttons
  const viewReportExportPdfBtn = document.getElementById('view-report-export-pdf-btn');
  const viewReportExportCsvBtn = document.getElementById('view-report-export-csv-btn');
  
  if (viewReportExportPdfBtn) {
    viewReportExportPdfBtn.addEventListener('click', () => {
      exportReport('pdf');
    });
  }
  
  if (viewReportExportCsvBtn) {
    viewReportExportCsvBtn.addEventListener('click', () => {
      exportReport('csv');
    });
  }
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
  const criteriaSection = document.getElementById('criteria-form');
  if (criteriaSection) criteriaSection.style.display = 'block';
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
    
    // Store report data (include headerInfo for inspection reports)
    currentReportData = data;
    if (data.headerInfo) {
      currentReportData.headerInfo = data.headerInfo;
    }
    
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
  
  // Handle checklist format differently (maintenance reports use checklist format)
  if (selectedReportType === 'maintenance') {
    displayChecklistReport(data.report);
  } else if (selectedReportType === 'inspection') {
    displayInspectionReport(data);
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

  // Get criteria from form to populate header (use selected values from dropdown)
  const formData = new FormData(reportCriteriaForm);
  const formCriteria = Object.fromEntries(formData.entries());
  
  // Also check if criteria was returned from API
  const apiCriteria = currentReportData?.criteria || {};
  
  // Get the first item for header information
  const firstItem = checklistData[0];
  const reportTitle = reportConfigs[selectedReportType]?.title || 'Checklist Report';
  
  // Use criteria values first (what user selected), then fall back to first item data
  // Priority: API criteria > Form criteria > First item data > Default
  const headerInfo = {
    companyName: reportTitle,
    branch: firstItem?.branch && firstItem.branch !== '-' ? firstItem.branch : (apiCriteria.branch || formCriteria.branch || '-'),
    location: firstItem?.location && firstItem.location !== '-' ? firstItem.location : (apiCriteria.location || formCriteria.location || '-'),
    itemName: firstItem?.itemName && firstItem.itemName !== '-' ? firstItem.itemName : (apiCriteria.itemName || formCriteria.itemName || '-'),
    month: firstItem?.month || 'NOV',
    year: apiCriteria.year || formCriteria.year || firstItem?.year || new Date().getFullYear(),
    frequency: apiCriteria.frequency || formCriteria.frequency || firstItem?.frequency || 'Monthly'
  };
  
  console.log('Header info:', headerInfo);
  console.log('Form criteria:', formCriteria);
  console.log('API criteria:', apiCriteria);
  console.log('First item:', firstItem);

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
    console.log('Item schedule data:', item.schedule);
    
    // Handle inspectionTasks - can be array or string
    let tasks = [];
    if (Array.isArray(item.inspectionTasks)) {
      tasks = item.inspectionTasks;
    } else if (typeof item.inspectionTasks === 'string' && item.inspectionTasks.trim()) {
      // Split by newlines if it's a string
      tasks = item.inspectionTasks.split('\n').map(t => t.trim()).filter(t => t);
    }
    
    const schedule = item.schedule || {};
    console.log('Schedule object:', schedule);
    console.log('Schedule keys:', Object.keys(schedule));
    
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
          cell.style.verticalAlign = 'middle';
          cell.style.padding = '4px 1px';
          cell.style.width = '40px';
          cell.style.minWidth = '40px';
          cell.style.maxWidth = '40px';
          cell.style.whiteSpace = 'nowrap';
          cell.style.overflow = 'visible';
          cell.style.lineHeight = '1.2';
          cell.style.fontSize = '0';
          
          // Debug: log what we're checking
          if (month === 1 && period === 1 && rowNum === 1) {
            console.log('Checking schedule structure:', {
              schedule: schedule,
              month1: schedule[1],
              month1Period1: schedule[1] && schedule[1][1]
            });
          }
          
          if (schedule && schedule[month] && schedule[month][period]) {
            const dates = schedule[month][period];
            if (Array.isArray(dates) && dates.length > 0) {
              // Check if dates are objects with day and class, or just strings
              const firstDate = dates[0];
              if (typeof firstDate === 'object' && firstDate.day) {
                // New format: dates are objects with {day, class}
                dates.forEach(dateObj => {
                  const dateDiv = document.createElement('div');
                  dateDiv.className = `date-cell ${dateObj.class || 'pending'}`;
                  dateDiv.textContent = dateObj.day;
                  
                  // Apply colors matching checklist draft page exactly
                  if (dateObj.class === 'completed') {
                    // Green for completed inspections
                    dateDiv.style.cssText = `
                      width: 16px;
                      height: 16px;
                      border-radius: 2px;
                      display: inline-block;
                      text-align: center;
                      line-height: 16px;
                      font-size: 0.55rem;
                      font-weight: 700;
                      cursor: pointer;
                      margin: 0 1px;
                      background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
                      color: #ffffff;
                      border: none;
                      vertical-align: middle;
                    `;
                  } else if (dateObj.class === 'fault') {
                    // Red gradient for fault conditions - font-weight: 700 (matching checklist draft)
                    dateDiv.style.cssText = `
                      width: 16px;
                      height: 16px;
                      border-radius: 2px;
                      display: inline-block;
                      text-align: center;
                      line-height: 16px;
                      font-size: 0.55rem;
                      font-weight: 700;
                      cursor: pointer;
                      margin: 0 1px;
                      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
                      color: #ffffff;
                      border: none;
                      vertical-align: middle;
                    `;
                  } else if (dateObj.class === 'pending') {
                    // Black for pending inspections
                    dateDiv.style.cssText = `
                      width: 16px;
                      height: 16px;
                      border-radius: 2px;
                      display: inline-block;
                      text-align: center;
                      line-height: 16px;
                      font-size: 0.55rem;
                      font-weight: 600;
                      cursor: pointer;
                      margin: 0 1px;
                      background: #000000;
                      color: #ffffff;
                      border: none;
                      vertical-align: middle;
                    `;
                  } else if (dateObj.class === 'upcoming') {
                    // Grey for upcoming dates
                    dateDiv.style.cssText = `
                      width: 16px;
                      height: 16px;
                      border-radius: 2px;
                      display: inline-block;
                      text-align: center;
                      line-height: 16px;
                      font-size: 0.55rem;
                      font-weight: 600;
                      cursor: not-allowed;
                      margin: 0 1px;
                      background: #9ca3af;
                      color: #000000;
                      border: none;
                      opacity: 0.9;
                      vertical-align: middle;
                    `;
                  } else {
                    // Default: black for pending
                    dateDiv.style.cssText = `
                      width: 16px;
                      height: 16px;
                      border-radius: 2px;
                      display: inline-block;
                      text-align: center;
                      line-height: 16px;
                      font-size: 0.55rem;
                      font-weight: 600;
                      cursor: pointer;
                      margin: 0 1px;
                      background: #000000;
                      color: #ffffff;
                      border: none;
                      vertical-align: middle;
                    `;
                  }
                  cell.appendChild(dateDiv);
                });
              } else {
                // Old format: dates are just strings
              cell.textContent = dates.join(', ');
              }
            } else if (dates) {
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

// Display inspection report with header info
function displayInspectionReport(data) {
  console.log('Displaying inspection report, data:', data);
  
  if (!data.report || !Array.isArray(data.report) || data.report.length === 0) {
    reportTableBody.innerHTML = '<tr><td colspan="100%" class="no-results">No inspection data available</td></tr>';
    return;
  }

  // Clear existing table headers
  reportTableHead.innerHTML = '';
  reportTableBody.innerHTML = '';

  // Get header info from API response or use defaults
  const headerInfo = data.headerInfo || {
    companyName: 'PKT Logistics Group',
    reportTitle: 'Maintenance Inspection Report',
    branch: '-',
    location: '-',
    inspectionType: '-',
    itemName: '-',
    monthYear: '-',
    inspectionDate: '-'
  };

  // Create and display header section
  createInspectionHeader(headerInfo);

  // Create table headers
  const headerRow = document.createElement('tr');
  const headers = ['Task', 'Asset ID', 'Asset Name', 'Serial Number', 'Inspection Date', 'Status', 'Remarks', 'Inspector'];
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  reportTableHead.appendChild(headerRow);

  // Create data rows
  let rowNum = 1;
  let currentTask = '';
  data.report.forEach((item, index) => {
    const tr = document.createElement('tr');
    
    // Check if this is the totals row
    const isTotalRow = item['Task'] === 'TOTAL';
    
    if (isTotalRow) {
      tr.style.backgroundColor = '#f1f3f5';
      tr.style.fontWeight = '700';
    }
    
    // Task column - only show if different from previous
    const taskCell = document.createElement('td');
    if (item['Task'] !== currentTask && !isTotalRow) {
      taskCell.textContent = item['Task'] || '-';
      taskCell.style.fontWeight = '600';
      currentTask = item['Task'];
    } else if (isTotalRow) {
      taskCell.textContent = item['Task'] || '-';
      taskCell.style.fontWeight = '700';
    } else {
      taskCell.textContent = ''; // Empty for same task
    }
    tr.appendChild(taskCell);
    
    // Asset ID
    const assetIdCell = document.createElement('td');
    assetIdCell.textContent = item['Asset ID'] || '-';
    assetIdCell.style.textAlign = 'center';
    tr.appendChild(assetIdCell);
    
    // Asset Name
    const assetNameCell = document.createElement('td');
    assetNameCell.textContent = item['Asset Name'] || '-';
    tr.appendChild(assetNameCell);
    
    // Serial Number
    const serialCell = document.createElement('td');
    serialCell.textContent = item['Serial Number'] || '-';
    tr.appendChild(serialCell);
    
    // Inspection Date
    const dateCell = document.createElement('td');
    dateCell.textContent = item['Inspection Date'] || '-';
    tr.appendChild(dateCell);
    
    // Status
    const statusCell = document.createElement('td');
    statusCell.textContent = item['Status'] || '-';
    // Add color coding for status (using actual database values)
    if (item['Status'] === 'normal' || item['Status'] === 'complete' || item['Status'] === 'completed') {
      statusCell.style.color = '#16a34a';
      statusCell.style.fontWeight = '600';
    } else if (item['Status'] === 'open' || item['Status'] === 'pending') {
      statusCell.style.color = '#f59e0b';
      statusCell.style.fontWeight = '600';
    } else if (item['Status'] === 'fault' || item['Status'] === 'abnormal' || item['Status'] === 'faulty' || item['Status'] === 'overdue') {
      statusCell.style.color = '#dc2626';
      statusCell.style.fontWeight = '600';
    } else if (isTotalRow) {
      statusCell.style.fontWeight = '700';
      statusCell.colSpan = 1;
    }
    tr.appendChild(statusCell);
    
    // Remarks
    const remarksCell = document.createElement('td');
    remarksCell.textContent = item['Remarks'] || '-';
    tr.appendChild(remarksCell);
    
    // Inspector
    const inspectorCell = document.createElement('td');
    inspectorCell.textContent = item['Inspector'] || '-';
    tr.appendChild(inspectorCell);
    
    reportTableBody.appendChild(tr);
    if (!isTotalRow) {
      rowNum++;
    }
  });
  
  console.log('Inspection report displayed, total rows:', rowNum - 1);
}

// Create inspection report header section
function createInspectionHeader(headerInfo) {
  const reportTableContainer = document.getElementById('report-table-container');
  if (!reportTableContainer) return;

  // Remove existing header if any
  const existingHeader = document.getElementById('inspection-header-section');
  if (existingHeader) {
    existingHeader.remove();
  }

  // Create header section
  const headerSection = document.createElement('div');
  headerSection.id = 'inspection-header-section';
  headerSection.style.cssText = `
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    font-family: 'Inter', sans-serif;
  `;

  // Title
  const titleSection = document.createElement('div');
  titleSection.style.cssText = 'text-align: center; margin-bottom: 1.5rem;';
  titleSection.innerHTML = `
    <h2 style="font-size: 1.5rem; font-weight: 700; color: #1a1a1a; margin-bottom: 0.5rem;">${escapeHtml(headerInfo.reportTitle)}</h2>
  `;
  headerSection.appendChild(titleSection);

  // Info grid - 2 columns
  const infoGrid = document.createElement('div');
  infoGrid.style.cssText = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1rem;';
  
  const infoItems = [
    { label: 'Company Name', value: headerInfo.companyName },
    { label: 'Report Title', value: headerInfo.reportTitle },
    { label: 'Branch', value: headerInfo.branch },
    { label: 'Location', value: headerInfo.location },
    { label: 'Inspection Type', value: headerInfo.inspectionType },
    { label: 'Item Name', value: headerInfo.itemName },
    { label: 'Month / Year', value: headerInfo.monthYear },
    { label: 'Inspection Date', value: headerInfo.inspectionDate }
  ];

  infoItems.forEach(item => {
    const infoItem = document.createElement('div');
    infoItem.style.cssText = 'display: flex; gap: 0.5rem;';
    const label = document.createElement('span');
    label.style.cssText = 'font-weight: 600; color: #374151; min-width: 140px;';
    label.textContent = item.label + ':';
    const value = document.createElement('span');
    value.style.cssText = 'color: #1a1a1a;';
    value.textContent = item.value;
    infoItem.appendChild(label);
    infoItem.appendChild(value);
    infoGrid.appendChild(infoItem);
  });

  headerSection.appendChild(infoGrid);

  // Insert header at the beginning of the container
  const firstChild = reportTableContainer.firstChild;
  if (firstChild) {
    reportTableContainer.insertBefore(headerSection, firstChild);
  } else {
    reportTableContainer.appendChild(headerSection);
  }
}

// Create checklist header section in modal
function createChecklistHeaderInModal(headerInfo, container) {
  if (!container) return;

  // Remove existing header if any
  const existingHeader = container.querySelector('#checklist-header-section');
  if (existingHeader) {
    existingHeader.remove();
  }

  // Create header section
  const headerSection = document.createElement('div');
  headerSection.id = 'checklist-header-section';
  headerSection.style.cssText = `
    margin-bottom: 20px;
    padding: 15px;
    background: #f9f9f9;
    border: 1px solid #ddd;
    border-radius: 5px;
    font-size: 11px;
  `;

  // Company name and title
  const titleDiv = document.createElement('div');
  titleDiv.style.cssText = 'font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #140958;';
  titleDiv.textContent = headerInfo.companyName || 'Maintenance Report';
  headerSection.appendChild(titleDiv);

  // Info grid
  const infoGrid = document.createElement('div');
  infoGrid.style.cssText = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 8px;';
  
  const fields = [
    { label: 'Branch', value: headerInfo.branch || '-' },
    { label: 'Location', value: headerInfo.location || '-' },
    { label: 'Item Name', value: headerInfo.itemName || '-', style: 'color: red; font-weight: bold;' },
    { label: 'Month', value: headerInfo.month || '-' },
    { label: 'Year', value: headerInfo.year || '-' },
    { label: 'Frequency', value: headerInfo.frequency || '-' }
  ];

  fields.forEach(field => {
    const fieldDiv = document.createElement('div');
    fieldDiv.style.cssText = 'display: flex; gap: 4px;';
    const label = document.createElement('span');
    label.style.fontWeight = '600';
    label.textContent = `${field.label}: `;
    const value = document.createElement('span');
    value.textContent = field.value;
    if (field.style) value.style.cssText = field.style;
    fieldDiv.appendChild(label);
    fieldDiv.appendChild(value);
    infoGrid.appendChild(fieldDiv);
  });

  headerSection.appendChild(infoGrid);

  // Insert before table
  const table = container.querySelector('table');
  if (table) {
    container.insertBefore(headerSection, table);
  } else {
    container.appendChild(headerSection);
  }
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

  // Insert header at the beginning of the container
  const firstChild = reportTableContainer.firstChild;
  if (firstChild) {
    reportTableContainer.insertBefore(headerSection, firstChild);
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
  
  // Check if report data exists
  if (!currentReportData.report || !Array.isArray(currentReportData.report) || currentReportData.report.length === 0) {
    alert('No data available to export. Please generate a report with data first.');
    return;
  }
  
  const criteria = Object.fromEntries(new FormData(reportCriteriaForm).entries());
  
  // Create form for export
  // Note: Using Node.js API endpoint, not PHP
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
  
  // Add report data (include headerInfo and criteria for maintenance/inspection reports)
  const reportDataToExport = {
    report: currentReportData.report
  };
  
  // Include headerInfo if available (for inspection reports)
  if (currentReportData.headerInfo) {
    reportDataToExport.headerInfo = currentReportData.headerInfo;
  }
  
  // Include criteria if available (for maintenance reports to populate header)
  if (currentReportData.criteria) {
    reportDataToExport.criteria = currentReportData.criteria;
  }
  
  console.log('=== EXPORT DEBUG (Frontend) ===');
  console.log('Exporting report:', {
    type: selectedReportType,
    format: format,
    dataCount: currentReportData.report.length,
    firstItem: currentReportData.report[0],
    hasCriteria: !!currentReportData.criteria,
    hasHeaderInfo: !!currentReportData.headerInfo,
    fullCurrentReportData: currentReportData
  });
  console.log('reportDataToExport:', reportDataToExport);
  console.log('reportDataToExport.report length:', reportDataToExport.report ? reportDataToExport.report.length : 'N/A');
  
  const dataInput = document.createElement('input');
  dataInput.type = 'hidden';
  dataInput.name = 'reportData';
  dataInput.value = JSON.stringify(reportDataToExport);
  form.appendChild(dataInput);
  
  console.log('Form data being sent:', {
    reportType: selectedReportType,
    format: format,
    criteria: criteria,
    reportDataLength: reportDataToExport.report ? reportDataToExport.report.length : 0
  });
  
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
        reportData: currentReportData.report,
        headerInfo: currentReportData.headerInfo || null
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Failed to save report');
    }

    alert('Report saved successfully!');
    await loadSavedReports();
    // Switch back to saved reports view after saving
    showSavedReportsView();
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

// Display saved reports in grid format with actual report previews
function displaySavedReports(reports) {
  if (reports.length === 0) {
    savedReportsList.innerHTML = '<div class="no-saved-reports">No saved reports yet. Click "Add Report" to create one.</div>';
    return;
  }

  savedReportsList.innerHTML = reports.map(report => {
    const date = report.createdAt ? formatReportDate(report.createdAt) : 'Unknown date';
    
    // Use reportName (from API) or reportTitle (fallback)
    const title = escapeHtml(report.reportName || report.reportTitle || 'Untitled Report');

    return `
      <div class="saved-report-card">
        <div class="report-card-content" style="flex: 1;">
          <div class="report-card-title" style="font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem;">${title}</div>
          <div class="report-card-meta" style="font-size: 0.85rem; color: #6b7280;">
            <div class="report-card-date">Saved: ${date}</div>
          </div>
        </div>
        <div class="report-card-actions" style="display: flex; gap: 0.75rem; align-items: center;">
          <button class="report-card-action-btn load-report-btn" data-report-id="${report._id}" title="Load Report" style="background: #140958; color: white; padding: 0.75rem 1.5rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 600; font-size: 0.95rem; min-width: 80px;">
            Load
          </button>
          <button class="report-card-action-btn delete-report-btn" data-report-id="${report._id}" title="Delete Report" style="background: #dc2626; color: white; padding: 0.75rem 1.5rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 600; font-size: 0.95rem; min-width: 80px;">
            Delete
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  // Attach event listeners to dynamically created buttons
  attachSavedReportEventListeners();
}

// Attach event listeners to saved report buttons
function attachSavedReportEventListeners() {
  // Load buttons
  const loadButtons = document.querySelectorAll('.load-report-btn');
  loadButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const reportId = btn.getAttribute('data-report-id');
      if (reportId && typeof window.viewFullReportInModal === 'function') {
        window.viewFullReportInModal(reportId);
      } else {
        console.error('viewFullReportInModal function not available or reportId missing');
      }
    });
  });
  
  // Delete buttons
  const deleteButtons = document.querySelectorAll('.delete-report-btn');
  deleteButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const reportId = btn.getAttribute('data-report-id');
      if (reportId && typeof window.deleteSavedReport === 'function') {
        window.deleteSavedReport(reportId);
      } else {
        console.error('deleteSavedReport function not available or reportId missing');
      }
    });
  });
}

// Generate a small preview of the actual report data
function generateReportPreview(report) {
  if (!report.reportData || !Array.isArray(report.reportData) || report.reportData.length === 0) {
    return '<div class="report-preview-empty">No data</div>';
  }

  const reportType = report.reportType || 'asset';
  const previewData = report.reportData.slice(0, 5); // Show first 5 rows
  
  if (reportType === 'maintenance' || reportType === 'checklist') {
    // Checklist format - show a small table preview
    return generateChecklistPreview(previewData);
  } else if (reportType === 'inspection') {
    // Inspection format - show a small table preview
    return generateInspectionPreview(previewData);
  } else {
    // Asset or other - show a small table preview
    return generateTablePreview(previewData);
  }
}

// Generate table preview for asset reports
function generateTablePreview(data) {
  if (!data || data.length === 0) {
    return '<div class="report-preview-empty">No data</div>';
  }
  
  const headers = Object.keys(data[0]);
  const maxCols = Math.min(headers.length, 4); // Show max 4 columns
  const maxRows = Math.min(data.length, 4); // Show max 4 rows
  const displayHeaders = headers.slice(0, maxCols);
  const displayData = data.slice(0, maxRows);
  
  let previewHTML = '<div class="report-preview-table">';
  previewHTML += '<table class="preview-table">';
  
  // Header row
  previewHTML += '<thead><tr>';
  displayHeaders.forEach(header => {
    previewHTML += `<th>${escapeHtml(String(header).substring(0, 8))}</th>`;
  });
  previewHTML += '</tr></thead>';
  
  // Data rows
  previewHTML += '<tbody>';
  displayData.forEach(row => {
    previewHTML += '<tr>';
    displayHeaders.forEach(header => {
      const value = row[header];
      const displayValue = value !== null && value !== undefined ? String(value) : '-';
      previewHTML += `<td>${escapeHtml(displayValue.substring(0, 10))}</td>`;
    });
    previewHTML += '</tr>';
  });
  previewHTML += '</tbody>';
  
  previewHTML += '</table>';
  if (data.length > maxRows) {
    previewHTML += '<div class="preview-more">+${data.length - maxRows} more</div>';
  }
  previewHTML += '</div>';
  
  return previewHTML;
}

// Generate checklist preview for maintenance reports
function generateChecklistPreview(data) {
  if (!data || data.length === 0) {
    return '<div class="report-preview-empty">No data</div>';
  }
  
  // For checklist, show a simplified grid view
  let previewHTML = '<div class="report-preview-checklist">';
  previewHTML += '<table class="preview-table preview-checklist-table">';
  
  // Show first few rows with first few columns
  const maxRows = Math.min(data.length, 3);
  const firstRow = data[0];
  const keys = Object.keys(firstRow);
  const maxCols = Math.min(keys.length, 5);
  
  // Header
  previewHTML += '<thead><tr>';
  for (let i = 0; i < maxCols; i++) {
    const key = keys[i];
    previewHTML += `<th>${escapeHtml(String(key).substring(0, 6))}</th>`;
  }
  previewHTML += '</tr></thead>';
  
  // Data
  previewHTML += '<tbody>';
  for (let i = 0; i < maxRows; i++) {
    previewHTML += '<tr>';
    for (let j = 0; j < maxCols; j++) {
      const key = keys[j];
      const value = data[i][key];
      const displayValue = value !== null && value !== undefined ? String(value) : '-';
      previewHTML += `<td>${escapeHtml(displayValue.substring(0, 8))}</td>`;
    }
    previewHTML += '</tr>';
  }
  previewHTML += '</tbody>';
  previewHTML += '</table>';
  
  if (data.length > maxRows) {
    previewHTML += `<div class="preview-more">+${data.length - maxRows} more rows</div>`;
  }
  previewHTML += '</div>';
  
  return previewHTML;
}

// Generate inspection preview
function generateInspectionPreview(data) {
  return generateTablePreview(data); // Use same table preview for inspection
}

// Get preview icon for report type
function getReportPreviewIcon(reportType) {
  const icons = {
    'asset': '<div class="report-preview-icon asset-icon">📊</div>',
    'maintenance': '<div class="report-preview-icon maintenance-icon">📋</div>',
    'inspection': '<div class="report-preview-icon inspection-icon">✅</div>',
    'checklist': '<div class="report-preview-icon checklist-icon">📝</div>'
  };
  return icons[reportType] || '<div class="report-preview-icon default-icon">📄</div>';
}

// Format report date (e.g., "10 hrs ago", "yesterday", "09 Aug 2022")
function formatReportDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffHours < 1) {
    return 'just now';
  } else if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hr' : 'hrs'} ago`;
  } else if (diffDays === 1) {
    return 'yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  }
}

// Show saved reports view (hide report generation)
function showSavedReportsView() {
  const reportTypeSection = document.querySelector('.report-type-section');
  const reportTypeSelection = document.querySelector('.report-type-selection');
  const criteriaSection = document.getElementById('criteria-form');
  const reportResults = document.getElementById('report-results');
  const savedReportsSection = document.getElementById('saved-reports-section');
  
  if (reportTypeSection) reportTypeSection.style.display = 'none';
  if (reportTypeSelection) reportTypeSelection.style.display = 'none';
  if (criteriaSection) criteriaSection.style.display = 'none';
  if (reportResults) reportResults.classList.remove('active');
  if (savedReportsSection) savedReportsSection.style.display = 'block';
}

// Show report generation view (hide saved reports)
function showReportGenerationView() {
  const reportTypeSection = document.querySelector('.report-type-section');
  const reportTypeSelection = document.querySelector('.report-type-selection');
  const criteriaSection = document.getElementById('criteria-form');
  const reportResults = document.getElementById('report-results');
  const savedReportsSection = document.getElementById('saved-reports-section');
  
  if (reportTypeSection) reportTypeSection.style.display = 'block';
  if (reportTypeSelection) reportTypeSelection.style.display = 'grid';
  if (criteriaSection) criteriaSection.style.display = 'none'; // Hide initially, show after type selection
  if (savedReportsSection) savedReportsSection.style.display = 'none';
  // Reset selected report type
  selectedReportType = null;
  // Reset report type cards
  reportTypes.forEach(card => {
    card.classList.remove('selected');
  });
}

// View full report in modal
window.viewFullReportInModal = async function(reportId) {
  const viewReportModal = document.getElementById('view-report-modal-overlay');
  const viewReportLoading = document.getElementById('view-report-loading-message');
  const viewReportTable = document.getElementById('view-report-table');
  const viewReportTableHead = document.getElementById('view-report-table-head');
  const viewReportTableBody = document.getElementById('view-report-table-body');
  const viewReportTableContainer = document.getElementById('view-report-table-container');
  
  // Show modal
  if (viewReportModal) {
    viewReportModal.style.display = 'flex';
  }
  
  // Show loading
  if (viewReportLoading) {
    viewReportLoading.style.display = 'block';
    viewReportLoading.textContent = 'Loading report...';
  }
  if (viewReportTable) {
    viewReportTable.style.display = 'none';
  }
  
  // Clear previous data
  if (viewReportTableHead) viewReportTableHead.innerHTML = '';
  if (viewReportTableBody) viewReportTableBody.innerHTML = '';
  
  // Remove existing header if any
  if (viewReportTableContainer) {
    const existingHeader = viewReportTableContainer.querySelector('#checklist-header-section');
    if (existingHeader) existingHeader.remove();
  }
  
  try {
    const response = await fetch(`/api/reports/load?reportId=${encodeURIComponent(reportId)}`);
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Failed to load report');
    }

    const report = data.report;
    
    // Set modal title
    const modalTitle = document.getElementById('view-report-modal-title');
    if (modalTitle) {
      modalTitle.textContent = report.reportName || report.reportTitle || 'Saved Report';
    }
    
    // Set the report type
    selectedReportType = report.reportType;
    
    // Display the report data in modal
    if (report.reportData && Array.isArray(report.reportData) && report.reportData.length > 0) {
      // Use saved report data
      currentReportData = { report: report.reportData };
      if (report.headerInfo) {
        currentReportData.headerInfo = report.headerInfo;
      }
      if (report.criteria) {
        currentReportData.criteria = report.criteria;
      }
      
      // Display in modal
      displayReportInViewModal(currentReportData);
    } else {
      // No saved data, show error
      if (viewReportTableBody) {
        viewReportTableBody.innerHTML = '<tr><td colspan="100%" class="no-results">No report data found. This report may need to be regenerated.</td></tr>';
      }
      if (viewReportTable) viewReportTable.style.display = 'table';
      if (viewReportLoading) viewReportLoading.style.display = 'none';
    }
  } catch (error) {
    console.error('Error loading saved report:', error);
    if (viewReportTableBody) {
      viewReportTableBody.innerHTML = `<tr><td colspan="100%" class="no-results">Error: ${error.message}</td></tr>`;
    }
    if (viewReportTable) viewReportTable.style.display = 'table';
    if (viewReportLoading) viewReportLoading.style.display = 'none';
  }
};

// Display report in view modal
function displayReportInViewModal(data) {
  const viewReportLoading = document.getElementById('view-report-loading-message');
  const viewReportTable = document.getElementById('view-report-table');
  const viewReportTableHead = document.getElementById('view-report-table-head');
  const viewReportTableBody = document.getElementById('view-report-table-body');
  const viewReportTableContainer = document.getElementById('view-report-table-container');
  
  if (viewReportLoading) viewReportLoading.style.display = 'none';
  if (viewReportTable) viewReportTable.style.display = 'table';
  
  // Clear previous data
  if (viewReportTableHead) viewReportTableHead.innerHTML = '';
  if (viewReportTableBody) viewReportTableBody.innerHTML = '';
  
  // Remove existing header if any
  if (viewReportTableContainer) {
    const existingHeader = viewReportTableContainer.querySelector('#checklist-header-section');
    if (existingHeader) existingHeader.remove();
  }
  
  if (!data.report || data.report.length === 0) {
    if (viewReportTableBody) {
      viewReportTableBody.innerHTML = '<tr><td colspan="100%" class="no-results">No data found matching the criteria</td></tr>';
    }
    return;
  }
  
  // Handle checklist format differently (maintenance reports use checklist format)
  if (selectedReportType === 'maintenance') {
    // Create header section for modal
    if (viewReportTableContainer && data.report && data.report.length > 0) {
      const firstItem = data.report[0];
      const apiCriteria = data.criteria || {};
      const headerInfo = {
        companyName: 'Maintenance Report',
        branch: firstItem?.branch && firstItem.branch !== '-' ? firstItem.branch : (apiCriteria.branch || '-'),
        location: firstItem?.location && firstItem.location !== '-' ? firstItem.location : (apiCriteria.location || '-'),
        itemName: firstItem?.itemName && firstItem.itemName !== '-' ? firstItem.itemName : (apiCriteria.itemName || '-'),
        month: firstItem?.month || 'NOV',
        year: apiCriteria.year || firstItem?.year || new Date().getFullYear(),
        frequency: apiCriteria.frequency || firstItem?.frequency || 'Monthly'
      };
      createChecklistHeaderInModal(headerInfo, viewReportTableContainer);
    }
    displayChecklistReportInViewModal(data.report);
  } else if (selectedReportType === 'inspection') {
    displayInspectionReportInModal(data);
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
    if (viewReportTableHead) viewReportTableHead.appendChild(headerRow);
    
    // Create data rows
    data.report.forEach(row => {
      const tr = document.createElement('tr');
      headers.forEach(header => {
        const td = document.createElement('td');
        const value = row[header];
        td.textContent = value !== null && value !== undefined ? value : '-';
        tr.appendChild(td);
      });
      if (viewReportTableBody) viewReportTableBody.appendChild(tr);
    });
  }
}

// Display checklist report in view modal
function displayChecklistReportInViewModal(checklistData) {
  const viewReportTableHead = document.getElementById('view-report-table-head');
  const viewReportTableBody = document.getElementById('view-report-table-body');
  
  if (!checklistData || !Array.isArray(checklistData) || checklistData.length === 0) {
    if (viewReportTableBody) {
      viewReportTableBody.innerHTML = '<tr><td colspan="100%" class="no-results">No checklist data available</td></tr>';
    }
    return;
  }

  // Clear existing table headers
  if (viewReportTableHead) viewReportTableHead.innerHTML = '';
  if (viewReportTableBody) viewReportTableBody.innerHTML = '';

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
  if (viewReportTableHead) viewReportTableHead.appendChild(headerRow);
  
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
  if (viewReportTableHead) viewReportTableHead.appendChild(subHeaderRow);
  
  // Create data rows (same logic as displayChecklistReportInModal)
  let rowNum = 1;
  checklistData.forEach((item, itemIndex) => {
    // Handle inspectionTasks - can be array or string
    let tasks = [];
    if (Array.isArray(item.inspectionTasks)) {
      tasks = item.inspectionTasks;
    } else if (typeof item.inspectionTasks === 'string' && item.inspectionTasks.trim()) {
      tasks = item.inspectionTasks.split('\n').map(t => t.trim()).filter(t => t);
    }
    
    if (tasks.length === 0) {
      tasks.push(item.itemName || 'No tasks defined');
    }
    
    // Handle schedule - might be stringified JSON, so parse if needed
    let schedule = item.schedule || {};
    if (typeof schedule === 'string') {
      try {
        schedule = JSON.parse(schedule);
      } catch (e) {
        console.warn(`Failed to parse schedule for item ${itemIndex}:`, e);
        schedule = {};
      }
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
      
      // Month/period cells (same as displayChecklistReportInModal)
      for (let month = 1; month <= 12; month++) {
        for (let period = 1; period <= 4; period++) {
          const cell = document.createElement('td');
          cell.style.textAlign = 'center';
          cell.style.verticalAlign = 'middle';
          cell.style.padding = '4px 1px';
          cell.style.width = '40px';
          cell.style.minWidth = '40px';
          cell.style.maxWidth = '40px';
          cell.style.whiteSpace = 'nowrap';
          cell.style.overflow = 'visible';
          cell.style.lineHeight = '1.2';
          cell.style.fontSize = '0';
          
          if (schedule && schedule[month] && schedule[month][period]) {
            const dates = schedule[month][period];
            if (Array.isArray(dates) && dates.length > 0) {
              const firstDate = dates[0];
              if (typeof firstDate === 'object' && firstDate.day) {
                dates.forEach(dateObj => {
                  const dateDiv = document.createElement('div');
                  dateDiv.className = `date-cell ${dateObj.class || 'pending'}`;
                  dateDiv.textContent = dateObj.day;
                  
                  // Apply colors matching checklist draft page EXACTLY
                  if (dateObj.class === 'completed') {
                    dateDiv.style.cssText = `
                      width: 16px;
                      height: 16px;
                      border-radius: 2px;
                      display: inline-block;
                      text-align: center;
                      line-height: 16px;
                      font-size: 0.55rem;
                      font-weight: 700;
                      cursor: pointer;
                      margin: 0 1px;
                      background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
                      color: #ffffff;
                      border: none;
                      vertical-align: middle;
                    `;
                  } else if (dateObj.class === 'fault') {
                    dateDiv.style.cssText = `
                      width: 16px;
                      height: 16px;
                      border-radius: 2px;
                      display: inline-block;
                      text-align: center;
                      line-height: 16px;
                      font-size: 0.55rem;
                      font-weight: 700;
                      cursor: pointer;
                      margin: 0 1px;
                      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
                      color: #ffffff;
                      border: none;
                      vertical-align: middle;
                    `;
                  } else if (dateObj.class === 'pending') {
                    dateDiv.style.cssText = `
                      width: 16px;
                      height: 16px;
                      border-radius: 2px;
                      display: inline-block;
                      text-align: center;
                      line-height: 16px;
                      font-size: 0.55rem;
                      font-weight: 600;
                      cursor: pointer;
                      margin: 0 1px;
                      background: #000000;
                      color: #ffffff;
                      border: none;
                      vertical-align: middle;
                    `;
                  } else if (dateObj.class === 'upcoming') {
                    dateDiv.style.cssText = `
                      width: 16px;
                      height: 16px;
                      border-radius: 2px;
                      display: inline-block;
                      text-align: center;
                      line-height: 16px;
                      font-size: 0.55rem;
                      font-weight: 600;
                      cursor: not-allowed;
                      margin: 0 1px;
                      background: #9ca3af;
                      color: #000000;
                      border: none;
                      opacity: 0.9;
                      vertical-align: middle;
                    `;
                  } else {
                    dateDiv.style.cssText = `
                      width: 16px;
                      height: 16px;
                      border-radius: 2px;
                      display: inline-block;
                      text-align: center;
                      line-height: 16px;
                      font-size: 0.55rem;
                      font-weight: 600;
                      cursor: pointer;
                      margin: 0 1px;
                      background: #000000;
                      color: #ffffff;
                      border: none;
                      vertical-align: middle;
                    `;
                  }
                  cell.appendChild(dateDiv);
                });
              } else {
                dates.forEach(date => {
                  const dateDiv = document.createElement('div');
                  dateDiv.textContent = String(date);
                  dateDiv.style.cssText = `
                    width: 16px;
                    height: 16px;
                    border-radius: 2px;
                    display: inline-block;
                    text-align: center;
                    line-height: 16px;
                    font-size: 0.55rem;
                    font-weight: 600;
                    margin: 0 1px;
                    background: #000000;
                    color: #ffffff;
                    border: none;
                    vertical-align: middle;
                  `;
                  cell.appendChild(dateDiv);
                });
              }
            }
          }
          
          tr.appendChild(cell);
        }
      }
      
      if (viewReportTableBody) viewReportTableBody.appendChild(tr);
      rowNum++;
    });
  });
}

// Close view report modal
window.closeViewReportModal = function() {
  const viewReportModal = document.getElementById('view-report-modal-overlay');
  if (viewReportModal) {
    viewReportModal.style.display = 'none';
  }
};

// Keep old function for backward compatibility (but redirect to modal)
window.viewFullReport = async function(reportId) {
  await viewFullReportInModal(reportId);
};

// Open add report modal
window.openAddReportModal = function() {
  console.log('openAddReportModal called');
  const addReportModalOverlay = document.getElementById('add-report-modal-overlay');
  console.log('Modal overlay element:', addReportModalOverlay);
  
  if (addReportModalOverlay) {
    addReportModalOverlay.classList.add('open');
    console.log('Modal overlay class added, display should be:', window.getComputedStyle(addReportModalOverlay).display);
    
    // Reset modal state
    resetModalForm();
    
    // Show report type selection, hide criteria and results
    const modalReportTypeSection = document.getElementById('modal-report-type-section');
    console.log('Modal report type section:', modalReportTypeSection);
    if (modalReportTypeSection) {
      modalReportTypeSection.style.display = 'block';
      console.log('Report type section displayed');
    } else {
      console.error('Modal report type section not found!');
    }
    
    const modalCriteriaForm = document.getElementById('modal-criteria-form');
    if (modalCriteriaForm) modalCriteriaForm.style.display = 'none';
    
    const modalReportResults = document.getElementById('modal-report-results');
    if (modalReportResults) modalReportResults.style.display = 'none';
  } else {
    console.error('Modal overlay element not found!');
  }
};

// Close add report modal
window.closeAddReportModal = function() {
  const addReportModalOverlay = document.getElementById('add-report-modal-overlay');
  if (addReportModalOverlay) {
    addReportModalOverlay.classList.remove('open');
    resetModalForm();
  }
};

// Reset modal form
function resetModalForm() {
  selectedReportType = null;
  currentReportData = null;
  
  // Reset modal report type cards
  const modalReportTypeCards = document.querySelectorAll('#modal-report-types .report-type-card');
  modalReportTypeCards.forEach(card => {
    card.classList.remove('selected');
  });
  
  // Clear modal criteria fields
  const modalCriteriaFields = document.getElementById('modal-criteria-fields');
  if (modalCriteriaFields) modalCriteriaFields.innerHTML = '';
  const modalReportTableHead = document.getElementById('modal-report-table-head');
  if (modalReportTableHead) modalReportTableHead.innerHTML = '';
  const modalReportTableBody = document.getElementById('modal-report-table-body');
  if (modalReportTableBody) modalReportTableBody.innerHTML = '';
  const modalReportTable = document.getElementById('modal-report-table');
  if (modalReportTable) modalReportTable.style.display = 'none';
  const modalLoadingMessage = document.getElementById('modal-loading-message');
  if (modalLoadingMessage) modalLoadingMessage.style.display = 'none';
  const modalSaveReportBtn = document.getElementById('modal-save-report-btn');
  if (modalSaveReportBtn) modalSaveReportBtn.style.display = 'none';
}

// Select report type in modal
function selectReportTypeInModal(type) {
  selectedReportType = type;
  
  // Update UI
  const modalReportTypeCards = document.querySelectorAll('#modal-report-types .report-type-card');
  modalReportTypeCards.forEach(card => {
    card.classList.remove('selected');
    if (card.dataset.type === type) {
      card.classList.add('selected');
    }
  });

  // Show criteria form in modal
  const config = reportConfigs[type];
  const modalCriteriaTitle = document.getElementById('modal-criteria-title');
  if (modalCriteriaTitle) modalCriteriaTitle.textContent = `${config.title} - Criteria`;
  renderCriteriaFieldsInModal(config.fields);
  
  const modalReportTypeSection = document.getElementById('modal-report-type-section');
  if (modalReportTypeSection) modalReportTypeSection.style.display = 'none';
  const modalCriteriaForm = document.getElementById('modal-criteria-form');
  if (modalCriteriaForm) modalCriteriaForm.style.display = 'block';
  const modalReportResults = document.getElementById('modal-report-results');
  if (modalReportResults) modalReportResults.style.display = 'none';
}

// Render criteria fields in modal
function renderCriteriaFieldsInModal(fields) {
  const modalCriteriaFields = document.getElementById('modal-criteria-fields');
  if (!modalCriteriaFields) return;
  modalCriteriaFields.innerHTML = '';
  
  fields.forEach(field => {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'form-field';
    
    const label = document.createElement('label');
    label.textContent = field.label;
    label.setAttribute('for', `modal-${field.name}`);
    
    let input;
    if (field.type === 'select') {
      input = document.createElement('select');
      input.id = `modal-${field.name}`;
      input.name = field.name;
      input.className = 'form-input';
      
      if (field.dynamic) {
        const options = reportOptions[field.dynamic] || [];
        input.innerHTML = '<option value="">All</option>' + options.map(opt => 
          `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`
        ).join('');
      } else if (field.options) {
        input.innerHTML = field.options.map(opt => 
          `<option value="${escapeHtml(opt)}">${escapeHtml(opt || 'All')}</option>`
        ).join('');
      }
    } else {
      input = document.createElement('input');
      input.type = field.type || 'text';
      input.id = `modal-${field.name}`;
      input.name = field.name;
      input.className = 'form-input';
      if (field.placeholder) {
        input.placeholder = field.placeholder;
      }
    }
    
    fieldDiv.appendChild(label);
    fieldDiv.appendChild(input);
    modalCriteriaFields.appendChild(fieldDiv);
  });
}

// Generate report in modal
async function generateReportInModal() {
  if (!selectedReportType) return;
  
  const modalReportResults = document.getElementById('modal-report-results');
  const modalReportTable = document.getElementById('modal-report-table');
  const modalLoadingMessage = document.getElementById('modal-loading-message');
  
  // Show loading
  if (modalReportResults) modalReportResults.style.display = 'block';
  if (modalReportTable) modalReportTable.style.display = 'none';
  if (modalLoadingMessage) {
    modalLoadingMessage.style.display = 'block';
    modalLoadingMessage.textContent = 'Generating report...';
  }
  
  // Get form data
  const modalReportCriteriaForm = document.getElementById('modal-report-criteria-form');
  if (!modalReportCriteriaForm) return;
  
  const formData = new FormData(modalReportCriteriaForm);
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
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(criteria)
    });
    
    const data = await response.json();
    
    console.log('=== generateReportInModal - API Response ===');
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    console.log('Full data:', data);
    console.log('data.ok:', data.ok);
    console.log('data.report:', data.report);
    console.log('data.report type:', typeof data.report);
    console.log('data.report is array:', Array.isArray(data.report));
    console.log('data.report length:', data.report ? data.report.length : 'N/A');
    
    if (!response.ok || !data.ok) {
      const errorMsg = data.error || 'Failed to generate report';
      console.error('API Error:', errorMsg);
      throw new Error(errorMsg);
    }
    
    // Ensure report is an array
    if (!Array.isArray(data.report)) {
      console.error('Report is not an array:', data.report);
      data.report = [];
    }
    
    if (data.report && data.report.length > 0) {
      console.log('First report item:', data.report[0]);
      console.log('First report item keys:', Object.keys(data.report[0]));
    } else {
      console.warn('Report is empty - no data found');
    }
    
    // Store report data
    currentReportData = { report: data.report || [] };
    if (data.headerInfo) {
      currentReportData.headerInfo = data.headerInfo;
    }
    if (data.criteria) {
      currentReportData.criteria = data.criteria;
    }
    
    // Hide loading message before displaying
    if (modalLoadingMessage) {
      modalLoadingMessage.style.display = 'none';
      console.log('Loading message hidden');
    }
    
    // Display report in modal
    try {
      console.log('Calling displayReportInModal with data:', data);
      displayReportInModal(data);
      console.log('displayReportInModal completed successfully');
    } catch (displayError) {
      console.error('Error displaying report in modal:', displayError);
      console.error('Error stack:', displayError.stack);
      if (modalLoadingMessage) {
        modalLoadingMessage.textContent = `Error displaying report: ${displayError.message}`;
        modalLoadingMessage.style.display = 'block';
      }
      // Don't throw - show error message instead
    }
    
    // Show save button
    const modalSaveReportBtn = document.getElementById('modal-save-report-btn');
    if (modalSaveReportBtn) {
      modalSaveReportBtn.style.display = 'inline-flex';
    }
    
  } catch (error) {
    console.error('Error generating report:', error);
    if (modalLoadingMessage) {
      modalLoadingMessage.textContent = `Error: ${error.message}`;
    }
    alert(`Failed to generate report: ${error.message}`);
  }
}

// Display report in modal
function displayReportInModal(data) {
  const modalLoadingMessage = document.getElementById('modal-loading-message');
  const modalReportTable = document.getElementById('modal-report-table');
  const modalReportTableHead = document.getElementById('modal-report-table-head');
  const modalReportTableBody = document.getElementById('modal-report-table-body');
  const modalReportResults = document.getElementById('modal-report-results');
  
  if (modalLoadingMessage) modalLoadingMessage.style.display = 'none';
  if (modalReportTable) modalReportTable.style.display = 'table';
  if (modalReportResults) modalReportResults.style.display = 'block';
  
  // Clear previous data
  if (modalReportTableHead) modalReportTableHead.innerHTML = '';
  if (modalReportTableBody) modalReportTableBody.innerHTML = '';
  
  // Remove existing header if any
  const modalReportTableContainer = document.getElementById('modal-report-table-container');
  if (modalReportTableContainer) {
    const existingHeader = modalReportTableContainer.querySelector('#checklist-header-section');
    if (existingHeader) existingHeader.remove();
  }
  
  if (!data.report || !Array.isArray(data.report) || data.report.length === 0) {
    console.warn('No report data to display in modal');
    if (modalReportTableBody) {
      modalReportTableBody.innerHTML = '<tr><td colspan="100%" class="no-results">No data found matching the criteria. Please check your database has inspection records matching the selected criteria.</td></tr>';
    }
    if (modalReportTable) modalReportTable.style.display = 'table';
    return;
  }
  
  console.log('Displaying report in modal with', data.report.length, 'rows, report type:', selectedReportType);
  
  // Handle checklist format differently (maintenance reports use checklist format)
  if (selectedReportType === 'maintenance') {
    // Create header section for modal
    const modalReportTableContainer = document.getElementById('modal-report-table-container');
    if (modalReportTableContainer && data.report && data.report.length > 0) {
      const firstItem = data.report[0];
      const apiCriteria = data.criteria || {};
      const headerInfo = {
        companyName: 'Maintenance Report',
        branch: firstItem?.branch && firstItem.branch !== '-' ? firstItem.branch : (apiCriteria.branch || '-'),
        location: firstItem?.location && firstItem.location !== '-' ? firstItem.location : (apiCriteria.location || '-'),
        itemName: firstItem?.itemName && firstItem.itemName !== '-' ? firstItem.itemName : (apiCriteria.itemName || '-'),
        month: firstItem?.month || 'NOV',
        year: apiCriteria.year || firstItem?.year || new Date().getFullYear(),
        frequency: apiCriteria.frequency || firstItem?.frequency || 'Monthly'
      };
      createChecklistHeaderInModal(headerInfo, modalReportTableContainer);
    }
    displayChecklistReportInModal(data.report);
  } else if (selectedReportType === 'inspection') {
    displayInspectionReportInModal(data);
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
    if (modalReportTableHead) modalReportTableHead.appendChild(headerRow);
    
    // Create data rows
    data.report.forEach(row => {
      const tr = document.createElement('tr');
      headers.forEach(header => {
        const td = document.createElement('td');
        const value = row[header];
        td.textContent = value !== null && value !== undefined ? value : '-';
        tr.appendChild(td);
      });
      if (modalReportTableBody) modalReportTableBody.appendChild(tr);
    });
  }
}

// Display checklist report in modal (same format as main page)
function displayChecklistReportInModal(checklistData) {
  console.log('=== displayChecklistReportInModal ===');
  console.log('checklistData:', checklistData);
  console.log('checklistData type:', typeof checklistData);
  console.log('checklistData is array:', Array.isArray(checklistData));
  if (checklistData && checklistData.length > 0) {
    console.log('First item:', checklistData[0]);
    console.log('First item keys:', Object.keys(checklistData[0]));
    console.log('First item schedule:', checklistData[0].schedule);
    console.log('First item inspectionTasks:', checklistData[0].inspectionTasks);
  }
  
  const modalReportTableHead = document.getElementById('modal-report-table-head');
  const modalReportTableBody = document.getElementById('modal-report-table-body');
  
  if (!checklistData || !Array.isArray(checklistData) || checklistData.length === 0) {
    if (modalReportTableBody) {
      modalReportTableBody.innerHTML = '<tr><td colspan="100%" class="no-results">No checklist data available</td></tr>';
    }
    return;
  }

  // Clear existing table headers
  if (modalReportTableHead) modalReportTableHead.innerHTML = '';
  if (modalReportTableBody) modalReportTableBody.innerHTML = '';

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
  if (modalReportTableHead) modalReportTableHead.appendChild(headerRow);
  
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
  if (modalReportTableHead) modalReportTableHead.appendChild(subHeaderRow);
  
  // Create data rows
  let rowNum = 1;
  checklistData.forEach((item, itemIndex) => {
    console.log(`Processing item ${itemIndex}:`, item);
    
    // Handle inspectionTasks - can be array or string
    let tasks = [];
    if (Array.isArray(item.inspectionTasks)) {
      tasks = item.inspectionTasks;
    } else if (typeof item.inspectionTasks === 'string' && item.inspectionTasks.trim()) {
      // Split by newlines if it's a string
      tasks = item.inspectionTasks.split('\n').map(t => t.trim()).filter(t => t);
    }
    
    if (tasks.length === 0) {
      tasks.push(item.itemName || 'No tasks defined');
    }
    
    // Handle schedule - might be stringified JSON, so parse if needed
    let schedule = item.schedule || {};
    if (typeof schedule === 'string') {
      try {
        schedule = JSON.parse(schedule);
      } catch (e) {
        console.warn(`Failed to parse schedule for item ${itemIndex}:`, e);
        schedule = {};
      }
    }
    
    console.log(`Item ${itemIndex} schedule:`, schedule);
    console.log(`Item ${itemIndex} schedule type:`, typeof schedule);
    console.log(`Item ${itemIndex} schedule keys:`, Object.keys(schedule));
    console.log(`Item ${itemIndex} tasks:`, tasks);
    
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
          cell.style.verticalAlign = 'middle';
          cell.style.padding = '4px 1px';
          cell.style.width = '40px';
          cell.style.minWidth = '40px';
          cell.style.maxWidth = '40px';
          cell.style.whiteSpace = 'nowrap';
          cell.style.overflow = 'visible';
          cell.style.lineHeight = '1.2';
          cell.style.fontSize = '0';
          
          if (schedule && schedule[month] && schedule[month][period]) {
            const dates = schedule[month][period];
            if (Array.isArray(dates) && dates.length > 0) {
              // Check if dates are objects with day and class, or just strings
              const firstDate = dates[0];
              if (typeof firstDate === 'object' && firstDate.day) {
                // New format: dates are objects with {day, class}
                dates.forEach(dateObj => {
                  const dateDiv = document.createElement('div');
                  dateDiv.className = `date-cell ${dateObj.class || 'pending'}`;
                  dateDiv.textContent = dateObj.day;
                  
                  // Apply colors matching checklist draft page exactly
                  if (dateObj.class === 'completed') {
                    // Green for completed inspections
                    dateDiv.style.cssText = `
                      width: 16px;
                      height: 16px;
                      border-radius: 2px;
                      display: inline-block;
                      text-align: center;
                      line-height: 16px;
                      font-size: 0.55rem;
                      font-weight: 700;
                      cursor: pointer;
                      margin: 0 1px;
                      background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
                      color: #ffffff;
                      border: none;
                      vertical-align: middle;
                    `;
                  } else if (dateObj.class === 'fault') {
                    // Red gradient for fault conditions - font-weight: 700 (matching checklist draft)
                    dateDiv.style.cssText = `
                      width: 16px;
                      height: 16px;
                      border-radius: 2px;
                      display: inline-block;
                      text-align: center;
                      line-height: 16px;
                      font-size: 0.55rem;
                      font-weight: 700;
                      cursor: pointer;
                      margin: 0 1px;
                      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
                      color: #ffffff;
                      border: none;
                      vertical-align: middle;
                    `;
                  } else if (dateObj.class === 'pending') {
                    // Black for pending inspections
                    dateDiv.style.cssText = `
                      width: 16px;
                      height: 16px;
                      border-radius: 2px;
                      display: inline-block;
                      text-align: center;
                      line-height: 16px;
                      font-size: 0.55rem;
                      font-weight: 600;
                      cursor: pointer;
                      margin: 0 1px;
                      background: #000000;
                      color: #ffffff;
                      border: none;
                      vertical-align: middle;
                    `;
                  } else if (dateObj.class === 'upcoming') {
                    // Grey for upcoming dates
                    dateDiv.style.cssText = `
                      width: 16px;
                      height: 16px;
                      border-radius: 2px;
                      display: inline-block;
                      text-align: center;
                      line-height: 16px;
                      font-size: 0.55rem;
                      font-weight: 600;
                      cursor: not-allowed;
                      margin: 0 1px;
                      background: #9ca3af;
                      color: #000000;
                      border: none;
                      opacity: 0.9;
                      vertical-align: middle;
                    `;
                  } else {
                    // Default: black for pending
                    dateDiv.style.cssText = `
                      width: 16px;
                      height: 16px;
                      border-radius: 2px;
                      display: inline-block;
                      text-align: center;
                      line-height: 16px;
                      font-size: 0.55rem;
                      font-weight: 600;
                      cursor: pointer;
                      margin: 0 1px;
                      background: #000000;
                      color: #ffffff;
                      border: none;
                      vertical-align: middle;
                    `;
                  }
                  cell.appendChild(dateDiv);
                });
              } else {
                // Old format: dates are just strings
                dates.forEach(date => {
                  const dateDiv = document.createElement('div');
                  dateDiv.textContent = String(date);
                  dateDiv.style.cssText = `
                    width: 16px;
                    height: 16px;
                    border-radius: 2px;
                    display: inline-block;
                    text-align: center;
                    line-height: 16px;
                    font-size: 0.55rem;
                    font-weight: 600;
                    margin: 0 1px;
                    background: #ffffff;
                    color: #000000;
                    border: 1px solid #000000;
                    vertical-align: middle;
                  `;
                  cell.appendChild(dateDiv);
                });
              }
            }
          }
          
          tr.appendChild(cell);
        }
      }
      
      if (modalReportTableBody) modalReportTableBody.appendChild(tr);
      rowNum++;
    });
  });
}

// Display inspection report in modal
function displayInspectionReportInModal(data) {
  console.log('=== displayInspectionReportInModal START ===');
  console.log('Data received:', data);
  console.log('data.report:', data.report);
  console.log('data.report length:', data.report ? data.report.length : 'N/A');
  
  const modalLoadingMessage = document.getElementById('modal-loading-message');
  const modalReportTable = document.getElementById('modal-report-table');
  const modalReportTableHead = document.getElementById('modal-report-table-head');
  const modalReportTableBody = document.getElementById('modal-report-table-body');
  const modalReportResults = document.getElementById('modal-report-results');
  const modalReportTableContainer = document.getElementById('modal-report-table-container');
  
  console.log('Modal elements:', {
    modalLoadingMessage: !!modalLoadingMessage,
    modalReportTable: !!modalReportTable,
    modalReportTableHead: !!modalReportTableHead,
    modalReportTableBody: !!modalReportTableBody,
    modalReportResults: !!modalReportResults,
    modalReportTableContainer: !!modalReportTableContainer
  });
  
  if (modalLoadingMessage) modalLoadingMessage.style.display = 'none';
  if (modalReportTable) modalReportTable.style.display = 'table';
  if (modalReportResults) modalReportResults.style.display = 'block';
  
  // Clear previous data
  if (modalReportTableHead) modalReportTableHead.innerHTML = '';
  if (modalReportTableBody) modalReportTableBody.innerHTML = '';
  
  // Remove existing header if any
  if (modalReportTableContainer) {
    const existingHeader = modalReportTableContainer.querySelector('#inspection-header-section');
    if (existingHeader) existingHeader.remove();
  }
  
  if (!data.report || !Array.isArray(data.report) || data.report.length === 0) {
    console.warn('No report data available');
    if (modalReportTableBody) {
      modalReportTableBody.innerHTML = '<tr><td colspan="100%" class="no-results">No inspection data available. Please check that you have inspection records in your database matching the selected criteria.</td></tr>';
    }
    if (modalReportTable) modalReportTable.style.display = 'table';
    return;
  }
  
  console.log('Processing', data.report.length, 'report rows');

  // Get header info from API response or use defaults
  const headerInfo = data.headerInfo || {
    companyName: 'PKT Logistics Group',
    reportTitle: 'Maintenance Inspection Report',
    branch: '-',
    location: '-',
    inspectionType: '-',
    itemName: '-',
    monthYear: '-',
    inspectionDate: '-'
  };

  // Create and display header section in modal
  if (modalReportTableContainer) {
    createInspectionHeaderInModal(headerInfo, modalReportTableContainer);
  }

  // Create table headers
  const headerRow = document.createElement('tr');
  const headers = ['Task', 'Asset ID', 'Asset Name', 'Serial Number', 'Inspection Date', 'Status', 'Remarks', 'Inspector'];
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  if (modalReportTableHead) modalReportTableHead.appendChild(headerRow);

  // Create data rows
  let rowNum = 1;
  let currentTask = '';
  data.report.forEach((item, index) => {
    const tr = document.createElement('tr');
    
    // Check if this is the totals row
    const isTotalRow = item['Task'] === 'TOTAL';
    
    if (isTotalRow) {
      tr.style.backgroundColor = '#f1f3f5';
      tr.style.fontWeight = '700';
    }
    
    // Task column - only show if different from previous
    const taskCell = document.createElement('td');
    if (item['Task'] !== currentTask && !isTotalRow) {
      taskCell.textContent = item['Task'] || '-';
      taskCell.style.fontWeight = '600';
      currentTask = item['Task'];
    } else if (isTotalRow) {
      taskCell.textContent = item['Task'] || '-';
      taskCell.style.fontWeight = '700';
    } else {
      taskCell.textContent = ''; // Empty for same task
    }
    tr.appendChild(taskCell);
    
    // Asset ID
    const assetIdCell = document.createElement('td');
    assetIdCell.textContent = item['Asset ID'] || '-';
    assetIdCell.style.textAlign = 'center';
    tr.appendChild(assetIdCell);
    
    // Asset Name
    const assetNameCell = document.createElement('td');
    assetNameCell.textContent = item['Asset Name'] || '-';
    tr.appendChild(assetNameCell);
    
    // Serial Number
    const serialCell = document.createElement('td');
    serialCell.textContent = item['Serial Number'] || '-';
    tr.appendChild(serialCell);
    
    // Inspection Date
    const dateCell = document.createElement('td');
    dateCell.textContent = item['Inspection Date'] || '-';
    tr.appendChild(dateCell);
    
    // Status
    const statusCell = document.createElement('td');
    statusCell.textContent = item['Status'] || '-';
    // Add color coding for status (using actual database values)
    if (item['Status'] === 'normal' || item['Status'] === 'complete' || item['Status'] === 'completed') {
      statusCell.style.color = '#16a34a';
      statusCell.style.fontWeight = '600';
    } else if (item['Status'] === 'open' || item['Status'] === 'pending') {
      statusCell.style.color = '#f59e0b';
      statusCell.style.fontWeight = '600';
    } else if (item['Status'] === 'fault' || item['Status'] === 'abnormal' || item['Status'] === 'faulty' || item['Status'] === 'overdue') {
      statusCell.style.color = '#dc2626';
      statusCell.style.fontWeight = '600';
    } else if (isTotalRow) {
      statusCell.style.fontWeight = '700';
      statusCell.colSpan = 1;
    }
    tr.appendChild(statusCell);
    
    // Remarks
    const remarksCell = document.createElement('td');
    remarksCell.textContent = item['Remarks'] || '-';
    tr.appendChild(remarksCell);
    
    // Inspector
    const inspectorCell = document.createElement('td');
    inspectorCell.textContent = item['Inspector'] || '-';
    tr.appendChild(inspectorCell);
    
    if (modalReportTableBody) modalReportTableBody.appendChild(tr);
    if (!isTotalRow) {
      rowNum++;
    }
  });
  
  console.log('Inspection report displayed in modal, total rows:', rowNum - 1);
  console.log('=== displayInspectionReportInModal END ===');
  
  // Force table visibility
  if (modalReportTable) {
    modalReportTable.style.display = 'table';
    console.log('Table display forced to table');
  }
  if (modalReportResults) {
    modalReportResults.style.display = 'block';
    console.log('Results section display forced to block');
  }
}

// Create inspection report header section in modal
function createInspectionHeaderInModal(headerInfo, container) {
  if (!container) return;

  // Remove existing header if any
  const existingHeader = container.querySelector('#inspection-header-section');
  if (existingHeader) {
    existingHeader.remove();
  }

  // Create header section
  const headerSection = document.createElement('div');
  headerSection.id = 'inspection-header-section';
  headerSection.style.cssText = `
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    font-family: 'Inter', sans-serif;
  `;

  // Title
  const titleSection = document.createElement('div');
  titleSection.style.cssText = 'text-align: center; margin-bottom: 1.5rem;';
  titleSection.innerHTML = `
    <h2 style="font-size: 1.5rem; font-weight: 700; color: #1a1a1a; margin-bottom: 0.5rem;">${escapeHtml(headerInfo.reportTitle || 'Maintenance Inspection Report')}</h2>
  `;
  headerSection.appendChild(titleSection);

  // Info grid - 2 columns
  const infoGrid = document.createElement('div');
  infoGrid.style.cssText = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1rem;';
  
  const infoItems = [
    { label: 'Company Name', value: headerInfo.companyName },
    { label: 'Report Title', value: headerInfo.reportTitle },
    { label: 'Branch', value: headerInfo.branch },
    { label: 'Location', value: headerInfo.location },
    { label: 'Inspection Type', value: headerInfo.inspectionType },
    { label: 'Item Name', value: headerInfo.itemName },
    { label: 'Month / Year', value: headerInfo.monthYear },
    { label: 'Inspection Date', value: headerInfo.inspectionDate }
  ];

  infoItems.forEach(item => {
    const infoItem = document.createElement('div');
    infoItem.style.cssText = 'display: flex; gap: 0.5rem;';
    const label = document.createElement('span');
    label.style.cssText = 'font-weight: 600; color: #374151; min-width: 140px;';
    label.textContent = item.label + ':';
    const value = document.createElement('span');
    value.style.cssText = 'color: #1a1a1a;';
    value.textContent = item.value || '-';
    infoItem.appendChild(label);
    infoItem.appendChild(value);
    infoGrid.appendChild(infoItem);
  });

  headerSection.appendChild(infoGrid);

  // Insert header at the beginning of the container
  const firstChild = container.firstChild;
  if (firstChild) {
    container.insertBefore(headerSection, firstChild);
  } else {
    container.appendChild(headerSection);
  }
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
    
    console.log('=== LOADING SAVED REPORT ===');
    console.log('Full report object:', report);
    console.log('reportData:', report.reportData);
    console.log('reportData type:', typeof report.reportData);
    console.log('reportData is array:', Array.isArray(report.reportData));
    console.log('reportData length:', Array.isArray(report.reportData) ? report.reportData.length : 'N/A');
    if (Array.isArray(report.reportData) && report.reportData.length > 0) {
      console.log('First reportData item:', report.reportData[0]);
    }
    console.log('criteria:', report.criteria);
    console.log('headerInfo:', report.headerInfo);
    
    // Set the report type
    selectedReportType = report.reportType;
    
    // Update UI
    reportTypes.forEach(card => {
      card.classList.remove('selected');
      if (card.dataset.type === report.reportType) {
        card.classList.add('selected');
      }
    });

    // Display the report data
    // If reportData exists, use it; otherwise regenerate from criteria
    if (report.reportData && Array.isArray(report.reportData) && report.reportData.length > 0) {
      // Use saved report data
      console.log('Using saved report data, count:', report.reportData.length);
      currentReportData = { report: report.reportData };
      if (report.headerInfo) {
        currentReportData.headerInfo = report.headerInfo;
      }
      if (report.criteria) {
        currentReportData.criteria = report.criteria;
      }
      
      // Hide criteria form and report type selection when viewing saved report
      const reportTypeSelection = document.querySelector('.report-type-selection');
      const criteriaSection = document.getElementById('criteria-form');
      if (reportTypeSelection) reportTypeSelection.style.display = 'none';
      if (criteriaSection) criteriaSection.style.display = 'none';
      
      displayReport(currentReportData);
      reportResults.classList.add('active');
    } else {
      // No saved data, regenerate from criteria
      console.log('No saved report data found, regenerating from criteria...');
      // Show criteria form and populate it
      const config = reportConfigs[report.reportType];
      criteriaTitle.textContent = `${config.title} - Criteria`;
      renderCriteriaFields(config.fields);
      criteriaForm.classList.add('active');
      
      // Populate form fields with saved criteria
      Object.keys(report.criteria || {}).forEach(key => {
        const field = document.getElementById(key);
        if (field) {
          field.value = report.criteria[key] || '';
        }
      });
      
      // Trigger report generation
      await generateReport();
    }

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


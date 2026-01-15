// Inspection Task Detail Page
// Loads and displays assets for a specific inspection task

let currentMaintenance = null;
let currentTaskText = '';
let maintenanceAssets = [];
let currentTaskSchedule = null; // Store the task-specific schedule
let allScheduledDates = []; // Store all scheduled dates
let currentDisplayMonth = new Date().getMonth(); // Current month being displayed (0-11)
let currentDisplayYear = new Date().getFullYear(); // Current year being displayed

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const maintenanceId = urlParams.get('maintenanceId');
const taskIndex = urlParams.get('taskIndex');
const taskText = urlParams.get('taskText');

// Load maintenance details and assets
async function loadTaskDetails() {
  if (!maintenanceId) {
    document.body.innerHTML = '<div style="padding: 2rem; text-align: center;"><h1>Error</h1><p>Maintenance ID is required.</p><a href="inspectiontask.html">← Back</a></div>';
    return;
  }

  try {
    // Load maintenance details
    const response = await fetch(`/api/maintenance/get?maintenanceId=${encodeURIComponent(maintenanceId)}`);
    if (!response.ok) {
      throw new Error('Failed to load maintenance details');
    }

    const data = await response.json();
    if (!data.ok || !data.maintenance) {
      throw new Error('Maintenance item not found');
    }

    currentMaintenance = data.maintenance;

    // Get task text from URL parameter or from maintenance item
    if (taskText) {
      currentTaskText = decodeURIComponent(taskText);
    } else if (currentMaintenance.inspectionTasks) {
      const tasks = currentMaintenance.inspectionTasks.split('\n').filter(t => t.trim());
      const index = parseInt(taskIndex) || 0;
      currentTaskText = tasks[index] || tasks[0] || 'No task description';
    } else {
      currentTaskText = 'No task description available';
    }

    // Set task title
    const taskTitle = document.getElementById('task-title');
    if (taskTitle) {
      taskTitle.textContent = currentTaskText;
    }

    // Load task-specific schedule from inspection_tasks collection
    await loadTaskSchedule();

    // Set back link - always go back to inspection task page (staff version)
    const backLink = document.getElementById('back-link');
    if (backLink && currentMaintenance) {
      backLink.addEventListener('click', (e) => {
        e.preventDefault();
        // Always go back to inspectiontask.html (staff version)
        const backUrl = `inspectiontask.html?maintenanceId=${encodeURIComponent(currentMaintenance._id)}&branch=${encodeURIComponent(currentMaintenance.branch)}&location=${encodeURIComponent(currentMaintenance.location)}&itemName=${encodeURIComponent(currentMaintenance.itemName)}&frequency=${encodeURIComponent(currentMaintenance.frequency)}`;
        window.location.href = backUrl;
      });
    }

    // Load dates from schedule and display them
    await loadAndDisplayDates();
  } catch (error) {
    console.error('Error loading task details:', error);
    document.body.innerHTML = `<div style="padding: 2rem; text-align: center;"><h1>Error</h1><p>${error.message || 'Failed to load task details'}</p><a href="inspectiontask.html">← Back</a></div>`;
  }
}

// Load task-specific schedule from inspection_tasks collection
async function loadTaskSchedule() {
  try {
    if (!maintenanceId || !currentTaskText) {
      console.log('No maintenanceId or taskText, using maintenance schedule');
      currentTaskSchedule = currentMaintenance?.maintenanceSchedule || {};
      return;
    }

    console.log(`Loading schedule for task: "${currentTaskText}" from inspection_tasks collection`);
    
    // Load schedule from inspection_tasks collection
    const response = await fetch(`/api/maintenance/inspection-task?maintenanceId=${encodeURIComponent(maintenanceId)}&taskName=${encodeURIComponent(currentTaskText)}`);
    
    if (response.ok) {
      const data = await response.json();
      if (data.ok && data.task && data.task.schedule) {
        currentTaskSchedule = data.task.schedule;
        console.log('✓ Loaded task-specific schedule from inspection_tasks:', currentTaskSchedule);
      } else {
        // Fallback to maintenance schedule if task-specific schedule not found
        console.log('No task-specific schedule found, using maintenance schedule');
        currentTaskSchedule = currentMaintenance?.maintenanceSchedule || {};
      }
    } else {
      // Fallback to maintenance schedule if API fails
      console.warn('Failed to load task schedule, using maintenance schedule');
      currentTaskSchedule = currentMaintenance?.maintenanceSchedule || {};
    }
  } catch (error) {
    console.error('Error loading task schedule:', error);
    // Fallback to maintenance schedule
    currentTaskSchedule = currentMaintenance?.maintenanceSchedule || {};
  }
}

// Extract all dates from schedule
function extractDatesFromSchedule(schedule, frequency) {
  const dates = [];
  if (!schedule || typeof schedule !== 'object') {
    return dates;
  }
  
  const currentYear = new Date().getFullYear();
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  
  if (frequency === 'Weekly') {
    months.forEach(month => {
      if (schedule[month] && typeof schedule[month] === 'object') {
        Object.values(schedule[month]).forEach(dateStr => {
          if (dateStr) {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              dates.push(date);
            }
          }
        });
      }
    });
  } else if (frequency === 'Monthly') {
    months.forEach(month => {
      if (schedule[month]) {
        const date = new Date(schedule[month]);
        if (!isNaN(date.getTime())) {
          dates.push(date);
        }
      }
    });
  } else if (frequency === 'Quarterly') {
    const quarters = ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)'];
    quarters.forEach(quarter => {
      if (schedule[quarter]) {
        const date = new Date(schedule[quarter]);
        if (!isNaN(date.getTime())) {
          dates.push(date);
        }
      }
    });
  }
  
  // Sort dates chronologically
  dates.sort((a, b) => a - b);
  return dates;
}

// Load and display dates from schedule
async function loadAndDisplayDates() {
  const assetsTableWrapper = document.getElementById('assets-table-wrapper');
  if (!assetsTableWrapper) {
    console.error('assets-table-wrapper element not found');
    return;
  }
  
  // Get schedule to use
  const scheduleToUse = currentTaskSchedule || currentMaintenance?.maintenanceSchedule || {};
  const frequency = currentMaintenance?.frequency || 'Weekly';
  
  // Extract all dates from schedule
  allScheduledDates = extractDatesFromSchedule(scheduleToUse, frequency);
  
  if (allScheduledDates.length === 0) {
    assetsTableWrapper.innerHTML = `
      <div class="no-assets">
        <p>No scheduled dates found for this inspection task.</p>
        <p style="margin-top: 0.5rem; font-size: 0.875rem; color: #6b7280;">Please add dates to the schedule using the edit button.</p>
      </div>
    `;
    return;
  }
  
  // Set initial display month/year to the first scheduled date or current month
  if (allScheduledDates.length > 0) {
    const firstDate = allScheduledDates[0];
    currentDisplayMonth = firstDate.getMonth();
    currentDisplayYear = firstDate.getFullYear();
  } else {
    const now = new Date();
    currentDisplayMonth = now.getMonth();
    currentDisplayYear = now.getFullYear();
  }
  
  // Load inspection data for all dates
  await loadInspectionDataForDates(allScheduledDates);
  
  // Display calendar for current month
  displayCalendarForMonth();
}

// Load inspection data for all dates
async function loadInspectionDataForDates(dates) {
  if (!maintenanceId || !currentTaskText) {
    return;
  }
  
  try {
    // First, load all assets to find which ones match this task
    const assetsResp = await fetch('/api/assets/list');
    let matchingAssetIds = [];
    
    if (assetsResp.ok) {
      const assetsData = await assetsResp.json();
      if (assetsData.ok && assetsData.assets) {
        // Find assets where locationDescription matches task name
        const matchingAssets = assetsData.assets.filter(asset => {
          const assetLocation = asset.locationDescription || '';
          return assetLocation.trim() === currentTaskText.trim();
        });
        matchingAssetIds = matchingAssets.map(asset => asset.assetId);
        console.log(`Found ${matchingAssetIds.length} asset(s) matching task "${currentTaskText}"`);
      }
    }
    
    // Load all maintenance assets for this maintenance item
    const response = await fetch(`/api/maintenance/assets?maintenanceId=${encodeURIComponent(maintenanceId)}`);
    if (response.ok) {
      const data = await response.json();
      if (data.ok && data.assets) {
        // Store inspection data by date - ONLY for assets matching this task
        window.inspectionDataByDate = window.inspectionDataByDate || {};
        
        dates.forEach(date => {
          const dateKey = formatDateForStorage(date);
          window.inspectionDataByDate[dateKey] = [];
          
          // Filter inspections for this date AND this task's assets only
          data.assets.forEach(ma => {
            // Only include inspections for assets that match this task
            // If no matching assets, don't show any inspections
            if (matchingAssetIds.length > 0 && matchingAssetIds.includes(ma.assetId)) {
              if (ma.inspectionDate) {
                const inspectionDate = new Date(ma.inspectionDate);
                const inspectionDateKey = formatDateForStorage(inspectionDate);
                
                if (inspectionDateKey === dateKey) {
                  // Debug: Log what we're receiving from the API
                  console.log(`Raw data from API for ${ma.assetId}:`, {
                    assetId: ma.assetId,
                    status: ma.status,
                    inspectionStatus: ma.inspectionStatus,
                    fullObject: ma
                  });
                  
                  // Ensure all MaintenanceAsset fields are included, especially 'status'
                  // The 'status' field should be 'normal' or 'fault' from MaintenanceAsset
                  const inspectionData = {
                    assetId: ma.assetId,
                    inspectionStatus: ma.inspectionStatus || 'pending',
                    status: ma.status || 'normal', // This is the fault condition: 'normal' or 'fault'
                    inspectionDate: ma.inspectionDate,
                    inspectionNotes: ma.inspectionNotes,
                    inspectorId: ma.inspectorId,
                    inspectorName: ma.inspectorName,
                    solved: ma.solved,
                    createdAt: ma.createdAt,
                    updatedAt: ma.updatedAt
                  };
                  
                  console.log(`Created inspection data for ${ma.assetId} on ${dateKey}:`, {
                    status: inspectionData.status,
                    inspectionStatus: inspectionData.inspectionStatus,
                    fullData: inspectionData
                  });
                  
                  window.inspectionDataByDate[dateKey].push(inspectionData);
                }
              }
            }
          });
        });
      }
    }
  } catch (error) {
    console.error('Error loading inspection data:', error);
  }
}

// Display calendar for current month
function displayCalendarForMonth() {
  const assetsTableWrapper = document.getElementById('assets-table-wrapper');
  if (!assetsTableWrapper) {
    return;
  }
  
  if (allScheduledDates.length === 0) {
    assetsTableWrapper.innerHTML = `
      <div class="no-assets">
        <p>No scheduled dates found for this inspection task.</p>
        <p style="margin-top: 0.5rem; font-size: 0.875rem; color: #6b7280;">Please add dates to the schedule using the edit button.</p>
      </div>
    `;
    return;
  }
  
  // Filter dates for current month
  const datesForMonth = allScheduledDates.filter(date => {
    return date.getFullYear() === currentDisplayYear && date.getMonth() === currentDisplayMonth;
  });
  
  // Get available years and months from scheduled dates
  const availableYears = [...new Set(allScheduledDates.map(d => d.getFullYear()))].sort();
  const availableMonths = [...new Set(allScheduledDates
    .filter(d => d.getFullYear() === currentDisplayYear)
    .map(d => d.getMonth()))].sort();
  
  // Generate calendar HTML (async)
  generateMonthCalendarWithNavigation(
    currentDisplayYear, 
    currentDisplayMonth, 
    datesForMonth,
    availableYears,
    availableMonths
  ).then(calendarHTML => {
    assetsTableWrapper.innerHTML = `
      <div class="calendar-container">
        ${calendarHTML}
      </div>
    `;
  });
}

// Navigate to previous month
window.navigatePreviousMonth = function() {
  currentDisplayMonth--;
  if (currentDisplayMonth < 0) {
    currentDisplayMonth = 11;
    currentDisplayYear--;
  }
  displayCalendarForMonth();
};

// Navigate to next month
window.navigateNextMonth = function() {
  currentDisplayMonth++;
  if (currentDisplayMonth > 11) {
    currentDisplayMonth = 0;
    currentDisplayYear++;
  }
  displayCalendarForMonth();
};

// Change year
window.changeYear = function(year) {
  currentDisplayYear = parseInt(year);
  // Find first available month in the new year, or use current month if available
  const monthsInYear = [...new Set(allScheduledDates
    .filter(d => d.getFullYear() === currentDisplayYear)
    .map(d => d.getMonth()))].sort();
  
  if (monthsInYear.length > 0) {
    currentDisplayMonth = monthsInYear[0];
  }
  displayCalendarForMonth();
};

// Generate calendar for a specific month with navigation
async function generateMonthCalendarWithNavigation(year, month, scheduledDates, availableYears, availableMonths) {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();
  
  // Check if previous/next month navigation is available
  const hasPreviousMonth = allScheduledDates.some(d => {
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear--;
    }
    return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
  });
  
  const hasNextMonth = allScheduledDates.some(d => {
    let nextMonth = month + 1;
    let nextYear = year;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear++;
    }
    return d.getFullYear() === nextYear && d.getMonth() === nextMonth;
  });
  
  // Load assets to match to this task (for filtering inspections)
  let matchingAssetIds = [];
  try {
    const assetsResp = await fetch('/api/assets/list');
    if (assetsResp.ok) {
      const assetsData = await assetsResp.json();
      if (assetsData.ok && assetsData.assets) {
        const matchingAssets = assetsData.assets.filter(asset => {
          const assetLocation = asset.locationDescription || '';
          return assetLocation.trim() === currentTaskText.trim();
        });
        matchingAssetIds = matchingAssets.map(asset => asset.assetId);
        console.log(`Calendar: Found ${matchingAssetIds.length} asset(s) matching task "${currentTaskText}"`);
      }
    }
  } catch (error) {
    console.warn('Could not load assets for calendar filtering:', error);
  }
  
  // Create a map of scheduled dates for quick lookup
  const scheduledDatesMap = {};
  scheduledDates.forEach(date => {
    const dateKey = formatDateForStorage(date);
    const allInspections = window.inspectionDataByDate?.[dateKey] || [];
    
    // Filter inspections to only those for assets matching THIS task
    // If no matching assets, don't show any inspections (empty array)
    const inspections = matchingAssetIds.length > 0 
      ? allInspections.filter(inspection => matchingAssetIds.includes(inspection.assetId))
      : []; // No matching assets = no inspections to show
    
    // Calculate status based on THIS task's inspections only
    let statusClass = 'pending';
    let statusText = 'Pending';
    let inspectionCount = 0;
    let hasFault = false;
    
    // FIRST: Check if date is in the future (upcoming dates should not be clickable)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    const isUpcomingDate = dateOnly > today;
    
    if (isUpcomingDate) {
      // If date is upcoming, mark as upcoming and don't count inspections
      statusClass = 'upcoming';
      statusText = 'Upcoming';
      inspectionCount = 0;
    } else if (inspections.length > 0) {
      // Only process inspections for past/today dates
      inspectionCount = inspections.length;
      const faultInspections = inspections.filter(i => i.status === 'fault' || i.status === 'abnormal');
      const completeInspections = inspections.filter(i => i.inspectionStatus === 'complete');
      const normalInspections = inspections.filter(i => i.status === 'normal' || (i.status !== 'fault' && i.status !== 'abnormal'));
      
      // Priority 1: If ANY inspection has fault, show RED (regardless of completion status)
      if (faultInspections.length > 0) {
        statusClass = 'fault';
        statusText = 'Fault';
        hasFault = true;
      } 
      // Priority 2: If ALL inspections are complete AND all are normal, show GREEN
      else if (completeInspections.length === inspections.length && normalInspections.length === inspections.length && inspections.length > 0) {
        statusClass = 'complete';
        statusText = 'Complete';
      } 
      // Otherwise: Pending/In Progress
      else {
        statusClass = 'pending';
        statusText = 'In Progress';
      }
    } else {
      // No inspections and not upcoming - show as pending
      statusClass = 'pending';
      statusText = 'Pending';
    }
    
    scheduledDatesMap[dateKey] = {
      statusClass,
      statusText,
      inspectionCount,
      hasFault,
      date
    };
  });
  
  // Generate calendar grid
  let calendarRows = [];
  let currentRow = [];
  
  // Empty cells for days before month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    currentRow.push('<td class="calendar-day empty"></td>');
  }
  
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month, day);
    const dateKey = formatDateForStorage(currentDate);
    const scheduledDate = scheduledDatesMap[dateKey];
    
    let cellHTML = '';
    if (scheduledDate) {
      // This date is scheduled - only make it clickable if it's not upcoming
      const isUpcoming = scheduledDate.statusClass === 'upcoming';
      const clickHandler = isUpcoming ? '' : `onclick="viewInspectionDetails('${dateKey}')"`;
      const cursorStyle = isUpcoming ? 'style="cursor: not-allowed;"' : '';
      cellHTML = `
        <td class="calendar-day scheduled ${scheduledDate.statusClass}" ${clickHandler} ${cursorStyle}>
          <div class="calendar-day-number">${day}</div>
          <div class="calendar-day-status">
            <span class="status-indicator ${scheduledDate.statusClass}"></span>
          </div>
          ${scheduledDate.inspectionCount > 0 ? `<div class="calendar-day-count">${scheduledDate.inspectionCount}</div>` : ''}
        </td>
      `;
    } else {
      // Regular day (not scheduled)
      cellHTML = `
        <td class="calendar-day">
          <div class="calendar-day-number">${day}</div>
        </td>
      `;
    }
    
    currentRow.push(cellHTML);
    
    // If we've filled a week (7 days), start a new row
    if (currentRow.length === 7) {
      calendarRows.push(`<tr>${currentRow.join('')}</tr>`);
      currentRow = [];
    }
  }
  
  // Fill remaining cells to complete the last week
  if (currentRow.length > 0) {
    while (currentRow.length < 7) {
      currentRow.push('<td class="calendar-day empty"></td>');
    }
    calendarRows.push(`<tr>${currentRow.join('')}</tr>`);
  }
  
  // Generate year dropdown options
  const yearOptions = availableYears.map(y => 
    `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`
  ).join('');
  
  return `
    <div class="calendar-month">
      <div class="calendar-month-header">
        <div class="calendar-nav-left">
          <button class="calendar-nav-btn" onclick="navigatePreviousMonth()" ${!hasPreviousMonth ? 'disabled' : ''} title="Previous Month">
            <span>←</span>
          </button>
        </div>
        <div class="calendar-nav-center">
          <h3>${monthNames[month]}</h3>
          <select class="calendar-year-select" onchange="changeYear(this.value)">
            ${yearOptions}
          </select>
        </div>
        <div class="calendar-nav-right">
          <button class="calendar-nav-btn" onclick="navigateNextMonth()" ${!hasNextMonth ? 'disabled' : ''} title="Next Month">
            <span>→</span>
          </button>
        </div>
      </div>
      <table class="calendar-table">
        <thead>
          <tr>
            ${dayNames.map(day => `<th class="calendar-weekday">${day}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${calendarRows.join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Generate calendar for a specific month (kept for backward compatibility)
async function generateMonthCalendar(year, month, scheduledDates) {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();
  
  // Load assets to match to this task (for filtering inspections)
  let matchingAssetIds = [];
  try {
    const assetsResp = await fetch('/api/assets/list');
    if (assetsResp.ok) {
      const assetsData = await assetsResp.json();
      if (assetsData.ok && assetsData.assets) {
        const matchingAssets = assetsData.assets.filter(asset => {
          const assetLocation = asset.locationDescription || '';
          return assetLocation.trim() === currentTaskText.trim();
        });
        matchingAssetIds = matchingAssets.map(asset => asset.assetId);
        console.log(`Calendar: Found ${matchingAssetIds.length} asset(s) matching task "${currentTaskText}"`);
      }
    }
  } catch (error) {
    console.warn('Could not load assets for calendar filtering:', error);
  }
  
  // Create a map of scheduled dates for quick lookup
  const scheduledDatesMap = {};
  scheduledDates.forEach(date => {
    const dateKey = formatDateForStorage(date);
    const allInspections = window.inspectionDataByDate?.[dateKey] || [];
    
    // Filter inspections to only those for assets matching THIS task
    const inspections = matchingAssetIds.length > 0 
      ? allInspections.filter(inspection => matchingAssetIds.includes(inspection.assetId))
      : allInspections; // Fallback if assets not loaded
    
    // Calculate status based on THIS task's inspections only
    let statusClass = 'pending';
    let statusText = 'Pending';
    let inspectionCount = 0;
    let hasFault = false;
    
    // FIRST: Check if date is in the future (upcoming dates should not be clickable)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    const isUpcomingDate = dateOnly > today;
    
    if (isUpcomingDate) {
      // If date is upcoming, mark as upcoming and don't count inspections
      statusClass = 'upcoming';
      statusText = 'Upcoming';
      inspectionCount = 0;
    } else if (inspections.length > 0) {
      // Only process inspections for past/today dates
      inspectionCount = inspections.length;
      const faultInspections = inspections.filter(i => i.status === 'fault' || i.status === 'abnormal');
      const completeInspections = inspections.filter(i => i.inspectionStatus === 'complete');
      const normalInspections = inspections.filter(i => i.status === 'normal' || (i.status !== 'fault' && i.status !== 'abnormal'));
      
      // Priority 1: If ANY inspection has fault, show RED (regardless of completion status)
      if (faultInspections.length > 0) {
        statusClass = 'fault';
        statusText = 'Fault';
        hasFault = true;
      } 
      // Priority 2: If ALL inspections are complete AND all are normal, show GREEN
      else if (completeInspections.length === inspections.length && normalInspections.length === inspections.length && inspections.length > 0) {
        statusClass = 'complete';
        statusText = 'Complete';
      } 
      // Otherwise: Pending/In Progress
      else {
        statusClass = 'pending';
        statusText = 'In Progress';
      }
    } else {
      // No inspections and not upcoming - show as pending
      statusClass = 'pending';
      statusText = 'Pending';
    }
    
    scheduledDatesMap[dateKey] = {
      statusClass,
      statusText,
      inspectionCount,
      hasFault,
      date
    };
  });
  
  // Generate calendar grid
  let calendarRows = [];
  let currentRow = [];
  
  // Empty cells for days before month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    currentRow.push('<td class="calendar-day empty"></td>');
  }
  
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month, day);
    const dateKey = formatDateForStorage(currentDate);
    const scheduledDate = scheduledDatesMap[dateKey];
    
    let cellHTML = '';
    if (scheduledDate) {
      // This date is scheduled - only make it clickable if it's not upcoming
      const isUpcoming = scheduledDate.statusClass === 'upcoming';
      const clickHandler = isUpcoming ? '' : `onclick="viewInspectionDetails('${dateKey}')"`;
      const cursorStyle = isUpcoming ? 'style="cursor: not-allowed;"' : '';
      cellHTML = `
        <td class="calendar-day scheduled ${scheduledDate.statusClass}" ${clickHandler} ${cursorStyle}>
          <div class="calendar-day-number">${day}</div>
          <div class="calendar-day-status">
            <span class="status-indicator ${scheduledDate.statusClass}"></span>
          </div>
          ${scheduledDate.inspectionCount > 0 ? `<div class="calendar-day-count">${scheduledDate.inspectionCount}</div>` : ''}
        </td>
      `;
    } else {
      // Regular day (not scheduled)
      cellHTML = `
        <td class="calendar-day">
          <div class="calendar-day-number">${day}</div>
        </td>
      `;
    }
    
    currentRow.push(cellHTML);
    
    // If we've filled a week (7 days), start a new row
    if (currentRow.length === 7) {
      calendarRows.push(`<tr>${currentRow.join('')}</tr>`);
      currentRow = [];
    }
  }
  
  // Fill remaining cells to complete the last week
  if (currentRow.length > 0) {
    while (currentRow.length < 7) {
      currentRow.push('<td class="calendar-day empty"></td>');
    }
    calendarRows.push(`<tr>${currentRow.join('')}</tr>`);
  }
  
  return `
    <div class="calendar-month">
      <div class="calendar-month-header">
        <h3>${monthNames[month]} ${year}</h3>
      </div>
      <table class="calendar-table">
        <thead>
          <tr>
            ${dayNames.map(day => `<th class="calendar-weekday">${day}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${calendarRows.join('')}
        </tbody>
      </table>
    </div>
  `;
}

// View inspection details for a specific date
window.viewInspectionDetails = function(dateKey) {
  const inspections = window.inspectionDataByDate?.[dateKey] || [];
  const date = new Date(dateKey);
  const dateStr = formatDateForDisplay(date);
  
  // Load assets for this task to show all assets (inspected and not inspected)
  loadAssetsForDate(dateKey, inspections, dateStr);
};

// Load assets for a specific date and display inspection details
async function loadAssetsForDate(dateKey, inspections, dateStr) {
  const assetsTableWrapper = document.getElementById('assets-table-wrapper');
  if (!assetsTableWrapper) {
    return;
  }
  
  // Show loading
  assetsTableWrapper.innerHTML = '<div class="loading">Loading inspection details...</div>';
  
  try {
    // Load all assets for this task
    const resp = await fetch('/api/assets/list');
    const data = await resp.json();
    
    if (resp.ok && data.ok && data.assets) {
      // Filter assets where locationDescription matches taskName
      const matchingAssets = data.assets.filter(asset => {
        const assetLocation = asset.locationDescription || '';
        return assetLocation.trim() === currentTaskText.trim();
      });
      
      // Create a map of assetId -> inspection for this date
      // Ensure status field is properly set (normalize 'abnormal' to 'fault')
      const inspectionMap = {};
      inspections.forEach(inspection => {
        if (inspection.assetId) {
          // Debug: Log the inspection object to see what fields are available
          console.log(`Inspection for ${inspection.assetId}:`, {
            status: inspection.status,
            inspectionStatus: inspection.inspectionStatus,
            assetId: inspection.assetId,
            fullObject: inspection
          });
          
          // Normalize status field: 'abnormal' -> 'fault', ensure it's set
          // The status field should come from the MaintenanceAsset document
          // Only normalize if inspectionStatus is 'complete', otherwise keep as is
          const normalizedInspection = {
            ...inspection,
            status: inspection.status === 'abnormal' ? 'fault' : (inspection.status || 'normal')
          };
          inspectionMap[inspection.assetId] = normalizedInspection;
        }
      });
      
      // Display inspection details
      displayInspectionDetailsForDate(matchingAssets, inspectionMap, dateKey, dateStr);
      } else {
      assetsTableWrapper.innerHTML = `
        <div class="no-assets">
          <p>Failed to load assets.</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading assets:', error);
    assetsTableWrapper.innerHTML = `
      <div class="no-assets">
        <p>Error loading assets: ${error.message}</p>
      </div>
    `;
  }
}

// Display inspection details for a specific date
function displayInspectionDetailsForDate(assets, inspectionMap, dateKey, dateStr) {
  const assetsTableWrapper = document.getElementById('assets-table-wrapper');
  if (!assetsTableWrapper) {
    return;
  }
  
  if (assets.length === 0) {
    assetsTableWrapper.innerHTML = `
      <div class="no-assets">
        <p>No assets found for this inspection task.</p>
      </div>
    `;
    return;
  }
  
  const table = document.createElement('table');
  table.className = 'assets-table';
  
  table.innerHTML = `
    <thead>
      <tr>
        <th colspan="5" style="text-align: center; padding: 1rem; background: #f9fafb;">
          <div style="display: flex; justify-content: center; align-items: center;">
            <div>
              <strong>Inspection Date: ${dateStr}</strong>
            </div>
          </div>
        </th>
      </tr>
      <tr>
        <th>Asset ID</th>
        <th>Asset Description</th>
        <th>Inspection Status</th>
        <th>Fault Condition</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>
      ${assets.map(asset => {
        const inspection = inspectionMap[asset.assetId];
        const inspectionStatus = inspection?.inspectionStatus || 'pending';
        
        // Determine inspection status display
        let statusClass = inspectionStatus === 'complete' ? 'complete' : 'pending';
        let statusText = inspectionStatus === 'complete' ? 'Complete' : 'Pending';
        
        // Determine fault condition display:
        // - If no inspection exists, show "Pending"
        // - If inspection exists and status is 'fault' or 'abnormal', show "Fault"
        // - If inspection exists and status is 'normal' or missing, show "Normal"
        let faultClass, faultText;
        if (!inspection || inspectionStatus === 'pending' || inspectionStatus === 'open') {
          // No inspection yet or inspection not complete
          faultClass = 'pending';
          faultText = 'Pending';
        } else {
          // Inspection exists - check the status field
          // IMPORTANT: Read the status field directly from inspection object
          const faultStatus = inspection.status;
          
          // Debug: Log what we're reading for display
          console.log(`Displaying fault condition for ${asset.assetId}:`, {
            inspectionExists: !!inspection,
            inspectionStatus: inspectionStatus,
            faultStatus: faultStatus,
            inspectionStatusField: inspection?.inspectionStatus,
            statusField: inspection?.status,
            fullInspection: inspection
          });
          
          if (faultStatus === 'fault' || faultStatus === 'abnormal') {
            faultClass = 'fault';
            faultText = 'Fault';
          } else if (faultStatus === 'normal') {
            faultClass = 'normal';
            faultText = 'Normal';
          } else {
            // If status is missing or unexpected, default to normal
            console.warn(`Unexpected status value for ${asset.assetId}:`, faultStatus);
            faultClass = 'normal';
            faultText = 'Normal';
          }
        }
        
        // Build URL for view more button (staff version - no underscore)
        // Include taskText so the back button knows which task to return to
        const viewMoreUrl = `inspectionassetdetails.html?assetId=${encodeURIComponent(asset.assetId || '')}&maintenanceId=${encodeURIComponent(maintenanceId || '')}&taskText=${encodeURIComponent(currentTaskText || '')}`;
        
        return `
          <tr>
            <td>${escapeHtml(asset.assetId || '-')}</td>
            <td>${escapeHtml(asset.assetDescription || '-')}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td><span class="status-badge ${faultClass}">${faultText}</span></td>
            <td>
              <a href="${viewMoreUrl}" class="view-more-btn" style="display: inline-block; padding: 0.4rem 0.8rem; background: #140958; color: white; text-decoration: none; border-radius: 6px; font-size: 0.875rem; font-weight: 600; transition: all 0.2s;">
                View More
              </a>
            </td>
          </tr>
        `;
      }).join('')}
    </tbody>
  `;
  
  assetsTableWrapper.innerHTML = '';
  assetsTableWrapper.appendChild(table);
}

// Helper functions
function formatDateForStorage(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
}

function formatDateForDisplay(date) {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Load assets based on locationDescription matching taskName (kept for backward compatibility)
async function loadAssets() {
  try {
    if (!currentTaskText || currentTaskText.trim() === '') {
      console.warn('No task name available, cannot load assets by locationDescription');
      maintenanceAssets = [];
      displayAssets();
      return;
    }
    
    console.log(`Loading assets where locationDescription = "${currentTaskText}"`);
    
    // Load all assets and filter by locationDescription
    const resp = await fetch('/api/assets/list');
    const data = await resp.json();

    if (resp.ok && data.ok && data.assets) {
      // Filter assets where locationDescription matches taskName
      const matchingAssets = data.assets.filter(asset => {
        const assetLocation = asset.locationDescription || '';
        return assetLocation.trim() === currentTaskText.trim();
      });
      
      console.log(`Found ${matchingAssets.length} asset(s) with locationDescription="${currentTaskText}"`);
      
      // Also get inspection status from maintenance_assets if they exist
      if (matchingAssets.length > 0 && maintenanceId) {
        try {
          const maintenanceAssetsResp = await fetch(`/api/maintenance/assets?maintenanceId=${encodeURIComponent(maintenanceId)}`);
          const maintenanceAssetsData = await maintenanceAssetsResp.json();
          
          if (maintenanceAssetsResp.ok && maintenanceAssetsData.ok && maintenanceAssetsData.assets) {
            // Create a map of assetId -> inspection status
            const statusMap = {};
            maintenanceAssetsData.assets.forEach(ma => {
              if (ma.assetId) {
                statusMap[ma.assetId] = {
                  inspectionStatus: ma.inspectionStatus || 'open',
                  inspectionNotes: ma.inspectionNotes,
                  solved: ma.solved || false,
                  inspectionDate: ma.inspectionDate
                };
              }
            });
            
            // Merge inspection status into matching assets
            maintenanceAssets = matchingAssets.map(asset => ({
              ...asset,
              inspectionStatus: statusMap[asset.assetId]?.inspectionStatus || 'open',
              inspectionNotes: statusMap[asset.assetId]?.inspectionNotes || '',
              solved: statusMap[asset.assetId]?.solved || false,
              inspectionDate: statusMap[asset.assetId]?.inspectionDate || null
            }));
          } else {
            // No maintenance assets found, use default status
            maintenanceAssets = matchingAssets.map(asset => ({
              ...asset,
              inspectionStatus: 'open',
              inspectionNotes: '',
              solved: false,
              inspectionDate: null
            }));
          }
        } catch (error) {
          console.warn('Could not load inspection status, using defaults:', error);
          maintenanceAssets = matchingAssets.map(asset => ({
            ...asset,
            inspectionStatus: 'open',
            inspectionNotes: '',
            solved: false,
            inspectionDate: null
          }));
        }
      } else {
        maintenanceAssets = matchingAssets.map(asset => ({
          ...asset,
          inspectionStatus: 'open',
          inspectionNotes: '',
          solved: false,
          inspectionDate: null
        }));
      }
    } else {
      maintenanceAssets = [];
    }
    
    displayAssets();
  } catch (error) {
    console.error('Error loading assets:', error);
    maintenanceAssets = [];
    displayAssets();
  }
}

// Display assets in the table
function displayAssets() {
  const assetsTableWrapper = document.getElementById('assets-table-wrapper');
  if (!assetsTableWrapper) {
    console.error('assets-table-wrapper element not found');
    return;
  }

  // Clear the wrapper first
  assetsTableWrapper.innerHTML = '';

  if (!maintenanceAssets || maintenanceAssets.length === 0) {
    assetsTableWrapper.innerHTML = `
      <div class="no-assets">
        <p>No assets found with locationDescription matching "${escapeHtml(currentTaskText)}".</p>
        <p style="margin-top: 0.5rem; font-size: 0.875rem; color: #6b7280;">Assets are automatically displayed when their locationDescription matches the inspection task name.</p>
      </div>
    `;
    return;
  }

  const table = document.createElement('table');
  table.className = 'assets-table';
  
  table.innerHTML = `
    <thead>
      <tr>
        <th>Asset ID</th>
        <th>Asset Description</th>
        <th>Category</th>
        <th>Status</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>
      ${maintenanceAssets.map(asset => {
        if (!asset || !asset.assetId) {
          return ''; // Skip invalid assets
        }
        
        const inspectionStatus = asset.inspectionStatus || 'pending';
        let statusClass = 'pending';
        let statusText = 'Pending';
        
        if (inspectionStatus === 'complete') {
          statusClass = 'complete';
          statusText = 'Complete';
        } else if (inspectionStatus === 'upcoming') {
          statusClass = 'upcoming';
          statusText = 'Upcoming';
        } else {
          statusClass = 'pending';
          statusText = 'Pending';
        }
        
        const safeAssetId = escapeHtml(asset.assetId);
        
        return `
          <tr data-asset-id="${safeAssetId}">
            <td class="asset-id">${safeAssetId}</td>
            <td class="asset-description">${escapeHtml(asset.assetDescription || '-')}</td>
            <td class="asset-category">${escapeHtml(asset.assetCategoryDescription || asset.assetCategory || '-')}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
              <div class="action-buttons">
                <button class="btn-view-details action-btn" onclick="viewAssetDetails('${safeAssetId}')">View Details</button>
                <button class="btn-delete-asset" onclick="removeAsset('${safeAssetId}')">Delete</button>
              </div>
            </td>
          </tr>
        `;
      }).filter(row => row !== '').join('')}
    </tbody>
  `;
  
  assetsTableWrapper.appendChild(table);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// View asset details
function viewAssetDetails(assetId) {
  if (!assetId || !maintenanceId) return;
  // Navigate to inspection asset details page (staff version)
  const params = new URLSearchParams({
    assetId: assetId,
    maintenanceId: maintenanceId
  });
  window.location.href = `inspectionassetdetails.html?${params.toString()}`;
}

// Remove asset from maintenance
window.removeAsset = async function(assetId) {
  if (!assetId || !maintenanceId) {
    alert('Invalid asset or maintenance ID');
    return;
  }

  if (!confirm(`Are you sure you want to unlink this asset from the inspection task?\n\nNote: This asset will still appear because its locationDescription matches the task name, but it will be unlinked from maintenance tracking.`)) {
    return;
  }

  try {
    const resp = await fetch('/api/maintenance/remove-asset', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        maintenanceId: maintenanceId,
        assetId: assetId
      })
    });

    const data = await resp.json();

    if (!resp.ok || !data.ok) {
      alert(`Delete failed: ${data.error || 'Unknown error'}`);
      return;
    }

    // Remove the asset from the local array immediately for better UX
    maintenanceAssets = maintenanceAssets.filter(asset => asset.assetId !== assetId);
    
    // Update the display immediately
    displayAssets();
    
    // Then reload from server to ensure consistency
    await loadAssets();
  } catch (error) {
    console.error('Error removing asset:', error);
    alert(`Delete failed: ${error.message || 'Network error'}`);
    // Reload assets to restore correct state
    await loadAssets();
  }
};

// Staff version - Admin-only functions removed:
// - setupInspectionActions (Edit/Delete menu)
// - openEditMaintenanceModal
// - setupEditMaintenanceModal
// - saveEditMaintenance

// Close edit maintenance modal
// Staff version - Edit functions removed:
// - closeEditMaintenanceModal
// - generateScheduleCalendarForEdit
// - generateEditWeeklySchedule
// - generateEditMonthlySchedule
// - generateEditQuarterlySchedule

// Staff version - All edit functions removed (lines 1214-1939):
// Removed: generateEditWeeklySchedule, generateEditMonthlySchedule, generateEditQuarterlySchedule,
// createWeekElementEdit, createDateElementEdit, createQuarterDateElementEdit,
// addWeekToMonthEdit, addDateToMonthEdit, addDateToQuarterEdit,
// updateWeekNumbersEdit, updateAddButtonStateWeeklyEdit, updateAddButtonStateMonthlyEdit,
// updateAddButtonStateQuarterlyEdit, setupEditMaintenanceModal, saveEditMaintenance

// Asset detail navigation function (staff version)
function viewAssetDetails(assetId) {
  // Navigate to asset details page (staff version)
  const url = `inspectionassetdetails.html?assetId=${encodeURIComponent(assetId)}`;
  if (maintenanceId) {
    url += `&maintenanceId=${encodeURIComponent(maintenanceId)}`;
  }
  window.location.href = url;
}

// Staff version - All edit-related functions removed (admin-only features):
// Removed: generateEditWeeklySchedule, generateEditMonthlySchedule, generateEditQuarterlySchedule,
// createWeekElementEdit, createDateElementEdit, createQuarterDateElementEdit,
// addWeekToMonthEdit, addDateToMonthEdit, addDateToQuarterEdit,
// updateWeekNumbersEdit, updateAddButtonStateWeeklyEdit, updateAddButtonStateMonthlyEdit,
// updateAddButtonStateQuarterlyEdit, setupEditMaintenanceModal, saveEditMaintenance

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadTaskDetails();
  // Staff version - removed admin-only functions (setupInspectionActions, setupEditMaintenanceModal)
});
  yearDropdown.id = 'edit-schedule-year';
  for (let y = currentYear; y <= currentYear + 2; y++) {
    const option = document.createElement('option');
    option.value = y;
    option.textContent = y;
    if (y === currentYear) option.selected = true;
    yearDropdown.appendChild(option);
  }
  
  yearSelect.appendChild(yearLabel);
  yearSelect.appendChild(yearDropdown);
  scheduleCalendar.appendChild(yearSelect);
  
  const monthsDiv = document.createElement('div');
  monthsDiv.className = 'calendar-months';
  
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  
  months.forEach((month) => {
    const monthDiv = document.createElement('div');
    monthDiv.className = 'calendar-month';
    monthDiv.dataset.month = month;
    
    const monthHeader = document.createElement('div');
    monthHeader.className = 'calendar-month-header';
    
    const monthName = document.createElement('span');
    monthName.style.fontWeight = '600';
    monthName.style.color = '#374151';
    monthName.textContent = month;
    monthHeader.appendChild(monthName);
    
    const addWeekBtn = document.createElement('button');
    addWeekBtn.type = 'button';
    addWeekBtn.className = 'add-week-btn';
    addWeekBtn.textContent = '+';
    addWeekBtn.title = 'Add week';
    addWeekBtn.dataset.month = month;
    addWeekBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      addWeekToMonthEdit(month, monthDiv);
    });
    monthHeader.appendChild(addWeekBtn);
    
    monthDiv.appendChild(monthHeader);
    
    const weeksDiv = document.createElement('div');
    weeksDiv.className = 'calendar-weeks';
    weeksDiv.dataset.month = month;
    
    // Add existing weeks
    if (existingSchedule[month] && typeof existingSchedule[month] === 'object') {
      Object.keys(existingSchedule[month]).forEach((weekKey, idx) => {
        const weekNumber = idx + 1;
        const dateValue = existingSchedule[month][weekKey];
        const weekDiv = createWeekElementEdit(month, weekNumber, dateValue, weeksDiv);
        weeksDiv.appendChild(weekDiv);
      });
    }
    
    monthDiv.appendChild(weeksDiv);
    monthsDiv.appendChild(monthDiv);
    
    updateAddButtonStateWeeklyEdit(monthDiv);
  });
  
  scheduleCalendar.appendChild(monthsDiv);


// Generate monthly schedule for edit
function generateEditMonthlySchedule(existingSchedule) {
  const scheduleCalendar = document.getElementById('edit-schedule-calendar');
  const currentYear = new Date().getFullYear();
  
  // Year selector
  const yearSelect = document.createElement('div');
  yearSelect.className = 'calendar-year-selector';
  
  const yearLabel = document.createElement('label');
  yearLabel.textContent = 'Year: ';
  const yearDropdown = document.createElement('select');
  yearDropdown.id = 'edit-schedule-year';
  for (let y = currentYear; y <= currentYear + 2; y++) {
    const option = document.createElement('option');
    option.value = y;
    option.textContent = y;
    if (y === currentYear) option.selected = true;
    yearDropdown.appendChild(option);
  }
  
  yearSelect.appendChild(yearLabel);
  yearSelect.appendChild(yearDropdown);
  scheduleCalendar.appendChild(yearSelect);
  
  const monthsDiv = document.createElement('div');
  monthsDiv.className = 'calendar-months';
  
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  
  months.forEach((month) => {
    const monthDiv = document.createElement('div');
    monthDiv.className = 'calendar-month';
    monthDiv.dataset.month = month;
    
    const monthHeader = document.createElement('div');
    monthHeader.className = 'calendar-month-header';
    
    const monthName = document.createElement('span');
    monthName.style.fontWeight = '600';
    monthName.style.color = '#374151';
    monthName.textContent = month;
    monthHeader.appendChild(monthName);
    
    const addDateBtn = document.createElement('button');
    addDateBtn.type = 'button';
    addDateBtn.className = 'add-week-btn';
    addDateBtn.textContent = '+';
    addDateBtn.title = 'Add date';
    addDateBtn.dataset.month = month;
    addDateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      addDateToMonthEdit(month, monthDiv);
    });
    monthHeader.appendChild(addDateBtn);
    
    monthDiv.appendChild(monthHeader);
    
    const datesDiv = document.createElement('div');
    datesDiv.className = 'calendar-weeks';
    datesDiv.dataset.month = month;
    
    // Add existing date
    if (existingSchedule[month]) {
      const dateDiv = createDateElementEdit(month, existingSchedule[month], datesDiv);
      datesDiv.appendChild(dateDiv);
    }
    
    monthDiv.appendChild(datesDiv);
    monthsDiv.appendChild(monthDiv);
    
    updateAddButtonStateMonthlyEdit(monthDiv);
  });
  
  scheduleCalendar.appendChild(monthsDiv);
}

// Generate quarterly schedule for edit
function generateEditQuarterlySchedule(existingSchedule) {
  const scheduleCalendar = document.getElementById('edit-schedule-calendar');
  const currentYear = new Date().getFullYear();
  
  // Year selector
  const yearSelect = document.createElement('div');
  yearSelect.className = 'calendar-year-selector';
  
  const yearLabel = document.createElement('label');
  yearLabel.textContent = 'Year: ';
  const yearDropdown = document.createElement('select');
  yearDropdown.id = 'edit-schedule-year';
  for (let y = currentYear; y <= currentYear + 2; y++) {
    const option = document.createElement('option');
    option.value = y;
    option.textContent = y;
    if (y === currentYear) option.selected = true;
    yearDropdown.appendChild(option);
  }
  
  yearSelect.appendChild(yearLabel);
  yearSelect.appendChild(yearDropdown);
  scheduleCalendar.appendChild(yearSelect);
  
  const quartersContainer = document.createElement('div');
  quartersContainer.className = 'calendar-quarters';
  
  const quarters = ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)'];
  
  quarters.forEach((quarter) => {
    const quarterDiv = document.createElement('div');
    quarterDiv.className = 'calendar-quarter';
    quarterDiv.dataset.quarter = quarter;
    
    const quarterHeader = document.createElement('div');
    quarterHeader.className = 'calendar-quarter-header';
    quarterHeader.textContent = quarter;
    quarterDiv.appendChild(quarterHeader);
    
    const addDateBtn = document.createElement('button');
    addDateBtn.type = 'button';
    addDateBtn.className = 'add-week-btn';
    addDateBtn.textContent = '+';
    addDateBtn.title = 'Add date';
    addDateBtn.dataset.quarter = quarter;
    addDateBtn.style.marginTop = '0.5rem';
    addDateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      addDateToQuarterEdit(quarter, quarterDiv);
    });
    quarterDiv.appendChild(addDateBtn);
    
    const datesDiv = document.createElement('div');
    datesDiv.className = 'calendar-weeks';
    datesDiv.dataset.quarter = quarter;
    datesDiv.style.marginTop = '0.5rem';
    
    // Add existing date
    if (existingSchedule[quarter]) {
      const dateDiv = createQuarterDateElementEdit(quarter, existingSchedule[quarter], datesDiv);
      datesDiv.appendChild(dateDiv);
    }
    
    quarterDiv.appendChild(datesDiv);
    quartersContainer.appendChild(quarterDiv);
    
    updateAddButtonStateQuarterlyEdit(quarterDiv);
  });
  
  scheduleCalendar.appendChild(quartersContainer);
}

// Helper functions for edit calendar (following add maintenance template)
function createWeekElementEdit(month, weekNumber, existingDate, weeksDiv) {
  const weekDiv = document.createElement('div');
  weekDiv.className = 'calendar-week';
  weekDiv.dataset.week = weekNumber;
  
  const weekLabel = document.createElement('div');
  weekLabel.className = 'calendar-week-label';
  weekLabel.textContent = `Week ${weekNumber}:`;
  weekDiv.appendChild(weekLabel);
  
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.className = 'calendar-date-input';
  dateInput.name = `schedule[${month}][Week${weekNumber}]`;
  if (existingDate) {
    dateInput.value = existingDate;
  }
  
  // Set min date to today (only future dates editable)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dateInput.min = today.toISOString().split('T')[0];
  
  // Disable if past date
  if (existingDate && new Date(existingDate) < today) {
    dateInput.disabled = true;
    dateInput.style.opacity = '0.6';
    dateInput.style.cursor = 'not-allowed';
  }
  
  weekDiv.appendChild(dateInput);
  
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-week-btn';
  removeBtn.textContent = '×';
  removeBtn.title = 'Remove week';
  
  // Always allow removing dates (even past dates can be removed)
  removeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    weekDiv.remove();
    updateWeekNumbersEdit(weeksDiv);
    const monthDiv = weeksDiv.closest('.calendar-month');
    if (monthDiv) {
      updateAddButtonStateWeeklyEdit(monthDiv);
    }
  });
  
  weekDiv.appendChild(removeBtn);
  
  return weekDiv;
}

function createDateElementEdit(month, existingDate, datesDiv) {
  const dateDiv = document.createElement('div');
  dateDiv.className = 'calendar-week';
  
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.className = 'calendar-date-input';
  dateInput.name = `schedule[${month}]`;
  dateInput.style.width = '100%';
  if (existingDate) {
    dateInput.value = existingDate;
  }
  
  // Set min date to today (only future dates editable)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dateInput.min = today.toISOString().split('T')[0];
  
  // Disable if past date
  if (existingDate && new Date(existingDate) < today) {
    dateInput.disabled = true;
    dateInput.style.opacity = '0.6';
    dateInput.style.cursor = 'not-allowed';
  }
  
  dateDiv.appendChild(dateInput);
  
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-week-btn';
  removeBtn.textContent = '×';
  removeBtn.title = 'Remove date';
  
  // Always allow removing dates (even past dates can be removed)
  removeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dateDiv.remove();
    const monthDiv = datesDiv.closest('.calendar-month');
    if (monthDiv) {
      updateAddButtonStateMonthlyEdit(monthDiv);
    }
  });
  
  dateDiv.appendChild(removeBtn);
  
  return dateDiv;
}

function createQuarterDateElementEdit(quarter, existingDate, datesDiv) {
  const dateDiv = document.createElement('div');
  dateDiv.className = 'calendar-week';
  
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.className = 'calendar-date-input';
  dateInput.name = `schedule[${quarter}]`;
  dateInput.style.width = '100%';
  if (existingDate) {
    dateInput.value = existingDate;
  }
  
  // Set min date to today (only future dates editable)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dateInput.min = today.toISOString().split('T')[0];
  
  // Disable if past date
  if (existingDate && new Date(existingDate) < today) {
    dateInput.disabled = true;
    dateInput.style.opacity = '0.6';
    dateInput.style.cursor = 'not-allowed';
  }
  
  dateDiv.appendChild(dateInput);
  
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-week-btn';
  removeBtn.textContent = '×';
  removeBtn.title = 'Remove date';
  
  // Always allow removing dates (even past dates can be removed)
  removeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dateDiv.remove();
    const quarterDiv = datesDiv.closest('.calendar-quarter');
    if (quarterDiv) {
      updateAddButtonStateQuarterlyEdit(quarterDiv);
    }
  });
  
  dateDiv.appendChild(removeBtn);
  
  return dateDiv;
}

function addWeekToMonthEdit(month, monthDiv) {
  const weeksDiv = monthDiv.querySelector('.calendar-weeks');
  if (!weeksDiv) return;
  
  const existingWeeks = weeksDiv.querySelectorAll('.calendar-week');
  const weekNumber = existingWeeks.length + 1;
  
  if (weekNumber > 4) {
    alert('Maximum 4 weeks per month allowed');
    return;
  }
  
  const weekDiv = createWeekElementEdit(month, weekNumber, null, weeksDiv);
  weeksDiv.appendChild(weekDiv);
  updateAddButtonStateWeeklyEdit(monthDiv);
}

function addDateToMonthEdit(month, monthDiv) {
  const datesDiv = monthDiv.querySelector('.calendar-weeks');
  if (!datesDiv) return;
  
  const existingDates = datesDiv.querySelectorAll('.calendar-week');
  
  if (existingDates.length >= 1) {
    alert('Maximum 1 date per month allowed');
    return;
  }
  
  const dateDiv = createDateElementEdit(month, null, datesDiv);
  datesDiv.appendChild(dateDiv);
  updateAddButtonStateMonthlyEdit(monthDiv);
}

function addDateToQuarterEdit(quarter, quarterDiv) {
  const datesDiv = quarterDiv.querySelector('.calendar-weeks');
  if (!datesDiv) return;
  
  const existingDates = datesDiv.querySelectorAll('.calendar-week');
  
  if (existingDates.length >= 1) {
    alert('Maximum 1 date per quarter allowed');
    return;
  }
  
  const dateDiv = createQuarterDateElementEdit(quarter, null, datesDiv);
  datesDiv.appendChild(dateDiv);
  updateAddButtonStateQuarterlyEdit(quarterDiv);
}

function updateWeekNumbersEdit(weeksDiv) {
  const weeks = weeksDiv.querySelectorAll('.calendar-week');
  weeks.forEach((weekDiv, index) => {
    const weekNumber = index + 1;
    weekDiv.dataset.week = weekNumber;
    const weekLabel = weekDiv.querySelector('.calendar-week-label');
    if (weekLabel) {
      weekLabel.textContent = `Week ${weekNumber}:`;
    }
    const dateInput = weekDiv.querySelector('.calendar-date-input');
    if (dateInput) {
      const month = weeksDiv.dataset.month;
      dateInput.name = `schedule[${month}][Week${weekNumber}]`;
    }
  });
}

function updateAddButtonStateWeeklyEdit(monthDiv) {
  const addBtn = monthDiv.querySelector('.add-week-btn');
  const weeksDiv = monthDiv.querySelector('.calendar-weeks');
  if (addBtn && weeksDiv) {
    const existingWeeks = weeksDiv.querySelectorAll('.calendar-week');
    addBtn.disabled = existingWeeks.length >= 4;
  }
}

function updateAddButtonStateMonthlyEdit(monthDiv) {
  const addBtn = monthDiv.querySelector('.add-week-btn');
  const datesDiv = monthDiv.querySelector('.calendar-weeks');
  if (addBtn && datesDiv) {
    const existingDates = datesDiv.querySelectorAll('.calendar-week');
    addBtn.disabled = existingDates.length >= 1;
  }
}

function updateAddButtonStateQuarterlyEdit(quarterDiv) {
  const addBtn = quarterDiv.querySelector('.add-week-btn');
  const datesDiv = quarterDiv.querySelector('.calendar-weeks');
  if (addBtn && datesDiv) {
    const existingDates = datesDiv.querySelectorAll('.calendar-week');
    addBtn.disabled = existingDates.length >= 1;
  }
}

// Setup edit maintenance modal
function setupEditMaintenanceModal() {
  const closeBtn = document.getElementById('close-edit-maintenance-modal-btn');
  const cancelBtn = document.getElementById('cancel-edit-maintenance-btn');
  const saveBtn = document.getElementById('save-edit-maintenance-btn');
  const editForm = document.getElementById('edit-maintenance-form');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', closeEditMaintenanceModal);
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeEditMaintenanceModal);
  }
  
  // Close modal when clicking outside
  const modal = document.getElementById('edit-maintenance-modal-overlay');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeEditMaintenanceModal();
      }
    });
  }
  
  if (editForm) {
    editForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveEditMaintenance();
    });
  }
  
  if (saveBtn) {
    saveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      saveEditMaintenance();
    });
  }
}

// Save edit maintenance
async function saveEditMaintenance() {
  if (!maintenanceId || !currentMaintenance) {
    alert('Maintenance information is missing');
    return;
  }
  
  const updateData = {};
  
  // Get inspection task update
  const taskTextInput = document.getElementById('edit-task-text');
  const newTaskText = taskTextInput?.value.trim() || '';
  
  if (!newTaskText) {
    alert('Inspection task is required');
    return;
  }
  
  // Get current inspection tasks
  const currentTasks = (currentMaintenance.inspectionTasks || '').split('\n').filter(t => t.trim());
  
  // Find the index of the current task
  const taskIndex = parseInt(urlParams.get('taskIndex')) || 0;
  
  // Update the task at the specified index
  if (taskIndex >= 0 && taskIndex < currentTasks.length) {
    currentTasks[taskIndex] = newTaskText;
  } else {
    // If index is invalid, just replace all or append
    currentTasks[0] = newTaskText;
  }
  
  updateData.inspectionTasks = currentTasks.join('\n');
  
  // Get calendar/schedule update
  const scheduleCalendar = document.getElementById('edit-schedule-calendar');
  if (scheduleCalendar) {
    const scheduleData = {};
    const frequency = currentMaintenance.frequency || 'Weekly';
    
    // For weekly frequency, rebuild the entire month structure to handle deletions properly
    if (frequency === 'Weekly') {
      const monthDivs = scheduleCalendar.querySelectorAll('[data-month]');
      monthDivs.forEach(monthDiv => {
        const month = monthDiv.dataset.month;
        const weeksDiv = monthDiv.querySelector('.calendar-weeks');
        if (weeksDiv) {
          const weekInputs = weeksDiv.querySelectorAll('.calendar-date-input');
          if (weekInputs.length > 0) {
            scheduleData[month] = {};
            
            // Only add weeks that have values (handles deletions)
            weekInputs.forEach(input => {
              if (input.value) {
                const nameParts = input.name.match(/schedule\[(.*?)\]\[(.*?)\]/);
                if (nameParts && nameParts[2]) {
                  const weekKey = nameParts[2]; // e.g., "Week1"
                  let dateValue = input.value;
                  if (dateValue.includes('T')) {
                    dateValue = dateValue.split('T')[0];
                  }
                  scheduleData[month][weekKey] = dateValue;
                }
              }
            });
            
            // If month has no weeks with values, don't include it
            if (Object.keys(scheduleData[month]).length === 0) {
              delete scheduleData[month];
            }
          }
        }
      });
    } else {
      // For Monthly and Quarterly, use the original logic
    const scheduleInputs = scheduleCalendar.querySelectorAll('[name^="schedule"]');
    
    scheduleInputs.forEach(input => {
        if (input.value) {
          // Normalize date to YYYY-MM-DD format (remove time if present)
          let dateValue = input.value;
          if (dateValue.includes('T')) {
            dateValue = dateValue.split('T')[0];
          }
          
        const nameParts = input.name.match(/schedule\[(.*?)\](?:\[(.*?)\])?/);
        if (nameParts) {
          const key1 = nameParts[1];
          const key2 = nameParts[2];
          if (key2) {
            // Weekly: schedule[January][Week1]
            if (!scheduleData[key1]) scheduleData[key1] = {};
              scheduleData[key1][key2] = dateValue;
          } else {
            // Monthly/Quarterly: schedule[January] or schedule[Q1 (Jan-Mar)]
              scheduleData[key1] = dateValue;
            }
          }
        }
      });
    }
    
    // DO NOT save to maintenanceSchedule - each task has its own schedule in inspection_tasks collection
    // updateData.maintenanceSchedule = scheduleData; // REMOVED - tasks have individual schedules
    
    console.log('Collected schedule data from edit form:', JSON.stringify(scheduleData, null, 2));
    
    // ALWAYS save to inspection_tasks collection (this is the single source of truth for task schedules)
    // This ensures the schedule is available in both checklist and task detail pages
    if (scheduleData && Object.keys(scheduleData).length > 0) {
      try {
        const taskResponse = await fetch('/api/maintenance/inspection-task', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            maintenanceId: maintenanceId,
            taskName: newTaskText || currentTaskText,
            schedule: scheduleData
          })
        });
        
        if (taskResponse.ok) {
          const taskData = await taskResponse.json();
          if (taskData.ok) {
            console.log('✓ Schedule also saved to inspection_tasks collection');
            console.log('Saved schedule:', JSON.stringify(scheduleData, null, 2));
          } else {
            console.warn('⚠ Could not save to inspection_tasks collection:', taskData.error);
          }
        } else {
          const errorText = await taskResponse.text();
          console.warn('⚠ Could not save to inspection_tasks collection, HTTP status:', taskResponse.status, errorText);
        }
      } catch (error) {
        console.warn('⚠ Error saving to inspection_tasks collection:', error);
        // Don't fail the whole update if this fails
      }
    } else {
      console.log('No schedule data to save (empty or all deleted)');
      // If schedule is empty, still try to save null to clear it
      try {
        const taskResponse = await fetch('/api/maintenance/inspection-task', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            maintenanceId: maintenanceId,
            taskName: newTaskText || currentTaskText,
            schedule: null
          })
        });
        if (taskResponse.ok) {
          console.log('✓ Cleared schedule in inspection_tasks collection');
        }
      } catch (error) {
        console.warn('⚠ Error clearing schedule:', error);
      }
    }
  }
  
  try {
    const response = await fetch('/api/maintenance/update', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        maintenanceId: maintenanceId,
        ...updateData
      })
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.ok) {
      alert(`Update failed: ${data.error || 'Unknown error'}`);
      return;
    }
    
    // Update local state
    currentTaskText = newTaskText;
    currentMaintenance.inspectionTasks = updateData.inspectionTasks;
    
    // Update the task schedule in local state (from inspection_tasks collection, not maintenanceSchedule)
    if (scheduleData && Object.keys(scheduleData).length > 0) {
      currentTaskSchedule = scheduleData;
    } else {
      currentTaskSchedule = null;
    }
    
    // Update UI
    const taskTitle = document.getElementById('task-title');
    if (taskTitle) {
      taskTitle.textContent = newTaskText;
    }
    
    alert('Maintenance updated successfully!');
    closeEditMaintenanceModal();
  } catch (error) {
    console.error('Error updating maintenance:', error);
    alert(`Update failed: ${error.message || 'Network error'}`);
  }
}

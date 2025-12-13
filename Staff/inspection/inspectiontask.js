// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const maintenanceId = urlParams.get('maintenanceId');
// Legacy support
const branch = urlParams.get('branch');
const location = urlParams.get('location');
const itemName = urlParams.get('itemName');

let currentMaintenance = null;
let tasks = []; // Array of {text: string, scheduledDate: string}

// Load maintenance details
async function loadMaintenanceDetails() {
  if (!maintenanceId && (!branch || !location || !itemName)) {
    document.body.innerHTML = '<div style="padding: 2rem; text-align: center;"><h1>Parameters Required</h1><p>Please provide maintenanceId in the URL.</p><a href="inspection.html">← Back to maintenance checklist</a></div>';
    return;
  }

  try {
    const url = maintenanceId 
      ? `../../admin/maintenance/get_maintenance.php?maintenanceId=${encodeURIComponent(maintenanceId)}`
      : `../../admin/maintenance/get_maintenance.php?branch=${encodeURIComponent(branch)}&location=${encodeURIComponent(location)}&itemName=${encodeURIComponent(itemName)}`;
    
    const resp = await fetch(url);
    const data = await resp.json();

    if (!resp.ok || !data.ok) {
      document.body.innerHTML = `<div style="padding: 2rem; text-align: center;"><h1>Maintenance Item Not Found</h1><p>${data.error || 'Could not load maintenance details.'}</p><a href="inspection.html">← Back to maintenance checklist</a></div>`;
      return;
    }

    currentMaintenance = data.maintenance;
    
    // Update URL with maintenanceId if using legacy parameters
    if (!maintenanceId && currentMaintenance._id) {
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('maintenanceId', currentMaintenance._id);
      newUrl.searchParams.delete('branch');
      newUrl.searchParams.delete('location');
      newUrl.searchParams.delete('itemName');
      window.history.replaceState({}, '', newUrl);
    }
    
    displayMaintenanceDetails(currentMaintenance);
    parseTasks(currentMaintenance.inspectionTasks || '');
    displayTasks();
  } catch (error) {
    console.error('Error loading maintenance:', error);
    document.body.innerHTML = `<div style="padding: 2rem; text-align: center;"><h1>Error</h1><p>Could not load maintenance details: ${error.message}</p><a href="inspection.html">← Back to maintenance checklist</a></div>`;
  }
}

// Display maintenance details in summary cards
function displayMaintenanceDetails(maintenance) {
  document.getElementById('summary-branch').textContent = maintenance.branch || '-';
  document.getElementById('summary-location').textContent = maintenance.location || '-';
  
  const itemNameEl = document.getElementById('summary-itemName');
  itemNameEl.textContent = maintenance.itemName || '-';
  
  const frequencyEl = document.getElementById('summary-frequency');
  const frequency = maintenance.frequency || '';
  const frequencyClass = frequency.toLowerCase();
  frequencyEl.innerHTML = `<span class="frequency-badge frequency-${frequencyClass}">${frequency || '-'}</span>`;
  
  // Note: Staff version doesn't display assigned staff info
}

// Parse inspection tasks from text (newline-separated) and link with schedule dates
function parseTasks(tasksText) {
  tasks = [];
  if (!tasksText) return;
  
  const lines = tasksText.split('\n').filter(line => line.trim());
  const scheduleDates = extractScheduleDates(currentMaintenance.maintenanceSchedule, currentMaintenance.frequency);
  
  lines.forEach((line, index) => {
    // Find next upcoming date from schedule for this task
    const nextDate = findNextScheduledDate(scheduleDates);
    
    tasks.push({
      id: index + 1,
      text: line.trim(),
      nextScheduledDate: nextDate,
      allScheduledDates: scheduleDates // Store all dates for "View more"
    });
  });
}

// Extract all dates from maintenanceSchedule based on frequency
function extractScheduleDates(schedule, frequency) {
  if (!schedule || typeof schedule !== 'object') return [];
  
  const dates = [];
  
  if (frequency === 'Weekly') {
    // schedule format: { "January": { "Week1": "2024-01-05", ... }, ... }
    Object.values(schedule).forEach(monthSchedule => {
      if (typeof monthSchedule === 'object') {
        Object.values(monthSchedule).forEach(dateStr => {
          if (dateStr) {
            const date = new Date(dateStr);
            if (date && !isNaN(date.getTime())) {
              dates.push(date);
            }
          }
        });
      }
    });
  } else if (frequency === 'Monthly') {
    // schedule format: { "January": "2024-01-15", "February": "2024-02-15", ... }
    Object.values(schedule).forEach(dateStr => {
      if (dateStr) {
        const date = new Date(dateStr);
        if (date && !isNaN(date.getTime())) {
          dates.push(date);
        }
      }
    });
  } else if (frequency === 'Quarterly') {
    // schedule format: { "Q1": { "January": "15", "February": "20", ... }, ... }
    const currentYear = new Date().getFullYear();
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    
    Object.entries(schedule).forEach(([quarter, quarterSchedule]) => {
      if (typeof quarterSchedule === 'object') {
        Object.entries(quarterSchedule).forEach(([monthName, dayStr]) => {
          if (dayStr) {
            const monthIndex = months.indexOf(monthName);
            if (monthIndex !== -1) {
              const day = parseInt(dayStr, 10);
              if (day >= 1 && day <= 31) {
                const date = new Date(currentYear, monthIndex, day);
                if (date && !isNaN(date.getTime())) {
                  dates.push(date);
                }
                // Also add for next year
                const dateNextYear = new Date(currentYear + 1, monthIndex, day);
                if (dateNextYear && !isNaN(dateNextYear.getTime())) {
                  dates.push(dateNextYear);
                }
              }
            }
          }
        });
      }
    });
  }
  
  // Sort dates ascending (includes past and future dates)
  dates.sort((a, b) => a - b);
  return dates;
}

// Find next scheduled date that hasn't passed
function findNextScheduledDate(scheduleDates) {
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Reset time to midnight for comparison
  
  for (const date of scheduleDates) {
    const scheduleDate = new Date(date);
    scheduleDate.setHours(0, 0, 0, 0);
    
    if (scheduleDate >= now) {
      return scheduleDate;
    }
  }
  
  // If no future date found, return the last date (or null)
  return scheduleDates.length > 0 ? scheduleDates[scheduleDates.length - 1] : null;
}

// Display tasks in the list
function displayTasks() {
  const tasksList = document.getElementById('tasks-list');
  if (!tasksList) return;
  
  tasksList.innerHTML = '';
  
  if (tasks.length === 0) {
    tasksList.innerHTML = '<li style="padding: 1.5rem; text-align: center; color: #888;">No inspection tasks defined</li>';
    return;
  }
  
  tasks.forEach(task => {
    const li = document.createElement('li');
    li.className = 'task-item';
    
    let daysRemainingHtml = '';
    
    if (task.nextScheduledDate) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const nextDate = new Date(task.nextScheduledDate);
      nextDate.setHours(0, 0, 0, 0);
      
      const diffTime = nextDate - now;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      let daysText = '';
      let daysColor = '#10b981'; // Default green
      
      if (diffDays < 0) {
        daysText = `Overdue by ${Math.abs(diffDays)} days`;
        daysColor = '#dc2626'; // Red for overdue
      } else if (diffDays === 0) {
        daysText = 'Due today';
        daysColor = '#f59e0b'; // Orange for today
      } else if (diffDays === 1) {
        daysText = 'Due tomorrow';
        daysColor = '#f59e0b'; // Orange for tomorrow
      } else if (diffDays <= 7) {
        daysText = `Due in ${diffDays} days`;
        daysColor = '#f59e0b'; // Orange for within 7 days
      } else {
        daysText = `Due in ${diffDays} days`;
        daysColor = '#10b981'; // Green for more than 7 days
      }
      
      daysRemainingHtml = `<div class="task-date" style="margin-top: 0.5rem; font-size: 0.875rem;">
        <span style="color: #6b7280;">Days remaining: </span>
        <span style="font-weight: 600; color: ${daysColor};">${daysText}</span>
      </div>`;
    }
    
    li.innerHTML = `
      <div class="task-number">${task.id}</div>
      <div style="flex: 1;">
        <div class="task-text">${task.text}</div>
        ${daysRemainingHtml}
      </div>
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <a href="inspectionasset.html?maintenanceId=${currentMaintenance._id || ''}" class="view-more-btn" style="text-decoration: none; display: inline-block;">
          View Assets
        </a>
      </div>
    `;
    
    tasksList.appendChild(li);
  });
}

// Initialize page
function init() {
  loadMaintenanceDetails();
  setupEventListeners();
}

// Setup all event listeners - Staff version doesn't include staff assignment
function setupEventListeners() {
  // Note: Staff version doesn't include edit/delete functionality
  // These buttons exist in HTML but are not functional for staff
}

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


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
    document.body.innerHTML = '<div style="padding: 2rem; text-align: center;"><h1>Parameters Required</h1><p>Please provide maintenanceId in the URL.</p><a href="maintenance.html">← Back to maintenance checklist</a></div>';
    return;
  }

  try {
    const url = maintenanceId 
      ? `./get_maintenance.php?maintenanceId=${encodeURIComponent(maintenanceId)}`
      : `./get_maintenance.php?branch=${encodeURIComponent(branch)}&location=${encodeURIComponent(location)}&itemName=${encodeURIComponent(itemName)}`;
    
    const resp = await fetch(url);
    const data = await resp.json();

    if (!resp.ok || !data.ok) {
      document.body.innerHTML = `<div style="padding: 2rem; text-align: center;"><h1>Maintenance Item Not Found</h1><p>${data.error || 'Could not load maintenance details.'}</p><a href="maintenance.html">← Back to maintenance checklist</a></div>`;
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
    document.body.innerHTML = `<div style="padding: 2rem; text-align: center;"><h1>Error</h1><p>Could not load maintenance details: ${error.message}</p><a href="maintenance.html">← Back to maintenance checklist</a></div>`;
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
  
  // Display assigned staff if exists
  displayAssignedStaff(maintenance);
}

// Display assigned staff information
function displayAssignedStaff(maintenance) {
  const assignedStaffDisplay = document.getElementById('assigned-staff-display');
  const assignedStaffName = document.getElementById('assigned-staff-name');
  
  if (maintenance.assignedStaffName) {
    assignedStaffName.textContent = maintenance.assignedStaffName;
    assignedStaffDisplay.style.display = 'block';
  } else {
    assignedStaffDisplay.style.display = 'none';
  }
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

// Find the next upcoming scheduled date
function findNextScheduledDate(dates) {
  if (!dates || dates.length === 0) return null;
  
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  // Find first date that's today or in the future
  for (const date of dates) {
    if (date >= now) {
      return date;
    }
  }
  
  // If no future dates, return the last date (past)
  return dates[dates.length - 1];
}

// Calculate days until date
function getDaysUntil(date) {
  if (!date) return null;
  
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  const diffTime = targetDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

// Display tasks in the list
function displayTasks() {
  const tasksList = document.getElementById('tasks-list');
  if (!tasksList) return;
  
  tasksList.innerHTML = '';
  
  if (tasks.length === 0) {
    tasksList.innerHTML = '<li class="no-tasks">No inspection tasks found. Click "Add Task" to create one.</li>';
    return;
  }
  
  tasks.forEach((task, index) => {
    const li = document.createElement('li');
    li.className = 'task-item';
    li.dataset.taskId = task.id;
    
    // Calculate days until next scheduled date
    const daysUntil = task.nextScheduledDate ? getDaysUntil(task.nextScheduledDate) : null;
    const nextDate = task.nextScheduledDate ? new Date(task.nextScheduledDate) : null;
    
    // Build countdown badge
    let countdownBadge = '';
    if (daysUntil !== null) {
      let badgeClass = 'task-countdown';
      let badgeText = '';
      
      if (daysUntil < 0) {
        badgeClass += ' overdue';
        badgeText = `${Math.abs(daysUntil)} day(s) overdue`;
      } else if (daysUntil === 0) {
        badgeClass += ' due-today';
        badgeText = 'Due today';
      } else if (daysUntil <= 7) {
        badgeClass += ' due-soon';
        badgeText = `${daysUntil} day(s) remaining`;
      } else {
        badgeClass += ' upcoming';
        badgeText = `${daysUntil} day(s) until`;
      }
      
      countdownBadge = `<div class="${badgeClass}">${badgeText}</div>`;
    }
    
    // Build date info
    const dateInfo = nextDate ? `
      <div class="task-date">
        <div class="task-date-info">
          <div class="task-date-label">Next Scheduled:</div>
          <div class="task-date-value">${nextDate.toLocaleDateString()}</div>
        </div>
        ${countdownBadge}
      </div>
    ` : `
      <div class="task-date">
        <span style="color: #6b7280; font-size: 0.85rem;">No date scheduled</span>
      </div>
    `;
    
    // Check if task has expanded details
    const isExpanded = task.expanded || false;
    const allDatesHtml = isExpanded && task.allScheduledDates && task.allScheduledDates.length > 0 ? `
      <div class="task-all-dates" style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e5e7eb;">
        <div class="task-date-label" style="margin-bottom: 0.5rem;">All Scheduled Dates:</div>
        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
          ${task.allScheduledDates.slice(0, 10).map(date => {
            const d = new Date(date);
            const days = getDaysUntil(date);
            return `<div style="font-size: 0.85rem; color: #374151;">
              ${d.toLocaleDateString()} 
              ${days !== null ? (days < 0 ? `(${Math.abs(days)} days ago)` : days === 0 ? '(Today)' : `(in ${days} days)`) : ''}
            </div>`;
          }).join('')}
          ${task.allScheduledDates.length > 10 ? `<div style="font-size: 0.8rem; color: #6b7280; font-style: italic;">... and ${task.allScheduledDates.length - 10} more</div>` : ''}
        </div>
      </div>
    ` : '';
    
    li.innerHTML = `
      <div class="task-number">${task.id}</div>
      <div style="flex: 1;">
        <div class="task-text">${task.text}</div>
        ${dateInfo}
        ${allDatesHtml}
      </div>
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <a href="maintenanceasset.html?maintenanceId=${currentMaintenance._id || ''}" class="view-more-btn" style="text-decoration: none; display: inline-block;">
          View Assets
        </a>
      </div>
    `;
    tasksList.appendChild(li);
  });
}

// Toggle task view (expand/collapse)
window.toggleTaskView = function(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    task.expanded = !task.expanded;
    displayTasks();
  }
};

// Open task actions menu
window.openTaskActions = function(taskId) {
  // Close all other menus
  document.querySelectorAll('.inspection-actions-menu').forEach(menu => {
    if (menu.id !== `task-actions-${taskId}`) {
      menu.classList.remove('open');
    }
  });
  
  const menu = document.getElementById(`task-actions-${taskId}`);
  if (menu) {
    menu.classList.toggle('open');
  }
};

// Edit task
window.editTask = function(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  
  // Close menu
  const menu = document.getElementById(`task-actions-${taskId}`);
  if (menu) menu.classList.remove('open');
  
  // For now, just edit the text via prompt (you can enhance this with a modal)
  const newText = prompt('Edit task:', task.text);
  if (newText !== null && newText.trim()) {
    task.text = newText.trim();
    displayTasks();
    updateMaintenanceTasks();
  }
};

// Delete task
window.deleteTask = function(taskId) {
  if (!confirm('Are you sure you want to delete this task?')) return;
  
  tasks = tasks.filter(t => t.id !== taskId);
  // Renumber tasks
  tasks.forEach((task, index) => {
    task.id = index + 1;
  });
  
  displayTasks();
  updateMaintenanceTasks();
};


// Add new task
function openAddTaskModal() {
  const modal = document.getElementById('add-task-modal-overlay');
  if (modal) {
    modal.classList.add('open');
  }
}

// Update maintenance tasks in database
async function updateMaintenanceTasks() {
  if (!currentMaintenance) return;
  
  const tasksText = tasks.map(t => t.text).join('\n');
  currentMaintenance.inspectionTasks = tasksText;
  
  try {
    const resp = await fetch('./update_maintenance.php', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        originalBranch: currentMaintenance.branch,
        originalLocation: currentMaintenance.location,
        originalItemName: currentMaintenance.itemName,
        ...currentMaintenance
      })
    });
    
    const data = await resp.json();
    if (!resp.ok || !data.ok) {
      console.error('Failed to update tasks:', data.error);
      alert('Failed to update tasks: ' + (data.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error updating tasks:', error);
    alert('Error updating tasks: ' + error.message);
  }
}

// Initialize page
function init() {
  loadMaintenanceDetails();
  setupEventListeners();
}

// Setup all event listeners
function setupEventListeners() {
  // Assign staff button
  const assignStaffBtn = document.getElementById('assign-staff-btn');
  if (assignStaffBtn) {
    assignStaffBtn.addEventListener('click', openAssignStaffModal);
  }
  
  // Close assign staff modal button
  const closeAssignStaffModalBtn = document.getElementById('close-assign-staff-modal-btn');
  if (closeAssignStaffModalBtn) {
    closeAssignStaffModalBtn.addEventListener('click', closeAssignStaffModal);
  }
  
  // Close assign staff modal when clicking outside
  const assignStaffModal = document.getElementById('assign-staff-modal-overlay');
  if (assignStaffModal) {
    assignStaffModal.addEventListener('click', (e) => {
      if (e.target === assignStaffModal) {
        closeAssignStaffModal();
      }
    });
  }
  
  // Add task button
  const addTaskBtn = document.getElementById('add-task-btn');
  if (addTaskBtn) {
    addTaskBtn.addEventListener('click', openAddTaskModal);
  }
  
  // Add task form
  const addTaskForm = document.getElementById('add-task-form');
  if (addTaskForm) {
    addTaskForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const taskText = document.getElementById('add-task-text').value.trim();
      
      if (!taskText) {
        alert('Please enter a task description');
        return;
      }
      
      // Use the same schedule dates from maintenance
      const scheduleDates = extractScheduleDates(currentMaintenance.maintenanceSchedule, currentMaintenance.frequency);
      const nextDate = findNextScheduledDate(scheduleDates);
      
      const newTask = {
        id: tasks.length + 1,
        text: taskText,
        nextScheduledDate: nextDate,
        allScheduledDates: scheduleDates
      };
      
      tasks.push(newTask);
      displayTasks();
      await updateMaintenanceTasks();
      
      // Close modal and reset form
      const modal = document.getElementById('add-task-modal-overlay');
      if (modal) modal.classList.remove('open');
      addTaskForm.reset();
    });
  }
  
  // Close add task modal
  const closeAddTaskBtn = document.getElementById('close-add-task-modal-btn');
  const cancelAddTaskBtn = document.getElementById('cancel-add-task-btn');
  const addTaskModal = document.getElementById('add-task-modal-overlay');
  
  if (closeAddTaskBtn) {
    closeAddTaskBtn.addEventListener('click', () => {
      if (addTaskModal) addTaskModal.classList.remove('open');
    });
  }
  
  if (cancelAddTaskBtn) {
    cancelAddTaskBtn.addEventListener('click', () => {
      if (addTaskModal) addTaskModal.classList.remove('open');
    });
  }
  
  if (addTaskModal) {
    addTaskModal.addEventListener('click', (e) => {
      if (e.target === addTaskModal) {
        addTaskModal.classList.remove('open');
      }
    });
  }
  
  // Inspection actions menu
  const inspectionActionsBtn = document.getElementById('inspection-actions-btn');
  const inspectionActionsMenu = document.getElementById('inspection-actions-menu');
  
  if (inspectionActionsBtn && inspectionActionsMenu) {
    inspectionActionsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      inspectionActionsMenu.classList.toggle('open');
    });
    
    document.addEventListener('click', (e) => {
      if (!inspectionActionsBtn.contains(e.target) && !inspectionActionsMenu.contains(e.target)) {
        inspectionActionsMenu.classList.remove('open');
      }
    });
  }
  
  // Edit maintenance button
  const editMaintenanceBtn = document.getElementById('edit-maintenance-btn');
  if (editMaintenanceBtn) {
    editMaintenanceBtn.addEventListener('click', () => {
      if (inspectionActionsMenu) inspectionActionsMenu.classList.remove('open');
      openEditMaintenanceModal();
    });
  }
  
  // Delete maintenance button
  const deleteMaintenanceBtn = document.getElementById('delete-maintenance-btn');
  if (deleteMaintenanceBtn) {
    deleteMaintenanceBtn.addEventListener('click', async () => {
      if (inspectionActionsMenu) inspectionActionsMenu.classList.remove('open');
      
      if (!confirm(`Are you sure you want to delete this maintenance item?\n\nBranch: ${currentMaintenance.branch}\nLocation: ${currentMaintenance.location}\nItem: ${currentMaintenance.itemName}\n\nThis action cannot be undone.`)) {
        return;
      }
      
      try {
        const resp = await fetch('./delete_maintenance.php', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            branch: currentMaintenance.branch,
            location: currentMaintenance.location,
            itemName: currentMaintenance.itemName
          })
        });
        
        const data = await resp.json();
        
        if (!resp.ok || !data.ok) {
          alert(`Delete failed: ${data.error || 'Unknown error'}`);
          return;
        }
        
        alert('Maintenance item deleted successfully!');
        window.location.href = 'maintenance.html';
      } catch (error) {
        console.error('Error deleting maintenance:', error);
        alert(`Delete failed: ${error.message || 'Network error'}`);
      }
    });
  }
  
  // Edit maintenance modal
  setupEditMaintenanceModal();
}

// Setup edit maintenance modal
function setupEditMaintenanceModal() {
  const editModal = document.getElementById('edit-modal-overlay');
  const editForm = document.getElementById('edit-maintenance-form');
  const closeEditBtn = document.getElementById('close-modal-btn');
  const cancelEditBtn = document.getElementById('cancel-edit-btn');
  
  function closeEditModal() {
    if (editModal) editModal.classList.remove('open');
  }
  
  if (closeEditBtn) {
    closeEditBtn.addEventListener('click', closeEditModal);
  }
  
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', closeEditModal);
  }
  
  if (editModal) {
    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) {
        closeEditModal();
      }
    });
  }
  
  // Frequency change handler
  const frequencySelect = document.getElementById('edit-frequency');
  const scheduleContainer = document.getElementById('edit-schedule-container');
  const scheduleCalendar = document.getElementById('edit-schedule-calendar');
  
  if (frequencySelect && scheduleContainer && scheduleCalendar) {
    frequencySelect.addEventListener('change', function() {
      const frequency = this.value;
      if (frequency) {
        scheduleContainer.style.display = 'block';
        generateEditScheduleCalendar(frequency, currentMaintenance.maintenanceSchedule);
      } else {
        scheduleContainer.style.display = 'none';
        scheduleCalendar.innerHTML = '';
      }
    });
  }
  
  // Form submit
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = Object.fromEntries(new FormData(editForm).entries());
      
      // Collect schedule data
      const scheduleData = {};
      if (scheduleCalendar) {
        const scheduleInputs = scheduleCalendar.querySelectorAll('[name^="schedule"]');
        scheduleInputs.forEach(input => {
          if (input.value) {
            const nameParts = input.name.match(/schedule\[(.*?)\](?:\[(.*?)\])?/);
            if (nameParts) {
              const key1 = nameParts[1];
              const key2 = nameParts[2];
              if (key2) {
                if (!scheduleData[key1]) scheduleData[key1] = {};
                scheduleData[key1][key2] = input.value;
              } else {
                scheduleData[key1] = input.value;
              }
            }
          }
        });
      }
      
      const updatedMaintenance = {
        originalBranch: currentMaintenance.branch,
        originalLocation: currentMaintenance.location,
        originalItemName: currentMaintenance.itemName,
        branch: formData.branch,
        location: formData.location,
        itemName: formData.itemName,
        frequency: formData.frequency,
        inspectionTasks: formData.inspectionTasks
      };
      
      if (Object.keys(scheduleData).length > 0) {
        updatedMaintenance.maintenanceSchedule = scheduleData;
      }
      
      try {
        const resp = await fetch('./update_maintenance.php', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(updatedMaintenance)
        });
        
        const data = await resp.json();
        
        if (!resp.ok || !data.ok) {
          alert(`Update failed: ${data.error || 'Unknown error'}`);
          return;
        }
        
        alert('Maintenance item updated successfully!');
        closeEditModal();
        // Reload page to reflect changes
        window.location.reload();
      } catch (error) {
        console.error('Error updating maintenance:', error);
        alert(`Update failed: ${error.message || 'Network error'}`);
      }
    });
  }
}

function openEditMaintenanceModal() {
  if (!currentMaintenance) return;
  
  const editModal = document.getElementById('edit-modal-overlay');
  const editForm = document.getElementById('edit-maintenance-form');
  const frequencySelect = document.getElementById('edit-frequency');
  const scheduleContainer = document.getElementById('edit-schedule-container');
  const scheduleCalendar = document.getElementById('edit-schedule-calendar');
  
  if (!editModal || !editForm) return;
  
  // Populate form
  document.getElementById('edit-branch').value = currentMaintenance.branch || '';
  document.getElementById('edit-location').value = currentMaintenance.location || '';
  document.getElementById('edit-itemName').value = currentMaintenance.itemName || '';
  document.getElementById('edit-frequency').value = currentMaintenance.frequency || '';
  document.getElementById('edit-inspectionTasks').value = currentMaintenance.inspectionTasks || '';
  
  // Show and populate calendar if frequency is set
  if (frequencySelect && currentMaintenance.frequency && scheduleContainer && scheduleCalendar) {
    scheduleContainer.style.display = 'block';
    generateEditScheduleCalendar(currentMaintenance.frequency, currentMaintenance.maintenanceSchedule);
  } else if (scheduleContainer) {
    scheduleContainer.style.display = 'none';
  }
  
  editModal.classList.add('open');
}

// Generate schedule calendar for edit modal
function generateEditScheduleCalendar(frequency, existingSchedule = null) {
  const scheduleCalendar = document.getElementById('edit-schedule-calendar');
  if (!scheduleCalendar) return;
  
  scheduleCalendar.innerHTML = '';
  
  if (frequency === 'Weekly') {
    generateEditWeeklySchedule(existingSchedule);
  } else if (frequency === 'Monthly') {
    generateEditMonthlySchedule(existingSchedule);
  } else if (frequency === 'Quarterly') {
    generateEditQuarterlySchedule(existingSchedule);
  }
}

function generateEditWeeklySchedule(existingSchedule) {
  const scheduleCalendar = document.getElementById('edit-schedule-calendar');
  const currentYear = new Date().getFullYear();
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
  
  months.forEach((month, index) => {
    const monthDiv = document.createElement('div');
    monthDiv.className = 'calendar-month';
    
    const monthHeader = document.createElement('div');
    monthHeader.className = 'calendar-month-header';
    monthHeader.textContent = month;
    monthDiv.appendChild(monthHeader);
    
    const weeksDiv = document.createElement('div');
    weeksDiv.className = 'calendar-weeks';
    
    const firstDay = new Date(currentYear, index, 1).getDay();
    const daysInMonth = new Date(currentYear, index + 1, 0).getDate();
    const weeks = Math.ceil((daysInMonth + firstDay) / 7);
    
    for (let week = 1; week <= weeks; week++) {
      const weekDiv = document.createElement('div');
      weekDiv.className = 'calendar-week';
      
      const weekLabel = document.createElement('div');
      weekLabel.className = 'calendar-week-label';
      weekLabel.textContent = `Week ${week}:`;
      
      const dateInput = document.createElement('input');
      dateInput.type = 'date';
      dateInput.className = 'calendar-date-input';
      dateInput.name = `schedule[${month}][Week${week}]`;
      
      // Populate existing value if available
      if (existingSchedule && existingSchedule[month] && existingSchedule[month][`Week${week}`]) {
        dateInput.value = existingSchedule[month][`Week${week}`];
      }
      
      weekDiv.appendChild(weekLabel);
      weekDiv.appendChild(dateInput);
      weeksDiv.appendChild(weekDiv);
    }
    
    monthDiv.appendChild(weeksDiv);
    monthsDiv.appendChild(monthDiv);
  });
  
  scheduleCalendar.appendChild(monthsDiv);
}

function generateEditMonthlySchedule(existingSchedule) {
  const scheduleCalendar = document.getElementById('edit-schedule-calendar');
  const currentYear = new Date().getFullYear();
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
  
  months.forEach((month, index) => {
    const monthDiv = document.createElement('div');
    monthDiv.className = 'calendar-month';
    
    const monthHeader = document.createElement('div');
    monthHeader.className = 'calendar-month-header';
    monthHeader.textContent = month;
    monthDiv.appendChild(monthHeader);
    
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'calendar-date-input';
    dateInput.name = `schedule[${month}]`;
    dateInput.style.width = '100%';
    dateInput.style.marginTop = '0.5rem';
    
    // Populate existing value if available
    if (existingSchedule && existingSchedule[month]) {
      dateInput.value = existingSchedule[month];
    }
    
    monthDiv.appendChild(dateInput);
    monthsDiv.appendChild(monthDiv);
  });
  
  scheduleCalendar.appendChild(monthsDiv);
}

function generateEditQuarterlySchedule(existingSchedule) {
  const scheduleCalendar = document.getElementById('edit-schedule-calendar');
  const currentYear = new Date().getFullYear();
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
  
  const quartersDiv = document.createElement('div');
  quartersDiv.className = 'calendar-months';
  
  const quarters = [
    { name: 'Q1', months: ['January', 'February', 'March'] },
    { name: 'Q2', months: ['April', 'May', 'June'] },
    { name: 'Q3', months: ['July', 'August', 'September'] },
    { name: 'Q4', months: ['October', 'November', 'December'] }
  ];
  
  quarters.forEach(quarter => {
    const quarterDiv = document.createElement('div');
    quarterDiv.className = 'calendar-quarter';
    
    const quarterLabel = document.createElement('div');
    quarterLabel.className = 'calendar-quarter-label';
    quarterLabel.textContent = quarter.name;
    quarterDiv.appendChild(quarterLabel);
    
    quarter.months.forEach(month => {
      const monthSelect = document.createElement('select');
      monthSelect.className = 'calendar-month-select';
      monthSelect.name = `schedule[${quarter.name}][${month}]`;
      
      const option = document.createElement('option');
      option.value = '';
      option.textContent = `${month}...`;
      monthSelect.appendChild(option);
      
      for (let day = 1; day <= 31; day++) {
        const dayOption = document.createElement('option');
        dayOption.value = day;
        dayOption.textContent = `Day ${day}`;
        
        // Populate existing value if available
        if (existingSchedule && existingSchedule[quarter.name] && existingSchedule[quarter.name][month] == day) {
          dayOption.selected = true;
        }
        
        monthSelect.appendChild(dayOption);
      }
      
      quarterDiv.appendChild(monthSelect);
    });
    
    quartersDiv.appendChild(quarterDiv);
  });
  
  scheduleCalendar.appendChild(quartersDiv);
}

// Close task action menus when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.inspection-actions-wrapper')) {
    document.querySelectorAll('.inspection-actions-menu').forEach(menu => {
      menu.classList.remove('open');
    });
  }
});

// Staff Assignment Functions
let selectedStaffId = null;

// Load and display staff list
async function loadStaffList() {
  const staffListEl = document.getElementById('staff-list');
  if (!staffListEl) return;
  
  staffListEl.innerHTML = '<div style="text-align: center; padding: 2rem; color: #9ca3af;">Loading staff...</div>';
  
  try {
    const resp = await fetch('./list_staff.php');
    const data = await resp.json();
    
    if (!resp.ok || !data.ok) {
      staffListEl.innerHTML = `<div class="no-staff">Error loading staff: ${data.error || 'Unknown error'}</div>`;
      return;
    }
    
    const staff = data.staff || [];
    
    if (staff.length === 0) {
      staffListEl.innerHTML = '<div class="no-staff">No staff members found in the system.</div>';
      return;
    }
    
    // Display staff list
    staffListEl.innerHTML = staff.map(member => {
      const initial = (member.name || 'U').charAt(0).toUpperCase();
      const isSelected = selectedStaffId === member._id ? 'selected' : '';
      return `
        <div class="staff-list-item ${isSelected}" data-staff-id="${member._id}" data-staff-name="${escapeHtml(member.name || 'Unknown')}">
          <div class="staff-avatar">${initial}</div>
          <div class="staff-info">
            <div class="staff-name">${escapeHtml(member.name || 'Unknown')}</div>
            <div class="staff-email">${escapeHtml(member.email || '')}</div>
          </div>
        </div>
      `;
    }).join('');
    
    // Add click handlers to staff items
    staffListEl.querySelectorAll('.staff-list-item').forEach(item => {
      item.addEventListener('click', () => {
        // Remove previous selection
        staffListEl.querySelectorAll('.staff-list-item').forEach(i => i.classList.remove('selected'));
        // Select clicked item
        item.classList.add('selected');
        selectedStaffId = item.dataset.staffId;
        const staffName = item.dataset.staffName;
        
        // Assign immediately when clicked
        assignStaffToMaintenance(selectedStaffId, staffName);
      });
    });
    
  } catch (error) {
    console.error('Error loading staff:', error);
    staffListEl.innerHTML = `<div class="no-staff">Error loading staff: ${error.message}</div>`;
  }
}

// Assign staff to maintenance task
async function assignStaffToMaintenance(staffId, staffName) {
  if (!currentMaintenance || !currentMaintenance._id) {
    alert('Cannot assign staff: Maintenance item not loaded');
    return;
  }
  
  try {
    const resp = await fetch('./assign_staff.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        maintenanceId: currentMaintenance._id,
        staffId: staffId
      })
    });
    
    const data = await resp.json();
    
    if (!resp.ok || !data.ok) {
      alert(`Error assigning staff: ${data.error || 'Unknown error'}`);
      return;
    }
    
    // Update current maintenance object
    currentMaintenance.assignedStaffId = data.assignedStaff.id;
    currentMaintenance.assignedStaffName = data.assignedStaff.name;
    currentMaintenance.assignedStaffEmail = data.assignedStaff.email;
    
    // Update display
    displayAssignedStaff(currentMaintenance);
    
    // Close modal
    const modal = document.getElementById('assign-staff-modal-overlay');
    if (modal) {
      modal.classList.remove('open');
    }
    
    // Show success message
    alert(`Task assigned to ${data.assignedStaff.name} successfully!`);
    
  } catch (error) {
    console.error('Error assigning staff:', error);
    alert(`Error assigning staff: ${error.message}`);
  }
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Open assign staff modal
function openAssignStaffModal() {
  const modal = document.getElementById('assign-staff-modal-overlay');
  if (modal) {
    modal.classList.add('open');
    selectedStaffId = null;
    loadStaffList();
  }
}

// Close assign staff modal
function closeAssignStaffModal() {
  const modal = document.getElementById('assign-staff-modal-overlay');
  if (modal) {
    modal.classList.remove('open');
  }
}

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


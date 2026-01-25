// Staff Dashboard JavaScript - Load real data for staff dashboard

// Get logged-in staff information from sessionStorage
function getCurrentStaff() {
  const userId = sessionStorage.getItem('userId');
  const userEmail = sessionStorage.getItem('userEmail');
  const userName = sessionStorage.getItem('userName');
  
  return {
    id: userId,
    email: userEmail,
    name: userName
  };
}

// Load dashboard statistics for staff
async function loadDashboardStats() {
  const staff = getCurrentStaff();
  
  if (!staff.id && !staff.email) {
    console.warn('Staff not logged in');
    updateStats(0, 0, 0, []);
    return;
  }
  
  try {
    console.log('Loading staff dashboard statistics...');
    
    // Fetch assigned maintenance tasks
    let url = '/api/maintenance/assigned?';
    if (staff.id) {
      url += 'staffId=' + encodeURIComponent(staff.id);
    } else if (staff.email) {
      url += 'staffEmail=' + encodeURIComponent(staff.email);
    }
    
    const maintenanceResp = await fetch(url);
    if (!maintenanceResp.ok) {
      throw new Error(`Maintenance API returned ${maintenanceResp.status}`);
    }
    
    const maintenanceData = await maintenanceResp.json();
    console.log('Assigned maintenance data:', maintenanceData);
    
    if (!maintenanceData.ok || !maintenanceData.maintenance) {
      console.warn('No assigned maintenance tasks found or API error');
      updateStats(0, 0, 0, []);
      return;
    }
    
    const assignedTasks = maintenanceData.maintenance;
    const totalTasks = assignedTasks.length;
    console.log(`Found ${totalTasks} assigned maintenance task(s)`);
    
    // Fetch all inspection records to calculate pending/completed
    let totalPending = 0;
    let totalCompleted = 0; // Total completed inspections (don't care about normal/fault)
    const taskDetails = [];
    
    // Process each maintenance task
    for (const task of assignedTasks) {
      try {
        // Get all inspection records for this maintenance task
        const assetsUrl = `/api/maintenance/assets?maintenanceId=${encodeURIComponent(task._id)}`;
        const assetsResp = await fetch(assetsUrl);
        
        let pendingCount = 0;
        let completedCount = 0;
        let allInspections = [];
        
        if (assetsResp.ok) {
          const assetsData = await assetsResp.json();
          if (assetsData.ok && assetsData.assets) {
            allInspections = assetsData.assets;
            
            // Count pending: all inspection records where inspectionStatus !== 'complete' (black cells)
            pendingCount = allInspections.filter(ma => {
              const status = (ma.inspectionStatus || 'pending').toLowerCase().trim();
              return status !== 'complete' && status !== 'completed';
            }).length;
            
            // Count completed: all inspection records where inspectionStatus === 'complete' (don't care about normal/fault)
            completedCount = allInspections.filter(ma => {
              const status = (ma.inspectionStatus || 'pending').toLowerCase().trim();
              return status === 'complete' || status === 'completed';
            }).length;
          }
        }
        
        console.log(`Task ${task._id}: ${pendingCount} pending, ${completedCount} completed out of ${allInspections.length} total`);
        
        totalPending += pendingCount;
        totalCompleted += completedCount;
        
        // Calculate next due date for task
        const nextDueDate = calculateNextDueDate(task.maintenanceSchedule, task.frequency);
        const status = getTaskStatus(nextDueDate, allInspections);
        
        taskDetails.push({
          ...task,
          assetCount: allInspections.length,
          pendingCount: pendingCount,
          completedCount: completedCount,
          nextDueDate: nextDueDate,
          status: status
        });
      } catch (error) {
        console.error(`Error loading assets for task ${task._id}:`, error);
      }
    }
    
    // Sort tasks by due date (ascending)
    taskDetails.sort((a, b) => {
      if (!a.nextDueDate) return 1;
      if (!b.nextDueDate) return -1;
      return new Date(a.nextDueDate) - new Date(b.nextDueDate);
    });
    
    console.log(`=== FINAL DASHBOARD STATS ===`);
    console.log(`Total Tasks: ${totalTasks}`);
    console.log(`Total Pending Inspections: ${totalPending}`);
    console.log(`Total Completed Inspections: ${totalCompleted}`);
    console.log(`Task Details: ${taskDetails.length} tasks`);
    
    updateStats(totalTasks, totalPending, totalCompleted, taskDetails);
    
  } catch (error) {
    console.error('Error loading dashboard stats:', error);
    updateStats(0, 0, 0, []);
  }
}

// Helper function to extract dates from schedule
function extractDatesFromSchedule(schedule, frequency) {
  const dates = [];
  if (!schedule || typeof schedule !== 'object') {
    return dates;
  }
  
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

// Helper function to format date as YYYY-MM-DD key
function formatDateKey(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper function to parse dates
function parseDate(dateValue) {
  if (!dateValue) return null;
  try {
    // Handle MongoDB UTCDateTime format
    if (typeof dateValue === 'object' && dateValue.$date) {
      return new Date(dateValue.$date);
    } else if (typeof dateValue === 'string' || typeof dateValue === 'number') {
      const d = new Date(dateValue);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  } catch (e) {
    console.warn('Error parsing date:', dateValue, e);
    return null;
  }
}

// Calculate next due date based on maintenance schedule and frequency
function calculateNextDueDate(schedule, frequency) {
  if (!schedule || typeof schedule !== 'object') return null;
  
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  let dates = [];
  
  if (frequency === 'Weekly') {
    Object.values(schedule).forEach(monthSchedule => {
      if (monthSchedule && typeof monthSchedule === 'object') {
        Object.values(monthSchedule).forEach(weekSchedule => {
          if (weekSchedule && typeof weekSchedule === 'object' && weekSchedule.date) {
            const date = parseDate(weekSchedule.date);
            if (date) dates.push(date);
          }
        });
      }
    });
  } else if (frequency === 'Monthly') {
    Object.values(schedule).forEach(monthSchedule => {
      if (monthSchedule && typeof monthSchedule === 'object' && monthSchedule.date) {
        const date = parseDate(monthSchedule.date);
        if (date) dates.push(date);
      }
    });
  } else if (frequency === 'Quarterly') {
    Object.values(schedule).forEach(quarterSchedule => {
      if (quarterSchedule && typeof quarterSchedule === 'object') {
        Object.values(quarterSchedule).forEach(monthSchedule => {
          if (monthSchedule && typeof monthSchedule === 'object' && monthSchedule.date) {
            const date = parseDate(monthSchedule.date);
            if (date) dates.push(date);
          }
        });
      }
    });
  }
  
  // Filter out past dates and find the next one
  const futureDates = dates.filter(d => d >= now).sort((a, b) => a - b);
  return futureDates.length > 0 ? futureDates[0] : (dates.length > 0 ? dates[dates.length - 1] : null);
}

// Get task status based on due date and assets
function getTaskStatus(nextDueDate, assets) {
  if (!assets || assets.length === 0) return 'Not Started';
  
  const allComplete = assets.every(a => (a.inspectionStatus || 'open') === 'complete');
  if (allComplete) return 'Completed';
  
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  if (!nextDueDate) return 'Pending';
  
  const dueDate = new Date(nextDueDate);
  dueDate.setHours(0, 0, 0, 0);
  
  const daysUntil = Math.floor((dueDate - now) / (1000 * 60 * 60 * 24));
  
  if (daysUntil < 0) return 'Overdue';
  if (daysUntil <= 3) return 'Due Soon';
  return 'In Progress';
}

// Update statistics display
function updateStats(totalTasks, pendingInspections, totalCompleted, taskDetails) {
  // Update stat cards - find by their parent card's h2 text
  const cards = document.querySelectorAll('.dashboard-card');
  cards.forEach(card => {
    const h2 = card.querySelector('h2');
      if (h2) {
        const statValue = card.querySelector('.stat-value');
        if (statValue) {
          if (h2.textContent.includes('Total Assigned')) {
            statValue.textContent = totalTasks;
          } else if (h2.textContent.includes('Completed Inspections')) {
            statValue.textContent = totalCompleted;
          } else if (h2.textContent.includes('Completed Tasks')) {
            // Fallback for old text
            statValue.textContent = totalCompleted;
          }
        }
      }
  });
  
  // Also update by ID if it exists
  const completedStatEl = document.getElementById('completed-inspection-stat');
  if (completedStatEl) {
    completedStatEl.textContent = totalCompleted;
  }
  
  // Update task table
  const tbody = document.querySelector('.asset-table tbody');
  if (tbody) {
    if (taskDetails.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #888;">No assigned tasks found</td></tr>';
      return;
    }
    
    tbody.innerHTML = taskDetails.map(task => {
      const taskId = task._id ? task._id.substring(task._id.length - 8) : '-';
      const assetCode = task.itemName || '-';
      const taskType = task.frequency || '-';
      const dueDate = task.nextDueDate ? formatDate(task.nextDueDate) : '-';
      const status = getTaskStatusDisplay(task.status);
      
      return `
        <tr>
          <td>${escapeHtml(taskId)}</td>
          <td>${escapeHtml(assetCode)}</td>
          <td>${escapeHtml(taskType)}</td>
          <td>${dueDate}</td>
          <td>${status}</td>
          <td><a class="action-link" href="../Staff/inspection/inspectiontask.html?maintenanceId=${encodeURIComponent(task._id)}">View Task</a></td>
        </tr>
      `;
    }).join('');
  }
}

// Format date for display
function formatDate(date) {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

// Get status display with color
function getTaskStatusDisplay(status) {
  const statusColors = {
    'Completed': { color: '#10b981', text: 'Completed' },
    'Overdue': { color: '#ef4444', text: 'Overdue' },
    'Due Soon': { color: '#f59e0b', text: 'Due Soon' },
    'In Progress': { color: '#3b82f6', text: 'In Progress' },
    'Pending': { color: '#f59e0b', text: 'Pending' },
    'Not Started': { color: '#6b7280', text: 'Not Started' }
  };
  
  const statusInfo = statusColors[status] || { color: '#6b7280', text: status || 'Unknown' };
  return `<span style="color: ${statusInfo.color}; font-weight: 600;">${statusInfo.text}</span>`;
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Update welcome username when user name is loaded
function updateWelcomeUsername() {
  const userNameEl = document.getElementById('user-name');
  const welcomeUsernameEl = document.getElementById('welcome-username');
  if (userNameEl && welcomeUsernameEl && userNameEl.textContent !== 'Loading...') {
    welcomeUsernameEl.textContent = userNameEl.textContent;
  }
}

// Initialize dashboard
function init() {
  loadDashboardStats();
  
  // Update welcome username
  updateWelcomeUsername();
  setTimeout(updateWelcomeUsername, 100);
  
  // Watch for changes to user-name element
  const userNameEl = document.getElementById('user-name');
  if (userNameEl) {
    const observer = new MutationObserver(updateWelcomeUsername);
    observer.observe(userNameEl, { childList: true, characterData: true, subtree: true });
  }
}

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


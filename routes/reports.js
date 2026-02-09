// Report API routes
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { Asset, Maintenance, MaintenanceAsset, User, InspectionTask } = require('../models');

// Helper to check MongoDB connection
function checkDBConnection(res) {
    if (mongoose.connection.readyState !== 1) {
        res.status(500).json({ ok: false, error: 'Database connection not available' });
        return false;
    }
    return true;
}

// Get report options (locations, branches, staff)
router.get('/options', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        // Get unique locations, branches, and categories from assets
        const assets = await Asset.find({
            locationDescription: { $exists: true, $ne: null, $ne: '' }
        }).select('locationDescription branchCode assetCategory').lean();

        const assetLocations = [...new Set(
            assets
                .map(a => a.locationDescription)
                .filter(loc => loc && loc.trim())
                .map(loc => loc.trim())
        )];

        const assetBranches = [...new Set(
            assets
                .map(a => a.branchCode)
                .filter(b => b && b.trim())
                .map(b => b.trim())
        )];

        const assetCategories = [...new Set(
            assets
                .map(a => a.assetCategory)
                .filter(c => c && c.trim())
                .map(c => c.trim())
        )];

        // Get unique locations and branches from maintenance
        const maintenance = await Maintenance.find({}).select('location branch').lean();

        const maintenanceLocations = [...new Set(
            maintenance
                .map(m => m.location)
                .filter(loc => loc && loc.trim())
                .map(loc => loc.trim())
        )];

        const maintenanceBranches = [...new Set(
            maintenance
                .map(m => m.branch)
                .filter(b => b && b.trim())
                .map(b => b.trim())
        )];

        // Merge and deduplicate
        const allLocations = [...new Set([...assetLocations, ...maintenanceLocations])].sort();
        const allBranches = [...new Set([...assetBranches, ...maintenanceBranches])].sort();

        // Get staff members
        const users = await User.find({}).select('name email').lean();
        const staffFromUsers = [...new Set(
            users
                .map(u => u.name)
                .filter(n => n && n.trim())
                .map(n => n.trim())
        )];

        const maintenanceStaff = await Maintenance.find({}).select('assignedStaffName').lean();
        const staffFromMaintenance = [...new Set(
            maintenanceStaff
                .map(m => m.assignedStaffName)
                .filter(n => n && n.trim())
                .map(n => n.trim())
        )];

        const allStaff = [...new Set([...staffFromUsers, ...staffFromMaintenance])].sort();

        // Sort categories
        const allCategories = assetCategories.sort();

        res.json({
            ok: true,
            locations: allLocations,
            branches: allBranches,
            staff: allStaff,
            categories: allCategories
        });
    } catch (error) {
        console.error('Error getting report options:', error);
        res.status(500).json({ ok: false, error: 'Could not load options: ' + error.message });
    }
});

// Generate asset report
router.post('/generate-asset', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const criteria = req.body;
        const filter = {};

        // Status filter
        if (criteria.status) {
            filter.status = criteria.status;
        }

        // Category filter
        if (criteria.category) {
            filter.assetCategory = criteria.category;
        }

        // Location filter
        if (criteria.location) {
            filter.locationDescription = criteria.location;
        }

        // Branch filter
        if (criteria.branch) {
            filter.branchCode = criteria.branch;
        }

        const assets = await Asset.find(filter).sort({ assetId: 1 }).lean();

        const report = assets.map(asset => ({
            'Asset ID': asset.assetId || '-',
            'Description': asset.assetDescription || '-',
            'Category': asset.assetCategory || '-',
            'Model': asset.model || '-',
            'Serial Number': asset.serialNo || asset.serialNumber || '-',
            'Status': asset.status || '-',
            'Location': asset.locationDescription || '-',
            'Branch': asset.branchCode || '-',
            'Condition': asset.condition || '-',
            'Created Date': asset.created_at ? new Date(asset.created_at).toLocaleDateString() : '-'
        }));

        res.json({ ok: true, report });
    } catch (error) {
        console.error('Error generating asset report:', error);
        res.status(500).json({ ok: false, error: 'Could not generate report: ' + error.message });
    }
});

// Helper function to extract dates for a month (same logic as frontend)
function extractDatesForMonth(monthName, year, maintenanceSchedule, frequency) {
    const monthIndex = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'].indexOf(monthName);
    const dates = [];

    if (!maintenanceSchedule || typeof maintenanceSchedule !== 'object') {
        return dates;
    }

    if (frequency === 'Weekly') {
        const monthSchedule = maintenanceSchedule[monthName];
        if (monthSchedule && typeof monthSchedule === 'object') {
            Object.keys(monthSchedule).forEach(weekKey => {
                const dateStr = monthSchedule[weekKey];
                if (dateStr) {
                    let normalizedDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
                    const dateParts = normalizedDateStr.split('-');
                    if (dateParts.length === 3) {
                        const inputDay = parseInt(dateParts[2], 10);
                        if (!isNaN(inputDay) && inputDay >= 1 && inputDay <= 31) {
                            const adjustedDate = new Date(year, monthIndex, inputDay);
                            if (adjustedDate.getMonth() === monthIndex && adjustedDate.getDate() === inputDay) {
                                dates.push(adjustedDate);
                            }
                        }
                    }
                }
            });
            dates.sort((a, b) => a.getTime() - b.getTime());
        }
    } else if (frequency === 'Monthly') {
        const dateStr = maintenanceSchedule[monthName];
        if (dateStr) {
            let normalizedDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
            const dateParts = normalizedDateStr.split('-');
            if (dateParts.length === 3) {
                const inputDay = parseInt(dateParts[2], 10);
                if (!isNaN(inputDay) && inputDay >= 1 && inputDay <= 31) {
                    const adjustedDate = new Date(year, monthIndex, inputDay);
                    if (adjustedDate.getMonth() === monthIndex && adjustedDate.getDate() === inputDay) {
                        dates.push(adjustedDate);
                    }
                }
            }
        }
    } else if (frequency === 'Quarterly') {
        const quarters = [
            { keys: ['Q1 (Jan-Mar)', 'Q1'], months: [0, 1, 2] },
            { keys: ['Q2 (Apr-Jun)', 'Q2'], months: [3, 4, 5] },
            { keys: ['Q3 (Jul-Sep)', 'Q3'], months: [6, 7, 8] },
            { keys: ['Q4 (Oct-Dec)', 'Q4'], months: [9, 10, 11] }
        ];

        const quarter = quarters.find(q => q.months.includes(monthIndex));
        if (quarter) {
            let quarterDateStr = null;
            for (const key of quarter.keys) {
                if (maintenanceSchedule[key]) {
                    quarterDateStr = maintenanceSchedule[key];
                    break;
                }
            }

            if (quarterDateStr) {
                let dateStr = quarterDateStr;
                if (typeof dateStr !== 'string') return dates;

                dateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;

                if (dateStr.includes('/')) {
                    const parts = dateStr.split('/');
                    if (parts.length === 3) {
                        const day = parseInt(parts[0], 10);
                        const month = parseInt(parts[1], 10);
                        const yr = parseInt(parts[2], 10);
                        if (day > 0 && day <= 31 && month > 0 && month <= 12 && yr > 0) {
                            dateStr = `${yr}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        }
                    }
                }

                const dateParts = dateStr.split('-');
                if (dateParts.length === 3) {
                    const dateYear = parseInt(dateParts[0], 10);
                    const dateMonth = parseInt(dateParts[1], 10) - 1;
                    const dateDay = parseInt(dateParts[2], 10);

                    if (!isNaN(dateYear) && !isNaN(dateMonth) && !isNaN(dateDay) &&
                        dateMonth >= 0 && dateMonth <= 11 && dateDay >= 1 && dateDay <= 31) {
                        if (dateMonth === monthIndex) {
                            const displayDate = new Date(year, monthIndex, dateDay);
                            if (displayDate.getMonth() === monthIndex && displayDate.getDate() === dateDay) {
                                dates.push(displayDate);
                            }
                        }
                    }
                }
            }
        }
    }

    return dates;
}

// Generate maintenance report in checklist format
router.post('/generate-maintenance', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const criteria = req.body;
        const filter = {};
        const year = criteria.year ? parseInt(criteria.year) : new Date().getFullYear();

        if (criteria.branch) filter.branch = criteria.branch;
        if (criteria.location) filter.location = criteria.location;
        if (criteria.frequency) filter.frequency = criteria.frequency;
        if (criteria.itemName) filter.itemName = { $regex: criteria.itemName, $options: 'i' };
        if (criteria.staff) filter.assignedStaffName = criteria.staff;

        const maintenance = await Maintenance.find(filter).sort({ itemName: 1 }).lean();

        const months = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
        const monthAbbr = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                           'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

        const checklist = [];

        for (const item of maintenance) {
            const maintenanceId = item._id.toString();
            
            // Load inspection tasks from inspection_tasks collection
            const inspectionTasks = await InspectionTask.find({ maintenanceId }).lean();
            const taskSchedules = {};
            inspectionTasks.forEach(task => {
                if (task.taskName && task.schedule) {
                    taskSchedules[task.taskName] = task.schedule;
                }
            });

            // Parse inspection tasks from maintenance item
            const tasks = [];
            if (item.inspectionTasks) {
                const taskLines = String(item.inspectionTasks).split('\n');
                taskLines.forEach(task => {
                    const trimmed = task.trim();
                    if (trimmed) tasks.push(trimmed);
                });
            }

            if (tasks.length === 0) {
                tasks.push('No tasks defined');
            }

            // Get inspection data for this maintenance item (once for all tasks)
            const maintenanceAssets = await MaintenanceAsset.find({ 
                maintenanceId: maintenanceId 
            }).lean();

            // Create a map of date -> inspection status
            const inspectionMap = new Map();
            maintenanceAssets.forEach(ma => {
                if (ma.inspectionDate) {
                    const dateStr = new Date(ma.inspectionDate).toISOString().split('T')[0];
                    inspectionMap.set(dateStr, {
                        hasInspection: true,
                        status: ma.inspectionStatus || 'open'
                    });
                }
            });

            // Create a checklist entry for each task (so each task gets its own row)
            tasks.forEach(taskName => {
                const taskSchedule = taskSchedules[taskName] || null;
                const monthlySchedule = {};

                // Create a map of date -> inspection status (check for fault condition)
                const inspectionMap = new Map();
                maintenanceAssets.forEach(ma => {
                    if (ma.inspectionDate) {
                        const dateStr = new Date(ma.inspectionDate).toISOString().split('T')[0];
                        // Check both inspectionStatus and status (fault condition)
                        const hasFault = ma.status === 'fault' || ma.status === 'abnormal';
                        const isComplete = ma.inspectionStatus === 'complete';
                        inspectionMap.set(dateStr, {
                            hasInspection: true,
                            status: ma.inspectionStatus || 'open',
                            hasFault: hasFault,
                            isComplete: isComplete
                        });
                    }
                });

                months.forEach((month, monthIdx) => {
                    const dates = extractDatesForMonth(month, year, taskSchedule, item.frequency || 'Monthly');
                    
                    // Organize dates by week (1-4) with inspection status
                    dates.forEach(date => {
                        const day = date.getDate();
                        let period = 1;
                        if (day >= 22) period = 4;
                        else if (day >= 15) period = 3;
                        else if (day >= 8) period = 2;

                        const monthNum = monthIdx + 1;
                        if (!monthlySchedule[monthNum]) {
                            monthlySchedule[monthNum] = {};
                        }
                        if (!monthlySchedule[monthNum][period]) {
                            monthlySchedule[monthNum][period] = [];
                        }
                        
                        // Format date as YYYY-MM-DD for inspection lookup
                        const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const inspection = inspectionMap.get(dateStr);
                        
                        // Determine cell class based on inspection status and fault condition
                        // Match image: red for fault/pending, normal (black on white) for completed without fault
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const inspectionDate = new Date(date);
                        inspectionDate.setHours(0, 0, 0, 0);
                        
                        let cellClass = 'pending'; // Default: red (fault/pending)
                        if (inspection && inspection.hasInspection) {
                            if (inspection.hasFault) {
                                cellClass = 'fault'; // Red: has fault
                            } else if (inspection.isComplete) {
                                cellClass = 'completed'; // Normal: completed without fault (black on white)
                            } else {
                                cellClass = 'pending'; // Red: pending inspection
                            }
                        } else if (inspectionDate > today) {
                            cellClass = 'upcoming'; // Grey: future date
                        } else {
                            cellClass = 'pending'; // Red: past date without inspection (fault)
                        }
                        
                        monthlySchedule[monthNum][period].push({
                            day: String(day),
                            class: cellClass
                        });
                    });
                });

                // Find latest month for display
                let latestMonth = 'NOV';
                if (Object.keys(monthlySchedule).length > 0) {
                    latestMonth = monthAbbr[new Date().getMonth()];
                }

                // Create checklist entry for this task
                checklist.push({
                    branch: item.branch || '-',
                    location: item.location || '-',
                    itemName: item.itemName || '-',
                    month: latestMonth,
                    year: year,
                    frequency: item.frequency || 'Monthly',
                    inspectionTasks: [taskName], // Single task per entry
                    schedule: monthlySchedule, // Task-specific schedule
                    assignedStaffName: item.assignedStaffName || 'No',
                    assignedStaffEmail: item.assignedStaffEmail || 'No'
                });
            });
        }

        // Include criteria in response for header population
        res.json({ 
            ok: true, 
            report: checklist,
            criteria: {
                year: year,
                frequency: criteria.frequency || null,
                branch: criteria.branch || null,
                location: criteria.location || null,
                itemName: criteria.itemName || null,
                staff: criteria.staff || null
            }
        });
    } catch (error) {
        console.error('Error generating maintenance report:', error);
        res.status(500).json({ ok: false, error: 'Could not generate report: ' + error.message });
    }
});

// Generate inspection report
router.post('/generate-inspection', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const criteria = req.body;
        const filter = {};

        // Filter by inspection date range (if provided)
        if (criteria.dateFrom || criteria.dateTo) {
            filter.inspectionDate = {};
            if (criteria.dateFrom) {
                filter.inspectionDate.$gte = new Date(criteria.dateFrom);
            }
            if (criteria.dateTo) {
                const dateTo = new Date(criteria.dateTo);
                dateTo.setHours(23, 59, 59, 999);
                filter.inspectionDate.$lte = dateTo;
            }
        }

        // Filter by status will be applied after matching with maintenance items
        // We'll filter in the report generation loop to handle normal/fault logic properly
        
        // Get inspections
        const inspections = await MaintenanceAsset.find(filter)
            .sort({ inspectionDate: -1 })
            .lean();
        
        console.log('Total inspections found:', inspections.length);

        // Get maintenance items to filter by branch, location, itemName, frequency
        let maintenanceFilter = {};
        if (criteria.branch) maintenanceFilter.branch = criteria.branch;
        if (criteria.location) maintenanceFilter.location = criteria.location;
        if (criteria.itemName) maintenanceFilter.itemName = { $regex: criteria.itemName, $options: 'i' };
        if (criteria.frequency) maintenanceFilter.frequency = criteria.frequency;

        const maintenanceItems = await Maintenance.find(maintenanceFilter).lean();
        const maintenanceIds = maintenanceItems.map(m => m._id.toString());
        
        console.log('Maintenance items found:', maintenanceItems.length);
        console.log('Maintenance IDs:', maintenanceIds);

        // Filter inspections by maintenance IDs (handle both string and ObjectId formats)
        const filteredInspections = inspections.filter(inspection => {
            if (!inspection.maintenanceId) return false;
            
            let inspectionMaintenanceId;
            try {
                if (typeof inspection.maintenanceId === 'string') {
                    inspectionMaintenanceId = inspection.maintenanceId;
                } else if (inspection.maintenanceId && typeof inspection.maintenanceId.toString === 'function') {
                    inspectionMaintenanceId = String(inspection.maintenanceId);
                } else {
                    inspectionMaintenanceId = String(inspection.maintenanceId);
                }
            } catch (e) {
                console.error('Error converting maintenanceId:', e);
                return false;
            }
            
            return inspectionMaintenanceId && maintenanceIds.includes(inspectionMaintenanceId);
        });
        
        console.log('Filtered inspections (after maintenance ID match):', filteredInspections.length);

        // Build report grouped by maintenance item and task
        const report = [];
        let headerInfo = null;
        
        // If no inspections found, return empty report with default header
        if (filteredInspections.length === 0) {
            headerInfo = {
                companyName: 'PKT Logistics Group',
                reportTitle: 'Maintenance Inspection Report',
                branch: criteria.branch || '-',
                location: criteria.location || '-',
                inspectionType: criteria.frequency || '-',
                itemName: criteria.itemName || '-',
                monthYear: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                inspectionDate: new Date().toLocaleDateString('en-GB', { 
                    day: 'numeric', 
                    month: 'short', 
                    year: 'numeric' 
                })
            };
        } else {
            // Group inspections by maintenance item
            const inspectionsByMaintenance = new Map();
            
            // Cache maintenance lookups to avoid duplicate queries
            const maintenanceCache = new Map();
            
            for (const inspection of filteredInspections) {
                // Handle both string and ObjectId formats for maintenanceId
                if (!inspection.maintenanceId) continue;
                
                let inspectionMaintenanceId;
                try {
                    // Safely convert maintenanceId to string
                    if (typeof inspection.maintenanceId === 'string') {
                        inspectionMaintenanceId = inspection.maintenanceId;
                    } else if (inspection.maintenanceId) {
                        // Use valueOf() for ObjectId which is safer than toString()
                        if (inspection.maintenanceId.valueOf) {
                            inspectionMaintenanceId = String(inspection.maintenanceId.valueOf());
                        } else if (inspection.maintenanceId.toString) {
                            inspectionMaintenanceId = String(inspection.maintenanceId.toString());
                        } else {
                            inspectionMaintenanceId = String(inspection.maintenanceId);
                        }
                    }
                } catch (e) {
                    console.error('Error converting maintenanceId:', e, inspection.maintenanceId);
                    continue;
                }
                
                if (!inspectionMaintenanceId) continue;
                
                // Check cache first
                let maintenance = maintenanceCache.get(inspectionMaintenanceId);
                if (!maintenance) {
                    try {
                        // Mongoose will handle ObjectId conversion automatically
                        // Convert to ObjectId if it's a valid hex string, otherwise use as-is
                        const queryId = mongoose.Types.ObjectId.isValid(inspectionMaintenanceId) 
                            ? new mongoose.Types.ObjectId(inspectionMaintenanceId) 
                            : inspectionMaintenanceId;
                        maintenance = await Maintenance.findOne({ _id: queryId }).lean();
                        if (maintenance) {
                            maintenanceCache.set(inspectionMaintenanceId, maintenance);
                        }
                    } catch (e) {
                        console.error('Error finding maintenance:', e);
                        continue;
                    }
                }
                
                if (!maintenance) continue;
                
                const maintenanceId = String(maintenance._id);
                if (!inspectionsByMaintenance.has(maintenanceId)) {
                    inspectionsByMaintenance.set(maintenanceId, {
                        maintenance: maintenance,
                        inspections: []
                    });
                }
                inspectionsByMaintenance.get(maintenanceId).inspections.push(inspection);
            }
        
            // Process each maintenance item and group by task
            for (const [maintenanceId, data] of inspectionsByMaintenance) {
                const maintenance = data.maintenance;
                const itemInspections = data.inspections;
                
                // Set header info from first maintenance item
                if (!headerInfo) {
                    const inspectionDate = itemInspections[0]?.inspectionDate ? new Date(itemInspections[0].inspectionDate) : new Date();
                    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                                      'July', 'August', 'September', 'October', 'November', 'December'];
                    
                    headerInfo = {
                        companyName: 'PKT Logistics Group',
                        reportTitle: 'Maintenance Inspection Report',
                        branch: maintenance.branch || criteria.branch || '-',
                        location: maintenance.location || criteria.location || '-',
                        inspectionType: maintenance.frequency || criteria.frequency || '-',
                        itemName: maintenance.itemName || criteria.itemName || '-',
                        monthYear: `${monthNames[inspectionDate.getMonth()]} ${inspectionDate.getFullYear()}`,
                        inspectionDate: inspectionDate.toLocaleDateString('en-GB', { 
                            day: 'numeric', 
                            month: 'short', 
                            year: 'numeric' 
                        }) || '-'
                    };
                }
                
                // Parse inspection tasks from maintenance item
                const tasks = [];
                if (maintenance.inspectionTasks) {
                    const taskLines = String(maintenance.inspectionTasks).split('\n');
                    taskLines.forEach(task => {
                        const trimmed = task.trim();
                        if (trimmed) tasks.push(trimmed);
                    });
                }
                
                if (tasks.length === 0) {
                    tasks.push('No tasks defined');
                }
                
                // Process each inspection directly using assetId
                for (const inspection of itemInspections) {
                    // Get asset directly from inspection's assetId
                    const asset = await Asset.findOne({ assetId: inspection.assetId }).lean();
                    if (!asset) {
                        console.log('Asset not found for assetId:', inspection.assetId);
                        continue;
                    }
                    
                    console.log('Processing inspection:', {
                        assetId: inspection.assetId,
                        inspectionStatus: inspection.inspectionStatus,
                        status: inspection.status,
                        maintenanceId: inspection.maintenanceId
                    });
                    
                    // Determine which task this inspection belongs to
                    // Try to match by asset's locationDescription or use first task as default
                    let taskName = tasks[0] || 'No tasks defined';
                    if (asset.locationDescription) {
                        // Try to find matching task by locationDescription
                        const matchingTask = tasks.find(task => 
                            task.toLowerCase() === asset.locationDescription.toLowerCase() ||
                            asset.locationDescription.toLowerCase().includes(task.toLowerCase())
                        );
                        if (matchingTask) {
                            taskName = matchingTask;
                        }
                    }
                    
                    // Use actual status values from database (no mapping)
                    // Priority: inspection.status (normal/fault/abnormal) or inspectionStatus (open/pending/complete)
                    let status = inspection.status || inspection.inspectionStatus || 'normal';
                    
                    // Apply status filter from criteria if specified (normal or fault)
                    if (criteria.status) {
                        if (criteria.status === 'normal') {
                            // Normal: status is 'normal' OR (inspectionStatus is complete/completed AND status is not fault/abnormal)
                            const isNormal = (inspection.status === 'normal' || !inspection.status) ||
                                           ((inspection.inspectionStatus === 'complete' || inspection.inspectionStatus === 'completed') && 
                                           inspection.status !== 'fault' && inspection.status !== 'abnormal' && inspection.status !== 'faulty');
                            if (!isNormal) {
                                console.log('Skipping inspection - not normal:', {
                                    assetId: asset.assetId,
                                    status: inspection.status,
                                    inspectionStatus: inspection.inspectionStatus,
                                    isNormal: isNormal
                                });
                                continue; // Skip this inspection
                            }
                        } else if (criteria.status === 'fault') {
                            // Fault: status is fault/abnormal/faulty OR inspectionStatus is faulty/overdue
                            const isFault = inspection.status === 'fault' || 
                                          inspection.status === 'abnormal' || 
                                          inspection.status === 'faulty' ||
                                          inspection.inspectionStatus === 'faulty' || 
                                          inspection.inspectionStatus === 'overdue';
                            if (!isFault) {
                                console.log('Skipping inspection - not fault:', {
                                    assetId: asset.assetId,
                                    status: inspection.status,
                                    inspectionStatus: inspection.inspectionStatus,
                                    isFault: isFault
                                });
                                continue; // Skip this inspection
                            }
                        } else if (status !== criteria.status) {
                            continue; // Skip if exact match required
                        }
                    }
                    
                    console.log('Adding inspection to report:', {
                        assetId: asset.assetId,
                        status: status,
                        taskName: taskName
                    });
                    
                    // Format inspection date as DD/MM/YYYY
                    let formattedDate = '-';
                    if (inspection.inspectionDate) {
                        const date = new Date(inspection.inspectionDate);
                        if (!isNaN(date.getTime())) {
                            const day = String(date.getDate()).padStart(2, '0');
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const year = date.getFullYear();
                            formattedDate = `${day}/${month}/${year}`;
                        }
                    }
                    
                    report.push({
                        'Task': taskName,
                        'Asset ID': asset.assetId || '-',
                        'Asset Name': asset.assetDescription || '-',
                        'Serial Number': asset.serialNo || asset.serialNumber || '-',
                        'Inspection Date': formattedDate,
                        'Status': status,
                        'Remarks': inspection.inspectionNotes || inspection.remarks || '-',
                        'Inspector': inspection.inspectorName || inspection.inspector || '-'
                    });
                }
            }
        }
        
        // Sort by task, then by asset ID
        report.sort((a, b) => {
            if (a['Task'] !== b['Task']) {
                return a['Task'].localeCompare(b['Task']);
            }
            return (a['Asset ID'] || '').localeCompare(b['Asset ID'] || '');
        });
        
        // Calculate totals based on actual report data (excluding any existing TOTAL row)
        const dataRows = report.filter(r => r['Task'] !== 'TOTAL');
        const totals = {
            total: dataRows.length,
            normal: dataRows.filter(r => r['Status'] === 'normal' || r['Status'] === 'complete' || r['Status'] === 'completed').length,
            fault: dataRows.filter(r => r['Status'] === 'fault' || r['Status'] === 'abnormal' || r['Status'] === 'faulty').length,
            open: dataRows.filter(r => r['Status'] === 'open' || r['Status'] === 'pending').length
        };
        
        // Remove any existing TOTAL row before adding new one
        const finalReport = report.filter(r => r['Task'] !== 'TOTAL');
        
        // Add summary row at the end with accurate totals
        finalReport.push({
            'Task': 'TOTAL',
            'Asset ID': '',
            'Asset Name': '',
            'Serial Number': '',
            'Inspection Date': '',
            'Status': `Total: ${totals.total} | Normal: ${totals.normal} | Fault: ${totals.fault} | Open: ${totals.open}`,
            'Remarks': '',
            'Inspector': ''
        });

        // Ensure all data is serializable (no circular references or complex objects)
        const serializableReport = finalReport.map(row => {
            const cleanRow = {};
            for (const [key, value] of Object.entries(row)) {
                // Convert any complex objects to strings
                if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                    cleanRow[key] = String(value);
                } else {
                    cleanRow[key] = value;
                }
            }
            return cleanRow;
        });

        res.json({ 
            ok: true, 
            report: serializableReport,
            headerInfo: headerInfo || {
                companyName: 'PKT Logistics Group',
                reportTitle: 'Maintenance Inspection Report',
                branch: criteria.branch || '-',
                location: criteria.location || '-',
                inspectionType: criteria.frequency || '-',
                itemName: criteria.itemName || '-',
                monthYear: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                inspectionDate: criteria.inspectionDate 
                    ? new Date(criteria.inspectionDate).toLocaleDateString('en-GB', { 
                        day: 'numeric', 
                        month: 'short', 
                        year: 'numeric' 
                    })
                    : new Date().toLocaleDateString('en-GB', { 
                        day: 'numeric', 
                        month: 'short', 
                        year: 'numeric' 
                    })
            },
            criteria: criteria
        });
    } catch (error) {
        console.error('Error generating inspection report:', error);
        res.status(500).json({ ok: false, error: 'Could not generate report: ' + error.message });
    }
});

// Generate checklist report
router.post('/generate-checklist', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const criteria = req.body;
        const filter = {};

        // Year filter - if not provided, use current year or find dates from schedule
        let year = criteria.year ? parseInt(criteria.year) : new Date().getFullYear();
        console.log(`Generating checklist report for year: ${year}`);

        if (criteria.branch) filter.branch = criteria.branch;
        if (criteria.location) filter.location = criteria.location;
        if (criteria.frequency) filter.frequency = criteria.frequency;
        if (criteria.itemName) filter.itemName = { $regex: criteria.itemName, $options: 'i' };

        const maintenance = await Maintenance.find(filter)
            .sort({ branch: 1, location: 1, itemName: 1 })
            .lean();

        // Build checklist format matching PHP structure
        const checklist = [];
        
        for (const item of maintenance) {
            // Parse inspection tasks
            const tasks = [];
            if (item.inspectionTasks) {
                const taskLines = String(item.inspectionTasks).split('\n');
                taskLines.forEach(task => {
                    const trimmed = task.trim();
                    if (trimmed) {
                        tasks.push(trimmed);
                    }
                });
            }

            // Extract schedule dates for the specified year based on frequency
            const scheduleDates = [];
            if (item.maintenanceSchedule) {
                let schedule;
                try {
                    // Handle different schedule formats
                    if (typeof item.maintenanceSchedule === 'string') {
                        schedule = JSON.parse(item.maintenanceSchedule || '{}');
                    } else if (typeof item.maintenanceSchedule === 'object') {
                        // If it's already an object, use it directly
                        schedule = item.maintenanceSchedule;
                    } else {
                        schedule = {};
                    }
                } catch (e) {
                    console.error(`Error parsing maintenanceSchedule for ${item.itemName}:`, e);
                    schedule = {};
                }
                
                const frequency = item.frequency || 'Monthly';
                console.log(`Processing schedule for ${item.itemName}, frequency: ${frequency}, schedule:`, JSON.stringify(schedule, null, 2));
                
                // Extract dates based on frequency type
                if (frequency === 'Weekly') {
                    // Format: { "January": { "Week1": "2024-01-05", "Week2": "2024-01-12", ... }, ... }
                    Object.values(schedule).forEach(monthSchedule => {
                        if (typeof monthSchedule === 'object' && monthSchedule !== null) {
                            Object.values(monthSchedule).forEach(dateStr => {
                                if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
                                    const dateYear = parseInt(dateStr.substring(0, 4));
                                    if (dateYear === year) {
                                        scheduleDates.push(dateStr);
                                    }
                                }
                            });
                        }
                    });
                } else if (frequency === 'Monthly') {
                    // Format: { "January": "2024-01-15", "February": "2024-02-15", ... }
                    // Also handle: { "1": "2024-01-15", "2": "2024-02-15", ... }
                    Object.entries(schedule).forEach(([key, dateStr]) => {
                        if (typeof dateStr === 'string' && dateStr.trim() !== '') {
                            // Check if it's a date string
                            if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
                                const dateYear = parseInt(dateStr.substring(0, 4));
                                if (dateYear === year) {
                                    scheduleDates.push(dateStr);
                                    console.log(`Found Monthly date: ${dateStr} from key: ${key}`);
                                }
                            }
                        } else if (typeof dateStr === 'object' && dateStr !== null) {
                            // Handle nested objects
                            Object.values(dateStr).forEach(nestedDate => {
                                if (typeof nestedDate === 'string' && nestedDate.trim() !== '' && /^\d{4}-\d{2}-\d{2}/.test(nestedDate)) {
                                    const dateYear = parseInt(nestedDate.substring(0, 4));
                                    if (dateYear === year) {
                                        scheduleDates.push(nestedDate);
                                        console.log(`Found Monthly date (nested): ${nestedDate} from key: ${key}`);
                                    }
                                }
                            });
                        }
                    });
                } else if (frequency === 'Quarterly') {
                    // Format: { "Q1": "2024-01-15", "Q2": "2024-04-20", ... }
                    Object.values(schedule).forEach(dateStr => {
                        if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
                            const dateYear = parseInt(dateStr.substring(0, 4));
                            if (dateYear === year) {
                                scheduleDates.push(dateStr);
                            }
                        }
                    });
                } else {
                    // Fallback: recursively find all date strings
                    const findDates = (obj) => {
                        if (typeof obj === 'string' && /^\d{4}-\d{2}-\d{2}/.test(obj)) {
                            const dateYear = parseInt(obj.substring(0, 4));
                            if (dateYear === year) {
                                scheduleDates.push(obj);
                            }
                        } else if (Array.isArray(obj)) {
                            obj.forEach(findDates);
                        } else if (typeof obj === 'object' && obj !== null) {
                            Object.values(obj).forEach(findDates);
                        }
                    };
                    findDates(schedule);
                }
                
                console.log(`Found ${scheduleDates.length} schedule dates for ${item.itemName} in year ${year}`);
                
                // If no dates found for the selected year, try to find dates in any year
                if (scheduleDates.length === 0 && schedule && Object.keys(schedule).length > 0) {
                    console.log(`No dates found for year ${year}, checking all years in schedule...`);
                    const allDates = [];
                    const findAnyDates = (obj) => {
                        if (typeof obj === 'string' && /^\d{4}-\d{2}-\d{2}/.test(obj)) {
                            allDates.push(obj);
                        } else if (Array.isArray(obj)) {
                            obj.forEach(findAnyDates);
                        } else if (typeof obj === 'object' && obj !== null) {
                            Object.values(obj).forEach(findAnyDates);
                        }
                    };
                    findAnyDates(schedule);
                    console.log(`Found ${allDates.length} total dates in schedule (any year):`, allDates);
                    
                    // If we found dates in other years, use the most common year or the year of the latest date
                    if (allDates.length > 0) {
                        const years = allDates.map(d => parseInt(d.substring(0, 4)));
                        const yearCounts = {};
                        years.forEach(y => yearCounts[y] = (yearCounts[y] || 0) + 1);
                        const mostCommonYear = Object.keys(yearCounts).reduce((a, b) => yearCounts[a] > yearCounts[b] ? a : b);
                        console.log(`Most common year in schedule: ${mostCommonYear}, but filtering for year: ${year}`);
                    }
                }
            } else {
                console.log(`No maintenanceSchedule found for ${item.itemName}`);
            }

            // Organize dates by month and period
            const monthlySchedule = {};
            console.log(`Processing ${scheduleDates.length} schedule dates for item ${item.itemName}`);
            scheduleDates.forEach(dateStr => {
                try {
                    const date = new Date(dateStr);
                    if (isNaN(date.getTime())) {
                        console.warn(`Invalid date string: ${dateStr}`);
                        return;
                    }
                    const month = date.getMonth() + 1; // 1-12
                    const day = date.getDate(); // 1-31
                    
                    // Determine period: 1-7 (1), 8-14 (2), 15-21 (3), 22-31 (4)
                    let period = 1;
                    if (day >= 22) period = 4;
                    else if (day >= 15) period = 3;
                    else if (day >= 8) period = 2;
                    
                    if (!monthlySchedule[month]) {
                        monthlySchedule[month] = {};
                    }
                    if (!monthlySchedule[month][period]) {
                        monthlySchedule[month][period] = [];
                    }
                    // Store just the day number (e.g., "17", "14", "20")
                    monthlySchedule[month][period].push(String(day));
                    console.log(`Added date: ${dateStr} -> Month ${month}, Period ${period}, Day ${day}`);
                } catch (error) {
                    console.error(`Error processing date ${dateStr}:`, error);
                }
            });
            
            console.log(`Monthly schedule for ${item.itemName}:`, JSON.stringify(monthlySchedule, null, 2));

            // If no tasks, create one entry
            if (tasks.length === 0) {
                tasks.push('No tasks defined');
            }

            // Find latest maintenance date for month display
            let latestDate = null;
            let latestMonth = 'NOV'; // Default
            if (scheduleDates.length > 0) {
                const sortedDates = scheduleDates.map(d => new Date(d)).sort((a, b) => b - a);
                latestDate = sortedDates[0];
                // Get month name from latest date
                const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                latestMonth = monthNames[latestDate.getMonth()];
            } else {
                // If no dates, use current month
                const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                latestMonth = monthNames[new Date().getMonth()];
            }

            // Create checklist entry with header information
            checklist.push({
                // Header information
                companyName: 'Checklist Report',
                branch: item.branch || '-',
                location: item.location || '-',
                itemName: item.itemName || '-',
                month: latestMonth,
                year: year,
                frequency: item.frequency || 'Monthly',
                // Data
                inspectionTasks: tasks,
                schedule: monthlySchedule,
                assignedStaffName: item.assignedStaffName || '-',
                assignedStaffEmail: item.assignedStaffEmail || '-'
            });
        }

        res.json({ ok: true, report: checklist });
    } catch (error) {
        console.error('Error generating checklist report:', error);
        res.status(500).json({ ok: false, error: 'Could not generate report: ' + error.message });
    }
});

// Save report
router.post('/save', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const { reportType, reportName, criteria, reportData, headerInfo } = req.body;

        if (!reportType || !reportName) {
            return res.status(400).json({ ok: false, error: 'reportType and reportName are required' });
        }

        const { Report } = require('../models');
        const report = new Report({
            reportType,
            reportName,
            criteria: criteria || {},
            reportData: reportData || [],
            headerInfo: headerInfo || null,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await report.save();

        res.json({ ok: true, reportId: report._id.toString(), message: 'Report saved successfully' });
    } catch (error) {
        console.error('Error saving report:', error);
        res.status(500).json({ ok: false, error: 'Could not save report: ' + error.message });
    }
});

// List saved reports
router.get('/saved', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const { Report } = require('../models');
        const reports = await Report.find({})
            .sort({ createdAt: -1 })
            .select('reportType reportName createdAt')
            .lean();

        res.json({
            ok: true,
            reports: reports.map(r => ({
                _id: r._id.toString(),
                reportType: r.reportType,
                reportName: r.reportName,
                createdAt: r.createdAt
            }))
        });
    } catch (error) {
        console.error('Error listing saved reports:', error);
        res.status(500).json({ ok: false, error: 'Could not load reports: ' + error.message });
    }
});

// Load saved report
router.get('/load', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const { reportId } = req.query;
        if (!reportId) {
            return res.status(400).json({ ok: false, error: 'reportId is required' });
        }

        const { Report } = require('../models');
        const report = await Report.findById(reportId).lean();

        if (!report) {
            return res.status(404).json({ ok: false, error: 'Report not found' });
        }

        res.json({
            ok: true,
            report: {
                reportType: report.reportType,
                reportName: report.reportName,
                criteria: report.criteria || {},
                reportData: report.reportData || [],
                headerInfo: report.headerInfo || null
            }
        });
    } catch (error) {
        console.error('Error loading saved report:', error);
        res.status(500).json({ ok: false, error: 'Could not load report: ' + error.message });
    }
});

// Export report (CSV or PDF)
router.post('/export', async (req, res) => {
    try {
        // Handle both JSON and form data
        let reportType, format, reportData, criteria;
        
        console.log('=== RAW REQUEST BODY ===');
        console.log('req.body keys:', Object.keys(req.body));
        console.log('req.body.reportType:', req.body.reportType);
        console.log('req.body.format:', req.body.format);
        console.log('req.body.reportData type:', typeof req.body.reportData);
        console.log('req.body.reportData length:', req.body.reportData ? req.body.reportData.length : 'N/A');
        console.log('req.body.criteria type:', typeof req.body.criteria);
        
        if (req.body.reportData && typeof req.body.reportData === 'string') {
            // Form data - parse JSON strings
            reportType = req.body.reportType;
            format = req.body.format;
            
            let parsedData;
            try {
                parsedData = JSON.parse(req.body.reportData);
                console.log('Parsed reportData successfully');
                console.log('Parsed data type:', typeof parsedData);
                console.log('Parsed data is array:', Array.isArray(parsedData));
                console.log('Parsed data keys:', parsedData && typeof parsedData === 'object' ? Object.keys(parsedData) : 'N/A');
            } catch (e) {
                console.error('Error parsing reportData JSON:', e);
                return res.status(400).json({ ok: false, error: 'Invalid reportData JSON: ' + e.message });
            }
            
            // Extract report array and criteria from { report: [...], criteria: {...} } structure
            if (Array.isArray(parsedData)) {
                reportData = parsedData;
                console.log('reportData is direct array, length:', reportData.length);
            } else if (parsedData && typeof parsedData === 'object') {
                // Structure: { report: [...], criteria: {...} }
                reportData = parsedData.report;
                console.log('Extracted report from object, length:', reportData ? reportData.length : 'N/A');
                
                // Extract criteria from parsedData if it exists
                if (parsedData.criteria) {
                    criteria = parsedData.criteria;
                    console.log('Extracted criteria from parsedData');
                }
            } else {
                console.error('Unexpected parsedData structure:', typeof parsedData);
                return res.status(400).json({ ok: false, error: 'Invalid reportData structure' });
            }
            
            // Also check req.body.criteria (form field)
            if (req.body.criteria) {
                try {
                    const parsedCriteria = typeof req.body.criteria === 'string' ? JSON.parse(req.body.criteria) : req.body.criteria;
                    criteria = { ...(criteria || {}), ...parsedCriteria };
                    console.log('Merged criteria from form field');
                } catch (e) {
                    console.warn('Could not parse criteria from form field:', e);
                    // If not JSON, use as is
                    if (typeof req.body.criteria === 'object') {
                        criteria = { ...(criteria || {}), ...req.body.criteria };
                    }
                }
            }
            
            // If no criteria found, use empty object
            if (!criteria) criteria = {};
            
            console.log('Final reportData type:', typeof reportData);
            console.log('Final reportData is array:', Array.isArray(reportData));
            console.log('Final reportData length:', Array.isArray(reportData) ? reportData.length : 'N/A');
        } else {
            // JSON data
            ({ reportType, format, criteria } = req.body);
            const rawData = req.body.reportData;
            // Extract report array from { report: [...] } structure
            if (Array.isArray(rawData)) {
                reportData = rawData;
            } else {
                reportData = rawData?.report || rawData;
                // Extract criteria from rawData if it exists
                if (rawData?.criteria) {
                    criteria = { ...(criteria || {}), ...rawData.criteria };
                }
            }
        }

        console.log('=== EXPORT PARSING RESULT ===');
        console.log('reportType:', reportType);
        console.log('format:', format);
        console.log('criteria:', criteria);
        console.log('reportData type:', typeof reportData);
        console.log('reportData is array:', Array.isArray(reportData));
        console.log('reportData length:', Array.isArray(reportData) ? reportData.length : 'N/A');

        if (!reportType || !format) {
            console.error('Missing reportType or format');
            return res.status(400).json({ ok: false, error: 'reportType and format are required' });
        }

        if (!reportData) {
            console.error('Missing reportData');
            return res.status(400).json({ ok: false, error: 'reportData is required' });
        }

        // Ensure reportData is an array
        if (!Array.isArray(reportData)) {
            console.error('reportData is not an array:', typeof reportData);
            console.error('reportData value:', reportData);
            return res.status(400).json({ ok: false, error: 'reportData must be an array. Received: ' + typeof reportData });
        }

        if (reportData.length === 0) {
            console.warn('reportData is empty array');
        }

        const titles = {
            'asset': 'Asset Report',
            'maintenance': 'Maintenance Report',
            'inspection': 'Inspection Report'
        };
        let title = titles[reportType] || 'Report';
        
        // Force correct title - never use old company name
        if (title.includes('PKT LOGISTICS') || title.includes('PREVENTIVE MAINTENANCE')) {
            title = titles[reportType] || 'Report';
        }
        
        console.log('=== EXPORT REQUEST ===');
        console.log('Report Type:', reportType);
        console.log('Format:', format);
        console.log('Title being used:', title);
        console.log('Criteria:', criteria);
        console.log('Report Data Type:', typeof reportData);
        console.log('Report Data Is Array:', Array.isArray(reportData));
        console.log('Report Data Length:', Array.isArray(reportData) ? reportData.length : 'N/A');
        console.log('Report Data Sample:', Array.isArray(reportData) && reportData.length > 0 ? JSON.stringify(reportData[0], null, 2) : 'No data');

        if (format === 'csv') {
            // Generate CSV
            const csvRows = [];
            
            if (Array.isArray(reportData) && reportData.length > 0) {
                // Headers
                const headers = Object.keys(reportData[0]);
                csvRows.push(headers.join(','));
                
                // Data rows
                reportData.forEach(row => {
                    const values = headers.map(header => {
                        const value = row[header] ?? '';
                        // Escape quotes and wrap in quotes if contains comma
                        const escaped = String(value).replace(/"/g, '""');
                        return escaped.includes(',') ? `"${escaped}"` : escaped;
                    });
                    csvRows.push(values.join(','));
                });
            }

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${title}_${new Date().toISOString().split('T')[0]}.csv"`);
            res.send('\ufeff' + csvRows.join('\n')); // BOM for Excel compatibility
        } else if (format === 'pdf') {
            // For PDF, return HTML that can be printed
            // In production, you might want to use a library like puppeteer or pdfkit
            console.log('Generating PDF with title:', title, 'for reportType:', reportType);
            // Extract headerInfo and criteria if data is in new format
            let headerInfo = null;
            let extractedCriteria = criteria || {};
            
            // Check if reportData is an object with nested structure
            if (reportData && !Array.isArray(reportData) && typeof reportData === 'object') {
                if (reportData.headerInfo) {
                    headerInfo = reportData.headerInfo;
                }
                if (reportData.criteria) {
                    extractedCriteria = { ...extractedCriteria, ...reportData.criteria };
                }
                // Extract the actual report array
                reportData = reportData.report || reportData;
            } else if (req.body.headerInfo) {
                headerInfo = typeof req.body.headerInfo === 'string' ? JSON.parse(req.body.headerInfo) : req.body.headerInfo;
            }
            
            // For maintenance reports, extract headerInfo from criteria and first item
            if (reportType === 'maintenance' && Array.isArray(reportData) && reportData.length > 0) {
                const firstItem = reportData[0];
                
                // Build headerInfo if not already set
                if (!headerInfo) {
                    headerInfo = {
                        companyName: title,
                        branch: firstItem.branch || extractedCriteria.branch || '-',
                        location: firstItem.location || extractedCriteria.location || '-',
                        itemName: firstItem.itemName || extractedCriteria.itemName || '-',
                        month: firstItem.month || 'NOV',
                        year: extractedCriteria.year || firstItem.year || new Date().getFullYear(),
                        frequency: extractedCriteria.frequency || firstItem.frequency || 'Monthly'
                    };
                } else {
                    // Merge with first item data if headerInfo exists but missing fields
                    headerInfo = {
                        companyName: headerInfo.companyName || title,
                        branch: headerInfo.branch || firstItem.branch || extractedCriteria.branch || '-',
                        location: headerInfo.location || firstItem.location || extractedCriteria.location || '-',
                        itemName: headerInfo.itemName || firstItem.itemName || extractedCriteria.itemName || '-',
                        month: headerInfo.month || firstItem.month || 'NOV',
                        year: headerInfo.year || extractedCriteria.year || firstItem.year || new Date().getFullYear(),
                        frequency: headerInfo.frequency || extractedCriteria.frequency || firstItem.frequency || 'Monthly'
                    };
                }
            }
            
            console.log('=== PDF EXPORT DEBUG ===');
            console.log('headerInfo:', JSON.stringify(headerInfo, null, 2));
            console.log('extractedCriteria:', JSON.stringify(extractedCriteria, null, 2));
            console.log('reportData type:', typeof reportData);
            console.log('reportData is array:', Array.isArray(reportData));
            console.log('reportData length:', Array.isArray(reportData) ? reportData.length : 'N/A');
            if (Array.isArray(reportData) && reportData.length > 0) {
                console.log('First item keys:', Object.keys(reportData[0]));
                console.log('First item has schedule:', !!reportData[0].schedule);
                console.log('First item sample:', JSON.stringify(reportData[0], null, 2));
            } else {
                console.error('ERROR: reportData is empty or not an array!');
                console.error('reportData value:', reportData);
                console.error('req.body:', JSON.stringify(req.body, null, 2));
            }
            
            // Only generate PDF if we have data
            if (!Array.isArray(reportData) || reportData.length === 0) {
                const errorHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Export Error</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
    .error { color: red; font-size: 18px; margin: 20px 0; }
    .debug { font-size: 12px; color: #666; margin-top: 20px; }
  </style>
</head>
<body>
  <h1>Export Error</h1>
  <p class="error">No data available to export.</p>
  <p>Please generate a report with data first, then try exporting again.</p>
  <div class="debug">
    <p>Debug Info:</p>
    <p>Report Type: ${reportType || 'N/A'}</p>
    <p>Format: ${format || 'N/A'}</p>
    <p>Data Type: ${typeof reportData}</p>
    <p>Data Length: ${Array.isArray(reportData) ? reportData.length : 'N/A'}</p>
  </div>
</body>
</html>`;
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                return res.send(errorHtml);
            }
            
            const html = generatePDFHTML(reportData, title, reportType, extractedCriteria, headerInfo);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            res.send(html);
        } else {
            return res.status(400).json({ ok: false, error: 'Invalid format. Use "csv" or "pdf"' });
        }
    } catch (error) {
        console.error('Error exporting report:', error);
        res.status(500).json({ ok: false, error: 'Could not export report: ' + error.message });
    }
});

function generatePDFHTML(data, title, reportType, criteria, headerInfoFromRequest = null) {
    // Force correct title - NEVER use old company name or maintenance checklist text
    const titles = {
        'asset': 'Asset Report',
        'maintenance': 'Maintenance Report',
        'inspection': 'Inspection Report'
    };
    
    // Always use the correct title based on report type, ignore any passed title that contains old text
    title = titles[reportType] || 'Report';
    
    console.log('=== PDF HTML GENERATION ===');
    console.log('Report Type:', reportType);
    console.log('Final Title:', title);
    
    const currentDate = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }) + ' MYT';
    const logoText = 'Inventory Maintenance Inspection v1.0';
    
    // Get header info for checklist/maintenance reports
    // Use passed headerInfo if available, otherwise extract from data
    let headerInfo = headerInfoFromRequest;
    if (!headerInfo && reportType === 'maintenance' && Array.isArray(data) && data.length > 0) {
        const firstItem = data[0];
        const titles = {
            'asset': 'Asset Report',
            'maintenance': 'Maintenance Report',
            'inspection': 'Inspection Report'
        };
        headerInfo = {
            companyName: titles[reportType] || 'Report',
            branch: firstItem.branch || criteria.branch || '-',
            location: firstItem.location || criteria.location || '-',
            itemName: firstItem.itemName || criteria.itemName || '-',
            month: firstItem.month || 'NOV',
            year: criteria.year || firstItem.year || new Date().getFullYear(),
            frequency: criteria.frequency || firstItem.frequency || 'Monthly'
        };
    }
    
    console.log('=== PDF HTML GENERATION ===');
    console.log('Title received:', title);
    console.log('Report type:', reportType);
    console.log('Title will be used in header');
    
    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @media print {
      @page { 
        size: portrait;
        margin: 0.5cm;
      }
    }
    body { 
      font-family: Arial, sans-serif; 
      margin: 15px; 
      font-size: 11px;
    }
    .header { 
      display: flex; 
      justify-content: space-between; 
      align-items: flex-start; 
      margin-bottom: 15px; 
      padding-bottom: 12px; 
      border-bottom: 2px solid #140958; 
    }
    .header-left { 
      display: flex; 
      align-items: center; 
      gap: 12px; 
    }
    .header-logo-text { 
      font-size: 12px; 
      font-weight: bold; 
      color: #140958; 
      max-width: 120px;
      line-height: 1.2;
    }
    .header-text { 
      display: flex; 
      flex-direction: column; 
    }
    .company-name { 
      font-size: 14px; 
      font-weight: bold; 
      color: #140958; 
      margin-bottom: 4px; 
    }
    .report-type { 
      font-size: 11px; 
      color: #333; 
      font-weight: 600; 
    }
    .header-right { 
      text-align: right; 
    }
    .report-date { 
      font-size: 10px; 
      color: #666; 
    }
    .checklist-info { 
      margin: 12px 0; 
      padding: 10px; 
      border: 1px solid #ddd; 
      border-radius: 5px; 
      background: #f9f9f9; 
      font-size: 10px;
    }
    .checklist-info-grid { 
      display: grid; 
      grid-template-columns: repeat(2, 1fr); 
      gap: 6px; 
      margin-bottom: 6px; 
    }
    .checklist-info-item { 
      display: flex; 
      gap: 4px; 
    }
    .checklist-info-label { 
      font-weight: 600; 
    }
    .checklist-check { 
      display: flex; 
      align-items: center; 
      gap: 10px; 
      margin-top: 6px; 
      padding-top: 6px; 
      border-top: 1px solid #ddd; 
    }
    .check-option { 
      display: flex; 
      align-items: center; 
      gap: 4px; 
    }
    .check-box { 
      width: 14px; 
      height: 14px; 
      border: 2px solid #333; 
      border-radius: 3px; 
      display: inline-flex; 
      align-items: center; 
      justify-content: center; 
      font-size: 9px;
    }
    .check-box.checked { 
      background: #140958; 
      border-color: #140958; 
      color: white; 
    }
    h1 {
      font-size: 16px;
      margin: 12px 0;
      text-align: center;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-top: 12px; 
      font-size: 10px;
      table-layout: fixed;
    }
    th { 
      background: #f1f3f5; 
      padding: 0.15rem 0.2rem; 
      text-align: center; 
      border: 1px solid #ddd; 
      font-weight: 600; 
      font-size: 9px;
    }
    td { 
      padding: 0.1rem 0.15rem; 
      border: 1px solid #ddd; 
      font-size: 9px;
      text-align: center;
      word-wrap: break-word;
      overflow: hidden;
    }
    /* NO column */
    table th:first-child,
    table td:first-child {
      width: 20px;
      min-width: 20px;
      max-width: 20px;
      font-size: 9px;
      padding: 0.15rem 0.1rem;
    }
    /* INSPECTION HARDWARE column - make it more readable */
    table th:nth-child(2),
    table td:nth-child(2) {
      width: 120px;
      min-width: 120px;
      max-width: 120px;
      text-align: left;
      font-size: 9px;
      padding: 0.1rem 0.15rem;
      line-height: 1.3;
      font-weight: 500;
    }
    /* Month header columns - ensure all 12 months fit */
    table th[colspan="4"] {
      width: calc((100% - 140px) / 12);
      min-width: 0;
      padding: 0.15rem 0.1rem;
      font-size: 9px;
    }
    /* Period columns */
    table th:not(:first-child):not(:nth-child(2)),
    table td:not(:first-child):not(:nth-child(2)) {
      width: calc((100% - 140px) / 48);
      min-width: 0;
      padding: 0.1rem 0.12rem;
      font-size: 8.5px;
    }
    tr:nth-child(even) { 
      background: #f8f9fa; 
    }
    .footer { 
      margin-top: 15px; 
      text-align: center; 
      color: #666; 
      font-size: 9px; 
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="header-logo-text">${escapeHtml(logoText)}</div>
      <div class="header-text">
        <div style="font-size: 9px; color: #666; margin-top: 4px;">
          <span>Form No: PKT-FR71</span> | 
          <span>Revision No: 02</span> | 
          <span>Effective Date: 28 JUL 2025</span>
        </div>
      </div>
    </div>
    <div class="header-right">
      <div class="report-date"><strong>Report Date:</strong><br>${escapeHtml(currentDate)}</div>
    </div>
  </div>`;
    
    // Add checklist header info if available
    if (headerInfo) {
        html += `
  <div class="checklist-info">
    <div class="checklist-info-grid" style="grid-template-columns: repeat(3, 1fr);">
      <div class="checklist-info-item">
        <span class="checklist-info-label">Name:</span>
        <span>PKT LOGISTICS(M) SDN BHD</span>
      </div>
      <div class="checklist-info-item">
        <span class="checklist-info-label">Location:</span>
        <span>${escapeHtml(headerInfo.location || 'HQ - SHAH ALAM, LOT 10')}</span>
      </div>
      <div class="checklist-info-item">
        <span class="checklist-info-label">Room:</span>
        <span>SERVER ROOM</span>
      </div>
      <div class="checklist-info-item">
        <span class="checklist-info-label">Item Name:</span>
        <span style="color: #dc2626; font-weight: 600;">${escapeHtml(headerInfo.itemName)}</span>
      </div>
      <div class="checklist-info-item">
        <span class="checklist-info-label">Month:</span>
        <span>${escapeHtml(headerInfo.month || 'NOV')}</span>
      </div>
      <div class="checklist-info-item">
        <span class="checklist-info-label">Year:</span>
        <span>${escapeHtml(headerInfo.year || new Date().getFullYear())}</span>
      </div>
    </div>
    <div class="checklist-check">
      <span class="checklist-info-label">Checklist Frequency:</span>
      <div class="check-option">
        <span class="check-box ${headerInfo.frequency === 'Weekly' ? 'checked' : ''}">${headerInfo.frequency === 'Weekly' ? '✓' : ''}</span>
        <span>Weekly</span>
      </div>
      <div class="check-option">
        <span class="check-box ${headerInfo.frequency === 'Monthly' ? 'checked' : ''}">${headerInfo.frequency === 'Monthly' ? '✓' : ''}</span>
        <span>Monthly</span>
      </div>
      <div class="check-option">
        <span class="check-box ${headerInfo.frequency === 'Quarterly' ? 'checked' : ''}">${headerInfo.frequency === 'Quarterly' ? '✓' : ''}</span>
        <span>Quarterly</span>
      </div>
    </div>
  </div>`;
    }
    
    html += `  <h1>${escapeHtml(title)}</h1>`;

    // Debug logging
    console.log('=== PDF HTML DATA CHECK ===');
    console.log('Data type:', typeof data);
    console.log('Is array:', Array.isArray(data));
    console.log('Data length:', Array.isArray(data) ? data.length : 'N/A');
    console.log('Report Type:', reportType);
    if (Array.isArray(data) && data.length > 0) {
        console.log('Data sample:', JSON.stringify(data[0], null, 2));
        console.log('First Item Keys:', Object.keys(data[0]));
        console.log('First Item Schedule:', data[0].schedule ? 'Has schedule' : 'No schedule');
        if (data[0].schedule) {
            console.log('Schedule type:', typeof data[0].schedule);
            console.log('Schedule keys:', Object.keys(data[0].schedule));
        }
    } else {
        console.log('No data or not an array');
    }

    if (Array.isArray(data) && data.length > 0) {
        // Check if data has checklist structure (has schedule property with month/period structure)
        const hasChecklistStructure = data.some(item => 
            item.schedule && typeof item.schedule === 'object' && 
            (item.inspectionTasks || item.itemName)
        );
        
        console.log('=== PDF GENERATION CHECK ===');
        console.log('Report Type:', reportType);
        console.log('Has Checklist Structure:', hasChecklistStructure);
        
        // For maintenance/checklist reports, ALWAYS use checklist format
        // Maintenance reports should always display as checklist table
        if (reportType === 'maintenance') {
            // Special formatting for checklist/maintenance report with colored date squares
            // Match exact format from image: First row has "INSPECTION HARDWARE" and month names
            const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            
            html += '<table><thead>';
            // First header row: "INSPECTION HARDWARE" and month names (exactly as in image)
            html += '<tr>';
            html += '<th rowspan="2" style="width: 40px; text-align: center; vertical-align: middle;">NO</th>';
            html += '<th rowspan="2" style="width: 250px; text-align: left; vertical-align: middle; padding-left: 8px;">INSPECTION HARDWARE</th>';
            months.forEach(month => {
                html += `<th colspan="4" style="text-align: center; font-weight: 700; font-size: 10px; vertical-align: middle;">${month}</th>`;
            });
            html += '</tr>';
            // Second header row: period numbers (1, 2, 3, 4) under each month
            html += '<tr>';
            for (let i = 0; i < 12; i++) {
                for (let p = 1; p <= 4; p++) {
                    html += `<th style="text-align: center; font-weight: 600; font-size: 9px; vertical-align: middle;">${p}</th>`;
                }
            }
            html += '</tr></thead><tbody>';
            
            let rowNum = 1;
            data.forEach(item => {
                const tasks = Array.isArray(item.inspectionTasks) 
                    ? item.inspectionTasks 
                    : (typeof item.inspectionTasks === 'string' ? item.inspectionTasks.split('\n').map(t => t.trim()).filter(t => t) : []);
                const schedule = item.schedule || {};
                
                if (tasks.length === 0) {
                    tasks.push(item.itemName || 'No tasks defined');
                }
                
                tasks.forEach(task => {
                    html += '<tr>';
                    html += `<td style="text-align: center; font-weight: 600;">${rowNum}</td>`;
                    html += `<td style="text-align: left; padding-left: 8px;">${escapeHtml(task || '-')}</td>`;
                    
                    for (let month = 1; month <= 12; month++) {
                        for (let period = 1; period <= 4; period++) {
                            if (schedule[month] && schedule[month][period]) {
                                const dates = schedule[month][period];
                                html += '<td style="text-align: center; padding: 4px; vertical-align: middle;">';
                                
                                if (Array.isArray(dates) && dates.length > 0) {
                                    // Check if dates are objects with day and class
                                    const firstDate = dates[0];
                                    if (typeof firstDate === 'object' && firstDate.day) {
                                        // New format: dates are objects with {day, class}
                                        dates.forEach((dateObj, idx) => {
                                            let bgColor, textColor, borderColor;
                                            // Match checklist colors exactly: green for completed, red for fault, black for pending, grey for upcoming
                                            if (dateObj.class === 'completed') {
                                                bgColor = '#16a34a'; // Green background
                                                textColor = '#ffffff'; // White text
                                                borderColor = '#15803d';
                                            } else if (dateObj.class === 'fault') {
                                                bgColor = '#dc2626'; // Red background
                                                textColor = '#ffffff'; // White text
                                                borderColor = '#b91c1c';
                                            } else if (dateObj.class === 'pending') {
                                                bgColor = '#000000'; // Black background
                                                textColor = '#ffffff'; // White text
                                                borderColor = '#000000';
                                            } else if (dateObj.class === 'upcoming') {
                                                bgColor = '#9ca3af'; // Grey background
                                                textColor = '#000000'; // Black text
                                                borderColor = '#9ca3af';
                                            } else {
                                                bgColor = '#000000'; // Default: black for pending
                                                textColor = '#ffffff';
                                                borderColor = '#000000';
                                            }
                                            
                                            // Add spacing between multiple dates in same cell
                                            const marginRight = idx < dates.length - 1 ? '3px' : '0';
                                            html += `<span style="display: inline-block; width: 22px; height: 22px; background: ${bgColor}; color: ${textColor}; border: 1px solid ${borderColor}; border-radius: 2px; text-align: center; line-height: 22px; font-size: 10px; font-weight: 600; margin-right: ${marginRight}; vertical-align: middle;">${escapeHtml(dateObj.day)}</span>`;
                                        });
                                    } else {
                                        // Old format: dates are just strings - display as normal (black text on white)
                                        dates.forEach((date, idx) => {
                                            const marginRight = idx < dates.length - 1 ? '3px' : '0';
                                            html += `<span style="display: inline-block; width: 22px; height: 22px; background: #ffffff; color: #000000; border: 1px solid #000000; border-radius: 2px; text-align: center; line-height: 22px; font-size: 10px; font-weight: 600; margin-right: ${marginRight}; vertical-align: middle;">${escapeHtml(String(date))}</span>`;
                                        });
                                    }
                                } else {
                                    html += escapeHtml(String(dates));
                                }
                                
                                html += '</td>';
                            } else {
                                html += '<td style="padding: 4px;"></td>';
                            }
                        }
                    }
                    html += '</tr>';
                    rowNum++;
                });
            });
            
            html += '</tbody></table>';
        } else if (reportType === 'inspection') {
            // Special format for inspection report with header info
            const headerInfo = headerInfoFromRequest || (data && data.headerInfo) || {
                companyName: 'PKT Logistics Group',
                reportTitle: 'Maintenance Inspection Report',
                branch: criteria.branch || '-',
                location: criteria.location || '-',
                inspectionType: criteria.frequency || '-',
                itemName: criteria.itemName || '-',
                monthYear: '-',
                inspectionDate: criteria.inspectionDate || '-'
            };
            
            // Add header info section
            html += `
  <div class="checklist-info" style="margin-bottom: 15px;">
    <div class="checklist-info-grid">
      <div class="checklist-info-item">
        <span class="checklist-info-label">Company Name:</span>
        <span>${escapeHtml(headerInfo.companyName)}</span>
      </div>
      <div class="checklist-info-item">
        <span class="checklist-info-label">Report Title:</span>
        <span>${escapeHtml(headerInfo.reportTitle)}</span>
      </div>
      <div class="checklist-info-item">
        <span class="checklist-info-label">Branch:</span>
        <span>${escapeHtml(headerInfo.branch)}</span>
      </div>
      <div class="checklist-info-item">
        <span class="checklist-info-label">Location:</span>
        <span>${escapeHtml(headerInfo.location)}</span>
      </div>
      <div class="checklist-info-item">
        <span class="checklist-info-label">Inspection Type:</span>
        <span>${escapeHtml(headerInfo.inspectionType)}</span>
      </div>
      <div class="checklist-info-item">
        <span class="checklist-info-label">Item Name:</span>
        <span>${escapeHtml(headerInfo.itemName)}</span>
      </div>
      <div class="checklist-info-item">
        <span class="checklist-info-label">Month / Year:</span>
        <span>${escapeHtml(headerInfo.monthYear)}</span>
      </div>
      <div class="checklist-info-item">
        <span class="checklist-info-label">Inspection Date:</span>
        <span>${escapeHtml(headerInfo.inspectionDate)}</span>
      </div>
    </div>
  </div>`;
            
            // Create table with specific columns (including Task)
            html += '<table><thead><tr>';
            html += '<th>Task</th>';
            html += '<th>Asset ID</th>';
            html += '<th>Asset Name</th>';
            html += '<th>Serial Number</th>';
            html += '<th>Inspection Date</th>';
            html += '<th>Status</th>';
            html += '<th>Remarks</th>';
            html += '<th>Inspector</th>';
            html += '</tr></thead><tbody>';
            
            let currentTask = '';
            data.forEach((item, index) => {
                const isTotalRow = item['Task'] === 'TOTAL';
                
                html += '<tr>';
                if (isTotalRow) {
                    html += `<td style="background: #f1f3f5; font-weight: 700;">${escapeHtml(item['Task'] || '-')}</td>`;
                } else {
                    // Only show task name if different from previous
                    if (item['Task'] !== currentTask) {
                        html += `<td style="font-weight: 600;">${escapeHtml(item['Task'] || '-')}</td>`;
                        currentTask = item['Task'];
                    } else {
                        html += '<td></td>'; // Empty for same task
                    }
                }
                
                html += `<td>${escapeHtml(item['Asset ID'] || '-')}</td>`;
                html += `<td>${escapeHtml(item['Asset Name'] || '-')}</td>`;
                html += `<td>${escapeHtml(item['Serial Number'] || '-')}</td>`;
                html += `<td>${escapeHtml(item['Inspection Date'] || '-')}</td>`;
                
                // Status with color coding
                const status = item['Status'] || '-';
                let statusColor = '#333';
                if (status === 'Good') statusColor = '#16a34a';
                else if (status === 'Attention') statusColor = '#f59e0b';
                else if (status === 'Faulty') statusColor = '#dc2626';
                
                if (isTotalRow) {
                    html += `<td style="background: #f1f3f5; font-weight: 700;">${escapeHtml(status)}</td>`;
                } else {
                    html += `<td style="color: ${statusColor}; font-weight: 600;">${escapeHtml(status)}</td>`;
                }
                
                html += `<td>${escapeHtml(item['Remarks'] || '-')}</td>`;
                html += `<td>${escapeHtml(item['Inspector'] || '-')}</td>`;
                html += '</tr>';
            });
            
            html += '</tbody></table>';
        } else {
            // Standard table format for other reports
            html += '<table><thead><tr>';
            const headers = Object.keys(data[0]);
            headers.forEach(header => {
                html += `<th>${escapeHtml(header)}</th>`;
            });
            html += '</tr></thead><tbody>';
            
            data.forEach(row => {
                html += '<tr>';
                headers.forEach(header => {
                    html += `<td>${escapeHtml(String(row[header] ?? ''))}</td>`;
                });
                html += '</tr>';
            });
            
            html += '</tbody></table>';
        }
    } else {
        html += '<p style="color: red; font-weight: bold; padding: 20px; text-align: center;">No data available for export.</p>';
        html += '<p style="text-align: center; color: #666;">Please generate a report with data first.</p>';
    }

    html += `<div class="footer">Total Records: ${Array.isArray(data) ? data.length : 0}</div>
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`;

    return html;
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = { textContent: text };
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Delete saved report
router.post('/delete', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const { reportId } = req.body;
        if (!reportId) {
            return res.status(400).json({ ok: false, error: 'reportId is required' });
        }

        const { Report } = require('../models');
        const result = await Report.deleteOne({ _id: new mongoose.Types.ObjectId(reportId) });

        if (result.deletedCount > 0) {
            res.json({ ok: true, message: 'Report deleted successfully' });
        } else {
            res.status(404).json({ ok: false, error: 'Report not found' });
        }
    } catch (error) {
        console.error('Error deleting report:', error);
        res.status(500).json({ ok: false, error: 'Could not delete report: ' + error.message });
    }
});

module.exports = router;

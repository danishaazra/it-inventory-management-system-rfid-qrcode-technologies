// Report API routes
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { Asset, Maintenance, MaintenanceAsset, User } = require('../models');

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

        // Get unique locations from assets
        const assets = await Asset.find({
            locationDescription: { $exists: true, $ne: null, $ne: '' }
        }).select('locationDescription branchCode').lean();

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

        res.json({
            ok: true,
            locations: allLocations,
            branches: allBranches,
            staff: allStaff
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

        // Date range filter
        if (criteria.dateFrom || criteria.dateTo) {
            filter.created_at = {};
            if (criteria.dateFrom) {
                filter.created_at.$gte = new Date(criteria.dateFrom);
            }
            if (criteria.dateTo) {
                const dateTo = new Date(criteria.dateTo);
                dateTo.setHours(23, 59, 59, 999);
                filter.created_at.$lte = dateTo;
            }
        }

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

// Generate maintenance report
router.post('/generate-maintenance', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const criteria = req.body;
        const filter = {};

        if (criteria.branch) filter.branch = criteria.branch;
        if (criteria.location) filter.location = criteria.location;
        if (criteria.frequency) filter.frequency = criteria.frequency;
        if (criteria.staff) filter.assignedStaffName = criteria.staff;

        const maintenance = await Maintenance.find(filter).sort({ itemName: 1 }).lean();

        const report = maintenance.map(item => ({
            'Branch': item.branch || '-',
            'Location': item.location || '-',
            'Item Name': item.itemName || '-',
            'Frequency': item.frequency || '-',
            'Assigned Staff': item.assignedStaffName || '-',
            'Created Date': item.created_at ? new Date(item.created_at).toLocaleDateString() : '-'
        }));

        res.json({ ok: true, report });
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

        if (criteria.status) {
            filter.inspectionStatus = criteria.status;
        }

        const inspections = await MaintenanceAsset.find(filter)
            .sort({ inspectionDate: -1 })
            .lean();

        const report = [];
        for (const inspection of inspections) {
            const asset = await Asset.findOne({ assetId: inspection.assetId }).lean();
            if (asset) {
                report.push({
                    'Asset ID': asset.assetId || '-',
                    'Description': asset.assetDescription || '-',
                    'Inspection Status': inspection.inspectionStatus || '-',
                    'Inspection Date': inspection.inspectionDate 
                        ? new Date(inspection.inspectionDate).toLocaleDateString() 
                        : '-',
                    'Notes': inspection.inspectionNotes || '-',
                    'Solved': inspection.solved ? 'Yes' : 'No'
                });
            }
        }

        res.json({ ok: true, report });
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
                companyName: 'PKT LOGISTICS (M) SDN BHD',
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

        const { reportType, reportName, criteria } = req.body;

        if (!reportType || !reportName) {
            return res.status(400).json({ ok: false, error: 'reportType and reportName are required' });
        }

        const { Report } = require('../models');
        const report = new Report({
            reportType,
            reportName,
            criteria,
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
                criteria: report.criteria
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
        
        if (req.body.reportData && typeof req.body.reportData === 'string') {
            // Form data - parse JSON strings
            reportType = req.body.reportType;
            format = req.body.format;
            reportData = JSON.parse(req.body.reportData);
            criteria = req.body.criteria ? JSON.parse(req.body.criteria) : {};
        } else {
            // JSON data
            ({ reportType, format, reportData, criteria } = req.body);
        }

        if (!reportType || !format || !reportData) {
            return res.status(400).json({ ok: false, error: 'reportType, format, and reportData are required' });
        }

        const titles = {
            'asset': 'Asset Report',
            'maintenance': 'Maintenance Report',
            'inspection': 'Inspection Report',
            'checklist': 'Checklist Report'
        };
        const title = titles[reportType] || 'Report';

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
            const html = generatePDFHTML(reportData, title, reportType, criteria || {});
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(html);
        } else {
            return res.status(400).json({ ok: false, error: 'Invalid format. Use "csv" or "pdf"' });
        }
    } catch (error) {
        console.error('Error exporting report:', error);
        res.status(500).json({ ok: false, error: 'Could not export report: ' + error.message });
    }
});

function generatePDFHTML(data, title, reportType, criteria) {
    const currentDate = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }) + ' MYT';
    const logoPath = '/images/pkt_logo.png';
    
    // Get header info for checklist reports
    let headerInfo = null;
    if (reportType === 'checklist' && Array.isArray(data) && data.length > 0) {
        const firstItem = data[0];
        headerInfo = {
            companyName: firstItem.companyName || 'PKT LOGISTICS (M) SDN BHD',
            branch: firstItem.branch || '-',
            location: firstItem.location || '-',
            itemName: firstItem.itemName || '-',
            month: firstItem.month || 'NOV',
            year: firstItem.year || new Date().getFullYear(),
            frequency: firstItem.frequency || 'Monthly'
        };
    }
    
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
    .header-logo { 
      width: 60px; 
      height: 60px; 
      object-fit: contain; 
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
      font-size: 8px;
      table-layout: fixed;
    }
    th { 
      background: #f1f3f5; 
      padding: 0.2rem 0.25rem; 
      text-align: center; 
      border: 1px solid #ddd; 
      font-weight: 600; 
      font-size: 8px;
    }
    td { 
      padding: 0.15rem 0.2rem; 
      border: 1px solid #ddd; 
      font-size: 7.5px;
      text-align: center;
      word-wrap: break-word;
      overflow: hidden;
    }
    /* NO column */
    table th:first-child,
    table td:first-child {
      width: 25px;
      min-width: 25px;
      max-width: 25px;
      font-size: 8px;
      padding: 0.2rem 0.15rem;
    }
    /* INSPECTION HARDWARE column */
    table th:nth-child(2),
    table td:nth-child(2) {
      width: 90px;
      min-width: 90px;
      max-width: 90px;
      text-align: left;
      font-size: 7.5px;
      padding: 0.15rem 0.2rem;
      line-height: 1.2;
    }
    /* Month header columns - ensure all 12 months fit */
    table th[colspan="4"] {
      width: calc((100% - 115px) / 12);
      min-width: 0;
      padding: 0.2rem 0.15rem;
      font-size: 8px;
    }
    /* Period columns */
    table th:not(:first-child):not(:nth-child(2)),
    table td:not(:first-child):not(:nth-child(2)) {
      width: calc((100% - 115px) / 48);
      min-width: 0;
      padding: 0.15rem 0.18rem;
      font-size: 7.5px;
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
      <img src="${logoPath}" alt="PKT Logo" class="header-logo" onerror="this.style.display='none'">
      <div class="header-text">
        <div class="company-name">PKT LOGISTICS (M) SDN BHD</div>
        <div class="report-type">ICT - PREVENTIVE MAINTENANCE CHECKLIST</div>
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
    <div class="checklist-info-grid">
      <div class="checklist-info-item">
        <span class="checklist-info-label">COMPANY NAME:</span>
        <span>${escapeHtml(headerInfo.companyName)}</span>
      </div>
      <div class="checklist-info-item">
        <span class="checklist-info-label">BRANCH:</span>
        <span>${escapeHtml(headerInfo.branch)}</span>
      </div>
      <div class="checklist-info-item">
        <span class="checklist-info-label">LOCATION:</span>
        <span>${escapeHtml(headerInfo.location)}</span>
      </div>
      <div class="checklist-info-item">
        <span class="checklist-info-label">ITEM NAME:</span>
        <span>${escapeHtml(headerInfo.itemName)}</span>
      </div>
      <div class="checklist-info-item">
        <span class="checklist-info-label">MONTH:</span>
        <span>${escapeHtml(headerInfo.month)}</span>
      </div>
      <div class="checklist-info-item">
        <span class="checklist-info-label">YEAR:</span>
        <span>${escapeHtml(headerInfo.year)}</span>
      </div>
    </div>
    <div class="checklist-check">
      <span class="checklist-info-label">CHECK:</span>
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

    if (Array.isArray(data) && data.length > 0) {
        if (reportType === 'checklist') {
            // Special formatting for checklist report
            const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
            html += '<table><thead><tr>';
            html += '<th>NO</th><th>INSPECTION HARDWARE</th>';
            months.forEach(month => {
                html += `<th colspan="4">${month}</th>`;
            });
            html += '</tr><tr><th></th><th></th>';
            for (let i = 0; i < 12; i++) {
                for (let p = 1; p <= 4; p++) {
                    html += `<th>${p}</th>`;
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
                    html += `<td>${rowNum}</td>`;
                    html += `<td>${escapeHtml(task || '-')}</td>`;
                    
                    for (let month = 1; month <= 12; month++) {
                        for (let period = 1; period <= 4; period++) {
                            if (schedule[month] && schedule[month][period]) {
                                const dates = schedule[month][period];
                                if (Array.isArray(dates)) {
                                    html += `<td>${escapeHtml(dates.join(', '))}</td>`;
                                } else {
                                    html += `<td>${escapeHtml(String(dates))}</td>`;
                                }
                            } else {
                                html += '<td></td>';
                            }
                        }
                    }
                    html += '</tr>';
                    rowNum++;
                });
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
        html += '<p>No data available</p>';
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

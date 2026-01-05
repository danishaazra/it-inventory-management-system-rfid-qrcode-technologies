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

        // Year filter
        const year = criteria.year ? parseInt(criteria.year) : new Date().getFullYear();

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

            // Extract schedule dates for the specified year
            const scheduleDates = [];
            if (item.maintenanceSchedule) {
                const schedule = typeof item.maintenanceSchedule === 'object' 
                    ? item.maintenanceSchedule 
                    : JSON.parse(item.maintenanceSchedule || '{}');
                
                // Recursively find all date strings in the schedule
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

            // Organize dates by month and period
            const monthlySchedule = {};
            scheduleDates.forEach(dateStr => {
                const date = new Date(dateStr);
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
            });

            // If no tasks, create one entry
            if (tasks.length === 0) {
                tasks.push('No tasks defined');
            }

            // Create checklist entry
            checklist.push({
                branch: item.branch || '-',
                location: item.location || '-',
                itemName: item.itemName || '-',
                frequency: item.frequency || '-',
                inspectionTasks: tasks,
                schedule: monthlySchedule,
                year: year,
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
    
    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @media print {
      @page { margin: 20mm; }
    }
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #140958; }
    .header-left { display: flex; align-items: center; gap: 15px; }
    .header-logo { width: 80px; height: 80px; object-fit: contain; }
    .header-text { display: flex; flex-direction: column; }
    .company-name { font-size: 18px; font-weight: bold; color: #140958; margin-bottom: 5px; }
    .report-type { font-size: 14px; color: #333; font-weight: 600; }
    .header-right { text-align: right; }
    .report-date { font-size: 12px; color: #666; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #f1f3f5; padding: 10px; text-align: left; border: 1px solid #ddd; font-weight: 600; }
    td { padding: 8px; border: 1px solid #ddd; }
    tr:nth-child(even) { background: #f8f9fa; }
    .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
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
  </div>
  <h1>${escapeHtml(title)}</h1>`;

    if (Array.isArray(data) && data.length > 0) {
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

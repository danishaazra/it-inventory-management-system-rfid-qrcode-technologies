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

        if (criteria.branch) filter.branch = criteria.branch;
        if (criteria.location) filter.location = criteria.location;
        if (criteria.frequency) filter.frequency = criteria.frequency;
        if (criteria.itemName) filter.itemName = { $regex: criteria.itemName, $options: 'i' };

        const maintenance = await Maintenance.find(filter).sort({ itemName: 1 }).lean();

        // Get year from criteria or use current year
        const year = criteria.year || new Date().getFullYear();

        // Build checklist format
        const checklist = maintenance.map((item, index) => {
            const row = {
                'NO': index + 1,
                'INSPECTION HARDWARE': item.itemName || '-'
            };

            // Add months (JAN-DEC) with 4 sub-columns each
            const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
            months.forEach(month => {
                row[`${month}_1`] = '';
                row[`${month}_2`] = '';
                row[`${month}_3`] = '';
                row[`${month}_4`] = '';
            });

            return row;
        });

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

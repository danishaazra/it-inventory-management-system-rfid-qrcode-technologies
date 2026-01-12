// Inspection API routes
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { MaintenanceAsset, Maintenance } = require('../models');

// Helper to check MongoDB connection
function checkDBConnection(res) {
    if (mongoose.connection.readyState !== 1) {
        res.status(500).json({ ok: false, error: 'Database connection not available' });
        return false;
    }
    return true;
}

// Save inspection for maintenance asset
router.post('/save', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const { maintenanceId, branch, location, itemName, assetId, notes, solved, inspectorId, inspectorName, staffId } = req.body;

        if (!assetId) {
            return res.status(400).json({ ok: false, error: 'assetId is required' });
        }

        let filter = {};
        if (maintenanceId) {
            filter = { maintenanceId, assetId };
        } else if (branch && location && itemName) {
            // Find maintenance by branch/location/itemName
            const maintenance = await Maintenance.findOne({ branch, location, itemName });
            if (!maintenance) {
                return res.status(404).json({ ok: false, error: 'Maintenance task not found' });
            }
            filter = { maintenanceId: maintenance._id.toString(), assetId };
        } else if (staffId) {
            // If staffId is provided, find the maintenance asset that belongs to staff's assigned tasks
            // 1) Find maintenance tasks assigned to this staff member
            const assignedMaintenance = await Maintenance.find({ assignedStaffId: staffId }).select('_id').lean();
            const assignedMaintenanceIds = assignedMaintenance.map(m => m._id.toString());

            if (assignedMaintenanceIds.length === 0) {
                return res.status(403).json({
                    ok: false,
                    error: 'No maintenance tasks assigned to this staff member'
                });
            }

            // 2) Find maintenance asset for this assetId that belongs to staff's tasks
            filter = {
                assetId: assetId,
                maintenanceId: { $in: assignedMaintenanceIds }
            };
        } else {
            return res.status(400).json({ 
                ok: false, 
                error: 'maintenanceId is required, or provide branch, location, and itemName, or staffId' 
            });
        }

        const maintenanceAsset = await MaintenanceAsset.findOne(filter);
        if (!maintenanceAsset) {
            return res.status(404).json({ ok: false, error: 'Asset not found in maintenance task' });
        }

        maintenanceAsset.inspectionStatus = solved ? 'complete' : 'open';
        maintenanceAsset.inspectionNotes = notes;
        maintenanceAsset.solved = solved || false;
        maintenanceAsset.inspectionDate = new Date();
        maintenanceAsset.updatedAt = new Date();
        if (inspectorId) maintenanceAsset.inspectorId = inspectorId;
        if (inspectorName) maintenanceAsset.inspectorName = inspectorName;

        await maintenanceAsset.save();

        res.json({ ok: true, message: 'Inspection saved successfully' });
    } catch (error) {
        console.error('Error saving inspection:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// Save standalone inspection (from scan)
router.post('/save-standalone', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const { assetId, notes, solved } = req.body;

        if (!assetId) {
            return res.status(400).json({ ok: false, error: 'assetId is required' });
        }

        if (!notes) {
            return res.status(400).json({ ok: false, error: 'Notes are required' });
        }

        // For standalone inspections, we can use a separate collection or MaintenanceAsset
        // Using MaintenanceAsset with a special marker or just creating a new record
        const inspection = new MaintenanceAsset({
            assetId,
            maintenanceId: 'standalone', // Marker for standalone inspections
            inspectionNotes: notes,
            solved: solved || false,
            inspectionStatus: solved ? 'complete' : 'open',
            inspectionDate: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await inspection.save();

        res.json({ ok: true, message: 'Inspection saved successfully' });
    } catch (error) {
        console.error('Error saving standalone inspection:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// Save preventive maintenance checklist inspection
router.post('/save-checklist', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const { frequency, inspectionDate, dateStr, assets } = req.body;

        if (!frequency || !inspectionDate || !assets || !Array.isArray(assets)) {
            return res.status(400).json({ 
                ok: false, 
                error: 'frequency, inspectionDate, and assets array are required' 
            });
        }

        // Save each asset inspection
        const savedInspections = [];
        for (const asset of assets) {
            if (!asset.assetId || !asset.status) {
                continue; // Skip invalid assets
            }

            // Find or create maintenance asset record
            // For checklist, we use a special maintenanceId format: "checklist-{frequency}-{date}"
            const checklistMaintenanceId = `checklist-${frequency}-${inspectionDate}`;
            
            let maintenanceAsset = await MaintenanceAsset.findOne({
                maintenanceId: checklistMaintenanceId,
                assetId: asset.assetId
            });

            if (maintenanceAsset) {
                // Update existing
                maintenanceAsset.inspectionStatus = asset.status === 'normal' ? 'complete' : 'open';
                maintenanceAsset.inspectionNotes = asset.remarks || '';
                maintenanceAsset.inspectionDate = new Date(inspectionDate);
                maintenanceAsset.updatedAt = new Date();
                await maintenanceAsset.save();
            } else {
                // Create new
                maintenanceAsset = new MaintenanceAsset({
                    maintenanceId: checklistMaintenanceId,
                    assetId: asset.assetId,
                    inspectionStatus: asset.status === 'normal' ? 'complete' : 'open',
                    inspectionNotes: asset.remarks || '',
                    inspectionDate: new Date(inspectionDate),
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                await maintenanceAsset.save();
            }

            savedInspections.push({
                assetId: asset.assetId,
                status: asset.status,
                remarks: asset.remarks
            });
        }

        res.json({ 
            ok: true, 
            message: 'Inspection saved successfully',
            savedCount: savedInspections.length
        });
    } catch (error) {
        console.error('Error saving checklist inspection:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// Get completed checklist inspections
router.get('/get-checklist', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const { frequency, year } = req.query;
        
        if (!frequency) {
            return res.status(400).json({ 
                ok: false, 
                error: 'frequency parameter is required' 
            });
        }
        
        const targetYear = year ? parseInt(year) : new Date().getFullYear();

        // Find all checklist inspections for this frequency
        // MaintenanceId format: "checklist-{frequency}-{date}"
        const pattern = `checklist-${frequency}-`;
        const inspections = await MaintenanceAsset.find({
            maintenanceId: { $regex: `^${pattern}` }
        }).lean();

        // Group by date
        const inspectionsByDate = new Map();
        
        inspections.forEach(inspection => {
            // Extract date from maintenanceId: "checklist-Weekly-2026-01-02" -> "2026-01-02"
            const dateMatch = inspection.maintenanceId.match(/\d{4}-\d{2}-\d{2}/);
            if (dateMatch) {
                const dateKey = dateMatch[0];
                const inspectionYear = parseInt(dateKey.split('-')[0]);
                
                // Filter by year if specified
                if (inspectionYear === targetYear) {
                    const dateStr = formatDateForDisplay(dateKey);
                    
                    if (!inspectionsByDate.has(dateKey)) {
                        inspectionsByDate.set(dateKey, {
                            date: dateKey,
                            dateStr: dateStr,
                            assets: [],
                            submittedAt: inspection.updatedAt || inspection.createdAt
                        });
                    }
                    
                    inspectionsByDate.get(dateKey).assets.push({
                        assetId: inspection.assetId,
                        status: inspection.inspectionStatus === 'complete' ? 'normal' : 'abnormal',
                        remarks: inspection.inspectionNotes || ''
                    });
                }
            }
        });

        // Convert to array
        const result = Array.from(inspectionsByDate.values());

        res.json({ 
            ok: true, 
            inspections: result 
        });
    } catch (error) {
        console.error('Error getting checklist inspections:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// Helper function to format date for display
function formatDateForDisplay(dateStr) {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(year, parseInt(month) - 1, day);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day} ${monthNames[date.getMonth()]} ${year}`;
}

module.exports = router;


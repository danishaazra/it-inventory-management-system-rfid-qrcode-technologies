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

module.exports = router;


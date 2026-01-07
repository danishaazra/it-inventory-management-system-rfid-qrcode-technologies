// Asset API routes
const express = require('express');
const router = express.Router();
const { Asset, Maintenance, MaintenanceAsset } = require('../models');

// Helper to check MongoDB connection
function checkDBConnection(res) {
    if (require('mongoose').connection.readyState !== 1) {
        res.status(500).json({ ok: false, error: 'Database connection not available' });
        return false;
    }
    return true;
}

// List all assets with optional search query
router.get('/list', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const query = req.query.query || '';
        
        let filter = {};
        if (query) {
            filter = {
                $or: [
                    { assetId: { $regex: query, $options: 'i' } },
                    { assetDescription: { $regex: query, $options: 'i' } },
                    { assetCategory: { $regex: query, $options: 'i' } },
                    { assetCategoryDescription: { $regex: query, $options: 'i' } },
                    { model: { $regex: query, $options: 'i' } },
                    { serialNo: { $regex: query, $options: 'i' } },
                    { serialNumber: { $regex: query, $options: 'i' } },
                    { location: { $regex: query, $options: 'i' } },
                    { locationDescription: { $regex: query, $options: 'i' } },
                    { area: { $regex: query, $options: 'i' } },
                    { locationArea: { $regex: query, $options: 'i' } }
                ]
            };
        }

        const assets = await Asset.find(filter).sort({ assetId: 1 }).lean();
        
        // Format response to match PHP structure
        const formattedAssets = assets.map(asset => ({
            assetId: asset.assetId || null,
            assetDescription: asset.assetDescription || null,
            assetCategory: asset.assetCategory || null,
            assetCategoryDescription: asset.assetCategoryDescription || null,
            model: asset.model || null,
            serialNo: asset.serialNo || null,
            serialNumber: asset.serialNumber || null,
            location: asset.location || null,
            locationDescription: asset.locationDescription || null,
            area: asset.area || null,
            locationArea: asset.locationArea || null
        }));

        res.json({ ok: true, assets: formattedAssets });
    } catch (error) {
        console.error('Error listing assets:', error);
        res.status(500).json({ ok: false, error: 'Could not load assets: ' + error.message });
    }
});

// Get single asset by assetId
router.get('/get', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const assetId = req.query.assetId;
        if (!assetId) {
            return res.status(400).json({ ok: false, error: 'assetId parameter is required' });
        }

        const asset = await Asset.findOne({ assetId }).lean();
        if (!asset) {
            return res.status(404).json({ ok: false, error: 'Asset not found' });
        }

        res.json({ ok: true, asset });
    } catch (error) {
        console.error('Error getting asset:', error);
        res.status(500).json({ ok: false, error: 'Could not load asset: ' + error.message });
    }
});

// Get asset by RFID tag
router.get('/get-by-rfid', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const rfidTagId = req.query.rfidTagId;
        if (!rfidTagId) {
            return res.status(400).json({ ok: false, error: 'rfidTagId parameter is required' });
        }

        const asset = await Asset.findOne({ rfidTagId }).lean();
        if (!asset) {
            return res.status(404).json({ ok: false, error: 'Asset not found' });
        }

        res.json({ ok: true, asset });
    } catch (error) {
        console.error('Error getting asset by RFID:', error);
        res.status(500).json({ ok: false, error: 'Could not load asset: ' + error.message });
    }
});

// Get asset by assetId (alternative endpoint)
router.get('/get-by-assetid', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const assetId = req.query.assetId;
        const staffId = req.query.staffId; // Optional: for staff assignment checking
        
        if (!assetId) {
            return res.status(400).json({ ok: false, error: 'assetId parameter is required' });
        }

        const asset = await Asset.findOne({ assetId }).lean();
        if (!asset) {
            return res.status(404).json({ ok: false, error: 'Asset not found' });
        }

        // If staffId is provided, verify that this asset is assigned to one of the staff's maintenance tasks
        if (staffId) {
            // 1) Find maintenance tasks assigned to this staff member
            const assignedMaintenance = await Maintenance.find({ assignedStaffId: staffId }).select('_id').lean();
            const assignedMaintenanceIds = assignedMaintenance.map(m => m._id.toString());

            if (assignedMaintenanceIds.length === 0) {
                // Staff has no assigned maintenance tasks at all
                return res.status(403).json({
                    ok: false,
                    error: 'ASSET_NOT_ASSIGNED_TO_STAFF',
                    message: 'This asset is not assigned to your maintenance tasks.'
                });
            }

            // 2) Check maintenance_assets for a record linking this asset to any of the staff's maintenance tasks
            const inspection = await MaintenanceAsset.findOne({
                assetId: asset.assetId,
                maintenanceId: { $in: assignedMaintenanceIds }
            }).lean();

            if (!inspection) {
                // Asset is not part of any maintenance task assigned to this staff member
                // Find which maintenance task this asset belongs to and get assigned staff info
                const allInspections = await MaintenanceAsset.find({ assetId: asset.assetId }).limit(1).lean();
                
                let assignedStaffName = null;
                let assignedStaffEmail = null;
                
                if (allInspections.length > 0) {
                    const maintenanceId = allInspections[0].maintenanceId;
                    const maintenance = await Maintenance.findById(maintenanceId).select('assignedStaffName assignedStaffEmail').lean();
                    
                    if (maintenance) {
                        assignedStaffName = maintenance.assignedStaffName || null;
                        assignedStaffEmail = maintenance.assignedStaffEmail || null;
                    }
                }
                
                return res.status(403).json({
                    ok: false,
                    error: 'ASSET_NOT_ASSIGNED_TO_STAFF',
                    message: 'This asset is not assigned to your maintenance tasks.',
                    assignedStaffName: assignedStaffName,
                    assignedStaffEmail: assignedStaffEmail
                });
            }
        }

        res.json({ ok: true, asset });
    } catch (error) {
        console.error('Error getting asset by assetId:', error);
        res.status(500).json({ ok: false, error: 'Could not load asset: ' + error.message });
    }
});

// Get unique locations
router.get('/locations', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const assets = await Asset.find({
            locationDescription: { $exists: true, $ne: null, $ne: '' }
        }).select('locationDescription').lean();

        const locations = [...new Set(
            assets
                .map(a => a.locationDescription)
                .filter(loc => loc && loc.trim())
                .map(loc => loc.trim())
        )].sort();

        res.json({ ok: true, locations });
    } catch (error) {
        console.error('Error getting locations:', error);
        res.status(500).json({ ok: false, error: 'Could not load locations: ' + error.message });
    }
});

// Add new asset
router.post('/add', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const data = req.body;
        if (!data.assetId || data.assetId === '') {
            return res.status(400).json({ ok: false, error: 'assetId required' });
        }

        const assetId = data.assetId.trim();

        // Check if asset already exists
        const existing = await Asset.findOne({ assetId });
        if (existing) {
            return res.status(409).json({
                ok: false,
                error: 'Data already exists',
                message: `An asset with Asset ID "${assetId}" already exists in the database.`
            });
        }

        const asset = new Asset({
            assetId: data.assetId,
            assetDescription: data.assetDescription,
            assetCategory: data.assetCategory,
            assetCategoryDescription: data.assetCategoryDescription,
            ownerCode: data.ownerCode,
            ownerName: data.ownerName,
            model: data.model,
            brand: data.brand,
            status: data.status,
            warrantyPeriod: data.warrantyPeriod,
            serialNo: data.serialNo,
            location: data.location,
            locationDescription: data.locationDescription,
            area: data.area,
            departmentCode: data.departmentCode,
            departmentDescription: data.departmentDescription,
            condition: data.condition,
            currentUser: data.currentUser,
            branchCode: data.branchCode,
            no: data.no,
            rfidTagId: data.rfidTagId,
            created_at: new Date()
        });

        await asset.save();
        res.json({ ok: true, message: 'Asset added successfully' });
    } catch (error) {
        console.error('Error adding asset:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// Update asset
router.post('/update', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const data = req.body;
        if (!data.assetId || data.assetId === '') {
            return res.status(400).json({ ok: false, error: 'assetId required' });
        }

        const assetId = data.assetId.trim();
        const asset = await Asset.findOne({ assetId });
        
        if (!asset) {
            return res.status(404).json({ ok: false, error: 'Asset not found' });
        }

        // Update fields
        const updateFields = [
            'assetDescription', 'assetCategory', 'assetCategoryDescription',
            'ownerCode', 'ownerName', 'model', 'brand', 'status', 'warrantyPeriod',
            'serialNo', 'location', 'locationDescription', 'area',
            'departmentCode', 'departmentDescription', 'condition', 'currentUser',
            'branchCode', 'no', 'rfidTagId'
        ];

        updateFields.forEach(field => {
            if (data[field] !== undefined) {
                if (field === 'rfidTagId') {
                    asset[field] = data[field] === null ? null : String(data[field]).trim();
                } else if (data[field] !== null) {
                    asset[field] = data[field];
                }
            }
        });

        asset.updated_at = new Date();
        await asset.save();

        res.json({ ok: true, message: 'Asset updated successfully' });
    } catch (error) {
        console.error('Error updating asset:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// Delete asset
router.post('/delete', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const data = req.body;
        if (!data.assetId || data.assetId === '') {
            return res.status(400).json({ ok: false, error: 'assetId required' });
        }

        const assetId = data.assetId.trim();
        const result = await Asset.deleteOne({ assetId });

        if (result.deletedCount > 0) {
            res.json({ ok: true, message: 'Asset deleted successfully' });
        } else {
            res.status(404).json({ ok: false, error: 'Asset not found' });
        }
    } catch (error) {
        console.error('Error deleting asset:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// Upload assets (bulk import) - simplified version
router.post('/upload', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        // This would need multipart/form-data handling for file uploads
        // For now, accept JSON array of assets
        const assets = req.body.assets || [];
        
        if (!Array.isArray(assets) || assets.length === 0) {
            return res.status(400).json({ ok: false, error: 'No assets provided' });
        }

        let inserted = 0;
        let skipped = 0;
        const errors = [];

        for (const assetData of assets) {
            try {
                if (!assetData.assetId) {
                    skipped++;
                    continue;
                }

                const existing = await Asset.findOne({ assetId: assetData.assetId });
                if (existing) {
                    skipped++;
                    continue;
                }

                const asset = new Asset({
                    ...assetData,
                    created_at: new Date()
                });
                await asset.save();
                inserted++;
            } catch (error) {
                errors.push({ assetId: assetData.assetId, error: error.message });
            }
        }

        res.json({
            ok: true,
            inserted,
            skipped,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Error uploading assets:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

module.exports = router;


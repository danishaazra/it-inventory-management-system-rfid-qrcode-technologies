// Asset API routes
const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const { Asset, Maintenance, MaintenanceAsset } = require('../models');

// Configure multer for file uploads (memory storage)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

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
        const staffId = req.query.staffId; // Optional: for staff assignment checking
        
        if (!rfidTagId) {
            return res.status(400).json({ ok: false, error: 'rfidTagId parameter is required' });
        }

        const asset = await Asset.findOne({ rfidTagId }).lean();
        if (!asset) {
            return res.status(404).json({ 
                ok: false, 
                error: 'ASSET_NOT_FOUND',
                message: 'Asset not found with this RFID Tag ID' 
            });
        }

        // If staffId is provided, verify that this asset is assigned to one of the staff's maintenance tasks
        // IMPORTANT: For staff scanning, staffId should always be provided to enforce assignment checking
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

// Upload assets (bulk import) - handles CSV and Excel files
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        if (!req.file) {
            return res.status(400).json({ ok: false, error: 'No file uploaded' });
        }

        const file = req.file;
        const fileName = file.originalname;
        const fileExt = fileName.split('.').pop().toLowerCase();

        // Check file type
        if (!['csv', 'xlsx', 'xls'].includes(fileExt)) {
            return res.status(400).json({ 
                ok: false, 
                error: 'Please upload a CSV or Excel file (.csv, .xlsx, .xls)' 
            });
        }

        let rows = [];

        // Parse file based on type
        if (fileExt === 'csv') {
            // Parse CSV
            const csvData = file.buffer.toString('utf8');
            const lines = csvData.split('\n').filter(line => line.trim());
            
            // Simple CSV parsing (handles quoted fields)
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // Simple CSV parsing - split by comma, handle quoted fields
                const values = [];
                let current = '';
                let inQuotes = false;
                
                for (let j = 0; j < line.length; j++) {
                    const char = line[j];
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        values.push(current.trim());
                        current = '';
                    } else {
                        current += char;
                    }
                }
                values.push(current.trim());
                rows.push(values);
            }
        } else {
            // Parse Excel file
            const workbook = xlsx.read(file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            rows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: null });
        }

        if (rows.length === 0) {
            return res.status(400).json({ ok: false, error: 'Empty file' });
        }

        // Get header row (first row)
        const rawHeader = rows[0].map(cell => 
            cell !== null && cell !== undefined ? String(cell).trim() : ''
        );

        if (rawHeader.length === 0) {
            return res.status(400).json({ ok: false, error: 'Empty file or missing header' });
        }

        // Normalize header names
        function normalizeHeaderName(header) {
            header = String(header).trim().toLowerCase();
            if (!header) return '';
            
            const mappings = {
                'no.': 'no',
                'branch code': 'branchCode',
                'asset id': 'assetId',
                'asset description': 'assetDescription',
                'asset category': 'assetCategory',
                'asset category description': 'assetCategoryDescription',
                'owner code': 'ownerCode',
                'owner name': 'ownerName',
                'warranty period': 'warrantyPeriod',
                'serial no.': 'serialNo',
                'serial no': 'serialNo',
                'location description': 'locationDescription',
                'department code': 'departmentCode',
                'department description': 'departmentDescription',
                'current user': 'currentUser',
                'rfid tag id': 'rfidTagId',
                'rfidtagid': 'rfidTagId',
                'rfid': 'rfidTagId'
            };
            
            if (mappings[header]) {
                return mappings[header];
            }
            
            // Convert to camelCase
            return header.replace(/[\s.]+/g, '').replace(/([a-z])([A-Z])/g, '$1$2').toLowerCase();
        }

        const header = rawHeader.map(normalizeHeaderName);
        const requiredCol = 'assetId';
        let inserted = 0;
        let skipped = 0;
        const duplicates = [];
        const batch = [];

        // Process data rows (skip header row)
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            
            // Skip empty rows
            if (!row || row.every(cell => !cell || String(cell).trim() === '')) {
                continue;
            }

            // Map row to associative array
            const assoc = {};
            header.forEach((colName, idx) => {
                if (!colName) return;
                const value = row[idx];
                assoc[colName] = value !== null && value !== undefined ? String(value).trim() : null;
            });

            // Skip rows without assetId
            const assetId = assoc[requiredCol] ? String(assoc[requiredCol]).trim() : '';
            if (!assetId) {
                skipped++;
                continue;
            }

            // Check for duplicate assetId
            const existing = await Asset.findOne({ assetId });
            if (existing) {
                duplicates.push(assetId);
                skipped++;
                continue;
            }

            batch.push({
                assetId: assoc['assetId'] || null,
                assetDescription: assoc['assetDescription'] || null,
                assetCategory: assoc['assetCategory'] || null,
                assetCategoryDescription: assoc['assetCategoryDescription'] || null,
                ownerCode: assoc['ownerCode'] || null,
                ownerName: assoc['ownerName'] || null,
                model: assoc['model'] || null,
                brand: assoc['brand'] || null,
                status: assoc['status'] || null,
                warrantyPeriod: assoc['warrantyPeriod'] || null,
                serialNo: assoc['serialNo'] || null,
                location: assoc['location'] || null,
                locationDescription: assoc['locationDescription'] || null,
                area: assoc['area'] || null,
                departmentCode: assoc['departmentCode'] || null,
                departmentDescription: assoc['departmentDescription'] || null,
                condition: assoc['condition'] || null,
                currentUser: assoc['currentUser'] || null,
                branchCode: assoc['branchCode'] || null,
                no: assoc['no'] || null,
                rfidTagId: assoc['rfidTagId'] || null,
                created_at: new Date()
            });
            inserted++;
        }

        // Insert batch
        if (batch.length > 0) {
            await Asset.insertMany(batch, { ordered: false });
        }

        const response = {
            ok: true,
            inserted: batch.length,
            processed: inserted
        };

        if (duplicates.length > 0) {
            response.duplicates = duplicates;
            response.skipped = skipped;
            response.message = `Inserted ${batch.length} asset(s). ${duplicates.length} duplicate(s) skipped.`;
        }

        res.json(response);
    } catch (error) {
        console.error('Error uploading assets:', error);
        res.status(500).json({ ok: false, error: 'Upload failed: ' + error.message });
    }
});

module.exports = router;


// Inspection API routes
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { MaintenanceAsset, Maintenance } = require('../models');

// Helper to check MongoDB connection
function checkDBConnection(res) {
    if (mongoose.connection.readyState !== 1) {
        console.warn('MongoDB connection not ready. State:', mongoose.connection.readyState);
        res.status(500).json({ ok: false, error: 'Database connection not available' });
        return false;
    }
    return true;
}

// Test endpoint to verify route is working
router.get('/test', (req, res) => {
    res.json({ ok: true, message: 'Inspections API is working!' });
});

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

        const { frequency, inspectionDate, dateStr, assets, maintenanceId, branch, location, itemName } = req.body;

        if (!frequency || !inspectionDate) {
            return res.status(400).json({ 
                ok: false, 
                error: 'frequency and inspectionDate are required' 
            });
        }

        // Allow empty assets array - just save the inspection date/status
        const assetsArray = Array.isArray(assets) ? assets : [];

        // Save each asset inspection
        const savedInspections = [];
        
        // Use actual maintenanceId if provided, otherwise use checklist format
        const maintenanceIdToUse = maintenanceId || `checklist-${frequency}-${inspectionDate}`;
        
        console.log('=== SAVING INSPECTION ===');
        console.log('MaintenanceId:', maintenanceIdToUse);
        console.log('Frequency:', frequency);
        console.log('Inspection Date:', inspectionDate);
        console.log('Assets to save:', assetsArray.length);
        
        for (const asset of assetsArray) {
            if (!asset.assetId) {
                console.warn('⚠ Skipping asset with missing assetId:', asset);
                continue; // Skip invalid assets
            }
            
            // Status is required, but if missing, default to 'normal'
            if (!asset.status) {
                console.warn(`⚠ Asset ${asset.assetId} missing status, defaulting to 'normal'`);
                asset.status = 'normal';
            }
            
            console.log(`\n📝 Processing asset: ${asset.assetId}`);
            console.log(`   Status: ${asset.status}`);
            console.log(`   Remarks: "${asset.remarks || '(empty)'}"`);
            console.log(`   Inspection Date: ${inspectionDate}`);

            // Always create a new inspection record for each inspection submission
            // This allows multiple inspections per date (e.g., re-inspections, corrections)
            // Each inspection will have its own unique _id and can be retrieved by inspectionDate
            console.log(`Creating new inspection record for asset ${asset.assetId}, maintenanceId: ${maintenanceIdToUse}, date: ${inspectionDate}`);
            
            const maintenanceAsset = new MaintenanceAsset({
                maintenanceId: maintenanceIdToUse,
                assetId: asset.assetId,
                // When inspection is submitted, it's always complete
                // The status field stores the fault condition: 'normal' or 'fault'
                inspectionStatus: 'complete',
                status: asset.status === 'abnormal' ? 'fault' : (asset.status || 'normal'), // Save fault condition: 'normal' or 'fault' (map 'abnormal' to 'fault')
                inspectionNotes: asset.remarks || '',
                inspectionDate: new Date(), // Set to current time when inspection is submitted
                createdAt: new Date(),
                updatedAt: new Date()
            });
            await maintenanceAsset.save();
            console.log(`✓ Created new inspection record - ID: ${maintenanceAsset._id}, Notes: "${asset.remarks || '(empty)'}", InspectionStatus: ${maintenanceAsset.inspectionStatus}, Status: ${maintenanceAsset.status}, Date: ${inspectionDate}`);

            savedInspections.push({
                assetId: asset.assetId,
                status: asset.status,
                remarks: asset.remarks
            });
            
            // All inspection data is stored in maintenance_assets collection only
            console.log(`✓✅ SAVED TO DATABASE (maintenance_assets collection): Asset ${asset.assetId}`);
            console.log(`   Document ID: ${maintenanceAsset._id}`);
            console.log(`   Maintenance ID: ${maintenanceIdToUse}`);
            console.log(`   Status: ${maintenanceAsset.status}`);
            console.log(`   Inspection Status: ${maintenanceAsset.inspectionStatus}`);
            console.log(`   Inspection Date: ${maintenanceAsset.inspectionDate}`);
            console.log(`   Notes: ${maintenanceAsset.inspectionNotes}`);
            console.log(`   ✅ All inspection data stored in maintenance_assets collection - will persist after page refresh!`);
        }
        
        // If no assets but maintenanceId is provided, create a record to track the inspection date
        if (assetsArray.length === 0 && maintenanceId) {
            // Create a marker record to indicate inspection was done (even without assets)
            const markerRecord = await MaintenanceAsset.findOne({
                maintenanceId: maintenanceId,
                assetId: 'INSPECTION_DATE_MARKER'
            });
            
            if (!markerRecord) {
                const marker = new MaintenanceAsset({
                    maintenanceId: maintenanceId,
                    assetId: 'INSPECTION_DATE_MARKER',
                    inspectionStatus: 'complete',
                    inspectionNotes: `Inspection completed on ${inspectionDate} - No assets to inspect`,
                    inspectionDate: new Date(), // Set to current time when inspection is submitted
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                await marker.save();
            } else {
                markerRecord.inspectionDate = new Date(); // Set to current time when inspection is submitted
                markerRecord.inspectionNotes = `Inspection completed on ${inspectionDate} - No assets to inspect`;
                markerRecord.updatedAt = new Date();
                await markerRecord.save();
            }
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
                            inspectionStatus: 'complete', // Inspection is complete when submitted
                            submittedAt: inspection.updatedAt || inspection.createdAt
                        });
                    }
                    
                    inspectionsByDate.get(dateKey).assets.push({
                        assetId: inspection.assetId,
                        status: inspection.status || (inspection.inspectionStatus === 'complete' ? 'normal' : 'abnormal'), // Use status field (normal/abnormal), fallback to inspectionStatus
                        inspectionStatus: inspection.inspectionStatus || 'complete', // Include inspectionStatus for frontend
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

// Get inspection by assetId from inspections collection
// Supports optional inspectionDate parameter to get inspection for a specific date
router.get('/get', async (req, res) => {
    console.log('=== GET /api/inspections/get ===');
    console.log('Query params:', req.query);
    try {
        if (!checkDBConnection(res)) return;

        const { assetId, inspectionDate, maintenanceId } = req.query;

        if (!assetId) {
            console.log('Missing assetId parameter');
            return res.status(400).json({ 
                ok: false, 
                error: 'assetId parameter is required' 
            });
        }
        
        console.log('Looking for inspection with assetId:', assetId);
        if (inspectionDate) {
            console.log('Filtering by inspectionDate:', inspectionDate);
        }
        if (maintenanceId) {
            console.log('Filtering by maintenanceId:', maintenanceId);
        }

        // All inspection data is stored in maintenance_assets collection only
        console.log('Loading inspection from maintenance_assets collection for assetId:', assetId);
        
        let inspection = null;
        
        // Build query filter
        const filter = { assetId: assetId };
        if (maintenanceId) {
            filter.maintenanceId = maintenanceId;
        }
        if (inspectionDate) {
            // Filter by date (normalize to start of day for comparison)
            const targetDate = new Date(inspectionDate);
            targetDate.setHours(0, 0, 0, 0);
            const nextDay = new Date(targetDate);
            nextDay.setDate(nextDay.getDate() + 1);
            filter.inspectionDate = {
                $gte: targetDate,
                $lt: nextDay
            };
        }
        
        // Query maintenance_assets collection (primary source for all inspection data)
        // If inspectionDate is provided, get the latest inspection for that date
        // Otherwise, get the latest inspection overall
        const maintenanceAssets = await MaintenanceAsset.find(filter)
            .sort({ inspectionDate: -1, updatedAt: -1, createdAt: -1 })
            .limit(1)
            .lean();
        
        if (maintenanceAssets.length > 0) {
            const ma = maintenanceAssets[0];
            // Convert maintenance_assets format to expected format
            // Map status: 'fault' or 'abnormal' -> 'fault', otherwise 'normal'
            const status = ma.status === 'fault' || ma.status === 'abnormal' ? 'fault' : (ma.status || (ma.inspectionStatus === 'complete' ? 'normal' : 'pending'));
            inspection = {
                _id: ma._id ? (ma._id.toString ? ma._id.toString() : String(ma._id)) : null,
                assetId: ma.assetId,
                notes: ma.inspectionNotes || ma.notes || null,
                solved: ma.solved !== undefined ? ma.solved : (status === 'normal' || status === 'complete'),
                status: status,
                inspectionStatus: ma.inspectionStatus || 'pending',
                inspectionDate: ma.inspectionDate || null,
                inspectorId: ma.inspectorId || null,
                inspectorName: ma.inspectorName || null,
                created_at: ma.createdAt || ma.created_at || null,
                updated_at: ma.updatedAt || ma.updated_at || null
            };
            console.log('✓ Found inspection in maintenance_assets collection');
        }

        if (!inspection) {
            console.log('No inspection found for assetId:', assetId);
            return res.status(404).json({ 
                ok: false, 
                error: 'Inspection not found' 
            });
        }

        console.log('Found inspection:', {
            assetId: inspection.assetId,
            inspectionStatus: inspection.inspectionStatus,
            hasNotes: !!inspection.notes,
            inspectionDate: inspection.inspectionDate
        });

        res.json({ 
            ok: true, 
            inspection: inspection 
        });
    } catch (error) {
        console.error('Error getting inspection:', error);
        res.status(500).json({ ok: false, error: 'Could not load inspection: ' + error.message });
    }
});

// Get all inspections for a specific date (allows multiple inspections per date)
router.get('/get-by-date', async (req, res) => {
    console.log('=== GET /api/inspections/get-by-date ===');
    console.log('Query params:', req.query);
    try {
        if (!checkDBConnection(res)) return;

        const { inspectionDate, maintenanceId, assetId } = req.query;

        if (!inspectionDate) {
            return res.status(400).json({ 
                ok: false, 
                error: 'inspectionDate parameter is required (format: YYYY-MM-DD)' 
            });
        }

        // Build query filter
        const filter = {};
        
        // Filter by date (normalize to start of day for comparison)
        const targetDate = new Date(inspectionDate);
        targetDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);
        filter.inspectionDate = {
            $gte: targetDate,
            $lt: nextDay
        };
        
        if (maintenanceId) {
            filter.maintenanceId = maintenanceId;
        }
        if (assetId) {
            filter.assetId = assetId;
        }
        
        console.log('Query filter:', filter);
        
        // Get all inspections for this date
        const maintenanceAssets = await MaintenanceAsset.find(filter)
            .sort({ createdAt: -1 }) // Most recent first
            .lean();
        
        const inspections = maintenanceAssets.map(ma => {
            const status = ma.status === 'fault' || ma.status === 'abnormal' ? 'fault' : (ma.status || (ma.inspectionStatus === 'complete' ? 'normal' : 'pending'));
            return {
                _id: ma._id ? (ma._id.toString ? ma._id.toString() : String(ma._id)) : null,
                maintenanceId: ma.maintenanceId,
                assetId: ma.assetId,
                notes: ma.inspectionNotes || ma.notes || null,
                solved: ma.solved !== undefined ? ma.solved : (status === 'normal' || status === 'complete'),
                status: status,
                inspectionStatus: ma.inspectionStatus || 'pending',
                inspectionDate: ma.inspectionDate || null,
                inspectorId: ma.inspectorId || null,
                inspectorName: ma.inspectorName || null,
                created_at: ma.createdAt || ma.created_at || null,
                updated_at: ma.updatedAt || ma.updated_at || null
            };
        });
        
        console.log(`✓ Found ${inspections.length} inspection(s) for date ${inspectionDate}`);

        res.json({ 
            ok: true, 
            inspections: inspections,
            count: inspections.length
        });
    } catch (error) {
        console.error('Error getting inspections by date:', error);
        res.status(500).json({ ok: false, error: 'Could not load inspections: ' + error.message });
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


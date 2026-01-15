// Maintenance API routes
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { Maintenance, MaintenanceAsset, Asset, User, InspectionTask } = require('../models');

// Helper to check MongoDB connection
function checkDBConnection(res) {
    if (mongoose.connection.readyState !== 1) {
        res.status(500).json({ ok: false, error: 'Database connection not available' });
        return false;
    }
    return true;
}

// List all maintenance items with optional search query
router.get('/list', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const query = req.query.query || '';
        const frequency = req.query.frequency || '';
        
        let filter = {};
        if (frequency) {
            filter.frequency = frequency;
        }
        if (query) {
            const queryFilter = {
                $or: [
                    { branch: { $regex: query, $options: 'i' } },
                    { location: { $regex: query, $options: 'i' } },
                    { itemName: { $regex: query, $options: 'i' } },
                    { frequency: { $regex: query, $options: 'i' } }
                ]
            };
            if (frequency) {
                filter = { $and: [filter, queryFilter] };
            } else {
                filter = queryFilter;
            }
        }

        const maintenanceItems = await Maintenance.find(filter).sort({ itemName: 1 }).lean();
        
        // Get inspection counts for each maintenance item
        const maintenanceWithCounts = await Promise.all(
            maintenanceItems.map(async (item) => {
                const inspections = await MaintenanceAsset.find({ 
                    maintenanceId: item._id.toString() 
                }).lean();
                
                const totalInspections = inspections.length;
                const completedInspections = inspections.filter(
                    i => i.inspectionStatus === 'complete'
                ).length;
                const openInspections = totalInspections - completedInspections;

                return {
                    _id: item._id.toString(),
                    branch: item.branch || null,
                    location: item.location || null,
                    itemName: item.itemName || null,
                    frequency: item.frequency || null,
                    inspectionTasks: item.inspectionTasks || null,
                    assignedStaffId: item.assignedStaffId || null,
                    assignedStaffName: item.assignedStaffName || null,
                    assignedStaffEmail: item.assignedStaffEmail || null,
                    totalInspections,
                    completedInspections,
                    openInspections
                };
            })
        );

        res.json({ ok: true, maintenance: maintenanceWithCounts });
    } catch (error) {
        console.error('Error listing maintenance:', error);
        res.status(500).json({ ok: false, error: 'Could not load maintenance items: ' + error.message });
    }
});

// Get single maintenance item
router.get('/get', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const { maintenanceId, branch, location, itemName } = req.query;

        let filter = {};
        if (maintenanceId) {
            filter = { _id: new mongoose.Types.ObjectId(maintenanceId) };
        } else if (branch && location && itemName) {
            filter = { branch, location, itemName };
        } else {
            return res.status(400).json({ 
                ok: false, 
                error: 'maintenanceId parameter is required, or provide branch, location, and itemName' 
            });
        }

        const maintenance = await Maintenance.findOne(filter).lean();
        if (!maintenance) {
            return res.status(404).json({ ok: false, error: 'Maintenance item not found' });
        }

        res.json({ 
            ok: true, 
            maintenance: {
                ...maintenance,
                _id: maintenance._id.toString()
            }
        });
    } catch (error) {
        console.error('Error getting maintenance:', error);
        res.status(500).json({ ok: false, error: 'Could not load maintenance item: ' + error.message });
    }
});

// Get assigned maintenance for a staff member
router.get('/assigned', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const { staffId, staffEmail } = req.query;
        
        let filter = {};
        if (staffId) {
            filter = { assignedStaffId: staffId };
        } else if (staffEmail) {
            const user = await User.findOne({ email: staffEmail, role: 'staff' });
            if (user) {
                filter = { assignedStaffId: user._id.toString() };
            } else {
                return res.json({ ok: true, maintenance: [] });
            }
        } else {
            return res.status(400).json({ ok: false, error: 'staffId or staffEmail required' });
        }

        const maintenance = await Maintenance.find(filter).sort({ itemName: 1 }).lean();
        
        res.json({ 
            ok: true, 
            maintenance: maintenance.map(m => ({
                ...m,
                _id: m._id.toString()
            }))
        });
    } catch (error) {
        console.error('Error getting assigned maintenance:', error);
        res.status(500).json({ ok: false, error: 'Could not load assigned maintenance: ' + error.message });
    }
});

// Get maintenance assets (assets linked to a maintenance task)
router.get('/assets', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const { maintenanceId, branch, location, itemName } = req.query;

        // Support "all" to get all maintenance assets (for status checking)
        if (maintenanceId === 'all') {
            const maintenanceAssets = await MaintenanceAsset.find({}).lean();
            
            const assets = [];
            for (const ma of maintenanceAssets) {
                if (ma.assetId) {
                    const asset = await Asset.findOne({ assetId: ma.assetId }).lean();
                    if (asset) {
                        assets.push({
                            assetId: asset.assetId,
                            assetDescription: asset.assetDescription,
                            inspectionStatus: ma.inspectionStatus || 'open',
                            inspectionDate: ma.inspectionDate,
                            maintenanceId: ma.maintenanceId
                        });
                    }
                }
            }
            
            return res.json({ ok: true, assets });
        }

        let maintenanceFilter = {};
        if (maintenanceId) {
            maintenanceFilter = { _id: new mongoose.Types.ObjectId(maintenanceId) };
        } else if (branch && location && itemName) {
            maintenanceFilter = { branch, location, itemName };
        } else {
            return res.status(400).json({ 
                ok: false, 
                error: 'maintenanceId parameter is required, or provide branch, location, and itemName' 
            });
        }

        const maintenance = await Maintenance.findOne(maintenanceFilter);
        if (!maintenance) {
            return res.status(404).json({ ok: false, error: 'Maintenance item not found' });
        }

        const maintenanceIdStr = maintenance._id.toString();
        const maintenanceAssets = await MaintenanceAsset.find({ 
            maintenanceId: maintenanceIdStr 
        }).lean();

        const assets = [];
        for (const ma of maintenanceAssets) {
            if (ma.assetId) {
                const asset = await Asset.findOne({ assetId: ma.assetId }).lean();
                if (asset) {
                    // Include the status field from MaintenanceAsset (fault condition: 'normal' or 'fault')
                    // Do NOT default to 'normal' - preserve the actual value from database
                    const faultStatus = ma.status; // This should be 'normal' or 'fault' from MaintenanceAsset
                    
                    console.log(`MaintenanceAsset for ${asset.assetId}:`, {
                        assetId: asset.assetId,
                        maStatus: ma.status,
                        maInspectionStatus: ma.inspectionStatus,
                        faultStatus: faultStatus,
                        fullMA: ma
                    });
                    
                    assets.push({
                        assetId: asset.assetId,
                        assetDescription: asset.assetDescription,
                        assetCategory: asset.assetCategory,
                        assetCategoryDescription: asset.assetCategoryDescription,
                        brand: asset.brand,
                        model: asset.model,
                        assetStatus: asset.status, // Asset's own status (for reference)
                        status: faultStatus, // Fault condition from MaintenanceAsset: 'normal' or 'fault' (preserve actual value)
                        inspectionStatus: ma.inspectionStatus || 'open',
                        inspectionNotes: ma.inspectionNotes || ma.notes || '', // Support both field names
                        solved: ma.solved || false,
                        inspectionDate: ma.inspectionDate,
                        inspectorId: ma.inspectorId,
                        inspectorName: ma.inspectorName,
                        createdAt: ma.createdAt,
                        updatedAt: ma.updatedAt
                    });
                }
            }
        }

        res.json({ ok: true, assets });
    } catch (error) {
        console.error('Error getting maintenance assets:', error);
        res.status(500).json({ ok: false, error: 'Could not load maintenance assets: ' + error.message });
    }
});

// Get inspection data for a specific asset and maintenance
router.get('/asset-inspection', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const { assetId, maintenanceId } = req.query;

        if (!assetId) {
            return res.status(400).json({ 
                ok: false, 
                error: 'assetId is required' 
            });
        }

        console.log('=== SEARCHING FOR INSPECTION ===');
        console.log('AssetId:', assetId);
        console.log('MaintenanceId:', maintenanceId);

        // Find the most recent inspection for this asset
        // Search ALL inspections for this asset (regardless of maintenanceId format)
        // Try both exact match and case-insensitive match
        const query = {
            $or: [
                { assetId: assetId },
                { assetId: { $regex: new RegExp(`^${assetId}$`, 'i') } } // Case-insensitive
            ]
        };

        console.log('Query:', JSON.stringify(query, null, 2));

        const maintenanceAssets = await MaintenanceAsset.find(query)
        .sort({ inspectionDate: -1, updatedAt: -1, createdAt: -1 }) // Get most recent first
        .limit(50) // Get top 50 most recent to ensure we find the right one
        .lean();

        console.log(`Found ${maintenanceAssets.length} inspection record(s) for asset ${assetId}`);
        
        // Log all maintenanceIds found for debugging
        if (maintenanceAssets.length > 0) {
            const maintenanceIds = maintenanceAssets.map(ma => ma.maintenanceId).filter((id, idx, arr) => arr.indexOf(id) === idx);
            console.log('MaintenanceIds found:', maintenanceIds);
            console.log('Looking for maintenanceId:', maintenanceId);
            
            // Log first few records for debugging
            console.log('First 3 records:', maintenanceAssets.slice(0, 3).map(ma => {
                const notes = ma.inspectionNotes || ma.notes || '';
                return {
                    _id: ma._id,
                    maintenanceId: ma.maintenanceId,
                    assetId: ma.assetId,
                    inspectionDate: ma.inspectionDate,
                    hasNotes: !!notes,
                    notesLength: notes.length,
                    notesPreview: notes ? notes.substring(0, 50) + '...' : '(empty)',
                    hasInspectionNotes: !!ma.inspectionNotes,
                    hasNotesField: !!ma.notes
                };
            }));
        } else {
            // If no records found, try a broader search to see if the assetId exists at all
            const allAssets = await MaintenanceAsset.find({}).limit(5).lean();
            console.log('Sample of all MaintenanceAsset records (first 5):', allAssets.map(ma => ({
                assetId: ma.assetId,
                maintenanceId: ma.maintenanceId
            })));
        }

        // If maintenanceId provided, prefer exact match, otherwise use most recent WITH notes
        let selectedInspection = null;
        if (maintenanceId && maintenanceAssets.length > 0) {
            // First try exact match
            selectedInspection = maintenanceAssets.find(ma => ma.maintenanceId === maintenanceId);
            // If no exact match, try to find one with notes (prefer inspections with actual notes)
            // Support both field names: inspectionNotes (new) and notes (old)
            if (!selectedInspection) {
                selectedInspection = maintenanceAssets.find(ma => {
                    const notes = ma.inspectionNotes || ma.notes || '';
                    return notes.trim() !== '';
                });
            }
            // If still no match, use most recent
            if (!selectedInspection) {
                selectedInspection = maintenanceAssets[0];
            }
        } else if (maintenanceAssets.length > 0) {
            // No maintenanceId specified, prefer one with notes, otherwise use most recent
            // Support both field names: inspectionNotes (new) and notes (old)
            selectedInspection = maintenanceAssets.find(ma => {
                const notes = ma.inspectionNotes || ma.notes || '';
                return notes.trim() !== '';
            }) || maintenanceAssets[0];
        }

        if (selectedInspection) {
            console.log('Selected inspection:', {
                _id: selectedInspection._id,
                maintenanceId: selectedInspection.maintenanceId,
                assetId: selectedInspection.assetId,
                inspectionDate: selectedInspection.inspectionDate,
                hasNotes: !!(selectedInspection.inspectionNotes || selectedInspection.notes),
                notesLength: (selectedInspection.inspectionNotes || selectedInspection.notes || '').length,
                notesContent: (selectedInspection.inspectionNotes || selectedInspection.notes || '').substring(0, 100)
            });
            
            // Support both field names: inspectionNotes (new) and notes (old)
            const inspectionNotes = selectedInspection.inspectionNotes || selectedInspection.notes || '';
            
            res.json({ 
                ok: true, 
                inspection: {
                    assetId: selectedInspection.assetId,
                    inspectionStatus: selectedInspection.inspectionStatus || 'open',
                    inspectionNotes: inspectionNotes,
                    inspectionDate: selectedInspection.inspectionDate,
                    solved: selectedInspection.solved || false,
                    maintenanceId: selectedInspection.maintenanceId || null
                }
            });
        } else {
            console.log('No inspection found for asset:', assetId);
            console.log('Query used:', JSON.stringify(query, null, 2));
            console.log('Total records found:', maintenanceAssets.length);
            if (maintenanceAssets.length > 0) {
                console.log('Sample records (first 3):', maintenanceAssets.slice(0, 3).map(ma => ({
                    maintenanceId: ma.maintenanceId,
                    assetId: ma.assetId,
                    hasNotes: !!ma.inspectionNotes,
                    notesLength: ma.inspectionNotes?.length || 0
                })));
            }
            res.json({ ok: true, inspection: null });
        }
    } catch (error) {
        console.error('Error getting asset inspection:', error);
        res.status(500).json({ ok: false, error: 'Could not load asset inspection: ' + error.message });
    }
});

// List all staff members
router.get('/staff', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const staff = await User.find({ role: 'staff' })
            .sort({ name: 1 })
            .select('_id name email role')
            .lean();

        res.json({ 
            ok: true, 
            staff: staff.map(s => ({
                _id: s._id.toString(),
                name: s.name,
                email: s.email,
                role: s.role
            }))
        });
    } catch (error) {
        console.error('Error listing staff:', error);
        res.status(500).json({ ok: false, error: 'Could not load staff: ' + error.message });
    }
});

// Add new maintenance item
router.post('/add', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const { branch, location, itemName, frequency, inspectionTasks, maintenanceSchedule } = req.body;

        console.log('Received maintenance add request:', {
            branch,
            location,
            itemName,
            frequency,
            hasSchedule: !!maintenanceSchedule,
            scheduleType: maintenanceSchedule ? typeof maintenanceSchedule : 'none',
            scheduleKeys: maintenanceSchedule && typeof maintenanceSchedule === 'object' ? Object.keys(maintenanceSchedule) : []
        });

        if (!branch || !location || !itemName || !frequency || !inspectionTasks) {
            return res.status(400).json({ ok: false, error: 'Branch, location, itemName, frequency, and inspectionTasks are required' });
        }

        // Check for duplicates
        const existing = await Maintenance.find({ branch, location, itemName, frequency });
        
        for (const existingDoc of existing) {
            const existingSchedule = existingDoc.maintenanceSchedule;
            const newSchedule = maintenanceSchedule;
            
            const existingScheduleStr = existingSchedule ? JSON.stringify(existingSchedule) : '';
            const newScheduleStr = newSchedule ? JSON.stringify(newSchedule) : '';
            const existingTasks = String(existingDoc.inspectionTasks || '').trim();
            const newTasks = String(inspectionTasks || '').trim();

            if (existingScheduleStr === newScheduleStr && existingTasks === newTasks) {
                return res.status(409).json({
                    ok: false,
                    error: 'Data already exists',
                    message: 'A maintenance item with the same Branch, Location, Item Name, Frequency, Schedule dates, and Inspection Tasks already exists in the database.'
                });
            }
        }

        const maintenance = new Maintenance({
            branch,
            location,
            itemName,
            frequency,
            maintenanceSchedule,
            inspectionTasks,
            created_at: new Date()
        });

        console.log('Saving maintenance to database with schedule:', {
            hasSchedule: !!maintenanceSchedule,
            scheduleData: maintenanceSchedule
        });

        await maintenance.save();
        
        // Verify the saved document
        const saved = await Maintenance.findById(maintenance._id);
        console.log('Saved maintenance document:', {
            id: saved._id,
            hasSchedule: !!saved.maintenanceSchedule,
            scheduleKeys: saved.maintenanceSchedule && typeof saved.maintenanceSchedule === 'object' ? Object.keys(saved.maintenanceSchedule) : []
        });
        
        // Save each inspection task to inspection_tasks collection
        const maintenanceId = saved._id.toString();
        console.log('=== SAVING INSPECTION TASKS ===');
        console.log('Maintenance ID:', maintenanceId);
        console.log('Inspection tasks string:', inspectionTasks);
        console.log('Maintenance schedule:', JSON.stringify(maintenanceSchedule, null, 2));
        
        const tasksList = inspectionTasks ? inspectionTasks.split('\n').filter(t => t.trim()) : [];
        console.log('Parsed tasks list:', tasksList);
        console.log('Number of tasks:', tasksList.length);
        
        if (tasksList.length > 0) {
            console.log(`\n🔄 Saving ${tasksList.length} inspection task(s) to inspection_tasks collection...`);
            const taskPromises = tasksList.map(async (taskName) => {
                const trimmedName = taskName.trim();
                try {
                    console.log(`  Creating task: "${trimmedName}"`);
                    const task = new InspectionTask({
                        maintenanceId: maintenanceId,
                        taskName: trimmedName,
                        schedule: maintenanceSchedule || null,
                        created_at: new Date(),
                        updated_at: new Date()
                    });
                    
                    console.log(`  Saving task: "${trimmedName}"...`);
                    await task.save();
                    console.log(`  ✓ Successfully saved task: "${trimmedName}" (ID: ${task._id.toString()})`);
                    
                    // Auto-link assets with matching locationDescription
                    await autoLinkAssetsByLocation(maintenanceId, trimmedName);
                    
                    // Initialize pending inspection records for all asset-date combinations
                    await initializePendingInspections(maintenanceId, trimmedName, maintenanceSchedule, frequency);
                    
                    return { success: true, taskName: trimmedName, taskId: task._id.toString() };
                } catch (error) {
                    console.error(`  ✗ FAILED to save task "${trimmedName}":`, error.message);
                    console.error(`  Error stack:`, error.stack);
                    return { success: false, taskName: trimmedName, error: error.message };
                }
            });
            
            const results = await Promise.all(taskPromises);
            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;
            
            console.log(`\n📊 Inspection tasks save complete: ${successful} succeeded, ${failed} failed`);
            
            if (successful > 0) {
                console.log('✅ Successfully saved tasks:', results.filter(r => r.success).map(r => r.taskName));
            }
            
            if (failed > 0) {
                console.error('❌ Failed tasks:', results.filter(r => !r.success));
            }
        } else {
            console.log('⚠ No inspection tasks to save (tasksList is empty)');
            console.log('  This could mean:');
            console.log('  - inspectionTasks field is empty');
            console.log('  - inspectionTasks field is not being sent from frontend');
        }
        
        res.json({ 
            ok: true, 
            message: 'Maintenance item added successfully',
            maintenanceId: maintenanceId
        });
    } catch (error) {
        console.error('Error adding maintenance:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// Update maintenance item
router.post('/update', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const { maintenanceId, ...updateData } = req.body;

        if (!maintenanceId) {
            return res.status(400).json({ ok: false, error: 'maintenanceId required' });
        }

        const maintenance = await Maintenance.findById(maintenanceId);
        if (!maintenance) {
            return res.status(404).json({ ok: false, error: 'Maintenance item not found' });
        }

        Object.assign(maintenance, updateData);
        await maintenance.save();

        res.json({ ok: true, message: 'Maintenance item updated successfully' });
    } catch (error) {
        console.error('Error updating maintenance:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// Delete maintenance item
router.post('/delete', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const { maintenanceId } = req.body;
        if (!maintenanceId) {
            return res.status(400).json({ ok: false, error: 'maintenanceId required' });
        }

        const result = await Maintenance.deleteOne({ _id: new mongoose.Types.ObjectId(maintenanceId) });
        
        if (result.deletedCount > 0) {
            // Also delete related maintenance assets
            await MaintenanceAsset.deleteMany({ maintenanceId });
            res.json({ ok: true, message: 'Maintenance item deleted successfully' });
        } else {
            res.status(404).json({ ok: false, error: 'Maintenance item not found' });
        }
    } catch (error) {
        console.error('Error deleting maintenance:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// Assign staff to maintenance
router.post('/assign-staff', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const { maintenanceId, staffId } = req.body;

        if (!maintenanceId || !staffId) {
            return res.status(400).json({ ok: false, error: 'maintenanceId and staffId are required' });
        }

        const staff = await User.findById(staffId);
        if (!staff || staff.role !== 'staff') {
            return res.status(404).json({ ok: false, error: 'Staff member not found' });
        }

        const maintenance = await Maintenance.findById(maintenanceId);
        if (!maintenance) {
            return res.status(404).json({ ok: false, error: 'Maintenance item not found' });
        }

        maintenance.assignedStaffId = staffId;
        maintenance.assignedStaffName = staff.name;
        maintenance.assignedStaffEmail = staff.email;
        maintenance.assignedAt = new Date();
        await maintenance.save();

        res.json({
            ok: true,
            message: 'Staff assigned successfully',
            assignedStaff: {
                id: staffId,
                name: staff.name,
                email: staff.email
            }
        });
    } catch (error) {
        console.error('Error assigning staff:', error);
        res.status(500).json({ ok: false, error: 'Could not assign staff: ' + error.message });
    }
});

// Add assets to maintenance
router.post('/add-assets', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const { maintenanceId, assetIds } = req.body;

        if (!maintenanceId || !Array.isArray(assetIds)) {
            return res.status(400).json({ ok: false, error: 'maintenanceId and assetIds array are required' });
        }

        const added = [];
        for (const assetId of assetIds) {
            const existing = await MaintenanceAsset.findOne({ maintenanceId, assetId });
            if (!existing) {
                const ma = new MaintenanceAsset({
                    maintenanceId,
                    assetId,
                    inspectionStatus: 'open',
                    createdAt: new Date()
                });
                await ma.save();
                added.push(assetId);
            }
        }

        res.json({ ok: true, added: added.length, message: `${added.length} asset(s) added to maintenance` });
    } catch (error) {
        console.error('Error adding assets to maintenance:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// Remove asset from maintenance
router.post('/remove-asset', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const { maintenanceId, assetId } = req.body;

        if (!maintenanceId || !assetId) {
            return res.status(400).json({ ok: false, error: 'maintenanceId and assetId are required' });
        }

        const result = await MaintenanceAsset.deleteOne({ maintenanceId, assetId });
        
        if (result.deletedCount > 0) {
            res.json({ ok: true, message: 'Asset removed from maintenance' });
        } else {
            res.status(404).json({ ok: false, error: 'Asset not found in maintenance' });
        }
    } catch (error) {
        console.error('Error removing asset from maintenance:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// Get maintenance asset details (for maintenance asset details page)
router.get('/asset-details', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const { assetId, maintenanceId } = req.query;

        if (!assetId || !maintenanceId) {
            return res.status(400).json({ ok: false, error: 'assetId and maintenanceId are required' });
        }

        // Get asset details
        const asset = await Asset.findOne({ assetId }).lean();
        if (!asset) {
            return res.status(404).json({ ok: false, error: 'Asset not found' });
        }

        // Get maintenance details
        const maintenance = await Maintenance.findById(maintenanceId)
            .select('assignedStaffName assignedStaffEmail')
            .lean();

        // Get inspection data
        const inspection = await MaintenanceAsset.findOne({
            maintenanceId,
            assetId
        }).lean();

        let inspectionDate = null;
        if (inspection && inspection.inspectionDate) {
            inspectionDate = new Date(inspection.inspectionDate).getTime();
        }

        res.json({
            ok: true,
            asset,
            maintenance: maintenance ? {
                assignedStaffName: maintenance.assignedStaffName,
                assignedStaffEmail: maintenance.assignedStaffEmail
            } : null,
            inspection: inspection ? {
                inspectionStatus: inspection.inspectionStatus || 'open',
                inspectionNotes: inspection.inspectionNotes,
                solved: inspection.solved || false,
                inspectionDate: inspectionDate
            } : null
        });
    } catch (error) {
        console.error('Error getting maintenance asset details:', error);
        res.status(500).json({ ok: false, error: 'Could not load asset details: ' + error.message });
    }
});

// Upload maintenance (bulk import) - simplified
router.post('/upload', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const items = req.body.items || [];
        
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ ok: false, error: 'No maintenance items provided' });
        }

        let inserted = 0;
        let skipped = 0;
        const duplicates = [];

        for (const itemData of items) {
            try {
                if (!itemData.branch || !itemData.location || !itemData.itemName) {
                    skipped++;
                    continue;
                }

                // Check for duplicates
                const existing = await Maintenance.findOne({
                    branch: itemData.branch,
                    location: itemData.location,
                    itemName: itemData.itemName,
                    frequency: itemData.frequency
                });

                if (existing) {
                    skipped++;
                    duplicates.push(`${itemData.itemName} (${itemData.branch}, ${itemData.location})`);
                    continue;
                }

                const maintenance = new Maintenance({
                    ...itemData,
                    created_at: new Date()
                });
                await maintenance.save();
                inserted++;
            } catch (error) {
                skipped++;
            }
        }

        res.json({
            ok: true,
            inserted,
            skipped,
            duplicates: duplicates.length > 0 ? duplicates : undefined
        });
    } catch (error) {
        console.error('Error uploading maintenance:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// ============================================
// INSPECTION TASKS ROUTES (separate collection)
// ============================================

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
                        let date;
                        if (typeof dateStr === 'string') {
                            const normalizedDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
                            date = new Date(normalizedDateStr);
                        } else if (dateStr && typeof dateStr === 'object' && dateStr.date) {
                            const normalizedDateStr = dateStr.date.includes('T') ? dateStr.date.split('T')[0] : dateStr.date;
                            date = new Date(normalizedDateStr);
                        } else {
                            return;
                        }
                        if (!isNaN(date.getTime())) {
                            date.setHours(0, 0, 0, 0);
                            dates.push(date);
                        }
                    }
                });
            }
        });
    } else if (frequency === 'Monthly') {
        months.forEach(month => {
            if (schedule[month]) {
                let date;
                if (typeof schedule[month] === 'string') {
                    const normalizedDateStr = schedule[month].includes('T') ? schedule[month].split('T')[0] : schedule[month];
                    date = new Date(normalizedDateStr);
                } else if (schedule[month] && typeof schedule[month] === 'object' && schedule[month].date) {
                    const normalizedDateStr = schedule[month].date.includes('T') ? schedule[month].date.split('T')[0] : schedule[month].date;
                    date = new Date(normalizedDateStr);
                } else {
                    return;
                }
                if (!isNaN(date.getTime())) {
                    date.setHours(0, 0, 0, 0);
                    dates.push(date);
                }
            }
        });
    } else if (frequency === 'Quarterly') {
        const quarters = ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)'];
        quarters.forEach(quarter => {
            if (schedule[quarter]) {
                let date;
                if (typeof schedule[quarter] === 'string') {
                    const normalizedDateStr = schedule[quarter].includes('T') ? schedule[quarter].split('T')[0] : schedule[quarter];
                    date = new Date(normalizedDateStr);
                } else if (schedule[quarter] && typeof schedule[quarter] === 'object' && schedule[quarter].date) {
                    const normalizedDateStr = schedule[quarter].date.includes('T') ? schedule[quarter].date.split('T')[0] : schedule[quarter].date;
                    date = new Date(normalizedDateStr);
                } else {
                    return;
                }
                if (!isNaN(date.getTime())) {
                    date.setHours(0, 0, 0, 0);
                    dates.push(date);
                }
            }
        });
    }
    
    dates.sort((a, b) => a - b);
    return dates;
}

// Initialize pending inspection records for all asset-date combinations
async function initializePendingInspections(maintenanceId, taskName, schedule, frequency) {
    try {
        if (!schedule || typeof schedule !== 'object') {
            console.log('No schedule provided, skipping pending inspection initialization');
            return;
        }
        
        console.log(`\n📅 Initializing pending inspections for task "${taskName}" (maintenanceId: ${maintenanceId})...`);
        
        // Get maintenance to get frequency if not provided
        if (!frequency) {
            const maintenance = await Maintenance.findById(maintenanceId).lean();
            if (maintenance) {
                frequency = maintenance.frequency || 'Weekly';
            } else {
                frequency = 'Weekly'; // Default
            }
        }
        
        // Extract all scheduled dates
        const scheduledDates = extractDatesFromSchedule(schedule, frequency);
        console.log(`Found ${scheduledDates.length} scheduled date(s)`);
        
        if (scheduledDates.length === 0) {
            console.log('No scheduled dates found, skipping pending inspection initialization');
            return;
        }
        
        // Filter out future dates - only process today and past dates
        // Use UTC dates for consistent comparison
        const today = new Date();
        const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
        const todayStr = todayUTC.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        const validDates = scheduledDates.filter(date => {
            // Convert date to YYYY-MM-DD string for comparison
            let dateStr;
            if (date instanceof Date) {
                // Use UTC to avoid timezone issues
                const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
                dateStr = utcDate.toISOString().split('T')[0];
            } else if (typeof date === 'string') {
                dateStr = date.includes('T') ? date.split('T')[0] : date;
            } else {
                const dateObj = new Date(date);
                const utcDate = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
                dateStr = utcDate.toISOString().split('T')[0];
            }
            
            // Compare date strings (YYYY-MM-DD format)
            return dateStr <= todayStr; // Only include today and past dates
        });
        
        console.log(`\n📅 Date Filtering Results:`);
        console.log(`   Today (UTC): ${todayStr}`);
        console.log(`   Total scheduled dates: ${scheduledDates.length}`);
        console.log(`   Valid dates (today and past): ${validDates.length}`);
        console.log(`   Excluded future dates: ${scheduledDates.length - validDates.length}`);
        
        // Log all scheduled dates and their status
        scheduledDates.forEach(date => {
            let dateStr;
            if (date instanceof Date) {
                const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
                dateStr = utcDate.toISOString().split('T')[0];
            } else {
                dateStr = date.includes('T') ? date.split('T')[0] : date;
            }
            const isValid = dateStr <= todayStr;
            console.log(`   ${dateStr}: ${isValid ? '✓ VALID' : '✗ FUTURE (excluded)'}`);
        });
        
        console.log(`   Valid dates: ${validDates.map(d => {
            if (d instanceof Date) {
                return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().split('T')[0];
            }
            return d.includes('T') ? d.split('T')[0] : d;
        }).join(', ')}\n`);
        
        if (validDates.length === 0) {
            console.log('No valid dates (today or past) found, skipping pending inspection initialization');
            return;
        }
        
        // Find all assets with locationDescription matching taskName
        const matchingAssets = await Asset.find({ 
            locationDescription: taskName 
        }).lean();
        
        console.log(`Found ${matchingAssets.length} asset(s) with locationDescription="${taskName}"`);
        
        if (matchingAssets.length === 0) {
            console.log('No matching assets found, skipping pending inspection initialization');
            return;
        }
        
        // Create pending inspection records for each asset-date combination (only for valid dates)
        let createdCount = 0;
        let skippedCount = 0;
        
        for (const asset of matchingAssets) {
            for (const scheduledDate of validDates) {
                // Normalize date to string format (YYYY-MM-DD) for consistent comparison
                let normalizedDate;
                let dateForQuery;
                
                if (scheduledDate instanceof Date) {
                    // Use UTC to avoid timezone issues
                    const utcDate = new Date(Date.UTC(scheduledDate.getFullYear(), scheduledDate.getMonth(), scheduledDate.getDate()));
                    normalizedDate = utcDate.toISOString().split('T')[0];
                    dateForQuery = scheduledDate;
                } else if (typeof scheduledDate === 'string') {
                    normalizedDate = scheduledDate.includes('T') ? scheduledDate.split('T')[0] : scheduledDate;
                    dateForQuery = new Date(normalizedDate);
                } else {
                    normalizedDate = scheduledDate;
                    dateForQuery = new Date(normalizedDate);
                }
                
                // Double-check: Don't create records for future dates (safety check)
                // Recalculate todayStr to ensure it's current and in scope
                const now = new Date();
                const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
                const todayStrCheck = todayUTC.toISOString().split('T')[0];
                
                if (normalizedDate > todayStrCheck) {
                    console.log(`  ⚠️  Skipping future date (safety check): ${normalizedDate} > ${todayStrCheck}`);
                    skippedCount++;
                    continue;
                }
                
                console.log(`  ✓ Processing date: ${normalizedDate} (today: ${todayStrCheck})`);
                
                // Check if inspection record already exists for this asset-date combination
                // Use a more comprehensive query to catch duplicates regardless of date format
                // Check both the exact date and the normalized date string
                const existing = await MaintenanceAsset.findOne({
                    maintenanceId: maintenanceId,
                    assetId: asset.assetId,
                    $or: [
                        // Match exact date object
                        { inspectionDate: dateForQuery },
                        // Match normalized date string
                        { inspectionDate: normalizedDate },
                        // Match date string with time
                        { inspectionDate: normalizedDate + 'T00:00:00.000Z' },
                        { inspectionDate: normalizedDate + 'T16:00:00.000Z' },
                        // Match using date range (same day, different time)
                        {
                            inspectionDate: {
                                $gte: new Date(normalizedDate + 'T00:00:00.000Z'),
                                $lt: new Date(normalizedDate + 'T23:59:59.999Z')
                            }
                        }
                    ]
                });
                
                if (existing) {
                    // Skip if record exists (prevent duplication)
                    // Also skip if inspection is already complete (don't overwrite completed inspections)
                    const existingStatus = (existing.inspectionStatus || '').toLowerCase();
                    if (existingStatus === 'complete' || existingStatus === 'completed') {
                        skippedCount++;
                        console.log(`  ⏭️  Skipped (complete): ${asset.assetId} on ${normalizedDate}`);
                        continue;
                    }
                    // If existing but not complete, also skip to prevent duplication
                    skippedCount++;
                    console.log(`  ⏭️  Skipped (duplicate): ${asset.assetId} on ${normalizedDate}`);
                    continue;
                }
                
                // Create new pending inspection record only if it doesn't exist
                const maintenanceAsset = new MaintenanceAsset({
                    maintenanceId: maintenanceId,
                    assetId: asset.assetId,
                    inspectionStatus: 'pending', // Mark as pending
                    inspectionDate: normalizedDate, // Store as normalized string (YYYY-MM-DD)
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                
                await maintenanceAsset.save();
                createdCount++;
                console.log(`  ✅ Created: ${asset.assetId} on ${normalizedDate}`);
            }
        }
        
        console.log(`\n📊 Pending inspection initialization complete: ${createdCount} created, ${skippedCount} already exist`);
        console.log(`   Total combinations: ${matchingAssets.length} assets × ${scheduledDates.length} dates = ${matchingAssets.length * scheduledDates.length}`);
    } catch (error) {
        console.error('Error initializing pending inspections:', error);
        // Don't throw - this is a background operation, shouldn't fail the main save
    }
}

// Auto-link assets to inspection task based on locationDescription matching taskName
async function autoLinkAssetsByLocation(maintenanceId, taskName) {
    try {
        console.log(`\n🔗 Auto-linking assets for task "${taskName}" (maintenanceId: ${maintenanceId})...`);
        
        // Find all assets with locationDescription matching taskName
        const matchingAssets = await Asset.find({ 
            locationDescription: taskName 
        }).lean();
        
        console.log(`Found ${matchingAssets.length} asset(s) with locationDescription="${taskName}"`);
        
        if (matchingAssets.length === 0) {
            console.log('No matching assets found, skipping auto-link');
            return;
        }
        
        // Link each matching asset to the maintenance task (without specific dates)
        // This creates a general link, pending inspections will be created by initializePendingInspections
        let linkedCount = 0;
        let skippedCount = 0;
        
        for (const asset of matchingAssets) {
            // Check if asset is already linked to this maintenance (without date)
            const existing = await MaintenanceAsset.findOne({
                maintenanceId: maintenanceId,
                assetId: asset.assetId,
                inspectionDate: { $exists: false } // Check for records without specific dates
            });
            
            if (existing) {
                skippedCount++;
                console.log(`  ⏭️  Asset ${asset.assetId} already linked, skipping`);
                continue;
            }
            
            // Create new maintenance asset link (without date - will be created by initializePendingInspections)
            // Actually, we don't need this anymore since we create date-specific records
            // But keeping for backward compatibility
        }
        
        console.log(`\n📊 Auto-link complete: ${linkedCount} linked, ${skippedCount} already linked`);
    } catch (error) {
        console.error('Error auto-linking assets:', error);
        // Don't throw - this is a background operation, shouldn't fail the main save
    }
}

// Get inspection task by maintenanceId and taskName
router.get('/inspection-task', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const { maintenanceId, taskName } = req.query;

        if (!maintenanceId || !taskName) {
            return res.status(400).json({ 
                ok: false, 
                error: 'maintenanceId and taskName are required' 
            });
        }

        const task = await InspectionTask.findOne({ 
            maintenanceId, 
            taskName 
        }).lean();

        if (!task) {
            return res.json({ ok: true, task: null });
        }

        res.json({ 
            ok: true, 
            task: {
                _id: task._id.toString(),
                maintenanceId: task.maintenanceId,
                taskName: task.taskName,
                schedule: task.schedule || null,
                created_at: task.created_at,
                updated_at: task.updated_at
            }
        });
    } catch (error) {
        console.error('Error getting inspection task:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// List all inspection tasks for a maintenance item
router.get('/inspection-tasks', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const { maintenanceId } = req.query;
        
        console.log('=== GET /api/maintenance/inspection-tasks ===');
        console.log('Query params:', req.query);
        console.log('maintenanceId:', maintenanceId);

        // Support "all" to get all tasks
        let query = {};
        if (maintenanceId && maintenanceId !== 'all') {
            query.maintenanceId = maintenanceId;
        }

        console.log(`Searching for tasks with query:`, query);
        const tasks = await InspectionTask.find(query).lean();
        console.log(`Found ${tasks.length} task(s) in inspection_tasks collection`);

        const formattedTasks = tasks.map(task => ({
            _id: task._id.toString(),
            maintenanceId: task.maintenanceId,
            taskName: task.taskName,
            schedule: task.schedule || null,
            created_at: task.created_at,
            updated_at: task.updated_at
        }));

        console.log('Returning tasks:', formattedTasks.map(t => ({ taskName: t.taskName, hasSchedule: !!t.schedule })));
        res.json({ ok: true, tasks: formattedTasks });
    } catch (error) {
        console.error('Error listing inspection tasks:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// Add or update inspection task
router.post('/inspection-task', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const { maintenanceId, taskName, schedule } = req.body;

        if (!maintenanceId || !taskName) {
            return res.status(400).json({ 
                ok: false, 
                error: 'maintenanceId and taskName are required' 
            });
        }

        // Check if task already exists
        const existing = await InspectionTask.findOne({ 
            maintenanceId, 
            taskName 
        });

        if (existing) {
            // Update existing task
            console.log('=== UPDATING INSPECTION TASK ===');
            console.log('Maintenance ID:', maintenanceId);
            console.log('Task Name:', taskName);
            console.log('Existing ID:', existing._id.toString());
            console.log('Old schedule:', JSON.stringify(existing.schedule, null, 2));
            console.log('New schedule:', schedule === null ? 'null (clearing)' : JSON.stringify(schedule, null, 2));
            
            // IMPORTANT: Replace entire schedule (not merge) to ensure deletions are saved
            existing.schedule = schedule || null;
            existing.updated_at = new Date();
            await existing.save();
            
            console.log('✓ Inspection task updated successfully');
            console.log('Verified saved schedule:', JSON.stringify(existing.schedule, null, 2));
            
            // Get maintenance to get frequency
            const maintenance = await Maintenance.findById(maintenanceId).lean();
            const frequency = maintenance ? (maintenance.frequency || 'Weekly') : 'Weekly';
            
            // Auto-link assets with matching locationDescription
            await autoLinkAssetsByLocation(maintenanceId, taskName);
            
            // Initialize pending inspection records for all asset-date combinations
            await initializePendingInspections(maintenanceId, taskName, schedule, frequency);

            res.json({ 
                ok: true, 
                message: 'Inspection task updated successfully',
                taskId: existing._id.toString()
            });
        } else {
            // Insert new task
            console.log('Creating new inspection task:', { maintenanceId, taskName, hasSchedule: !!schedule });
            const newTask = new InspectionTask({
                maintenanceId,
                taskName,
                schedule: schedule || null,
                created_at: new Date(),
                updated_at: new Date()
            });

            await newTask.save();
            console.log('✓ Inspection task created successfully, ID:', newTask._id.toString());
            console.log('✓ Collection "inspection_tasks" should now exist in MongoDB');
            
            // Get maintenance to get frequency
            const maintenance = await Maintenance.findById(maintenanceId).lean();
            const frequency = maintenance ? (maintenance.frequency || 'Weekly') : 'Weekly';
            
            // Auto-link assets with matching locationDescription
            await autoLinkAssetsByLocation(maintenanceId, taskName);
            
            // Initialize pending inspection records for all asset-date combinations
            await initializePendingInspections(maintenanceId, taskName, schedule, frequency);

            res.json({ 
                ok: true, 
                message: 'Inspection task created successfully',
                taskId: newTask._id.toString()
            });
        }
    } catch (error) {
        console.error('Error saving inspection task:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            maintenanceId,
            taskName,
            hasSchedule: !!schedule
        });
        res.status(500).json({ ok: false, error: error.message });
    }
});

// Delete inspection task
router.delete('/inspection-task', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        const { maintenanceId, taskName } = req.body;

        if (!maintenanceId || !taskName) {
            return res.status(400).json({ 
                ok: false, 
                error: 'maintenanceId and taskName are required' 
            });
        }

        const result = await InspectionTask.deleteOne({ 
            maintenanceId, 
            taskName 
        });

        if (result.deletedCount > 0) {
            res.json({ ok: true, message: 'Inspection task deleted successfully' });
        } else {
            res.status(404).json({ ok: false, error: 'Inspection task not found' });
        }
    } catch (error) {
        console.error('Error deleting inspection task:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// Initialize pending inspections for a maintenance task (for migration or manual trigger)
router.post('/initialize-pending-inspections', async (req, res) => {
    try {
        console.log('\n🔵 POST /api/maintenance/initialize-pending-inspections');
        console.log('Request body:', req.body);
        
        if (!checkDBConnection(res)) return;

        const { maintenanceId, taskName } = req.body;

        if (!maintenanceId || !taskName) {
            console.error('❌ Missing required parameters');
            return res.status(400).json({ 
                ok: false, 
                error: 'maintenanceId and taskName are required' 
            });
        }

        console.log(`Looking for inspection task: maintenanceId="${maintenanceId}", taskName="${taskName}"`);

        // Convert maintenanceId to ObjectId if it's a string
        let maintenanceIdObj;
        try {
            maintenanceIdObj = mongoose.Types.ObjectId.isValid(maintenanceId) 
                ? new mongoose.Types.ObjectId(maintenanceId) 
                : maintenanceId;
        } catch (e) {
            maintenanceIdObj = maintenanceId;
        }

        // Get the inspection task to get its schedule
        const inspectionTask = await InspectionTask.findOne({ 
            maintenanceId: maintenanceIdObj, 
            taskName 
        }).lean();

        console.log('Inspection task found:', inspectionTask ? 'Yes' : 'No');
        if (inspectionTask) {
            console.log('Has schedule:', !!inspectionTask.schedule);
            if (inspectionTask.schedule) {
                console.log('Schedule keys:', Object.keys(inspectionTask.schedule));
            }
        }

        if (!inspectionTask || !inspectionTask.schedule) {
            console.error('❌ Inspection task not found or has no schedule');
            return res.status(404).json({ 
                ok: false, 
                error: 'Inspection task not found or has no schedule' 
            });
        }

        // Get maintenance to get frequency
        const maintenance = await Maintenance.findById(maintenanceIdObj).lean();
        if (!maintenance) {
            console.error('❌ Maintenance item not found');
            return res.status(404).json({ 
                ok: false, 
                error: 'Maintenance item not found' 
            });
        }

        const frequency = maintenance.frequency || 'Weekly';
        console.log(`Frequency: ${frequency}`);

        // Initialize pending inspections
        console.log('Calling initializePendingInspections...');
        await initializePendingInspections(maintenanceIdObj.toString(), taskName, inspectionTask.schedule, frequency);

        console.log('✅ Pending inspections initialized successfully');
        res.json({ 
            ok: true, 
            message: 'Pending inspections initialized successfully' 
        });
    } catch (error) {
        console.error('❌ Error initializing pending inspections:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ ok: false, error: error.message });
    }
});

// Initialize pending inspections for ALL maintenance tasks (migration endpoint)
router.post('/initialize-all-pending-inspections', async (req, res) => {
    try {
        if (!checkDBConnection(res)) return;

        console.log('=== INITIALIZING PENDING INSPECTIONS FOR ALL TASKS ===');
        
        // Get all inspection tasks with schedules
        const allInspectionTasks = await InspectionTask.find({
            schedule: { $exists: true, $ne: null }
        }).lean();
        
        console.log(`Found ${allInspectionTasks.length} inspection task(s) with schedules`);
        
        let totalInitialized = 0;
        let totalErrors = 0;
        const results = [];
        
        for (const task of allInspectionTasks) {
            try {
                // Get maintenance to get frequency
                const maintenance = await Maintenance.findById(task.maintenanceId).lean();
                if (!maintenance) {
                    console.log(`⚠ Maintenance ${task.maintenanceId} not found, skipping task "${task.taskName}"`);
                    continue;
                }
                
                const frequency = maintenance.frequency || 'Weekly';
                
                console.log(`\nProcessing task: "${task.taskName}" (maintenanceId: ${task.maintenanceId})`);
                
                // Initialize pending inspections
                await initializePendingInspections(
                    task.maintenanceId, 
                    task.taskName, 
                    task.schedule, 
                    frequency
                );
                
                totalInitialized++;
                results.push({ 
                    taskName: task.taskName, 
                    maintenanceId: task.maintenanceId, 
                    status: 'success' 
                });
            } catch (error) {
                console.error(`Error processing task "${task.taskName}":`, error);
                totalErrors++;
                results.push({ 
                    taskName: task.taskName, 
                    maintenanceId: task.maintenanceId, 
                    status: 'error', 
                    error: error.message 
                });
            }
        }
        
        console.log(`\n=== INITIALIZATION COMPLETE ===`);
        console.log(`Total tasks processed: ${allInspectionTasks.length}`);
        console.log(`Successfully initialized: ${totalInitialized}`);
        console.log(`Errors: ${totalErrors}`);
        
        res.json({ 
            ok: true, 
            message: `Pending inspections initialization complete`,
            totalTasks: allInspectionTasks.length,
            successful: totalInitialized,
            errors: totalErrors,
            results: results
        });
    } catch (error) {
        console.error('Error initializing all pending inspections:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
});

module.exports = router;


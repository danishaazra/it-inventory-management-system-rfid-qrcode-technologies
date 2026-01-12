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
                    assets.push({
                        assetId: asset.assetId,
                        assetDescription: asset.assetDescription,
                        assetCategory: asset.assetCategory,
                        assetCategoryDescription: asset.assetCategoryDescription,
                        brand: asset.brand,
                        model: asset.model,
                        status: asset.status,
                        inspectionStatus: ma.inspectionStatus || 'open',
                        inspectionNotes: ma.inspectionNotes,
                        solved: ma.solved || false,
                        inspectionDate: ma.inspectionDate
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
        
        // Link each matching asset to the maintenance task
        let linkedCount = 0;
        let skippedCount = 0;
        
        for (const asset of matchingAssets) {
            // Check if asset is already linked to this maintenance
            const existing = await MaintenanceAsset.findOne({
                maintenanceId: maintenanceId,
                assetId: asset.assetId
            });
            
            if (existing) {
                skippedCount++;
                console.log(`  ⏭️  Asset ${asset.assetId} already linked, skipping`);
                continue;
            }
            
            // Create new maintenance asset link
            const maintenanceAsset = new MaintenanceAsset({
                maintenanceId: maintenanceId,
                assetId: asset.assetId,
                inspectionStatus: 'open',
                createdAt: new Date(),
                updatedAt: new Date()
            });
            
            await maintenanceAsset.save();
            linkedCount++;
            console.log(`  ✓ Linked asset ${asset.assetId} (${asset.assetDescription || 'No description'})`);
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

        if (!maintenanceId) {
            console.error('✗ Missing maintenanceId parameter');
            return res.status(400).json({ 
                ok: false, 
                error: 'maintenanceId is required' 
            });
        }

        console.log(`Searching for tasks with maintenanceId: ${maintenanceId}`);
        const tasks = await InspectionTask.find({ maintenanceId }).lean();
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
            console.log('Updating existing inspection task:', { maintenanceId, taskName, existingId: existing._id.toString() });
            existing.schedule = schedule || null;
            existing.updated_at = new Date();
            await existing.save();
            console.log('✓ Inspection task updated successfully');
            
            // Auto-link assets with matching locationDescription
            await autoLinkAssetsByLocation(maintenanceId, taskName);

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
            
            // Auto-link assets with matching locationDescription
            await autoLinkAssetsByLocation(maintenanceId, taskName);

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

module.exports = router;


// Mongoose models for all collections
const mongoose = require('mongoose');

const MONGO_DB = process.env.MONGO_DB || 'it_inventory';

// User Schema
const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false }, // Optional for backward compatibility
    role: { type: String, enum: ['admin', 'staff'], required: true },
    created_at: { type: Date, default: Date.now },
    lastLogin: { type: Date, default: Date.now }
}, { collection: 'users' });

// Asset Schema
const assetSchema = new mongoose.Schema({
    assetId: String,
    assetDescription: String,
    assetCategory: String,
    assetCategoryDescription: String,
    ownerCode: String,
    ownerName: String,
    model: String,
    brand: String,
    status: String,
    warrantyPeriod: String,
    serialNo: String,
    serialNumber: String, // Support both field names
    location: String,
    locationDescription: String,
    area: String,
    locationArea: String,
    departmentCode: String,
    departmentDescription: String,
    condition: String,
    currentUser: String,
    branchCode: String,
    no: String,
    rfidTagId: String,
    created_at: { type: Date, default: Date.now }
}, { collection: 'assets' });

// Maintenance Schema
const maintenanceSchema = new mongoose.Schema({
    branch: String,
    location: String,
    itemName: String,
    frequency: String,
    maintenanceSchedule: mongoose.Schema.Types.Mixed,
    inspectionTasks: String,
    assignedStaffId: String,
    assignedStaffName: String,
    assignedStaffEmail: String,
    created_at: { type: Date, default: Date.now }
}, { collection: 'maintenance' });

// Maintenance Asset Schema (for linking assets to maintenance tasks)
const maintenanceAssetSchema = new mongoose.Schema({
    maintenanceId: String,
    assetId: String,
    inspectionStatus: { type: String, default: 'open' }, // 'complete' when inspection is done, 'open' when pending
    status: { type: String, default: 'normal' }, // 'normal' or 'abnormal' (fault condition)
    inspectionDate: Date,
    inspectionNotes: String,
    inspectorId: String,
    inspectorName: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { collection: 'maintenance_assets' });

// Inspection Task Schema (separate collection for each task's schedule)
const inspectionTaskSchema = new mongoose.Schema({
    maintenanceId: { type: String, required: true },
    taskName: { type: String, required: true },
    schedule: mongoose.Schema.Types.Mixed,
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
}, { collection: 'inspection_tasks' });

// Create index for faster queries
inspectionTaskSchema.index({ maintenanceId: 1, taskName: 1 });

// Report Schema
const reportSchema = new mongoose.Schema({
    reportType: String,
    reportName: String,
    criteria: mongoose.Schema.Types.Mixed,
    reportData: mongoose.Schema.Types.Mixed, // Store the actual report data
    headerInfo: mongoose.Schema.Types.Mixed, // Store header info for reports that need it
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { collection: 'reports' });

// Create indexes
assetSchema.index({ assetId: 1 });
assetSchema.index({ rfidTagId: 1 });
maintenanceAssetSchema.index({ maintenanceId: 1 });
maintenanceAssetSchema.index({ assetId: 1 });

const User = mongoose.model('User', userSchema, 'users');
const Asset = mongoose.model('Asset', assetSchema, 'assets');
const Maintenance = mongoose.model('Maintenance', maintenanceSchema, 'maintenance');
const MaintenanceAsset = mongoose.model('MaintenanceAsset', maintenanceAssetSchema, 'maintenance_assets');
const Report = mongoose.model('Report', reportSchema, 'reports');
const InspectionTask = mongoose.model('InspectionTask', inspectionTaskSchema, 'inspection_tasks');

module.exports = {
    User,
    Asset,
    Maintenance,
    MaintenanceAsset,
    Report,
    InspectionTask
};


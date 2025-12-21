<?php
header('Content-Type: application/json');
require '../api/db.php';

$assetId = $_GET['assetId'] ?? '';
$maintenanceId = $_GET['maintenanceId'] ?? '';

if (empty($assetId) || empty($maintenanceId)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'assetId and maintenanceId are required']);
  exit;
}

try {
  // Get asset details
  $assetFilter = ['assetId' => $assetId];
  $assetResults = mongoFind($mongoManager, $assetsNamespace, $assetFilter, ['limit' => 1]);
  
  if (empty($assetResults)) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'Asset not found']);
    exit;
  }
  
  $assetDoc = $assetResults[0];
  $asset = [
    'assetId' => $assetDoc->assetId ?? null,
    'assetDescription' => $assetDoc->assetDescription ?? null,
    'assetCategory' => $assetDoc->assetCategory ?? null,
    'assetCategoryDescription' => $assetDoc->assetCategoryDescription ?? null,
    'brand' => $assetDoc->brand ?? null,
    'model' => $assetDoc->model ?? null,
    'status' => $assetDoc->status ?? null,
    'location' => $assetDoc->location ?? null,
    'locationDescription' => $assetDoc->locationDescription ?? null,
    'serialNo' => $assetDoc->serialNo ?? null,
    'area' => $assetDoc->area ?? null,
    'departmentCode' => $assetDoc->departmentCode ?? null,
    'departmentDescription' => $assetDoc->departmentDescription ?? null,
    'condition' => $assetDoc->condition ?? null,
    'currentUser' => $assetDoc->currentUser ?? null,
    'ownerCode' => $assetDoc->ownerCode ?? null,
    'ownerName' => $assetDoc->ownerName ?? null,
    'warrantyPeriod' => $assetDoc->warrantyPeriod ?? null,
    'branchCode' => $assetDoc->branchCode ?? null,
    'no' => $assetDoc->no ?? null,
    'rfidTagId' => $assetDoc->rfidTagId ?? null,
  ];
  
  // Get maintenance details (for staff info)
  $maintenanceFilter = ['_id' => new MongoDB\BSON\ObjectId($maintenanceId)];
  $maintenanceResults = mongoFind($mongoManager, $maintenanceNamespace, $maintenanceFilter, ['limit' => 1]);
  
  $maintenance = null;
  if (!empty($maintenanceResults)) {
    $maintenanceDoc = $maintenanceResults[0];
    $maintenance = [
      'assignedStaffName' => $maintenanceDoc->assignedStaffName ?? null,
      'assignedStaffEmail' => $maintenanceDoc->assignedStaffEmail ?? null,
    ];
  }
  
  // Get inspection data
  $inspectionsNamespace = $mongoDb . '.maintenance_assets';
  $inspectionFilter = [
    'maintenanceId' => $maintenanceId,
    'assetId' => $assetId
  ];
  $inspectionResults = mongoFind($mongoManager, $inspectionsNamespace, $inspectionFilter, ['limit' => 1]);
  
  $inspection = null;
  if (!empty($inspectionResults)) {
    $inspectionDoc = $inspectionResults[0];
    // Convert MongoDB UTCDateTime to timestamp (milliseconds)
    $inspectionDate = null;
    if (isset($inspectionDoc->inspectionDate)) {
      if ($inspectionDoc->inspectionDate instanceof MongoDB\BSON\UTCDateTime) {
        $inspectionDate = $inspectionDoc->inspectionDate->toDateTime()->getTimestamp() * 1000;
      } else {
        $inspectionDate = $inspectionDoc->inspectionDate;
      }
    }
    $inspection = [
      'inspectionStatus' => $inspectionDoc->inspectionStatus ?? 'open',
      'inspectionNotes' => $inspectionDoc->inspectionNotes ?? null,
      'solved' => $inspectionDoc->solved ?? false,
      'inspectionDate' => $inspectionDate,
    ];
  }
  
  echo json_encode([
    'ok' => true,
    'asset' => $asset,
    'maintenance' => $maintenance,
    'inspection' => $inspection
  ]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Could not load asset details: ' . $e->getMessage()]);
}
?>


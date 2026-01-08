<?php
// Prevent any output before JSON
ob_start();

// Turn off error display (but log them)
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Set JSON header
header('Content-Type: application/json');

try {
  require '../api/db.php';
} catch (Throwable $e) {
  ob_end_clean();
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Database connection failed: ' . $e->getMessage()]);
  exit;
}

// Clean output buffer before processing
ob_end_clean();

// Get assetId from query parameter
$assetId = $_GET['assetId'] ?? '';
// Optional: staffId is only used when staff are scanning assets. When present,
// we will verify that the asset is assigned to one of the staff's maintenance tasks.
$staffId   = $_GET['staffId'] ?? '';

if (empty($assetId)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'assetId parameter is required']);
  exit;
}

try {
  // Query asset by assetId
  $filter = ['assetId' => $assetId];
  $results = mongoFind($mongoManager, $assetsNamespace, $filter, ['limit' => 1]);
  
  if (empty($results)) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'ASSET_NOT_FOUND', 'message' => 'Asset not found with this Asset ID']);
    exit;
  }
  
  $doc = $results[0];
  
  // Convert MongoDB document to array
  $asset = [
    'assetId' => $doc->assetId ?? null,
    'assetDescription' => $doc->assetDescription ?? null,
    'assetCategory' => $doc->assetCategory ?? null,
    'assetCategoryDescription' => $doc->assetCategoryDescription ?? null,
    'ownerCode' => $doc->ownerCode ?? null,
    'ownerName' => $doc->ownerName ?? null,
    'model' => $doc->model ?? null,
    'brand' => $doc->brand ?? null,
    'status' => $doc->status ?? null,
    'warrantyPeriod' => $doc->warrantyPeriod ?? null,
    'serialNo' => $doc->serialNo ?? null,
    'location' => $doc->location ?? null,
    'locationDescription' => $doc->locationDescription ?? null,
    'area' => $doc->area ?? null,
    'departmentCode' => $doc->departmentCode ?? null,
    'departmentDescription' => $doc->departmentDescription ?? null,
    'condition' => $doc->condition ?? null,
    'currentUser' => $doc->currentUser ?? null,
    'branchCode' => $doc->branchCode ?? null,
    'no' => $doc->no ?? null,
    'rfidTagId' => $doc->rfidTagId ?? null,
    'created_at' => $doc->created_at ?? null,
  ];

  // If a staffId is provided, verify that this asset is assigned to one of the
  // staff member's maintenance tasks. This is used by the Staff scan pages only.
  if (!empty($staffId) && !empty($asset['assetId'])) {
    // 1) Find maintenance tasks assigned to this staff member
    $maintenanceFilter = ['assignedStaffId' => $staffId];
    $maintenanceResults = mongoFind($mongoManager, $maintenanceNamespace, $maintenanceFilter, ['projection' => ['_id' => 1]]);

    $assignedMaintenanceIds = [];
    foreach ($maintenanceResults as $mDoc) {
      if (isset($mDoc->_id)) {
        $assignedMaintenanceIds[] = (string)$mDoc->_id;
      }
    }

    if (empty($assignedMaintenanceIds)) {
      // Staff has no assigned maintenance tasks at all
      http_response_code(403);
      echo json_encode([
        'ok' => false,
        'error' => 'ASSET_NOT_ASSIGNED_TO_STAFF',
        'message' => 'This asset is not assigned to your maintenance tasks.'
      ]);
      exit;
    }

    // 2) Check maintenance_assets for a record linking this asset to any of the staff's maintenance tasks
    $inspectionsNamespace = $mongoDb . '.maintenance_assets';
    $inspectionFilter = [
      'assetId' => $asset['assetId'],
      'maintenanceId' => ['$in' => $assignedMaintenanceIds],
    ];

    $inspectionResults = mongoFind($mongoManager, $inspectionsNamespace, $inspectionFilter, ['limit' => 1]);

    if (empty($inspectionResults)) {
      // Asset is not part of any maintenance task assigned to this staff member
      // Find which maintenance task this asset belongs to and get assigned staff info
      $allInspectionFilter = ['assetId' => $asset['assetId']];
      $allInspectionResults = mongoFind($mongoManager, $inspectionsNamespace, $allInspectionFilter, ['limit' => 1]);
      
      $assignedStaffName = null;
      $assignedStaffEmail = null;
      
      if (!empty($allInspectionResults)) {
        $inspectionDoc = $allInspectionResults[0];
        $maintenanceId = isset($inspectionDoc->maintenanceId) ? (string)$inspectionDoc->maintenanceId : null;
        
        if ($maintenanceId) {
          $maintenanceFilter = ['_id' => new MongoDB\BSON\ObjectId($maintenanceId)];
          $maintenanceResults = mongoFind($mongoManager, $maintenanceNamespace, $maintenanceFilter, ['limit' => 1]);
          
          if (!empty($maintenanceResults)) {
            $maintenanceDoc = $maintenanceResults[0];
            $assignedStaffName = $maintenanceDoc->assignedStaffName ?? null;
            $assignedStaffEmail = $maintenanceDoc->assignedStaffEmail ?? null;
          }
        }
      }
      
      http_response_code(403);
      echo json_encode([
        'ok' => false,
        'error' => 'ASSET_NOT_ASSIGNED_TO_STAFF',
        'message' => 'This asset is not assigned to your maintenance tasks.',
        'assignedStaffName' => $assignedStaffName,
        'assignedStaffEmail' => $assignedStaffEmail
      ]);
      exit;
    }
  }
  
  echo json_encode(['ok' => true, 'asset' => $asset]);
} catch (Throwable $e) {
  ob_end_clean();
  http_response_code(500);
  error_log('get_asset_by_assetid error: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
  echo json_encode(['ok' => false, 'error' => 'Could not load asset: ' . $e->getMessage()]);
  exit;
}
?>


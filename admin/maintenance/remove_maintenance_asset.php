<?php
header('Content-Type: application/json');
require '../api/db.php';

$data = json_decode(file_get_contents('php://input'), true);

$maintenanceId = $data['maintenanceId'] ?? '';
$branch = $data['branch'] ?? '';
$location = $data['location'] ?? '';
$itemName = $data['itemName'] ?? '';
$assetId = $data['assetId'] ?? '';

if (empty($assetId)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'assetId is required']);
  exit;
}

if (empty($maintenanceId) && (empty($branch) || empty($location) || empty($itemName))) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'maintenanceId is required, or provide branch, location, and itemName']);
  exit;
}

try {
  $inspectionsNamespace = $mongoDb . '.maintenance_assets';
  
  if (!empty($maintenanceId)) {
    $filter = [
      'maintenanceId' => $maintenanceId,
      'assetId' => $assetId
    ];
  } else {
    $filter = [
      'branch' => $branch,
      'location' => $location,
      'itemName' => $itemName,
      'assetId' => $assetId
    ];
  }
  
  $bulk = new MongoDB\Driver\BulkWrite();
  $bulk->delete($filter);
  
  $result = $mongoManager->executeBulkWrite($inspectionsNamespace, $bulk);
  
  if ($result->getDeletedCount() > 0) {
    echo json_encode(['ok' => true, 'message' => 'Asset removed successfully']);
  } else {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'Asset not found in maintenance task']);
  }
} catch (Exception $e) {
  http_response_code(500);
  error_log('Error in remove_maintenance_asset.php: ' . $e->getMessage());
  echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
?>



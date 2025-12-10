<?php
header('Content-Type: application/json');
require '../api/db.php';

$data = json_decode(file_get_contents('php://input'), true);

$branch = $data['branch'] ?? '';
$location = $data['location'] ?? '';
$itemName = $data['itemName'] ?? '';
$assetId = $data['assetId'] ?? '';

if (empty($branch) || empty($location) || empty($itemName) || empty($assetId)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'branch, location, itemName, and assetId are required']);
  exit;
}

try {
  $inspectionsNamespace = $mongoDb . '.maintenance_assets';
  
  $filter = [
    'branch' => $branch,
    'location' => $location,
    'itemName' => $itemName,
    'assetId' => $assetId
  ];
  
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


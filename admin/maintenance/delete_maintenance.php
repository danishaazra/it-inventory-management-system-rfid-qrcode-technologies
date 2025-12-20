<?php
header('Content-Type: application/json');
require '../api/db.php';

$data = json_decode(file_get_contents('php://input'), true);

$branch = $data['branch'] ?? '';
$location = $data['location'] ?? '';
$itemName = $data['itemName'] ?? '';

if (empty($branch) || empty($location) || empty($itemName)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'branch, location, and itemName are required']);
  exit;
}

try {
  // Check if maintenance item exists
  $filter = [
    'branch' => $branch,
    'location' => $location,
    'itemName' => $itemName
  ];
  $results = mongoFind($mongoManager, $maintenanceNamespace, $filter, ['limit' => 1]);
  
  if (empty($results)) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'Maintenance item not found']);
    exit;
  }
  
  // Delete the maintenance item
  $bulk = new MongoDB\Driver\BulkWrite();
  $bulk->delete($filter);
  
  $result = $mongoManager->executeBulkWrite($maintenanceNamespace, $bulk);
  
  if ($result->getDeletedCount() > 0) {
    echo json_encode(['ok' => true, 'message' => 'Maintenance item deleted successfully']);
  } else {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Failed to delete maintenance item']);
  }
} catch (MongoDB\Driver\Exception\Exception $e) {
  http_response_code(500);
  error_log('MongoDB error in delete_maintenance.php: ' . $e->getMessage());
  echo json_encode(['ok' => false, 'error' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
  http_response_code(500);
  error_log('Error in delete_maintenance.php: ' . $e->getMessage());
  echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
?>





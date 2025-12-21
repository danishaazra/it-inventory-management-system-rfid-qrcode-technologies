<?php
header('Content-Type: application/json');
require '../api/db.php';

$data = json_decode(file_get_contents('php://input'), true);

// Get the original identifiers
$originalBranch = $data['originalBranch'] ?? '';
$originalLocation = $data['originalLocation'] ?? '';
$originalItemName = $data['originalItemName'] ?? '';

if (empty($originalBranch) || empty($originalLocation) || empty($originalItemName)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'originalBranch, originalLocation, and originalItemName are required']);
  exit;
}

try {
  // Check if maintenance item exists
  $filter = [
    'branch' => $originalBranch,
    'location' => $originalLocation,
    'itemName' => $originalItemName
  ];
  $results = mongoFind($mongoManager, $maintenanceNamespace, $filter, ['limit' => 1]);
  
  if (empty($results)) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'Maintenance item not found']);
    exit;
  }
  
  // Prepare update document
  $updateDoc = [
    'branch' => $data['branch'] ?? null,
    'location' => $data['location'] ?? null,
    'itemName' => $data['itemName'] ?? null,
    'frequency' => $data['frequency'] ?? null,
    'maintenanceSchedule' => $data['maintenanceSchedule'] ?? null,
    'inspectionTasks' => $data['inspectionTasks'] ?? null,
    'updated_at' => new MongoDB\BSON\UTCDateTime(),
  ];
  
  // Remove null values
  $updateDoc = array_filter($updateDoc, function($value) {
    return $value !== null;
  });
  
  // Build update query
  $bulk = new MongoDB\Driver\BulkWrite();
  $bulk->update(
    $filter,
    ['$set' => $updateDoc]
  );
  
  $result = $mongoManager->executeBulkWrite($maintenanceNamespace, $bulk);
  
  if ($result->getModifiedCount() > 0 || $result->getMatchedCount() > 0) {
    echo json_encode(['ok' => true, 'message' => 'Maintenance item updated successfully']);
  } else {
    echo json_encode(['ok' => true, 'message' => 'No changes detected']);
  }
} catch (MongoDB\Driver\Exception\Exception $e) {
  http_response_code(500);
  error_log('MongoDB error in update_maintenance.php: ' . $e->getMessage());
  echo json_encode(['ok' => false, 'error' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
  http_response_code(500);
  error_log('Error in update_maintenance.php: ' . $e->getMessage());
  echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
?>







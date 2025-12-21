<?php
header('Content-Type: application/json');
require '../api/db.php';

$data = json_decode(file_get_contents('php://input'), true);

// Validate required fields
$requiredFields = ['branch', 'location', 'itemName', 'frequency', 'inspectionTasks'];
foreach ($requiredFields as $field) {
  if (!isset($data[$field]) || $data[$field] === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => ucfirst($field) . ' is required']);
    exit;
  }
}

// Prepare document for MongoDB
$doc = [
  'branch' => $data['branch'] ?? null,
  'location' => $data['location'] ?? null,
  'itemName' => $data['itemName'] ?? null,
  'frequency' => $data['frequency'] ?? null,
  'maintenanceSchedule' => $data['maintenanceSchedule'] ?? null,
  'inspectionTasks' => $data['inspectionTasks'] ?? null,
  'created_at' => new MongoDB\BSON\UTCDateTime(),
];

try {
  // Verify MongoDB connection
  if (!isset($mongoManager)) {
    throw new Exception('MongoDB manager not initialized');
  }
  
  // Check if maintenance item with same branch, location, and itemName already exists
  $filter = [
    'branch' => $doc['branch'],
    'location' => $doc['location'],
    'itemName' => $doc['itemName']
  ];
  
  $existing = mongoFind($mongoManager, $maintenanceNamespace, $filter, ['limit' => 1]);
  if (!empty($existing)) {
    http_response_code(409); // Conflict status code
    echo json_encode([
      'ok' => false, 
      'error' => 'Data already exists',
      'message' => 'A maintenance item with this Branch, Location, and Item Name already exists in the database.'
    ]);
    exit;
  }
  
  // Attempt to insert
  $result = mongoInsertOne($mongoManager, $maintenanceNamespace, $doc);
  
  if ($result['insertedCount'] > 0) {
    echo json_encode(['ok' => true, 'message' => 'Maintenance item added successfully']);
  } else {
    throw new Exception('Maintenance item was not inserted into database');
  }
} catch (MongoDB\Driver\Exception\Exception $e) {
  http_response_code(500);
  error_log('MongoDB error in add_maintenance.php: ' . $e->getMessage());
  echo json_encode(['ok' => false, 'error' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
  http_response_code(500);
  error_log('Error in add_maintenance.php: ' . $e->getMessage());
  echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
?>







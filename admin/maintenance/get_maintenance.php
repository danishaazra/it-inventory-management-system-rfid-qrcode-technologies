<?php
header('Content-Type: application/json');
require '../api/db.php';

// Get parameters from query string - support both maintenanceId and legacy branch/location/itemName
$maintenanceId = $_GET['maintenanceId'] ?? '';
$branch = $_GET['branch'] ?? '';
$location = $_GET['location'] ?? '';
$itemName = $_GET['itemName'] ?? '';

try {
  // If maintenanceId is provided, use it (preferred method)
  if (!empty($maintenanceId)) {
    $filter = ['_id' => new MongoDB\BSON\ObjectId($maintenanceId)];
  } elseif (!empty($branch) && !empty($location) && !empty($itemName)) {
    // Legacy support: query by branch, location, and itemName
    $filter = [
      'branch' => $branch,
      'location' => $location,
      'itemName' => $itemName
    ];
  } else {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'maintenanceId parameter is required, or provide branch, location, and itemName']);
    exit;
  }
  
  $results = mongoFind($mongoManager, $maintenanceNamespace, $filter, ['limit' => 1]);
  
  if (empty($results)) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'Maintenance item not found']);
    exit;
  }
  
  $doc = $results[0];
  
  // Convert maintenanceSchedule (might be BSON object) to array
  $maintenanceSchedule = null;
  if (isset($doc->maintenanceSchedule)) {
    if (is_object($doc->maintenanceSchedule)) {
      // Convert BSON object to array recursively
      $maintenanceSchedule = json_decode(json_encode($doc->maintenanceSchedule), true);
    } else {
      $maintenanceSchedule = $doc->maintenanceSchedule;
    }
  }
  
  // Convert MongoDB document to array
  $maintenance = [
    '_id' => (string)$doc->_id, // Include MongoDB ID
    'branch' => $doc->branch ?? null,
    'location' => $doc->location ?? null,
    'itemName' => $doc->itemName ?? null,
    'frequency' => $doc->frequency ?? null,
    'maintenanceSchedule' => $maintenanceSchedule,
    'inspectionTasks' => $doc->inspectionTasks ?? null,
    'created_at' => $doc->created_at ?? null,
    'assignedStaffId' => $doc->assignedStaffId ?? null,
    'assignedStaffName' => $doc->assignedStaffName ?? null,
    'assignedStaffEmail' => $doc->assignedStaffEmail ?? null,
  ];
  
  echo json_encode(['ok' => true, 'maintenance' => $maintenance]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Could not load maintenance item: ' . $e->getMessage()]);
}
?>


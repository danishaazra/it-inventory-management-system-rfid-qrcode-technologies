<?php
header('Content-Type: application/json');
require '../api/db.php';

// Get staffId or staffEmail from query parameters
$staffId = $_GET['staffId'] ?? '';
$staffEmail = $_GET['staffEmail'] ?? '';

if (empty($staffId) && empty($staffEmail)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'staffId or staffEmail is required']);
  exit;
}

try {
  // Build filter based on staffId or staffEmail
  $filter = [];
  if (!empty($staffId)) {
    $filter['assignedStaffId'] = $staffId;
  } elseif (!empty($staffEmail)) {
    $filter['assignedStaffEmail'] = $staffEmail;
  }
  
  // Query maintenance items assigned to this staff member
  $options = [
    'sort' => ['itemName' => 1] // Sort ascending by itemName
  ];
  $results = mongoFind($mongoManager, $maintenanceNamespace, $filter, $options);
  
  // Convert MongoDB documents to arrays
  $maintenance = [];
  foreach ($results as $doc) {
    // Convert maintenanceSchedule if exists
    $maintenanceSchedule = null;
    if (isset($doc->maintenanceSchedule)) {
      if (is_object($doc->maintenanceSchedule)) {
        $maintenanceSchedule = json_decode(json_encode($doc->maintenanceSchedule), true);
      } else {
        $maintenanceSchedule = $doc->maintenanceSchedule;
      }
    }
    
    $item = [
      '_id' => (string)$doc->_id,
      'branch' => $doc->branch ?? null,
      'location' => $doc->location ?? null,
      'itemName' => $doc->itemName ?? null,
      'frequency' => $doc->frequency ?? null,
      'maintenanceSchedule' => $maintenanceSchedule,
      'inspectionTasks' => $doc->inspectionTasks ?? null,
      'assignedStaffId' => $doc->assignedStaffId ?? null,
      'assignedStaffName' => $doc->assignedStaffName ?? null,
      'assignedStaffEmail' => $doc->assignedStaffEmail ?? null,
    ];
    $maintenance[] = $item;
  }
  
  echo json_encode(['ok' => true, 'maintenance' => $maintenance]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Could not load assigned maintenance: ' . $e->getMessage()]);
}
?>







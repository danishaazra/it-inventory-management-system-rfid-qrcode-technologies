<?php
header('Content-Type: application/json');
require '../api/db.php';

try {
  // Query all maintenance items from MongoDB, sorted by itemName
  $options = [
    'sort' => ['itemName' => 1] // Sort ascending by itemName
  ];
  $results = mongoFind($mongoManager, $maintenanceNamespace, [], $options);
  
  // Get inspection counts from maintenance_assets collection
  $inspectionsNamespace = $mongoDb . '.maintenance_assets';
  
  // Convert MongoDB documents to arrays
  $maintenance = [];
  foreach ($results as $doc) {
    $maintenanceId = (string)$doc->_id;
    
    // Get inspection counts for this maintenance item
    $inspectionFilter = ['maintenanceId' => $maintenanceId];
    $inspectionResults = mongoFind($mongoManager, $inspectionsNamespace, $inspectionFilter);
    
    $totalInspections = count($inspectionResults);
    $completedInspections = 0;
    $openInspections = 0;
    
    foreach ($inspectionResults as $inspectionDoc) {
      $status = $inspectionDoc->inspectionStatus ?? 'open';
      if ($status === 'complete') {
        $completedInspections++;
      } else {
        $openInspections++;
      }
    }
    
    $item = [
      '_id' => $maintenanceId,
      'branch' => $doc->branch ?? null,
      'location' => $doc->location ?? null,
      'itemName' => $doc->itemName ?? null,
      'frequency' => $doc->frequency ?? null,
      'inspectionTasks' => $doc->inspectionTasks ?? null,
      'assignedStaffId' => $doc->assignedStaffId ?? null,
      'assignedStaffName' => $doc->assignedStaffName ?? null,
      'assignedStaffEmail' => $doc->assignedStaffEmail ?? null,
      'totalInspections' => $totalInspections,
      'completedInspections' => $completedInspections,
      'openInspections' => $openInspections,
    ];
    $maintenance[] = $item;
  }
  
  echo json_encode(['ok' => true, 'maintenance' => $maintenance]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Could not load maintenance items: ' . $e->getMessage()]);
}
?>



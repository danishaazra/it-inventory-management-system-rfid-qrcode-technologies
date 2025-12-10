<?php
header('Content-Type: application/json');
require '../api/db.php';

try {
  // Query all maintenance items from MongoDB, sorted by itemName
  $options = [
    'sort' => ['itemName' => 1] // Sort ascending by itemName
  ];
  $results = mongoFind($mongoManager, $maintenanceNamespace, [], $options);
  
  // Convert MongoDB documents to arrays
  $maintenance = [];
  foreach ($results as $doc) {
    $item = [
      'branch' => $doc->branch ?? null,
      'location' => $doc->location ?? null,
      'itemName' => $doc->itemName ?? null,
      'frequency' => $doc->frequency ?? null,
      'inspectionTasks' => $doc->inspectionTasks ?? null,
    ];
    $maintenance[] = $item;
  }
  
  echo json_encode(['ok' => true, 'maintenance' => $maintenance]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Could not load maintenance items: ' . $e->getMessage()]);
}
?>


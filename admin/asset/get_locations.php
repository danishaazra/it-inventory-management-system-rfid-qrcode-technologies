<?php
header('Content-Type: application/json');
require '../api/db.php';

try {
  // Query all assets to get unique location descriptions
  $filter = [
    'locationDescription' => ['$exists' => true, '$ne' => null, '$ne' => '']
  ];
  
  $options = [
    'projection' => ['locationDescription' => 1]
  ];
  
  $results = mongoFind($mongoManager, $assetsNamespace, $filter, $options);
  
  // Extract unique location descriptions
  $locations = [];
  foreach ($results as $doc) {
    $location = $doc->locationDescription ?? null;
    if ($location && !empty(trim((string)$location))) {
      $locationStr = trim((string)$location);
      if (!in_array($locationStr, $locations, true)) {
        $locations[] = $locationStr;
      }
    }
  }
  
  // Sort locations alphabetically
  sort($locations);
  
  echo json_encode(['ok' => true, 'locations' => $locations]);
} catch (Exception $e) {
  http_response_code(500);
  error_log('Error in get_locations.php: ' . $e->getMessage());
  echo json_encode(['ok' => false, 'error' => 'Could not load locations: ' . $e->getMessage()]);
}
?>








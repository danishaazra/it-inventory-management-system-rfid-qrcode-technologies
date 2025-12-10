<?php
header('Content-Type: application/json');
require '../api/db.php';

$data = json_decode(file_get_contents('php://input'), true);

$branch = $data['branch'] ?? '';
$location = $data['location'] ?? '';
$itemName = $data['itemName'] ?? '';
$assetIds = $data['assetIds'] ?? [];

if (empty($branch) || empty($location) || empty($itemName) || empty($assetIds) || !is_array($assetIds)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'branch, location, itemName, and assetIds array are required']);
  exit;
}

try {
  $inspectionsNamespace = $mongoDb . '.maintenance_assets';
  
  $inserted = 0;
  $skipped = 0;
  $batch = [];
  
  foreach ($assetIds as $assetId) {
    // Check if asset exists
    $assetFilter = ['assetId' => $assetId];
    $assetResults = mongoFind($mongoManager, $assetsNamespace, $assetFilter, ['limit' => 1]);
    
    if (empty($assetResults)) {
      $skipped++;
      continue; // Skip non-existent assets
    }
    
    // Check if already assigned
    $filter = [
      'branch' => $branch,
      'location' => $location,
      'itemName' => $itemName,
      'assetId' => $assetId
    ];
    $existing = mongoFind($mongoManager, $inspectionsNamespace, $filter, ['limit' => 1]);
    
    if (!empty($existing)) {
      $skipped++;
      continue; // Already assigned
    }
    
    $batch[] = [
      'branch' => $branch,
      'location' => $location,
      'itemName' => $itemName,
      'assetId' => $assetId,
      'inspectionStatus' => 'open',
      'solved' => false,
      'created_at' => new MongoDB\BSON\UTCDateTime(),
    ];
    $inserted++;
  }
  
  if (!empty($batch)) {
    $result = mongoInsertMany($mongoManager, $inspectionsNamespace, $batch);
    
    if ($result['insertedCount'] > 0) {
      echo json_encode([
        'ok' => true,
        'message' => "Successfully added $inserted asset(s)." . ($skipped > 0 ? " $skipped already assigned or not found." : '')
      ]);
    } else {
      throw new Exception('No assets were added');
    }
  } else {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'No valid assets to add. They may already be assigned or not found.']);
  }
} catch (Exception $e) {
  http_response_code(500);
  error_log('Error in add_maintenance_assets.php: ' . $e->getMessage());
  echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
?>


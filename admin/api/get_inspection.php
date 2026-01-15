<?php
header('Content-Type: application/json');
require 'db.php';

// Get assetId from query parameter
$assetId = $_GET['assetId'] ?? '';

if (empty($assetId)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'assetId parameter is required']);
  exit;
}

try {
  // Build namespace for inspections collection
  $inspectionsNamespace = $mongoDb . '.inspections';
  
  // Query inspection by assetId, get most recent first
  $filter = ['assetId' => $assetId];
  $options = [
    'sort' => ['inspectionDate' => -1, 'created_at' => -1],
    'limit' => 1
  ];
  
  $results = mongoFind($mongoManager, $inspectionsNamespace, $filter, $options);
  
  if (empty($results)) {
    // If not found in inspections collection, try maintenance_assets collection
    $maintenanceAssetsNamespace = $mongoDb . '.maintenance_assets';
    $results = mongoFind($mongoManager, $maintenanceAssetsNamespace, $filter, $options);
    
    if (empty($results)) {
      http_response_code(404);
      echo json_encode(['ok' => false, 'error' => 'Inspection not found']);
      exit;
    }
    
    // Convert maintenance_assets format to inspection format
    $doc = $results[0];
    $inspection = [
      '_id' => (string)$doc->_id,
      'assetId' => $doc->assetId ?? null,
      'notes' => $doc->inspectionNotes ?? $doc->notes ?? null,
      'solved' => $doc->solved ?? false,
      'inspectionStatus' => $doc->inspectionStatus ?? 'pending',
      'inspectionDate' => $doc->inspectionDate ?? null,
      'created_at' => $doc->createdAt ?? $doc->created_at ?? null,
      'updated_at' => $doc->updatedAt ?? $doc->updated_at ?? null,
    ];
  } else {
    // Convert inspections collection format
    $doc = $results[0];
    $inspection = [
      '_id' => (string)$doc->_id,
      'assetId' => $doc->assetId ?? null,
      'notes' => $doc->notes ?? null,
      'solved' => $doc->solved ?? false,
      'inspectionStatus' => $doc->inspectionStatus ?? 'pending',
      'inspectionDate' => $doc->inspectionDate ?? null,
      'created_at' => $doc->created_at ?? null,
      'updated_at' => $doc->updated_at ?? null,
    ];
  }
  
  echo json_encode(['ok' => true, 'inspection' => $inspection]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Could not load inspection: ' . $e->getMessage()]);
}
?>

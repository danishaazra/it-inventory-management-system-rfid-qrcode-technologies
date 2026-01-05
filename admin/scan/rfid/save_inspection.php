<?php
header('Content-Type: application/json');
require '../../api/db.php';

$data = json_decode(file_get_contents('php://input'), true);

$assetId = $data['assetId'] ?? '';
$notes = $data['notes'] ?? '';
$solved = $data['solved'] ?? false;

if (empty($assetId)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'assetId is required']);
  exit;
}

if (empty($notes)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Notes are required']);
  exit;
}

try {
  // Save inspection to a standalone inspections collection
  $inspectionsNamespace = $mongoDb . '.inspections';
  
  $inspectionDoc = [
    'assetId' => $assetId,
    'notes' => $notes,
    'solved' => $solved,
    'inspectionStatus' => $solved ? 'complete' : 'open',
    'inspectionDate' => new MongoDB\BSON\UTCDateTime(),
    'created_at' => new MongoDB\BSON\UTCDateTime(),
    'updated_at' => new MongoDB\BSON\UTCDateTime(),
  ];
  
  $bulk = new MongoDB\Driver\BulkWrite();
  $bulk->insert($inspectionDoc);
  
  $result = $mongoManager->executeBulkWrite($inspectionsNamespace, $bulk);
  
  if ($result->getInsertedCount() > 0) {
    echo json_encode(['ok' => true, 'message' => 'Inspection saved successfully']);
  } else {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Failed to save inspection']);
  }
} catch (Exception $e) {
  http_response_code(500);
  error_log('Error in save_inspection.php: ' . $e->getMessage());
  echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
?>




<?php
header('Content-Type: application/json');
require '../api/db.php';

$data = json_decode(file_get_contents('php://input'), true);

$reportId = $data['reportId'] ?? '';

if (empty($reportId)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'reportId is required']);
  exit;
}

try {
  $reportsNamespace = $mongoDb . '.saved_reports';
  
  $bulk = new MongoDB\Driver\BulkWrite();
  $bulk->delete(['_id' => new MongoDB\BSON\ObjectId($reportId)]);
  
  $result = $mongoManager->executeBulkWrite($reportsNamespace, $bulk);
  
  if ($result->getDeletedCount() > 0) {
    echo json_encode(['ok' => true, 'message' => 'Report deleted successfully']);
  } else {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'Report not found']);
  }
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Could not delete report: ' . $e->getMessage()]);
}
?>



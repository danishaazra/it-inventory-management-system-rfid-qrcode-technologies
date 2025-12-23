<?php
header('Content-Type: application/json');
require '../api/db.php';

$data = json_decode(file_get_contents('php://input'), true);

$reportType = $data['reportType'] ?? '';
$reportTitle = $data['reportTitle'] ?? '';
$criteria = $data['criteria'] ?? [];
$reportData = $data['reportData'] ?? [];

if (empty($reportType) || empty($reportTitle)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'reportType and reportTitle are required']);
  exit;
}

try {
  $reportsNamespace = $mongoDb . '.saved_reports';
  
  $reportDoc = [
    'reportType' => $reportType,
    'reportTitle' => $reportTitle,
    'criteria' => $criteria,
    'reportData' => $reportData,
    'createdAt' => new MongoDB\BSON\UTCDateTime(),
    'created_at' => new MongoDB\BSON\UTCDateTime(),
  ];
  
  $bulk = new MongoDB\Driver\BulkWrite();
  $bulk->insert($reportDoc);
  
  $result = $mongoManager->executeBulkWrite($reportsNamespace, $bulk);
  
  if ($result->getInsertedCount() > 0) {
    echo json_encode(['ok' => true, 'message' => 'Report saved successfully']);
  } else {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Failed to save report']);
  }
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Could not save report: ' . $e->getMessage()]);
}
?>


<?php
header('Content-Type: application/json');
require '../api/db.php';

$reportId = $_GET['reportId'] ?? '';

if (empty($reportId)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'reportId is required']);
  exit;
}

try {
  $reportsNamespace = $mongoDb . '.saved_reports';
  
  $filter = ['_id' => new MongoDB\BSON\ObjectId($reportId)];
  $results = mongoFind($mongoManager, $reportsNamespace, $filter, ['limit' => 1]);
  
  if (empty($results)) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'Report not found']);
    exit;
  }
  
  $doc = $results[0];
  
  // Convert report data
  $report = [
    'reportType' => $doc->reportType ?? null,
    'reportTitle' => $doc->reportTitle ?? null,
    'criteria' => $doc->criteria ?? [],
    'reportData' => $doc->reportData ?? [],
  ];
  
  echo json_encode(['ok' => true, 'report' => $report]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Could not load report: ' . $e->getMessage()]);
}
?>


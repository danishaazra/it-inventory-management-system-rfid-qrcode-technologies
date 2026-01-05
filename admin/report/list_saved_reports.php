<?php
header('Content-Type: application/json');
require '../api/db.php';

try {
  $reportsNamespace = $mongoDb . '.saved_reports';
  
  // Get all saved reports, sorted by creation date (newest first)
  $options = [
    'sort' => ['createdAt' => -1]
  ];
  $results = mongoFind($mongoManager, $reportsNamespace, [], $options);
  
  $reports = [];
  foreach ($results as $doc) {
    // Convert MongoDB UTCDateTime to timestamp
    $createdAt = null;
    if (isset($doc->createdAt)) {
      if ($doc->createdAt instanceof MongoDB\BSON\UTCDateTime) {
        $createdAt = $doc->createdAt->toDateTime()->getTimestamp() * 1000;
      } else {
        $createdAt = $doc->createdAt;
      }
    }
    
    $report = [
      '_id' => (string)$doc->_id,
      'reportType' => $doc->reportType ?? null,
      'reportTitle' => $doc->reportTitle ?? null,
      'criteria' => $doc->criteria ?? [],
      'createdAt' => $createdAt,
    ];
    $reports[] = $report;
  }
  
  echo json_encode(['ok' => true, 'reports' => $reports]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Could not load saved reports: ' . $e->getMessage()]);
}
?>



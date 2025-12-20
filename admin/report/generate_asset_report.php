<?php
header('Content-Type: application/json');
require '../api/db.php';

$data = json_decode(file_get_contents('php://input'), true);

try {
  // Build filter based on criteria
  $filter = [];
  
  // Date range filter (if created_at exists)
  if (!empty($data['dateFrom']) || !empty($data['dateTo'])) {
    $dateFilter = [];
    if (!empty($data['dateFrom'])) {
      $dateFilter['$gte'] = new MongoDB\BSON\UTCDateTime(strtotime($data['dateFrom']) * 1000);
    }
    if (!empty($data['dateTo'])) {
      $dateFilter['$lte'] = new MongoDB\BSON\UTCDateTime((strtotime($data['dateTo']) + 86400) * 1000);
    }
    if (!empty($dateFilter)) {
      $filter['created_at'] = $dateFilter;
    }
  }
  
  // Status filter
  if (!empty($data['status'])) {
    $filter['status'] = $data['status'];
  }
  
  // Category filter
  if (!empty($data['category'])) {
    $filter['assetCategory'] = $data['category'];
  }
  
  // Location filter (exact match for dropdown selection)
  if (!empty($data['location'])) {
    $filter['locationDescription'] = $data['location'];
  }
  
  // Branch filter (exact match for dropdown selection)
  if (!empty($data['branch'])) {
    $filter['branchCode'] = $data['branch'];
  }
  
  // Query assets
  $options = [
    'sort' => ['assetId' => 1]
  ];
  $results = mongoFind($mongoManager, $assetsNamespace, $filter, $options);
  
  // Convert to report format
  $report = [];
  foreach ($results as $doc) {
    $report[] = [
      'Asset ID' => $doc->assetId ?? '-',
      'Description' => $doc->assetDescription ?? '-',
      'Category' => $doc->assetCategory ?? '-',
      'Model' => $doc->model ?? '-',
      'Serial Number' => $doc->serialNo ?? $doc->serialNumber ?? '-',
      'Status' => $doc->status ?? '-',
      'Location' => $doc->location ?? '-',
      'Location Description' => $doc->locationDescription ?? '-',
      'Area' => $doc->area ?? $doc->locationArea ?? '-',
      'Branch' => $doc->branchCode ?? '-',
      'Department' => $doc->departmentDescription ?? '-',
      'Condition' => $doc->condition ?? '-',
      'Current User' => $doc->currentUser ?? '-',
      'Created Date' => isset($doc->created_at) ? date('Y-m-d', $doc->created_at->toDateTime()->getTimestamp()) : '-'
    ];
  }
  
  echo json_encode([
    'ok' => true,
    'report' => $report,
    'count' => count($report)
  ]);
  
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Could not generate report: ' . $e->getMessage()]);
}
?>


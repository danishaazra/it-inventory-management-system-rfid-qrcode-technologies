<?php
header('Content-Type: application/json');
require '../api/db.php';

// Get assetId from query parameter
$assetId = $_GET['assetId'] ?? '';

if (empty($assetId)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'assetId parameter is required']);
  exit;
}

try {
  // Query asset by assetId
  $filter = ['assetId' => $assetId];
  $results = mongoFind($mongoManager, $assetsNamespace, $filter, ['limit' => 1]);
  
  if (empty($results)) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'Asset not found']);
    exit;
  }
  
  $doc = $results[0];
  
  // Convert MongoDB document to array
  $asset = [
    'assetId' => $doc->assetId ?? null,
    'assetDescription' => $doc->assetDescription ?? null,
    'assetCategory' => $doc->assetCategory ?? null,
    'assetCategoryDescription' => $doc->assetCategoryDescription ?? null,
    'ownerCode' => $doc->ownerCode ?? null,
    'ownerName' => $doc->ownerName ?? null,
    'model' => $doc->model ?? null,
    'brand' => $doc->brand ?? null,
    'status' => $doc->status ?? null,
    'warrantyPeriod' => $doc->warrantyPeriod ?? null,
    'serialNo' => $doc->serialNo ?? null,
    'location' => $doc->location ?? null,
    'locationDescription' => $doc->locationDescription ?? null,
    'area' => $doc->area ?? null,
    'departmentCode' => $doc->departmentCode ?? null,
    'departmentDescription' => $doc->departmentDescription ?? null,
    'condition' => $doc->condition ?? null,
    'currentUser' => $doc->currentUser ?? null,
    'branchCode' => $doc->branchCode ?? null,
    'no' => $doc->no ?? null,
    'created_at' => $doc->created_at ?? null,
  ];
  
  echo json_encode(['ok' => true, 'asset' => $asset]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Could not load asset: ' . $e->getMessage()]);
}
?>





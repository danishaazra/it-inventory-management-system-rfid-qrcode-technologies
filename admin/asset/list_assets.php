<?php
header('Content-Type: application/json');
require '../api/db.php';

try {
  // Query all assets from MongoDB, sorted by assetId
  $options = [
    'sort' => ['assetId' => 1] // Sort ascending by assetId
  ];
  $results = mongoFind($mongoManager, $assetsNamespace, [], $options);
  
  // Convert MongoDB documents to arrays
  $assets = [];
  foreach ($results as $doc) {
    $asset = [
      'assetId' => $doc->assetId ?? null,
      'assetDescription' => $doc->assetDescription ?? null,
      'assetCategory' => $doc->assetCategory ?? null,
      'model' => $doc->model ?? null,
      'serialNo' => $doc->serialNo ?? null,
      'location' => $doc->location ?? null,
      'area' => $doc->area ?? null,
    ];
    $assets[] = $asset;
  }
  
  echo json_encode(['ok' => true, 'assets' => $assets]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Could not load assets: ' . $e->getMessage()]);
}
?>


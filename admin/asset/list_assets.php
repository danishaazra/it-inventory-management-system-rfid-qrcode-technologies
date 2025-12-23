<?php
header('Content-Type: application/json');
require '../api/db.php';

try {
  $query = $_GET['query'] ?? '';

  // Build filter if query provided
  $filter = [];
  if (!empty($query)) {
    $regex = new MongoDB\BSON\Regex($query, 'i');
    $filter = [
      '$or' => [
        ['assetId' => $regex],
        ['assetDescription' => $regex],
        ['assetCategory' => $regex],
        ['assetCategoryDescription' => $regex],
        ['model' => $regex],
        ['serialNo' => $regex],
        ['serialNumber' => $regex],
        ['location' => $regex],
        ['locationDescription' => $regex],
        ['area' => $regex],
        ['locationArea' => $regex],
      ]
    ];
  }

  // Query assets from MongoDB, sorted by assetId
  $options = [
    'sort' => ['assetId' => 1] // Sort ascending by assetId
  ];
  $results = mongoFind($mongoManager, $assetsNamespace, $filter, $options);
  
  // Convert MongoDB documents to arrays
  $assets = [];
  foreach ($results as $doc) {
    $asset = [
      'assetId' => $doc->assetId ?? null,
      'assetDescription' => $doc->assetDescription ?? null,
      'assetCategory' => $doc->assetCategory ?? null,
      'assetCategoryDescription' => $doc->assetCategoryDescription ?? null,
      'model' => $doc->model ?? null,
      'serialNo' => $doc->serialNo ?? null,
      'serialNumber' => $doc->serialNumber ?? null, // Support both field names
      'location' => $doc->location ?? null,
      'locationDescription' => $doc->locationDescription ?? null,
      'area' => $doc->area ?? null,
      'locationArea' => $doc->locationArea ?? null,
    ];
    $assets[] = $asset;
  }
  
  echo json_encode(['ok' => true, 'assets' => $assets]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Could not load assets: ' . $e->getMessage()]);
}
?>



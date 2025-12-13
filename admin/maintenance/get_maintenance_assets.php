<?php
header('Content-Type: application/json');
require '../api/db.php';

// Get parameters from query string - support both maintenanceId and legacy branch/location/itemName
$maintenanceId = $_GET['maintenanceId'] ?? '';
$branch = $_GET['branch'] ?? '';
$location = $_GET['location'] ?? '';
$itemName = $_GET['itemName'] ?? '';

try {
  $inspectionsNamespace = $mongoDb . '.maintenance_assets';
  
  // If maintenanceId is provided, use it (preferred method)
  if (!empty($maintenanceId)) {
    $filter = ['maintenanceId' => $maintenanceId];
  } elseif (!empty($branch) && !empty($location) && !empty($itemName)) {
    // Legacy support: query by branch, location, and itemName
    $filter = [
      'branch' => $branch,
      'location' => $location,
      'itemName' => $itemName
    ];
  } else {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'maintenanceId parameter is required, or provide branch, location, and itemName']);
    exit;
  }
  $results = mongoFind($mongoManager, $inspectionsNamespace, $filter);
  
  $assets = [];
  foreach ($results as $doc) {
    // Get asset details
    $assetId = $doc->assetId ?? null;
    $asset = null;
    
    if ($assetId) {
      $assetFilter = ['assetId' => $assetId];
      $assetResults = mongoFind($mongoManager, $assetsNamespace, $assetFilter, ['limit' => 1]);
      if (!empty($assetResults)) {
        $assetDoc = $assetResults[0];
        $asset = [
          'assetId' => $assetDoc->assetId ?? null,
          'assetDescription' => $assetDoc->assetDescription ?? null,
          'assetCategory' => $assetDoc->assetCategory ?? null,
          'assetCategoryDescription' => $assetDoc->assetCategoryDescription ?? null,
          'brand' => $assetDoc->brand ?? null,
          'model' => $assetDoc->model ?? null,
          'status' => $assetDoc->status ?? null,
        ];
      }
    }
    
    if ($asset) {
      // Add inspection data
      $asset['inspectionStatus'] = $doc->inspectionStatus ?? 'open';
      $asset['inspectionNotes'] = $doc->inspectionNotes ?? null;
      $asset['solved'] = $doc->solved ?? false;
      $asset['inspectionDate'] = $doc->inspectionDate ?? null;
      $assets[] = $asset;
    }
  }
  
  echo json_encode(['ok' => true, 'assets' => $assets]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Could not load maintenance assets: ' . $e->getMessage()]);
}
?>



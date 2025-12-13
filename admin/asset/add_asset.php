<?php
header('Content-Type: application/json');
require '../api/db.php';

$data = json_decode(file_get_contents('php://input'), true);
if (!isset($data['assetId']) || $data['assetId'] === '') {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'assetId required']);
  exit;
}

// Prepare document for MongoDB
$doc = [
  'assetId' => $data['assetId'] ?? null,
  'assetDescription' => $data['assetDescription'] ?? null,
  'assetCategory' => $data['assetCategory'] ?? null,
  'assetCategoryDescription' => $data['assetCategoryDescription'] ?? null,
  'ownerCode' => $data['ownerCode'] ?? null,
  'ownerName' => $data['ownerName'] ?? null,
  'model' => $data['model'] ?? null,
  'brand' => $data['brand'] ?? null,
  'status' => $data['status'] ?? null,
  'warrantyPeriod' => $data['warrantyPeriod'] ?? null,
  'serialNo' => $data['serialNo'] ?? null,
  'location' => $data['location'] ?? null,
  'locationDescription' => $data['locationDescription'] ?? null,
  'area' => $data['area'] ?? null,
  'departmentCode' => $data['departmentCode'] ?? null,
  'departmentDescription' => $data['departmentDescription'] ?? null,
  'condition' => $data['condition'] ?? null,
  'currentUser' => $data['currentUser'] ?? null,
  'branchCode' => $data['branchCode'] ?? null,
  'no' => $data['no'] ?? null,
  'created_at' => new MongoDB\BSON\UTCDateTime(),
];

try {
  // Verify MongoDB connection
  if (!isset($mongoManager)) {
    throw new Exception('MongoDB manager not initialized');
  }
  
  // Check if asset with same assetId already exists
  $assetId = trim($data['assetId']);
  if (assetExists($mongoManager, $assetsNamespace, $assetId)) {
    http_response_code(409); // Conflict status code
    echo json_encode([
      'ok' => false, 
      'error' => 'Data already exists',
      'message' => 'An asset with Asset ID "' . $assetId . '" already exists in the database.'
    ]);
    exit;
  }
  
  // Attempt to insert
  $result = mongoInsertOne($mongoManager, $assetsNamespace, $doc);
  
  if ($result['insertedCount'] > 0) {
    echo json_encode(['ok' => true, 'message' => 'Asset added successfully']);
  } else {
    throw new Exception('Asset was not inserted into database');
  }
} catch (MongoDB\Driver\Exception\Exception $e) {
  http_response_code(500);
  error_log('MongoDB error in add_asset.php: ' . $e->getMessage());
  echo json_encode(['ok' => false, 'error' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
  http_response_code(500);
  error_log('Error in add_asset.php: ' . $e->getMessage());
  echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
?>




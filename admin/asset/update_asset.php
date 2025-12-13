<?php
header('Content-Type: application/json');
require '../api/db.php';

$data = json_decode(file_get_contents('php://input'), true);
if (!isset($data['assetId']) || $data['assetId'] === '') {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'assetId required']);
  exit;
}

$assetId = trim($data['assetId']);

try {
  // Check if asset exists
  $filter = ['assetId' => $assetId];
  $results = mongoFind($mongoManager, $assetsNamespace, $filter, ['limit' => 1]);
  
  if (empty($results)) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'Asset not found']);
    exit;
  }
  
  // Prepare update document (exclude assetId from update, it's the key)
  $updateDoc = [
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
    'updated_at' => new MongoDB\BSON\UTCDateTime(),
  ];
  
  // Remove null values to avoid overwriting with null
  $updateDoc = array_filter($updateDoc, function($value) {
    return $value !== null;
  });
  
  // Build update query
  $bulk = new MongoDB\Driver\BulkWrite();
  $bulk->update(
    ['assetId' => $assetId],
    ['$set' => $updateDoc]
  );
  
  $result = $mongoManager->executeBulkWrite($assetsNamespace, $bulk);
  
  if ($result->getModifiedCount() > 0 || $result->getMatchedCount() > 0) {
    echo json_encode(['ok' => true, 'message' => 'Asset updated successfully']);
  } else {
    echo json_encode(['ok' => true, 'message' => 'No changes detected']);
  }
} catch (MongoDB\Driver\Exception\Exception $e) {
  http_response_code(500);
  error_log('MongoDB error in update_asset.php: ' . $e->getMessage());
  echo json_encode(['ok' => false, 'error' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
  http_response_code(500);
  error_log('Error in update_asset.php: ' . $e->getMessage());
  echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
?>




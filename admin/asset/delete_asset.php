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
  
  // Delete the asset
  $bulk = new MongoDB\Driver\BulkWrite();
  $bulk->delete(['assetId' => $assetId]);
  
  $result = $mongoManager->executeBulkWrite($assetsNamespace, $bulk);
  
  if ($result->getDeletedCount() > 0) {
    echo json_encode(['ok' => true, 'message' => 'Asset deleted successfully']);
  } else {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Failed to delete asset']);
  }
} catch (MongoDB\Driver\Exception\Exception $e) {
  http_response_code(500);
  error_log('MongoDB error in delete_asset.php: ' . $e->getMessage());
  echo json_encode(['ok' => false, 'error' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
  http_response_code(500);
  error_log('Error in delete_asset.php: ' . $e->getMessage());
  echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
?>








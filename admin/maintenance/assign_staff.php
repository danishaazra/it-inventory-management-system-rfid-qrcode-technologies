<?php
header('Content-Type: application/json');
require '../api/db.php';

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['maintenanceId']) || !isset($data['staffId'])) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'maintenanceId and staffId are required']);
  exit;
}

$maintenanceId = $data['maintenanceId'];
$staffId = $data['staffId'];

try {
  // Get staff details
  $usersNamespace = $mongoDb . '.users';
  $staffFilter = ['_id' => new MongoDB\BSON\ObjectId($staffId)];
  $staffResults = mongoFind($mongoManager, $usersNamespace, $staffFilter, ['limit' => 1]);
  
  if (empty($staffResults)) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'Staff member not found']);
    exit;
  }
  
  $staff = $staffResults[0];
  
  // Update maintenance item with assigned staff
  $bulk = new MongoDB\Driver\BulkWrite();
  $bulk->update(
    ['_id' => new MongoDB\BSON\ObjectId($maintenanceId)],
    ['$set' => [
      'assignedStaffId' => $staffId,
      'assignedStaffName' => $staff->name ?? null,
      'assignedStaffEmail' => $staff->email ?? null,
      'assignedAt' => new MongoDB\BSON\UTCDateTime()
    ]]
  );
  $result = $mongoManager->executeBulkWrite($maintenanceNamespace, $bulk);
  
  echo json_encode([
    'ok' => true,
    'message' => 'Staff assigned successfully',
    'assignedStaff' => [
      'id' => $staffId,
      'name' => $staff->name ?? null,
      'email' => $staff->email ?? null
    ]
  ]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Could not assign staff: ' . $e->getMessage()]);
}
?>



<?php
header('Content-Type: application/json');
require '../api/db.php';

try {
  $usersNamespace = $mongoDb . '.users';
  
  // Query all users with role 'staff'
  $filter = ['role' => 'staff'];
  $options = [
    'sort' => ['name' => 1] // Sort ascending by name
  ];
  $results = mongoFind($mongoManager, $usersNamespace, $filter, $options);
  
  // Convert MongoDB documents to arrays
  $staff = [];
  foreach ($results as $doc) {
    $staffMember = [
      '_id' => (string)$doc->_id,
      'name' => $doc->name ?? null,
      'email' => $doc->email ?? null,
      'role' => $doc->role ?? null,
    ];
    $staff[] = $staffMember;
  }
  
  echo json_encode(['ok' => true, 'staff' => $staff]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Could not load staff: ' . $e->getMessage()]);
}
?>







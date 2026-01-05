<?php
// Prevent any output before JSON
ob_start();

// Turn off error display (but log them)
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Set JSON header
header('Content-Type: application/json');

try {
  require '../admin/api/db.php';
} catch (Throwable $e) {
  ob_end_clean();
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Database connection failed: ' . $e->getMessage()]);
  exit;
}

// Clean output buffer before processing
ob_end_clean();

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['name']) || !isset($data['email']) || !isset($data['role'])) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Name, email, and role are required']);
  exit;
}

$name = trim($data['name']);
$email = trim($data['email']);
$role = trim($data['role']);

// Validate email
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Invalid email address']);
  exit;
}

// Validate role
if (!in_array($role, ['admin', 'staff'])) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Invalid role']);
  exit;
}

try {
  $usersNamespace = $mongoDb . '.users';
  
  // Check if user exists by email
  $filter = ['email' => $email];
  $existingUsers = mongoFind($mongoManager, $usersNamespace, $filter, ['limit' => 1]);
  
  if (!empty($existingUsers)) {
    // User exists, update last login time and role (if changed)
    $user = $existingUsers[0];
    $userId = (string)$user->_id;
    
    // Update last login time and role
    $bulk = new MongoDB\Driver\BulkWrite();
    $bulk->update(
      ['_id' => $user->_id],
      ['$set' => [
        'name' => $name,
        'role' => $role, // Always update role to match what user selected
        'lastLogin' => new MongoDB\BSON\UTCDateTime()
      ]]
    );
    $mongoManager->executeBulkWrite($usersNamespace, $bulk);
    
    echo json_encode([
      'ok' => true,
      'user' => [
        'id' => $userId,
        'name' => $name,
        'email' => $email,
        'role' => $role // Return the role that was selected, not the stored one
      ]
    ]);
  } else {
    // User doesn't exist, create new user
    $newUser = [
      'name' => $name,
      'email' => $email,
      'role' => $role,
      'created_at' => new MongoDB\BSON\UTCDateTime(),
      'lastLogin' => new MongoDB\BSON\UTCDateTime()
    ];
    
    $result = mongoInsertOne($mongoManager, $usersNamespace, $newUser);
    
    // Get the inserted user to return the ID
    $insertedUsers = mongoFind($mongoManager, $usersNamespace, ['email' => $email], ['limit' => 1]);
    $insertedUser = $insertedUsers[0];
    
    echo json_encode([
      'ok' => true,
      'user' => [
        'id' => (string)$insertedUser->_id,
        'name' => $name,
        'email' => $email,
        'role' => $role
      ]
    ]);
  }
} catch (Throwable $e) {
  ob_end_clean();
  http_response_code(500);
  error_log('Login error: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
  echo json_encode(['ok' => false, 'error' => 'Login failed: ' . $e->getMessage()]);
  exit;
}
?>


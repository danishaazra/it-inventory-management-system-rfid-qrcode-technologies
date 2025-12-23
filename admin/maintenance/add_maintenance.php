<?php
// Suppress any output before JSON
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Start output buffering to catch any stray output
ob_start();

// Set JSON header early
header('Content-Type: application/json');

// Wrap require in try-catch to handle fatal errors
try {
  require '../api/db.php';
} catch (Throwable $e) {
  ob_end_clean();
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Failed to load database configuration: ' . $e->getMessage()]);
  exit;
}

$input = @file_get_contents('php://input');
if ($input === false) {
  ob_end_clean();
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Failed to read input data']);
  exit;
}

$data = json_decode($input, true);

if (json_last_error() !== JSON_ERROR_NONE) {
  ob_end_clean();
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Invalid JSON input: ' . json_last_error_msg()]);
  exit;
}

if ($data === null) {
  ob_end_clean();
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Invalid or empty JSON data']);
  exit;
}

// Validate required fields
$requiredFields = ['branch', 'location', 'itemName', 'frequency', 'inspectionTasks'];
foreach ($requiredFields as $field) {
  if (!isset($data[$field]) || $data[$field] === '') {
    http_response_code(400);
    ob_end_clean();
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'error' => ucfirst($field) . ' is required']);
    exit;
  }
}

// Prepare document for MongoDB
$doc = [
  'branch' => $data['branch'] ?? null,
  'location' => $data['location'] ?? null,
  'itemName' => $data['itemName'] ?? null,
  'frequency' => $data['frequency'] ?? null,
  'maintenanceSchedule' => $data['maintenanceSchedule'] ?? null,
  'inspectionTasks' => $data['inspectionTasks'] ?? null,
  'created_at' => new MongoDB\BSON\UTCDateTime(),
];

try {
  // Verify MongoDB connection and required variables
  if (!isset($mongoManager)) {
    throw new Exception('MongoDB manager not initialized');
  }
  
  if (!isset($maintenanceNamespace)) {
    throw new Exception('Maintenance namespace not defined');
  }
  
  // Check if maintenance item with same branch, location, itemName, frequency, schedule, and tasks already exists
  $filter = [
    'branch' => $doc['branch'],
    'location' => $doc['location'],
    'itemName' => $doc['itemName'],
    'frequency' => $doc['frequency']
  ];
  
  $existing = mongoFind($mongoManager, $maintenanceNamespace, $filter);
  
  // Check if any existing record has the same schedule and inspection tasks
  $isDuplicate = false;
  foreach ($existing as $existingDoc) {
    try {
      // Compare maintenance schedule
      $existingSchedule = null;
      if (isset($existingDoc->maintenanceSchedule) && $existingDoc->maintenanceSchedule !== null) {
        if (is_object($existingDoc->maintenanceSchedule)) {
          $existingSchedule = @json_decode(@json_encode($existingDoc->maintenanceSchedule), true);
        } elseif (is_array($existingDoc->maintenanceSchedule)) {
          $existingSchedule = $existingDoc->maintenanceSchedule;
        } else {
          $existingSchedule = $existingDoc->maintenanceSchedule;
        }
      }
      
      $newSchedule = null;
      if (isset($doc['maintenanceSchedule']) && $doc['maintenanceSchedule'] !== null) {
        if (is_array($doc['maintenanceSchedule'])) {
          $newSchedule = $doc['maintenanceSchedule'];
        } elseif (is_string($doc['maintenanceSchedule']) && !empty($doc['maintenanceSchedule'])) {
          $decoded = @json_decode($doc['maintenanceSchedule'], true);
          $newSchedule = ($decoded !== null && json_last_error() === JSON_ERROR_NONE) ? $decoded : null;
        } else {
          $newSchedule = $doc['maintenanceSchedule'];
        }
      }
      
      // Normalize schedules for comparison (handle null/empty)
      $existingScheduleStr = '';
      if ($existingSchedule !== null) {
        $encoded = @json_encode($existingSchedule, JSON_SORT_KEYS);
        $existingScheduleStr = ($encoded !== false) ? $encoded : '';
      }
      
      $newScheduleStr = '';
      if ($newSchedule !== null) {
        $encoded = @json_encode($newSchedule, JSON_SORT_KEYS);
        $newScheduleStr = ($encoded !== false) ? $encoded : '';
      }
      
      // Compare inspection tasks
      $existingTasks = isset($existingDoc->inspectionTasks) ? trim((string)$existingDoc->inspectionTasks) : '';
      $newTasks = isset($doc['inspectionTasks']) ? trim((string)$doc['inspectionTasks']) : '';
      
      // If both schedule and tasks match, it's a duplicate
      if ($existingScheduleStr === $newScheduleStr && $existingTasks === $newTasks) {
        $isDuplicate = true;
        break;
      }
    } catch (Exception $e) {
      // If comparison fails, skip this record and continue
      error_log('Error comparing maintenance records: ' . $e->getMessage());
      continue;
    }
  }
  
  if ($isDuplicate) {
    http_response_code(409); // Conflict status code
    ob_end_clean();
    header('Content-Type: application/json');
    echo json_encode([
      'ok' => false, 
      'error' => 'Data already exists',
      'message' => 'A maintenance item with the same Branch, Location, Item Name, Frequency, Schedule dates, and Inspection Tasks already exists in the database.'
    ]);
    exit;
  }
  
  // Attempt to insert
  $result = mongoInsertOne($mongoManager, $maintenanceNamespace, $doc);
  
  if ($result['insertedCount'] > 0) {
    // Clear any output buffer and send JSON
    ob_end_clean();
    header('Content-Type: application/json');
    echo json_encode(['ok' => true, 'message' => 'Maintenance item added successfully']);
  } else {
    throw new Exception('Maintenance item was not inserted into database');
  }
} catch (MongoDB\Driver\Exception\Exception $e) {
  http_response_code(500);
  error_log('MongoDB error in add_maintenance.php: ' . $e->getMessage());
  ob_end_clean();
  echo json_encode(['ok' => false, 'error' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
  http_response_code(500);
  error_log('Error in add_maintenance.php: ' . $e->getMessage());
  ob_end_clean();
  echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
} catch (Throwable $e) {
  http_response_code(500);
  error_log('Fatal error in add_maintenance.php: ' . $e->getMessage());
  ob_end_clean();
  echo json_encode(['ok' => false, 'error' => 'Fatal error: ' . $e->getMessage()]);
}
?>








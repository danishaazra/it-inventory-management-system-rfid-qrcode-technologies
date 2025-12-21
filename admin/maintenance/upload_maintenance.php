<?php
// Supports CSV and Excel files (.xlsx, .xls)
header('Content-Type: application/json');
require '../api/db.php';

if (!isset($_FILES['file'])) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'No file']);
  exit;
}

$tmpPath = $_FILES['file']['tmp_name'];
$fileName = $_FILES['file']['name'];
$fileExt = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

// Check file type
$allowedExtensions = ['csv', 'xlsx', 'xls'];
if (!in_array($fileExt, $allowedExtensions)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Please upload a CSV or Excel file (.csv, .xlsx, .xls)']);
  exit;
}

// Load PhpSpreadsheet for Excel files
$isExcel = in_array($fileExt, ['xlsx', 'xls']);
if ($isExcel) {
  // Check if PhpSpreadsheet is available (vendor is in project root)
  $autoloadPath = __DIR__ . '/../../vendor/autoload.php';
  if (!file_exists($autoloadPath)) {
    http_response_code(500);
    echo json_encode([
      'ok' => false, 
      'error' => 'PhpSpreadsheet library not found. Please install it using: composer install'
    ]);
    exit;
  }
  require_once $autoloadPath;
}

try {
  $rows = [];
  
  if ($isExcel) {
    // Read Excel file using PhpSpreadsheet
    $reader = \PhpOffice\PhpSpreadsheet\IOFactory::createReader(ucfirst($fileExt));
    $reader->setReadDataOnly(true);
    $spreadsheet = $reader->load($tmpPath);
    $worksheet = $spreadsheet->getActiveSheet();
    $rows = $worksheet->toArray();
  } else {
    // Read CSV file
    $handle = fopen($tmpPath, 'r');
    if (!$handle) {
      http_response_code(400);
      echo json_encode(['ok' => false, 'error' => 'Could not read file']);
      exit;
    }
    while (($row = fgetcsv($handle)) !== false) {
      $rows[] = $row;
    }
    fclose($handle);
  }
  
  if (empty($rows)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Empty file']);
    exit;
  }
  
  // Get header row (first row)
  $rawHeader = array_map(function($cell) {
    return $cell !== null ? trim((string)$cell) : '';
  }, $rows[0]);
  
  if (empty($rawHeader)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Empty file or missing header']);
    exit;
  }
  
  // Normalize header names
  function normalizeHeaderName($header) {
    $header = trim($header);
    if (empty($header)) return '';
    
    $mappings = [
      'branch' => 'branch',
      'location' => 'location',
      'item name' => 'itemName',
      'itemname' => 'itemName',
      'frequency' => 'frequency',
      'inspection tasks' => 'inspectionTasks',
      'inspectiontasks' => 'inspectionTasks',
      'maintenance schedule' => 'maintenanceSchedule',
      'maintenanceschedule' => 'maintenanceSchedule'
    ];
    
    $lowerHeader = strtolower($header);
    
    if (isset($mappings[$lowerHeader])) {
      return $mappings[$lowerHeader];
    }
    
    // Convert to camelCase
    $normalized = strtolower($header);
    $normalized = preg_replace('/[\s.]+/', '', $normalized);
    $normalized = lcfirst(str_replace(' ', '', ucwords(str_replace(['_', '-'], ' ', $normalized))));
    
    return $normalized;
  }
  
  // Normalize all headers
  $header = array_map('normalizeHeaderName', $rawHeader);
  
  $requiredFields = ['branch', 'location', 'itemName', 'frequency', 'inspectionTasks'];
  $inserted = 0;
  $skipped = 0;
  $duplicates = [];
  $batch = [];

  // Process data rows (skip header row)
  for ($i = 1; $i < count($rows); $i++) {
    $row = $rows[$i];
    
    // Skip empty rows
    if (empty(array_filter($row, function($cell) {
      return $cell !== null && trim((string)$cell) !== '';
    }))) {
      continue;
    }
    
    // Map row to associative array using normalized header names
    $assoc = [];
    foreach ($header as $idx => $colName) {
      if (empty($colName)) continue;
      $value = $row[$idx] ?? null;
      if ($value === null || $value === '') {
        $assoc[$colName] = null;
      } else {
        $assoc[$colName] = trim((string)$value);
      }
    }
    
    // Check if required fields are present
    $missingFields = [];
    foreach ($requiredFields as $field) {
      if (empty($assoc[$field])) {
        $missingFields[] = $field;
      }
    }
    
    if (!empty($missingFields)) {
      $skipped++;
      continue;
    }
    
    // Check for duplicate (same branch, location, itemName)
    $filter = [
      'branch' => $assoc['branch'],
      'location' => $assoc['location'],
      'itemName' => $assoc['itemName']
    ];
    $existing = mongoFind($mongoManager, $maintenanceNamespace, $filter, ['limit' => 1]);
    if (!empty($existing)) {
      $duplicates[] = $assoc['itemName'] . ' (' . $assoc['branch'] . ', ' . $assoc['location'] . ')';
      $skipped++;
      continue;
    }
    
    $batch[] = [
      'branch' => $assoc['branch'] ?? null,
      'location' => $assoc['location'] ?? null,
      'itemName' => $assoc['itemName'] ?? null,
      'frequency' => $assoc['frequency'] ?? null,
      'maintenanceSchedule' => isset($assoc['maintenanceSchedule']) ? json_decode($assoc['maintenanceSchedule'], true) : null,
      'inspectionTasks' => $assoc['inspectionTasks'] ?? null,
      'created_at' => new MongoDB\BSON\UTCDateTime(),
    ];
    $inserted++;
  }
  
  if ($inserted > 0 && !empty($batch)) {
    try {
      $result = mongoInsertMany($mongoManager, $maintenanceNamespace, $batch);
      $actualInserted = $result['insertedCount'] ?? 0;
      $writeErrors = $result['writeErrors'] ?? [];

      if (!empty($writeErrors)) {
        error_log('MongoDB write errors: ' . json_encode($writeErrors));
        throw new Exception('Some documents failed to insert. Check server logs.');
      }
      
      if ($actualInserted === 0) {
        throw new Exception('No documents were inserted. Please check MongoDB connection and permissions.');
      }
      
      $response = ['ok' => true, 'inserted' => $actualInserted, 'processed' => $inserted];
      
      // Add duplicate information if any
      if (!empty($duplicates)) {
        $response['duplicates'] = $duplicates;
        $response['skipped'] = $skipped;
        $response['message'] = "Inserted {$actualInserted} maintenance item(s). " . count($duplicates) . " duplicate(s) skipped.";
      }
      
      echo json_encode($response);
    } catch (Exception $insertError) {
      http_response_code(500);
      echo json_encode(['ok' => false, 'error' => 'Database insert failed: ' . $insertError->getMessage()]);
      exit;
    }
  } else {
    $response = ['ok' => true, 'inserted' => 0];
    
    if (!empty($duplicates)) {
      $response['duplicates'] = $duplicates;
      $response['skipped'] = $skipped;
      $response['message'] = "No new maintenance items inserted. " . count($duplicates) . " duplicate(s) found and skipped.";
    } else {
      $response['message'] = 'No valid rows to insert';
    }
    
    echo json_encode($response);
  }
} catch (Exception $e) {
  http_response_code(500);
  error_log('Upload error: ' . $e->getMessage() . PHP_EOL . $e->getTraceAsString());
  echo json_encode(['ok' => false, 'error' => 'Upload failed: ' . $e->getMessage()]);
}
?>







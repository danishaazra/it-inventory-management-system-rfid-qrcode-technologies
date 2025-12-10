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
  
  // Normalize header names: convert "Asset ID" -> "assetId", "Serial No." -> "serialNo", etc.
  // This function converts Excel column headers to system field names
  function normalizeHeaderName($header) {
    $header = trim($header);
    if (empty($header)) return '';
    
    // Common mappings for Excel column names to system field names
    $mappings = [
      'no.' => 'no',
      'branch code' => 'branchCode',
      'asset id' => 'assetId',
      'asset description' => 'assetDescription',
      'asset category' => 'assetCategory',
      'asset category description' => 'assetCategoryDescription',
      'owner code' => 'ownerCode',
      'owner name' => 'ownerName',
      'warranty period' => 'warrantyPeriod',
      'serial no.' => 'serialNo',
      'serial no' => 'serialNo',
      'location description' => 'locationDescription',
      'department code' => 'departmentCode',
      'department description' => 'departmentDescription',
      'current user' => 'currentUser'
    ];
    
    $lowerHeader = strtolower($header);
    
    // Check if there's a direct mapping
    if (isset($mappings[$lowerHeader])) {
      return $mappings[$lowerHeader];
    }
    
    // Convert to camelCase: "Status" -> "status", "Model" -> "model"
    $normalized = strtolower($header);
    // Replace spaces/periods and convert to camelCase
    $normalized = preg_replace('/[\s.]+/', '', $normalized);
    $normalized = lcfirst(str_replace(' ', '', ucwords(str_replace(['_', '-'], ' ', $normalized))));
    
    return $normalized;
  }
  
  // Normalize all headers
  $header = array_map('normalizeHeaderName', $rawHeader);

// Normalize header names
$requiredCol = 'assetId';
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
      if (empty($colName)) continue; // Skip empty header columns
      $value = $row[$idx] ?? null;
      // Convert cell value to string, handle nulls and empty strings
      if ($value === null || $value === '') {
        $assoc[$colName] = null;
      } else {
        $assoc[$colName] = trim((string)$value);
      }
    }
    
    // Skip rows without assetId (check for null, empty string, or whitespace)
    $assetId = trim((string)($assoc[$requiredCol] ?? ''));
    if (empty($assetId)) {
      $skipped++;
      continue;
    }
    
    // Check for duplicate assetId
    if (assetExists($mongoManager, $assetsNamespace, $assetId)) {
      $duplicates[] = $assetId;
      $skipped++;
      continue;
    }
    
    $batch[] = [
      'assetId' => $assoc['assetId'] ?? null,
      'assetDescription' => $assoc['assetDescription'] ?? null,
      'assetCategory' => $assoc['assetCategory'] ?? null,
      'assetCategoryDescription' => $assoc['assetCategoryDescription'] ?? null,
      'ownerCode' => $assoc['ownerCode'] ?? null,
      'ownerName' => $assoc['ownerName'] ?? null,
      'model' => $assoc['model'] ?? null,
      'brand' => $assoc['brand'] ?? null,
      'status' => $assoc['status'] ?? null,
      'warrantyPeriod' => $assoc['warrantyPeriod'] ?? null,
      'serialNo' => $assoc['serialNo'] ?? null,
      'location' => $assoc['location'] ?? null,
      'locationDescription' => $assoc['locationDescription'] ?? null,
      'area' => $assoc['area'] ?? null,
      'departmentCode' => $assoc['departmentCode'] ?? null,
      'departmentDescription' => $assoc['departmentDescription'] ?? null,
      'condition' => $assoc['condition'] ?? null,
      'currentUser' => $assoc['currentUser'] ?? null,
      'branchCode' => $assoc['branchCode'] ?? null,
      'no' => $assoc['no'] ?? null,
      'created_at' => new MongoDB\BSON\UTCDateTime(),
    ];
    $inserted++;
  }
  
  if ($inserted > 0 && !empty($batch)) {
    try {
      $result = mongoInsertMany($mongoManager, $assetsNamespace, $batch);
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
        $response['message'] = "Inserted {$actualInserted} asset(s). " . count($duplicates) . " duplicate(s) skipped.";
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
      $response['message'] = "No new assets inserted. " . count($duplicates) . " duplicate(s) found and skipped.";
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



<?php
require '../api/db.php';

$reportType = $_POST['reportType'] ?? '';
$format = $_POST['format'] ?? 'csv';
$reportData = json_decode($_POST['reportData'] ?? '[]', true);
$criteria = json_decode($_POST['criteria'] ?? '{}', true);

if (empty($reportType) || empty($reportData)) {
  die('Invalid export request');
}

// Get report title
$titles = [
  'asset' => 'Asset Report',
  'maintenance' => 'Maintenance Report',
  'inspection' => 'Inspection Report',
  'checklist' => 'Checklist Report'
];
$title = $titles[$reportType] ?? 'Report';

if ($format === 'csv') {
  exportCSV($reportData, $title);
} elseif ($format === 'pdf') {
  exportPDF($reportData, $title, $reportType, $criteria);
} else {
  die('Invalid format');
}

function exportCSV($data, $title) {
  header('Content-Type: text/csv; charset=utf-8');
  header('Content-Disposition: attachment; filename="' . $title . '_' . date('Y-m-d') . '.csv"');
  
  $output = fopen('php://output', 'w');
  
  // Add BOM for UTF-8 Excel compatibility
  fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
  
  if (!empty($data)) {
    // Write headers
    $headers = array_keys($data[0]);
    fputcsv($output, $headers);
    
    // Write data rows
    foreach ($data as $row) {
      $values = [];
      foreach ($headers as $header) {
        $values[] = $row[$header] ?? '';
      }
      fputcsv($output, $values);
    }
  }
  
  fclose($output);
  exit;
}

function exportPDF($data, $title, $reportType = '', $criteria = []) {
  // For PDF, we'll use a simple HTML to PDF approach
  // You may want to use a library like TCPDF or FPDF for better PDF generation
  
  header('Content-Type: text/html; charset=utf-8');
  
  // Set timezone to Malaysia Time (MYT)
  date_default_timezone_set('Asia/Kuala_Lumpur');
  
  // Get the base path for the logo
  $logoPath = '../../images/logo_dm.png';
  $currentDate = date('Y-m-d H:i:s') . ' MYT';
  
  // Extract criteria information for maintenance and inspection reports
  $branch = $criteria['branch'] ?? '';
  $location = $criteria['location'] ?? '';
  $itemName = $criteria['itemName'] ?? '';
  $frequency = $criteria['frequency'] ?? '';
  $dateFrom = $criteria['dateFrom'] ?? '';
  $dateTo = $criteria['dateTo'] ?? '';
  
  // Extract item name, branch, location, and frequency from report data if not in criteria
  if (in_array($reportType, ['maintenance', 'inspection']) && !empty($data)) {
    // Get unique values from report data
    $branches = array_unique(array_filter(array_column($data, 'Branch')));
    $locations = array_unique(array_filter(array_column($data, 'Location')));
    $itemNames = array_unique(array_filter(array_column($data, 'Item Name')));
    $frequencies = array_unique(array_filter(array_column($data, 'Frequency')));
    
    if (empty($branch) && !empty($branches)) {
      $branch = count($branches) === 1 ? $branches[0] : 'Multiple';
    }
    if (empty($location) && !empty($locations)) {
      $location = count($locations) === 1 ? $locations[0] : 'Multiple';
    }
    if (empty($itemName) && !empty($itemNames)) {
      $itemName = count($itemNames) === 1 ? $itemNames[0] : 'Multiple Items';
    }
    if (empty($frequency) && !empty($frequencies)) {
      $frequency = count($frequencies) === 1 ? $frequencies[0] : 'Multiple';
    }
  }
  
  // Determine month range and year
  $monthRange = '';
  $year = date('Y');
  if ($dateFrom && $dateTo) {
    $fromDate = new DateTime($dateFrom);
    $toDate = new DateTime($dateTo);
    $monthFrom = strtoupper($fromDate->format('M'));
    $monthTo = strtoupper($toDate->format('M'));
    if ($monthFrom === $monthTo) {
      $monthRange = $monthFrom;
    } else {
      $monthRange = $monthFrom . ' to ' . $monthTo;
    }
    $year = $fromDate->format('Y');
  } elseif ($dateFrom) {
    $fromDate = new DateTime($dateFrom);
    $monthRange = strtoupper($fromDate->format('M'));
    $year = $fromDate->format('Y');
  } elseif ($dateTo) {
    $toDate = new DateTime($dateTo);
    $monthRange = strtoupper($toDate->format('M'));
    $year = $toDate->format('Y');
  }
  
  // If no date range, use current year
  if (empty($monthRange)) {
    $year = date('Y');
  }
  
  $html = '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>' . htmlspecialchars($title) . '</title>
  <style>
    @media print {
      @page {
        margin: 20mm;
      }
    }
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #140958; }
    .header-left { display: flex; align-items: center; gap: 15px; }
    .header-logo { width: 80px; height: 80px; object-fit: contain; }
    .header-text { display: flex; flex-direction: column; }
    .company-name { font-size: 18px; font-weight: bold; color: #140958; margin-bottom: 5px; }
    .report-type { font-size: 14px; color: #333; font-weight: 600; }
    .header-right { text-align: right; }
    .report-date { font-size: 12px; color: #666; }
    .form-info { margin: 20px 0; padding: 15px; background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 8px; }
    .form-info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px 20px; }
    .form-info-item { display: flex; }
    .form-info-label { font-weight: 600; min-width: 150px; color: #374151; }
    .form-info-value { color: #1a1a1a; }
    .frequency-options { display: flex; gap: 15px; margin-top: 5px; }
    .frequency-option { display: flex; align-items: center; gap: 5px; }
    .frequency-checkbox { width: 15px; height: 15px; }
    h1 { color: #140958; border-bottom: 2px solid #140958; padding-bottom: 10px; margin-top: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #f1f3f5; padding: 10px; text-align: left; border: 1px solid #ddd; font-weight: 600; }
    td { padding: 8px; border: 1px solid #ddd; }
    tr:nth-child(even) { background: #f8f9fa; }
    .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <img src="' . htmlspecialchars($logoPath) . '" alt="PKT Logo" class="header-logo" onerror="this.style.display=\'none\'">
      <div class="header-text">
        <div class="company-name">' . htmlspecialchars($title) . '</div>
      </div>
    </div>
    <div class="header-right">
      <div class="report-date"><strong>Report Date:</strong><br>' . htmlspecialchars($currentDate) . '</div>
    </div>
  </div>';
  
  // Add form information section for maintenance, inspection, and checklist reports
  if (in_array($reportType, ['maintenance', 'inspection', 'checklist'])) {
    // For checklist, extract info from first item if available
    if ($reportType === 'checklist' && !empty($data)) {
      $firstItem = $data[0];
      if (empty($branch) && isset($firstItem['branch'])) {
        $branch = $firstItem['branch'];
      }
      if (empty($location) && isset($firstItem['location'])) {
        $location = $firstItem['location'];
      }
      if (empty($itemName) && isset($firstItem['itemName'])) {
        $itemName = $firstItem['itemName'];
      }
      if (empty($frequency) && isset($firstItem['frequency'])) {
        $frequency = $firstItem['frequency'];
      }
      if (isset($firstItem['year'])) {
        $year = $firstItem['year'];
      }
      // For checklist, month range is the full year
      $monthRange = 'JAN to DEC';
    }
    $html .= '<div class="form-info">
      <div class="form-info-grid">
        <div class="form-info-item">
          <span class="form-info-label">BRANCH:</span>
          <span class="form-info-value">' . htmlspecialchars($branch ?: '-') . '</span>
        </div>
        <div class="form-info-item">
          <span class="form-info-label">LOCATION:</span>
          <span class="form-info-value">' . htmlspecialchars($location ?: '-') . '</span>
        </div>
        <div class="form-info-item">
          <span class="form-info-label">ITEM NAME:</span>
          <span class="form-info-value">' . htmlspecialchars($itemName ?: '-') . '</span>
        </div>
        <div class="form-info-item">
          <span class="form-info-label">MONTH:</span>
          <span class="form-info-value">' . htmlspecialchars($monthRange ?: '-') . '</span>
        </div>
        <div class="form-info-item">
          <span class="form-info-label">YEAR:</span>
          <span class="form-info-value">' . htmlspecialchars($year) . '</span>
        </div>
        <div class="form-info-item" style="grid-column: span 2;">
          <span class="form-info-label">CHECKLIST FREQUENCY:</span>
          <div class="frequency-options">
            <div class="frequency-option">
              <input type="checkbox" class="frequency-checkbox" ' . ($frequency === 'Weekly' ? 'checked' : '') . ' disabled>
              <label>Weekly</label>
            </div>
            <div class="frequency-option">
              <input type="checkbox" class="frequency-checkbox" ' . ($frequency === 'Monthly' ? 'checked' : '') . ' disabled>
              <label>Monthly</label>
            </div>
            <div class="frequency-option">
              <input type="checkbox" class="frequency-checkbox" ' . ($frequency === 'Quarterly' ? 'checked' : '') . ' disabled>
              <label>Quarterly</label>
            </div>
          </div>
        </div>
      </div>
    </div>';
  }
  
  $html .= '<h1>' . htmlspecialchars($title) . '</h1>';
  
  // Handle checklist format differently
  if ($reportType === 'checklist' && !empty($data)) {
    // Generate checklist table with monthly grid
    $html .= generateChecklistTable($data, $criteria);
  } elseif (!empty($data)) {
    $html .= '<table>';
    
    // Headers
    $headers = array_keys($data[0]);
    $html .= '<thead><tr>';
    foreach ($headers as $header) {
      $html .= '<th>' . htmlspecialchars($header) . '</th>';
    }
    $html .= '</tr></thead><tbody>';
    
    // Data rows
    foreach ($data as $row) {
      $html .= '<tr>';
      foreach ($headers as $header) {
        $html .= '<td>' . htmlspecialchars($row[$header] ?? '') . '</td>';
      }
      $html .= '</tr>';
    }
    
    $html .= '</tbody></table>';
  } else {
    $html .= '<p>No data available</p>';
  }
  
  // Calculate total records (for checklist, count tasks)
  $totalRecords = count($data);
  if ($reportType === 'checklist' && !empty($data)) {
    $totalRecords = 0;
    foreach ($data as $item) {
      $tasks = $item['inspectionTasks'] ?? [];
      $totalRecords += !empty($tasks) ? count($tasks) : 1;
    }
  }
  
  $html .= '<div class="footer">Total Records: ' . $totalRecords . '</div>
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>';
  
  echo $html;
  exit;
}

function generateChecklistTable($data, $criteria) {
  $months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  $monthAbbr = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  
  $html = '<table style="width: 100%; border-collapse: collapse; font-size: 10px;">';
  
  // Header row
  $html .= '<thead><tr>';
  $html .= '<th style="border: 1px solid #000; padding: 6px; text-align: center; background: #f1f3f5; width: 35px;">NO</th>';
  $html .= '<th style="border: 1px solid #000; padding: 6px; text-align: left; background: #f1f3f5; width: 180px;">INSPECTION HARDWARE</th>';
  
  // Month headers with 4 sub-columns each
  foreach ($months as $idx => $month) {
    $html .= '<th colspan="4" style="border: 1px solid #000; padding: 3px; text-align: center; background: #f1f3f5; max-width: 80px;">' . strtoupper($monthAbbr[$idx]) . '</th>';
  }
  $html .= '</tr>';
  
  // Sub-header row for periods (1, 2, 3, 4)
  $html .= '<tr>';
  $html .= '<th style="border: 1px solid #000; padding: 3px;"></th>';
  $html .= '<th style="border: 1px solid #000; padding: 3px;"></th>';
  for ($i = 0; $i < 12; $i++) {
    for ($p = 1; $p <= 4; $p++) {
      $html .= '<th style="border: 1px solid #000; padding: 2px; text-align: center; background: #f8f9fa; font-weight: normal; width: 18px; font-size: 9px;">' . $p . '</th>';
    }
  }
  $html .= '</tr></thead><tbody>';
  
  // Data rows - one row per location/item combination with all its tasks
  $rowNum = 1;
  foreach ($data as $item) {
    $tasks = $item['inspectionTasks'] ?? [];
    $schedule = $item['schedule'] ?? [];
    
    // If no tasks, still create one row
    if (empty($tasks)) {
      $tasks = [''];
    }
    
    foreach ($tasks as $taskIdx => $task) {
      $html .= '<tr>';
      $html .= '<td style="border: 1px solid #000; padding: 6px; text-align: center;">' . $rowNum . '</td>';
      $html .= '<td style="border: 1px solid #000; padding: 6px;">' . htmlspecialchars($task ?: '-') . '</td>';
      
      // Generate cells for each month (4 periods each)
      for ($month = 1; $month <= 12; $month++) {
        for ($period = 1; $period <= 4; $period++) {
          $cellContent = '';
          if (isset($schedule[$month][$period])) {
            $dates = $schedule[$month][$period];
            if (!empty($dates)) {
              $cellContent = implode(', ', $dates);
            }
          }
          $html .= '<td style="border: 1px solid #000; padding: 2px; text-align: center; width: 18px; font-size: 9px;">' . htmlspecialchars($cellContent) . '</td>';
        }
      }
      
      $html .= '</tr>';
      $rowNum++;
    }
  }
  
  $html .= '</tbody></table>';
  
  // Add assigned staff information
  if (!empty($data)) {
    $firstItem = $data[0];
    $staffName = $firstItem['assignedStaffName'] ?? '';
    $staffEmail = $firstItem['assignedStaffEmail'] ?? '';
    
    if ($staffName && $staffName !== '-') {
      $html .= '<div style="margin-top: 30px; padding: 15px; border-top: 1px solid #e5e7eb;">';
      $html .= '<div style="font-weight: 600; margin-bottom: 10px;">INSPECTED BY:</div>';
      $html .= '<div style="margin-bottom: 5px;"><strong>Name:</strong> ' . htmlspecialchars($staffName) . '</div>';
      if ($staffEmail && $staffEmail !== '-') {
        $html .= '<div><strong>Email:</strong> ' . htmlspecialchars($staffEmail) . '</div>';
      }
      $html .= '</div>';
    }
  }
  
  return $html;
}
?>


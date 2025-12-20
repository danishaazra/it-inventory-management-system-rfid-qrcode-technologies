<?php
require '../api/db.php';

$reportType = $_POST['reportType'] ?? '';
$format = $_POST['format'] ?? 'csv';
$reportData = json_decode($_POST['reportData'] ?? '[]', true);

if (empty($reportType) || empty($reportData)) {
  die('Invalid export request');
}

// Get report title
$titles = [
  'asset' => 'Asset Report',
  'maintenance' => 'Maintenance Report',
  'inspection' => 'Inspection Report'
];
$title = $titles[$reportType] ?? 'Report';

if ($format === 'csv') {
  exportCSV($reportData, $title);
} elseif ($format === 'pdf') {
  exportPDF($reportData, $title);
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

function exportPDF($data, $title) {
  // For PDF, we'll use a simple HTML to PDF approach
  // You may want to use a library like TCPDF or FPDF for better PDF generation
  
  header('Content-Type: text/html; charset=utf-8');
  
  // Get the base path for the logo
  $logoPath = '../../images/pkt_logo.png';
  $currentDate = date('Y-m-d H:i:s');
  
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
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #140958; }
    .header-left { display: flex; align-items: center; gap: 15px; }
    .header-logo { width: 80px; height: 80px; object-fit: contain; }
    .header-text { display: flex; flex-direction: column; }
    .company-name { font-size: 18px; font-weight: bold; color: #140958; margin-bottom: 5px; }
    .report-type { font-size: 14px; color: #333; font-weight: 600; }
    .header-right { text-align: right; }
    .report-date { font-size: 12px; color: #666; }
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
        <div class="company-name">PKT LOGISTICS (M) SDN BHD</div>
        <div class="report-type">ICT - PREVENTIVE MAINTENANCE CHECKLIST</div>
      </div>
    </div>
    <div class="header-right">
      <div class="report-date"><strong>Report Date:</strong><br>' . htmlspecialchars($currentDate) . '</div>
    </div>
  </div>
  <h1>' . htmlspecialchars($title) . '</h1>';
  
  if (!empty($data)) {
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
  
  $html .= '<div class="footer">Total Records: ' . count($data) . '</div>
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
?>


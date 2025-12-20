<?php
header('Content-Type: application/json');
require '../api/db.php';

$data = json_decode(file_get_contents('php://input'), true);

try {
  // Build filter based on criteria
  $filter = [];
  
  // Frequency filter
  if (!empty($data['frequency'])) {
    $filter['frequency'] = $data['frequency'];
  }
  
  // Branch filter (exact match for dropdown selection)
  if (!empty($data['branch'])) {
    $filter['branch'] = $data['branch'];
  }
  
  // Location filter (exact match for dropdown selection)
  if (!empty($data['location'])) {
    $filter['location'] = $data['location'];
  }
  
  // Assigned staff filter (exact match for dropdown selection)
  if (!empty($data['assignedStaff'])) {
    $filter['assignedStaffName'] = $data['assignedStaff'];
  }
  
  // Query maintenance items
  $options = [
    'sort' => ['branch' => 1, 'location' => 1, 'itemName' => 1]
  ];
  $results = mongoFind($mongoManager, $maintenanceNamespace, $filter, $options);
  
  // Convert to report format
  $report = [];
  foreach ($results as $doc) {
    // Extract schedule dates if available
    $scheduleInfo = '-';
    if (isset($doc->maintenanceSchedule)) {
      $schedule = is_object($doc->maintenanceSchedule) 
        ? json_decode(json_encode($doc->maintenanceSchedule), true)
        : $doc->maintenanceSchedule;
      
      if (is_array($schedule)) {
        $dates = [];
        foreach ($schedule as $key => $value) {
          if (is_array($value)) {
            foreach ($value as $k => $v) {
              if (is_string($v) && preg_match('/^\d{4}-\d{2}-\d{2}/', $v)) {
                $dates[] = $v;
              }
            }
          } elseif (is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}/', $value)) {
            $dates[] = $value;
          }
        }
        if (!empty($dates)) {
          $scheduleInfo = implode(', ', array_slice($dates, 0, 3));
          if (count($dates) > 3) {
            $scheduleInfo .= '...';
          }
        }
      }
    }
    
    $report[] = [
      'Branch' => $doc->branch ?? '-',
      'Location' => $doc->location ?? '-',
      'Item Name' => $doc->itemName ?? '-',
      'Frequency' => $doc->frequency ?? '-',
      'Assigned Staff' => $doc->assignedStaffName ?? 'Unassigned',
      'Staff Email' => $doc->assignedStaffEmail ?? '-',
      'Next Schedule' => $scheduleInfo,
      'Inspection Tasks Count' => !empty($doc->inspectionTasks) ? substr_count($doc->inspectionTasks, "\n") + 1 : 0
    ];
  }
  
  echo json_encode([
    'ok' => true,
    'report' => $report,
    'count' => count($report)
  ]);
  
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Could not generate report: ' . $e->getMessage()]);
}
?>


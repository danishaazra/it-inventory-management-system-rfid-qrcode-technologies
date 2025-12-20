<?php
header('Content-Type: application/json');
require '../api/db.php';

$data = json_decode(file_get_contents('php://input'), true);

try {
  // Build filter based on criteria
  $filter = [];
  
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
  
  // Query maintenance items (inspections are part of maintenance)
  $options = [
    'sort' => ['branch' => 1, 'location' => 1, 'itemName' => 1]
  ];
  $results = mongoFind($mongoManager, $maintenanceNamespace, $filter, $options);
  
  // Convert to report format with task details
  $report = [];
  foreach ($results as $doc) {
    // Parse inspection tasks
    $tasks = [];
    if (!empty($doc->inspectionTasks)) {
      $taskLines = explode("\n", $doc->inspectionTasks);
      foreach ($taskLines as $task) {
        $task = trim($task);
        if (!empty($task)) {
          $tasks[] = $task;
        }
      }
    }
    
    // Extract next scheduled date
    $nextDate = '-';
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
          sort($dates);
          $today = date('Y-m-d');
          foreach ($dates as $date) {
            if ($date >= $today) {
              $nextDate = $date;
              break;
            }
          }
          if ($nextDate === '-') {
            $nextDate = $dates[0]; // Use earliest if all past
          }
        }
      }
    }
    
    // Determine status based on next date
    $status = 'Pending';
    if ($nextDate !== '-') {
      $nextTimestamp = strtotime($nextDate);
      $todayTimestamp = strtotime(date('Y-m-d'));
      if ($nextTimestamp < $todayTimestamp) {
        $status = 'Overdue';
      } elseif ($nextTimestamp === $todayTimestamp) {
        $status = 'Due Today';
      }
    }
    
    // Apply status filter if specified
    if (!empty($data['status'])) {
      if ($data['status'] === 'Overdue' && $status !== 'Overdue') {
        continue;
      } elseif ($data['status'] === 'Completed' && $status !== 'Completed') {
        continue;
      } elseif ($data['status'] === 'Pending' && ($status === 'Overdue' || $status === 'Completed')) {
        continue;
      }
    }
    
    // Date range filter
    if (!empty($data['dateFrom']) || !empty($data['dateTo'])) {
      if ($nextDate === '-') {
        continue; // Skip if no date
      }
      if (!empty($data['dateFrom']) && $nextDate < $data['dateFrom']) {
        continue;
      }
      if (!empty($data['dateTo']) && $nextDate > $data['dateTo']) {
        continue;
      }
    }
    
    // Create entry for each task or one entry with all tasks
    if (empty($tasks)) {
      $report[] = [
        'Branch' => $doc->branch ?? '-',
        'Location' => $doc->location ?? '-',
        'Item Name' => $doc->itemName ?? '-',
        'Task' => 'No tasks defined',
        'Status' => $status,
        'Next Scheduled Date' => $nextDate,
        'Assigned Staff' => $doc->assignedStaffName ?? 'Unassigned',
        'Frequency' => $doc->frequency ?? '-'
      ];
    } else {
      foreach ($tasks as $task) {
        $report[] = [
          'Branch' => $doc->branch ?? '-',
          'Location' => $doc->location ?? '-',
          'Item Name' => $doc->itemName ?? '-',
          'Task' => $task,
          'Status' => $status,
          'Next Scheduled Date' => $nextDate,
          'Assigned Staff' => $doc->assignedStaffName ?? 'Unassigned',
          'Frequency' => $doc->frequency ?? '-'
        ];
      }
    }
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


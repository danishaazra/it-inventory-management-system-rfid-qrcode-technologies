<?php
header('Content-Type: application/json');
require '../api/db.php';

$data = json_decode(file_get_contents('php://input'), true);

try {
  // Build filter based on criteria
  $filter = [];
  
  // Year filter (for checklist, we'll filter by schedule dates)
  $year = !empty($data['year']) ? (int)$data['year'] : (int)date('Y');
  
  // Frequency filter
  if (!empty($data['frequency'])) {
    $filter['frequency'] = $data['frequency'];
  }
  
  // Branch filter
  if (!empty($data['branch'])) {
    $filter['branch'] = $data['branch'];
  }
  
  // Location filter
  if (!empty($data['location'])) {
    $filter['location'] = $data['location'];
  }
  
  // Item name filter
  if (!empty($data['itemName'])) {
    $filter['itemName'] = $data['itemName'];
  }
  
  // Query maintenance items
  $options = [
    'sort' => ['branch' => 1, 'location' => 1, 'itemName' => 1]
  ];
  $results = mongoFind($mongoManager, $maintenanceNamespace, $filter, $options);
  
  // Convert to checklist format
  $checklist = [];
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
    
    // Extract schedule dates for the specified year
    $scheduleDates = [];
    if (isset($doc->maintenanceSchedule)) {
      $schedule = is_object($doc->maintenanceSchedule) 
        ? json_decode(json_encode($doc->maintenanceSchedule), true)
        : $doc->maintenanceSchedule;
      
      if (is_array($schedule)) {
        foreach ($schedule as $key => $value) {
          if (is_array($value)) {
            foreach ($value as $k => $v) {
              if (is_string($v) && preg_match('/^\d{4}-\d{2}-\d{2}/', $v)) {
                $dateYear = (int)substr($v, 0, 4);
                if ($dateYear === $year) {
                  $scheduleDates[] = $v;
                }
              }
            }
          } elseif (is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}/', $value)) {
            $dateYear = (int)substr($value, 0, 4);
            if ($dateYear === $year) {
              $scheduleDates[] = $value;
            }
          }
        }
      }
    }
    
    // Organize dates by month and week/period
    $monthlySchedule = [];
    foreach ($scheduleDates as $date) {
      $dateObj = new DateTime($date);
      $month = (int)$dateObj->format('n'); // 1-12
      $day = (int)$dateObj->format('j'); // 1-31
      
      // Determine which period (1-4) based on day of month
      // Period 1: 1-7, Period 2: 8-14, Period 3: 15-21, Period 4: 22-31
      $period = 1;
      if ($day >= 22) {
        $period = 4;
      } elseif ($day >= 15) {
        $period = 3;
      } elseif ($day >= 8) {
        $period = 2;
      }
      
      if (!isset($monthlySchedule[$month])) {
        $monthlySchedule[$month] = [];
      }
      if (!isset($monthlySchedule[$month][$period])) {
        $monthlySchedule[$month][$period] = [];
      }
      $monthlySchedule[$month][$period][] = $dateObj->format('d');
    }
    
    // If no tasks, create one entry with "No tasks defined"
    if (empty($tasks)) {
      $tasks = ['No tasks defined'];
    }
    
    // Create checklist entry
    $checklist[] = [
      'branch' => $doc->branch ?? '-',
      'location' => $doc->location ?? '-',
      'itemName' => $doc->itemName ?? '-',
      'frequency' => $doc->frequency ?? '-',
      'inspectionTasks' => $tasks,
      'schedule' => $monthlySchedule,
      'year' => $year,
      'assignedStaffName' => $doc->assignedStaffName ?? '-',
      'assignedStaffEmail' => $doc->assignedStaffEmail ?? '-'
    ];
  }
  
  echo json_encode([
    'ok' => true,
    'report' => $checklist,
    'count' => count($checklist)
  ]);
  
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Could not generate checklist: ' . $e->getMessage()]);
}
?>


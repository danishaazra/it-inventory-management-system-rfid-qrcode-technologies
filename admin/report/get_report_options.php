<?php
header('Content-Type: application/json');
require '../api/db.php';

try {
  // Get unique locations from assets
  $assetsFilter = [
    'locationDescription' => ['$exists' => true, '$ne' => null, '$ne' => '']
  ];
  $assetsOptions = [
    'projection' => ['locationDescription' => 1, 'branchCode' => 1]
  ];
  $assetsResults = mongoFind($mongoManager, $assetsNamespace, $assetsFilter, $assetsOptions);
  
  $assetLocations = [];
  $assetBranches = [];
  foreach ($assetsResults as $doc) {
    // Locations
    $location = $doc->locationDescription ?? null;
    if ($location && !empty(trim((string)$location))) {
      $locationStr = trim((string)$location);
      if (!in_array($locationStr, $assetLocations, true)) {
        $assetLocations[] = $locationStr;
      }
    }
    
    // Branches
    $branch = $doc->branchCode ?? null;
    if ($branch && !empty(trim((string)$branch))) {
      $branchStr = trim((string)$branch);
      if (!in_array($branchStr, $assetBranches, true)) {
        $assetBranches[] = $branchStr;
      }
    }
  }
  
  // Get unique locations and branches from maintenance
  $maintenanceOptions = [
    'projection' => ['location' => 1, 'branch' => 1]
  ];
  $maintenanceResults = mongoFind($mongoManager, $maintenanceNamespace, [], $maintenanceOptions);
  
  $maintenanceLocations = [];
  $maintenanceBranches = [];
  foreach ($maintenanceResults as $doc) {
    // Locations
    $location = $doc->location ?? null;
    if ($location && !empty(trim((string)$location))) {
      $locationStr = trim((string)$location);
      if (!in_array($locationStr, $maintenanceLocations, true)) {
        $maintenanceLocations[] = $locationStr;
      }
    }
    
    // Branches
    $branch = $doc->branch ?? null;
    if ($branch && !empty(trim((string)$branch))) {
      $branchStr = trim((string)$branch);
      if (!in_array($branchStr, $maintenanceBranches, true)) {
        $maintenanceBranches[] = $branchStr;
      }
    }
  }
  
  // Merge and deduplicate
  $allLocations = array_unique(array_merge($assetLocations, $maintenanceLocations));
  $allBranches = array_unique(array_merge($assetBranches, $maintenanceBranches));
  
  // Get unique staff members from users collection
  $usersNamespace = $mongoDb . '.users';
  $usersOptions = [
    'projection' => ['name' => 1, 'email' => 1]
  ];
  $usersResults = mongoFind($mongoManager, $usersNamespace, [], $usersOptions);
  
  $staffMembers = [];
  foreach ($usersResults as $doc) {
    $name = $doc->name ?? null;
    if ($name && !empty(trim((string)$name))) {
      $nameStr = trim((string)$name);
      if (!in_array($nameStr, $staffMembers, true)) {
        $staffMembers[] = $nameStr;
      }
    }
  }
  
  // Also get staff from maintenance assignedStaffName
  $maintenanceStaffResults = mongoFind($mongoManager, $maintenanceNamespace, [], [
    'projection' => ['assignedStaffName' => 1]
  ]);
  
  foreach ($maintenanceStaffResults as $doc) {
    $name = $doc->assignedStaffName ?? null;
    if ($name && !empty(trim((string)$name))) {
      $nameStr = trim((string)$name);
      if (!in_array($nameStr, $staffMembers, true)) {
        $staffMembers[] = $nameStr;
      }
    }
  }
  
  // Sort alphabetically
  sort($allLocations);
  sort($allBranches);
  sort($staffMembers);
  
  echo json_encode([
    'ok' => true,
    'locations' => array_values($allLocations),
    'branches' => array_values($allBranches),
    'staff' => array_values($staffMembers)
  ]);
  
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Could not load options: ' . $e->getMessage()]);
}
?>


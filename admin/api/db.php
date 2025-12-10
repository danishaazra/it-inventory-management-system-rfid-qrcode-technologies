<?php

$mongoUri = 'mongodb+srv://danishaazra:1234@it-inventory.0amupak.mongodb.net/?appName=it-inventory'; // Replace with your Atlas URI (mongodb+srv://...)
$mongoDb  = 'it_inventory';             // Your database name (can be created automatically if it doesn't exist)

// 2) Helper to get a Manager instance.
function getMongoManager(string $uri) {
  static $manager = null;
  if ($manager === null) {
    $manager = new MongoDB\Driver\Manager($uri);
  }
  return $manager;
}

// 3) Helper to insert one document into a namespace.
function mongoInsertOne(MongoDB\Driver\Manager $manager, string $namespace, array $doc) {
  $bulk = new MongoDB\Driver\BulkWrite();
  $bulk->insert($doc);
  $result = $manager->executeBulkWrite($namespace, $bulk);
  
  $insertedCount = $result->getInsertedCount();
  $writeErrors = $result->getWriteErrors();
  
  if (!empty($writeErrors)) {
    throw new Exception('MongoDB write error: ' . json_encode($writeErrors));
  }
  
  if ($insertedCount === 0) {
    throw new Exception('Document was not inserted. Inserted count: 0');
  }
  
  return ['insertedCount' => $insertedCount];
}

// 4) Helper to insert many documents.
function mongoInsertMany(MongoDB\Driver\Manager $manager, string $namespace, array $docs) {
  if (empty($docs)) {
    return ['insertedCount' => 0];
  }
  
  $bulk = new MongoDB\Driver\BulkWrite();
  foreach ($docs as $doc) {
    $bulk->insert($doc);
  }
  $result = $manager->executeBulkWrite($namespace, $bulk);
  
  return [
    'insertedCount' => $result->getInsertedCount(),
    'writeErrors' => $result->getWriteErrors()
  ];
}

// 5) Helper to query documents from MongoDB.
function mongoFind(MongoDB\Driver\Manager $manager, string $namespace, array $filter = [], array $options = []) {
  $query = new MongoDB\Driver\Query($filter, $options);
  $cursor = $manager->executeQuery($namespace, $query);
  $results = [];
  foreach ($cursor as $document) {
    $results[] = $document;
  }
  return $results;
}

// 7) Helper to check if an asset with the same assetId already exists.
function assetExists(MongoDB\Driver\Manager $manager, string $namespace, string $assetId) {
  $filter = ['assetId' => $assetId];
  $results = mongoFind($manager, $namespace, $filter, ['limit' => 1]);
  return !empty($results);
}

// 6) Build namespace string for the assets collection.
$assetsNamespace = $mongoDb . '.assets';

// 8) Build namespace string for the maintenance collection.
$maintenanceNamespace = $mongoDb . '.maintenance';

// Export manager and namespace.
$mongoManager = getMongoManager($mongoUri);
?>
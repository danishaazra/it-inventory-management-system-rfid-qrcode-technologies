<?php
// Prevent any output before image
ob_start();

// Turn off error display (but log them)
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Load vendor autoload (vendor is in project root, 2 levels up from admin/asset/)
$autoloadPath = __DIR__ . '/../../vendor/autoload.php';

if (!file_exists($autoloadPath)) {
    ob_end_clean();
    header('Content-Type: image/png');
    $image = imagecreatetruecolor(256, 256);
    $white = imagecolorallocate($image, 255, 255, 255);
    $black = imagecolorallocate($image, 0, 0, 0);
    imagefill($image, 0, 0, $white);
    imagestring($image, 5, 40, 120, 'Library Not Found', $black);
    imagepng($image);
    imagedestroy($image);
    exit;
}

require_once $autoloadPath;

use Endroid\QrCode\Builder\Builder;
use Endroid\QrCode\Encoding\Encoding;
use Endroid\QrCode\ErrorCorrectionLevel;
use Endroid\QrCode\Writer\PngWriter;

try {
    // Clean output buffer before setting headers
    ob_end_clean();
    header('Content-Type: image/png');
    
    // Get the data to encode from query parameter
    $data = $_GET['data'] ?? '';
    
    if (empty($data)) {
        // Return a small blank image if no data
        $image = imagecreatetruecolor(256, 256);
        $white = imagecolorallocate($image, 255, 255, 255);
        imagefill($image, 0, 0, $white);
        imagepng($image);
        imagedestroy($image);
        exit;
    }
    
    // Create Builder instance with constructor (version 6 API)
    $builder = new Builder(
        writer: new PngWriter(),
        data: $data,
        encoding: new Encoding('UTF-8'),
        errorCorrectionLevel: ErrorCorrectionLevel::High,
        size: 256,
        margin: 10
    );
    
    $result = $builder->build();
    
    echo $result->getString();
    
} catch (Throwable $e) {
    // On any error, return an error image with full error message
    ob_end_clean();
    $errorMessage = $e->getMessage();
    $errorFile = $e->getFile();
    $errorLine = $e->getLine();
    error_log('QR Code error: ' . $errorMessage . ' in ' . $errorFile . ':' . $errorLine);
    error_log('Stack trace: ' . $e->getTraceAsString());
    
    header('Content-Type: image/png');
    $image = imagecreatetruecolor(512, 256);
    $white = imagecolorallocate($image, 255, 255, 255);
    $black = imagecolorallocate($image, 0, 0, 0);
    $red = imagecolorallocate($image, 220, 38, 38);
    imagefill($image, 0, 0, $white);
    
    // Display full error message (split into multiple lines if needed)
    $errorMsg = 'Error: ' . $errorMessage;
    $lines = str_split($errorMsg, 50); // Split into 50 char lines
    $y = 50;
    foreach ($lines as $line) {
        imagestring($image, 3, 10, $y, $line, $red);
        $y += 20;
    }
    
    imagepng($image);
    imagedestroy($image);
    exit;
}
?>


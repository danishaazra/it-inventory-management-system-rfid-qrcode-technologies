<?php
require '../vendor/autoload.php';

use Endroid\QrCode\Builder\Builder;
use Endroid\QrCode\Encoding\Encoding;
use Endroid\QrCode\ErrorCorrectionLevel\ErrorCorrectionLevelHigh;
use Endroid\QrCode\Writer\PngWriter;

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

try {
    $result = Builder::create()
        ->writer(new PngWriter())
        ->data($data)
        ->encoding(new Encoding('UTF-8'))
        ->errorCorrectionLevel(new ErrorCorrectionLevelHigh())
        ->size(256)
        ->margin(10)
        ->build();
    
    echo $result->getString();
} catch (Exception $e) {
    // On error, return a blank image
    error_log('QR Code generation error: ' . $e->getMessage());
    $image = imagecreatetruecolor(256, 256);
    $white = imagecolorallocate($image, 255, 255, 255);
    $black = imagecolorallocate($image, 0, 0, 0);
    imagefill($image, 0, 0, $white);
    imagestring($image, 5, 50, 120, 'QR Code Error', $black);
    imagepng($image);
    imagedestroy($image);
}
?>


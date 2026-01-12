<?php
// Color Analysis Script
$colorCounts = [];
$totalColors = 0;

// Patterns to match
$patterns = [
    '/#([0-9a-fA-F]{3,6})\b/',
    '/rgba?\(([^)]+)\)/',
    '/color:\s*([a-zA-Z]+)\b/',
    '/background:\s*([a-zA-Z]+)\b/',
    '/border-color:\s*([a-zA-Z]+)\b/'
];

// Scan all HTML, JS, and PHP files in admin directory
function scanDirectory($dir, $patterns, &$colorCounts, &$totalColors) {
    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir),
        RecursiveIteratorIterator::SELF_FIRST
    );
    
    foreach ($files as $file) {
        if ($file->isFile() && 
            (preg_match('/\.(html|js|php)$/i', $file->getFilename()))) {
            $content = file_get_contents($file->getPathname());
            
            // Extract hex colors
            if (preg_match_all('/#([0-9a-fA-F]{3,6})\b/i', $content, $matches)) {
                foreach ($matches[1] as $match) {
                    // Normalize 3-digit to 6-digit
                    if (strlen($match) === 3) {
                        $match = $match[0] . $match[0] . $match[1] . $match[1] . $match[2] . $match[2];
                    }
                    $color = '#' . strtoupper($match);
                    $colorCounts[$color] = ($colorCounts[$color] ?? 0) + 1;
                    $totalColors++;
                }
            }
            
            // Extract rgba/rgb
            if (preg_match_all('/rgba?\(([^)]+)\)/i', $content, $matches)) {
                foreach ($matches[1] as $match) {
                    $color = 'rgb(' . trim($match) . ')';
                    $colorCounts[$color] = ($colorCounts[$color] ?? 0) + 1;
                    $totalColors++;
                }
            }
            
            // Extract named colors
            $namedColors = ['white', 'black', 'transparent', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'gray', 'grey'];
            foreach ($namedColors as $named) {
                $pattern = '/\b' . $named . '\b/i';
                if (preg_match_all($pattern, $content, $m)) {
                    $color = strtolower($named);
                    $colorCounts[$color] = ($colorCounts[$color] ?? 0) + count($m[0]);
                    $totalColors += count($m[0]);
                }
            }
        }
    }
}

// Scan admin directory
$adminDir = __DIR__ . '/..';
scanDirectory($adminDir, $patterns, $colorCounts, $totalColors);

// Sort by count (descending)
arsort($colorCounts);

// Output results
header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html>
<head>
    <title>Color Usage Analysis</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #140958; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f1f3f5; font-weight: 600; }
        .color-box { width: 30px; height: 30px; border: 1px solid #ddd; display: inline-block; vertical-align: middle; margin-right: 10px; }
        .percentage { font-weight: 600; color: #140958; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Color Usage Analysis</h1>
        <p><strong>Total Color Occurrences:</strong> <?php echo $totalColors; ?></p>
        <table>
            <thead>
                <tr>
                    <th>Color</th>
                    <th>Preview</th>
                    <th>Count</th>
                    <th>Percentage</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($colorCounts as $color => $count): 
                    $percentage = ($totalColors > 0) ? round(($count / $totalColors) * 100, 2) : 0;
                    $bgColor = (strpos($color, 'rgb') === 0 || strpos($color, '#') === 0) ? $color : $color;
                ?>
                <tr>
                    <td><code><?php echo htmlspecialchars($color); ?></code></td>
                    <td>
                        <?php if (strpos($color, '#') === 0 || strpos($color, 'rgb') === 0): ?>
                            <span class="color-box" style="background: <?php echo htmlspecialchars($color); ?>;"></span>
                        <?php else: ?>
                            <span class="color-box" style="background: <?php echo htmlspecialchars($color); ?>;"></span>
                        <?php endif; ?>
                    </td>
                    <td><?php echo $count; ?></td>
                    <td><span class="percentage"><?php echo $percentage; ?>%</span></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</body>
</html>





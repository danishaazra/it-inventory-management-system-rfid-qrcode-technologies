// QR Code generation route
const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');

// Generate QR code image
router.get('/generate', async (req, res) => {
    try {
        const data = req.query.data || '';
        
        if (!data) {
            // Return a small blank image if no data
            return res.status(400).json({ error: 'Data parameter is required' });
        }

        // Generate QR code as PNG buffer
        const qrCodeBuffer = await QRCode.toBuffer(data, {
            errorCorrectionLevel: 'H',
            type: 'png',
            width: 256,
            margin: 1
        });

        // Set headers and send image
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(qrCodeBuffer);
    } catch (error) {
        console.error('QR Code generation error:', error);
        
        // Return error image
        res.setHeader('Content-Type', 'image/png');
        
        // Create a simple error image using a basic approach
        // For a proper error image, you might want to use a canvas library
        // For now, return a 1x1 transparent PNG
        const errorBuffer = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            'base64'
        );
        res.status(500).send(errorBuffer);
    }
});

module.exports = router;


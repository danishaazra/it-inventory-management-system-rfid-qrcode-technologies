// server.js
console.log('Starting server...');
console.log('Node.js version:', process.version);
console.log('Current working directory:', process.cwd());

// Load environment variables
require('dotenv').config();
const path = require('path');

console.log('Loading dependencies...');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
console.log('✓ Dependencies loaded');

const app = express();
app.use(express.json());
app.use(cors());

// Serve static files from root directory
app.use(express.static(path.join(__dirname)));

// MongoDB connection with better error handling
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.warn('WARNING: MONGO_URI environment variable is not set');
    console.warn('MongoDB connection will be skipped. Set MONGO_URI in Render environment variables to enable database connection.');
} else {
    // Only attempt connection if MONGO_URI is provided
    mongoose.connect(MONGO_URI)
      .then(() => {
          console.log('✓ MongoDB Connected successfully');
      })
      .catch(err => {
          console.error('✗ MongoDB connection error:', err.message);
          console.error('Server will continue running without database connection');
          // Don't exit - let the server continue running
      });
}

// Root endpoint - redirect to login page
app.get('/', (req, res) => {
    res.redirect('/login/index.html');
});

// API info endpoint (for checking API status)
app.get('/api', (req, res) => {
    res.json({ 
        message: 'IT Inventory Management System API',
        status: 'running',
        endpoints: {
            health: '/health',
            test: '/api/test'
        }
    });
});

// Health check endpoint (for Render)
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ message: 'Backend is running!' });
});

// Listen on PORT
const PORT = process.env.PORT || 5000;

// Start server even if MongoDB connection fails
app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(50));
    console.log('✓ Server started successfully!');
    console.log(`✓ Listening on port ${PORT}`);
    console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✓ Health check: http://0.0.0.0:${PORT}/health`);
    console.log(`✓ API test: http://0.0.0.0:${PORT}/api/test`);
    console.log('='.repeat(50));
});

// Handle process errors
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
    // Don't exit the process
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Don't exit the process - let it continue
});

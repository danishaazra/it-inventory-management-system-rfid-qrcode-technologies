// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB connection with better error handling
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('ERROR: MONGO_URI environment variable is not set');
    console.error('Please set MONGO_URI in your Render environment variables');
}

mongoose.connect(MONGO_URI || '')
  .then(() => {
      console.log('MongoDB Connected successfully');
  })
  .catch(err => {
      console.error('MongoDB connection error:', err.message);
      // Don't exit - let the server continue running
      // The app can still serve other endpoints
  });

// Health check endpoint (for Render)
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ message: 'Backend is running!' });
});

// Listen on PORT
const PORT = process.env.PORT || 5000;

// Start server even if MongoDB connection fails
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
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

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
const bcrypt = require('bcryptjs');
console.log('✓ Dependencies loaded');

const app = express();
// Parse JSON bodies - must be before routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // For form data
// CORS configuration
app.use(cors({
    origin: true, // Allow all origins for development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// MongoDB connection with better error handling
const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB = process.env.MONGO_DB || 'it_inventory';

// Load models
const { User } = require('./models');

// Load API routes
const assetRoutes = require('./routes/assets');
const maintenanceRoutes = require('./routes/maintenance');
const inspectionRoutes = require('./routes/inspections');
const qrcodeRoutes = require('./routes/qrcode');
const reportRoutes = require('./routes/reports');

// Initialize default admin user
async function initializeAdminUser() {
    try {
        if (mongoose.connection.readyState !== 1) {
            console.log('⚠ MongoDB not connected, skipping admin user initialization');
            return;
        }

        // Check if admin user already exists
        const existingAdmin = await User.findOne({ email: 'admin@gmail.com' });
        
        if (existingAdmin) {
            console.log('✓ Admin user already exists');
            // Update password if it's not set or needs to be updated
            if (!existingAdmin.password) {
                const hashedPassword = await bcrypt.hash('admin123', 10);
                existingAdmin.password = hashedPassword;
                existingAdmin.role = 'admin';
                existingAdmin.name = 'admin';
                await existingAdmin.save();
                console.log('✓ Admin user password updated');
            }
            return;
        }

        // Create default admin user
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const adminUser = new User({
            name: 'admin',
            email: 'admin@gmail.com',
            password: hashedPassword,
            role: 'admin',
            created_at: new Date(),
            lastLogin: new Date()
        });

        await adminUser.save();
        console.log('✓ Default admin user created: admin@gmail.com / admin123');
    } catch (error) {
        console.error('✗ Error initializing admin user:', error.message);
    }
}

if (!MONGO_URI) {
    console.warn('WARNING: MONGO_URI environment variable is not set');
    console.warn('MongoDB connection will be skipped. Set MONGO_URI in Render environment variables to enable database connection.');
} else {
    // Only attempt connection if MONGO_URI is provided
    mongoose.connect(MONGO_URI, { dbName: MONGO_DB })
      .then(async () => {
          console.log('✓ MongoDB Connected successfully');
          // Initialize admin user after connection
          await initializeAdminUser();
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

// API Routes (must be before static file serving)
app.use('/api/assets', assetRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/qrcode', qrcodeRoutes);
app.use('/api/reports', reportRoutes);

// Serve static files from root directory (after API routes)
app.use(express.static(path.join(__dirname)));

// Register endpoint (staff only)
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({ 
                ok: false, 
                error: 'Name, email, and password are required' 
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                ok: false, 
                error: 'Invalid email address' 
            });
        }

        // Validate password length
        if (password.length < 6) {
            return res.status(400).json({ 
                ok: false, 
                error: 'Password must be at least 6 characters long' 
            });
        }

        // Only allow staff registration - prevent admin registration
        if (role && role !== 'staff') {
            return res.status(403).json({ 
                ok: false, 
                error: 'Admin accounts cannot be created through registration. Please contact system administrator.' 
            });
        }

        // Check if MongoDB is connected
        if (mongoose.connection.readyState !== 1) {
            return res.status(500).json({ 
                ok: false, 
                error: 'Database connection not available' 
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.trim() });
        if (existingUser) {
            return res.status(400).json({ 
                ok: false, 
                error: 'An account with this email already exists. Please login instead.' 
            });
        }

        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create new user (staff only)
        const newUser = new User({
            name: name.trim(),
            email: email.trim(),
            password: hashedPassword,
            role: 'staff', // Force staff role
            created_at: new Date(),
            lastLogin: new Date()
        });

        await newUser.save();

        return res.json({
            ok: true,
            message: 'Staff account created successfully',
            user: {
                id: newUser._id.toString(),
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ 
            ok: false, 
            error: 'Registration failed: ' + error.message 
        });
    }
});

// Login endpoint (replaces login.php) - auto-detects role from user account
app.post('/api/login', async (req, res) => {
    try {
        console.log('=== LOGIN REQUEST ===');
        console.log('Request body:', req.body);
        console.log('Request body type:', typeof req.body);
        console.log('Request body keys:', Object.keys(req.body || {}));
        console.log('Content-Type:', req.get('Content-Type'));
        console.log('Request method:', req.method);
        
        // Extract email and password from request body
        const email = req.body?.email;
        const password = req.body?.password;
        
        console.log('Extracted email:', email || 'MISSING');
        console.log('Extracted password:', password ? 'present' : 'MISSING');

        // Validation
        if (!email || !password) {
            console.log('Validation failed: missing email or password');
            return res.status(400).json({ 
                ok: false, 
                error: 'Email and password are required' 
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                ok: false, 
                error: 'Invalid email address' 
            });
        }

        // Check if MongoDB is connected
        if (mongoose.connection.readyState !== 1) {
            return res.status(500).json({ 
                ok: false, 
                error: 'Database connection not available' 
            });
        }

        // Check if user exists
        const user = await User.findOne({ email: email.trim() });

        if (!user) {
            return res.status(401).json({ 
                ok: false, 
                error: 'Invalid email or password' 
            });
        }

        // Check if user has a password (for backward compatibility with old users)
        if (!user.password) {
            // Old user without password - allow login but suggest they register
            // For now, we'll allow them to login and update their account
            // In production, you might want to force password reset
            user.lastLogin = new Date();
            await user.save();

            return res.json({
                ok: true,
                user: {
                    id: user._id.toString(),
                    name: user.name,
                    email: user.email,
                    role: user.role
                },
                message: 'Please register to set a password for your account'
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ 
                ok: false, 
                error: 'Invalid email or password' 
            });
        }

        // Update last login time
        user.lastLogin = new Date();
        await user.save();

        // Return user with their role (auto-detected from database)
        return res.json({
            ok: true,
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: user.role // Role is determined from the user's account in database
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ 
            ok: false, 
            error: 'Login failed: ' + error.message 
        });
    }
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

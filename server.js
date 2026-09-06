const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Safe Static File Serving (Exposes only index.html and /images asset directory)
app.use('/images', express.static(path.join(__dirname, 'images')));

// Root route serving index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// MySQL Connection Pool Configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'portfolio_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Enable SSL dynamically for cloud databases (e.g. Aiven MySQL) when DB_SSL is true
if (process.env.DB_SSL === 'true') {
  dbConfig.ssl = { rejectUnauthorized: false };
}

const db = mysql.createPool(dbConfig);

// Test Database Connection
(async () => {
  try {
    const connection = await db.getConnection();
    console.log('✅ Connected to MySQL Database: ' + (process.env.DB_NAME || 'portfolio_db'));
    connection.release();
  } catch (err) {
    console.warn('⚠️ MySQL Connection Warning: Database connection not established yet.');
    console.warn('   Ensure MySQL is running and database configuration in .env is correct.');
  }
})();

// ==========================================
// RATE LIMITING & SECURITY MIDDLEWARE
// ==========================================

// Lightweight sliding-window IP rate limiter for contact form submissions
// Note: In-memory map resets on server restart and provides lightweight single-instance protection
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
const MAX_REQUESTS_PER_WINDOW = 5; // Max 5 submissions per IP in window

const contactRateLimiter = (req, res, next) => {
  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  if (!rateLimitMap.has(clientIp)) {
    rateLimitMap.set(clientIp, []);
  }

  const timestamps = rateLimitMap.get(clientIp).filter(time => now - time < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      success: false,
      error: 'Too many contact form submissions from your IP. Please try again in 15 minutes.'
    });
  }

  timestamps.push(now);
  rateLimitMap.set(clientIp, timestamps);
  next();
};

// ==========================================
// ROUTES & API ENDPOINTS
// ==========================================

// Health Check Endpoint (Suitable for Render health checks & uptime monitoring)
app.get('/api/health', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    const connection = await db.getConnection();
    dbStatus = 'connected';
    connection.release();
  } catch (err) {
    dbStatus = 'disconnected';
  }

  res.json({
    status: 'OK',
    message: 'Portfolio Backend Service is active',
    database: dbStatus
  });
});

// POST Contact Message Endpoint
app.post('/api/contact', contactRateLimiter, async (req, res) => {
  try {
    let { name, email, subject, message } = req.body;

    // String Sanitization & Trimming
    name = (name || '').trim();
    email = (email || '').trim();
    subject = (subject || '').trim();
    message = (message || '').trim();

    // Required Field Validation
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and message are required fields.'
      });
    }

    // Input Length Checks
    if (name.length > 100) {
      return res.status(400).json({ success: false, error: 'Name must be under 100 characters.' });
    }
    if (email.length > 150) {
      return res.status(400).json({ success: false, error: 'Email must be under 150 characters.' });
    }
    if (subject.length > 200) {
      return res.status(400).json({ success: false, error: 'Subject must be under 200 characters.' });
    }
    if (message.length > 5000) {
      return res.status(400).json({ success: false, error: 'Message must be under 5000 characters.' });
    }

    // Email Regex Format Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address.'
      });
    }

    // Parameterized SQL Query to Prevent SQL Injection
    const query = `
      INSERT INTO contact_messages (name, email, subject, message)
      VALUES (?, ?, ?, ?)
    `;
    const [result] = await db.execute(query, [
      name,
      email,
      subject || 'General Inquiry',
      message
    ]);

    console.log(`📩 New message saved from ${name} (ID: ${result.insertId})`);

    return res.status(201).json({
      success: true,
      message: 'Thank you! Your message has been saved successfully.',
      insertedId: result.insertId
    });

  } catch (error) {
    console.error('❌ Error saving contact message:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to save message into database. Please try again later.'
    });
  }
});

// Wildcard Fallback Middleware to serve index.html for UI navigation or 404 JSON for missing API routes
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Central Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`🚀 Portfolio server listening on http://localhost:${PORT}`);
});


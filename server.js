const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MySQL Connection Pool
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'portfolio_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test Database Connection
(async () => {
  try {
    const connection = await db.getConnection();
    console.log('✅ Connected to MySQL Database: ' + (process.env.DB_NAME || 'portfolio_db'));
    connection.release();
  } catch (err) {
    console.warn('⚠️ MySQL Connection Warning: Database connection not established yet.');
    console.warn('   Ensure MySQL is running on localhost:3306 and portfolio_db is created via schema.sql.');
  }
})();

// ==========================================
// ROUTES & API ENDPOINTS
// ==========================================

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Portfolio Backend Service is active' });
});

// POST Contact Message Endpoint
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Input Validation
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and message are required fields.'
      });
    }

    // Insert Message into MySQL Database
    const query = `
      INSERT INTO contact_messages (name, email, subject, message)
      VALUES (?, ?, ?, ?)
    `;
    const [result] = await db.execute(query, [
      name.trim(),
      email.trim(),
      subject ? subject.trim() : 'General Inquiry',
      message.trim()
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
      error: 'Failed to save message into database. Please check MySQL database connection.'
    });
  }
});

// GET All Messages Endpoint (Admin view / Testing)
app.get('/api/messages', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM contact_messages ORDER BY created_at DESC');
    res.json({ success: true, count: rows.length, messages: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});

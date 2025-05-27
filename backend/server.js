// server.js - Main backend server
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Fallback to individual variables if DATABASE_URL not available
  user: process.env.PGUSER || process.env.DB_USER || 'postgres',
  host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
  database: process.env.PGDATABASE || process.env.DB_NAME || 'parks_gardens',
  password: process.env.PGPASSWORD || process.env.DB_PASSWORD || 'password',
  port: process.env.PGPORT || process.env.DB_PORT || 5432,
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error acquiring client', err.stack);
  } else {
    console.log('✅ Database connected successfully');
    release();
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Socket.io for real-time updates
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`User ${socket.id} joined room: ${room}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// ==================== AUTH ROUTES ====================

// Register user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, role, crew_id } = req.body;
    
    // Check if user exists
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const newUser = await pool.query(
      'INSERT INTO users (email, password, name, role, crew_id, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id, email, name, role, crew_id',
      [email, hashedPassword, name, role, crew_id]
    );

    // Generate JWT
    const token = jwt.sign(
      { id: newUser.rows[0].id, role: newUser.rows[0].role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: newUser.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check user exists
    const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.rows[0].password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.rows[0].id, role: user.rows[0].role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '24h' }
    );

    const { password: _, ...userWithoutPassword } = user.rows[0];

    res.json({
      token,
      user: userWithoutPassword
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== TASK ROUTES ====================

// Get all tasks
app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const { date, assigned_to, status } = req.query;
    let query = `
      SELECT t.*, u.name as assigned_to_name, u.crew_id,
             ra.title as risk_assessment_title, ra.hazards, ra.controls,
             s.title as swms_title, s.steps, s.ppe
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN risk_assessments ra ON t.risk_assessment_id = ra.id
      LEFT JOIN swms s ON t.swms_id = s.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (date) {
      query += ` AND DATE(t.scheduled_date) = $${paramCount}`;
      params.push(date);
      paramCount++;
    }

    if (assigned_to) {
      query += ` AND t.assigned_to = $${paramCount}`;
      params.push(assigned_to);
      paramCount++;
    }

    if (status) {
      query += ` AND t.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    query += ' ORDER BY t.scheduled_date ASC';

    const tasks = await pool.query(query, params);
    res.json(tasks.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new task
app.post('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      location,
      estimated_hours,
      priority,
      assigned_to,
      scheduled_date,
      equipment_required,
      risk_assessment_id,
      swms_id,
      recurring_type
    } = req.body;

    const newTask = await pool.query(
      `INSERT INTO tasks (
        title, description, location, estimated_hours, priority,
        assigned_to, scheduled_date, equipment_required, risk_assessment_id,
        swms_id, recurring_type, status, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'assigned', $12, NOW())
      RETURNING *`,
      [
        title, description, location, estimated_hours, priority,
        assigned_to, scheduled_date, equipment_required, risk_assessment_id,
        swms_id, recurring_type, req.user.id
      ]
    );

    // Emit real-time update
    io.emit('task-created', newTask.rows[0]);

    res.status(201).json(newTask.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update task status
app.put('/api/tasks/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, start_time, end_time, incomplete_reason } = req.body;

    const updatedTask = await pool.query(
      `UPDATE tasks SET 
        status = $1, 
        start_time = COALESCE($2, start_time),
        end_time = COALESCE($3, end_time),
        incomplete_reason = COALESCE($4, incomplete_reason),
        updated_at = NOW()
      WHERE id = $5 
      RETURNING *`,
      [status, start_time, end_time, incomplete_reason, id]
    );

    if (updatedTask.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Emit real-time update
    io.emit('task-updated', updatedTask.rows[0]);

    res.json(updatedTask.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== SAFETY DOCUMENT ROUTES ====================

// Get risk assessments
app.get('/api/risk-assessments', authenticateToken, async (req, res) => {
  try {
    const riskAssessments = await pool.query('SELECT * FROM risk_assessments ORDER BY title');
    res.json(riskAssessments.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get SWMS documents
app.get('/api/swms', authenticateToken, async (req, res) => {
  try {
    const swms = await pool.query('SELECT * FROM swms ORDER BY title');
    res.json(swms.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== STAFF ROUTES ====================

// Get all staff
app.get('/api/staff', authenticateToken, async (req, res) => {
  try {
    const staff = await pool.query(`
      SELECT id, name, email, role, crew_id, created_at
      FROM users 
      WHERE role = 'field_staff'
      ORDER BY name
    `);
    res.json(staff.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's tasks (for mobile app)
app.get('/api/my-tasks', authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;
    let query = `
      SELECT t.*, 
             ra.title as risk_assessment_title, ra.hazards, ra.controls,
             s.title as swms_title, s.steps, s.ppe
      FROM tasks t
      LEFT JOIN risk_assessments ra ON t.risk_assessment_id = ra.id
      LEFT JOIN swms s ON t.swms_id = s.id
      WHERE t.assigned_to = $1
    `;
    const params = [req.user.id];

    if (date) {
      query += ' AND DATE(t.scheduled_date) = $2';
      params.push(date);
    }

    query += ' ORDER BY t.scheduled_date ASC';

    const tasks = await pool.query(query, params);
    res.json(tasks.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== DASHBOARD STATS ====================

// Get dashboard statistics
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const stats = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'assigned') as pending,
        COUNT(*) FILTER (WHERE status = 'in-progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'needs-rescheduling') as needs_rescheduling
      FROM tasks 
      WHERE DATE(scheduled_date) = $1
    `, [today]);

    res.json(stats.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Mobile API: http://localhost:${PORT}/api`);
  console.log(`💻 Dashboard API: http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    pool.end();
  });
});
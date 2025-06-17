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
    const { email, password, name, role, crew_id, phone } = req.body;
    
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
      'INSERT INTO users (email, password, name, role, crew_id, phone, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id, email, name, role, crew_id, phone',
      [email, hashedPassword, name, role, crew_id, phone]
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

// Get single task by ID
app.get('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const task = await pool.query(`
      SELECT t.*, u.name as assigned_to_name, u.crew_id,
             ra.title as risk_assessment_title, ra.hazards, ra.controls,
             s.title as swms_title, s.steps, s.ppe
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN risk_assessments ra ON t.risk_assessment_id = ra.id
      LEFT JOIN swms s ON t.swms_id = s.id
      WHERE t.id = $1
    `, [id]);

    if (task.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task.rows[0]);
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

// Update entire task
app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
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
      recurring_type,
      status,
      incomplete_reason
    } = req.body;

    console.log(`🔄 Updating task ${id}:`, { status, incomplete_reason });

    const updatedTask = await pool.query(
      `UPDATE tasks SET 
        title = $1,
        description = $2,
        location = $3,
        estimated_hours = $4,
        priority = $5,
        assigned_to = $6,
        scheduled_date = $7,
        equipment_required = $8,
        risk_assessment_id = $9,
        swms_id = $10,
        recurring_type = $11,
        status = $12,
        incomplete_reason = $13,
        updated_at = NOW()
      WHERE id = $14 
      RETURNING *`,
      [
        title, description, location, estimated_hours, priority,
        assigned_to, scheduled_date, equipment_required, risk_assessment_id,
        swms_id, recurring_type, status, incomplete_reason, id
      ]
    );

    if (updatedTask.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    console.log(`✅ Task ${id} updated. New status: ${updatedTask.rows[0].status}`);

    // Emit real-time update
    io.emit('task-updated', updatedTask.rows[0]);

    res.json(updatedTask.rows[0]);
  } catch (err) {
    console.error('❌ Task update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete task
app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const deletedTask = await pool.query(
      'DELETE FROM tasks WHERE id = $1 RETURNING *',
      [id]
    );

    if (deletedTask.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Emit real-time update
    io.emit('task-deleted', { id: parseInt(id) });

    res.status(204).send(); // No content response for successful delete
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
      SELECT id, name, email, role, crew_id, phone, created_at
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

// Get single staff member by ID
app.get('/api/staff/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const staff = await pool.query(`
      SELECT id, name, email, role, crew_id, phone, created_at
      FROM users 
      WHERE id = $1
    `, [id]);

    if (staff.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    res.json(staff.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update staff member
app.put('/api/staff/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, crew_id, phone, password } = req.body;

    // Check if email is already taken by another user
    const emailCheck = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2', 
      [email, id]
    );
    
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    let updateQuery;
    let params;

    // If password is provided, hash it and update
    if (password && password.trim() !== '') {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      updateQuery = `
        UPDATE users SET 
          name = $1,
          email = $2,
          role = $3,
          crew_id = $4,
          phone = $5,
          password = $6,
          updated_at = NOW()
        WHERE id = $7 
        RETURNING id, name, email, role, crew_id, phone, created_at
      `;
      params = [name, email, role, crew_id, phone, hashedPassword, id];
    } else {
      // Update without changing password
      updateQuery = `
        UPDATE users SET 
          name = $1,
          email = $2,
          role = $3,
          crew_id = $4,
          phone = $5,
          updated_at = NOW()
        WHERE id = $6 
        RETURNING id, name, email, role, crew_id, phone, created_at
      `;
      params = [name, email, role, crew_id, phone, id];
    }

    const updatedStaff = await pool.query(updateQuery, params);

    if (updatedStaff.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Emit real-time update
    io.emit('staff-updated', updatedStaff.rows[0]);

    res.json(updatedStaff.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete staff member
app.delete('/api/staff/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get the staff member details for logging
    const staffMember = await pool.query(
      'SELECT name, email FROM users WHERE id = $1',
      [id]
    );

    if (staffMember.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Start a database transaction to ensure all operations succeed or fail together
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Find all tasks assigned to this staff member
      const assignedTasks = await client.query(
        'SELECT id, title, status FROM tasks WHERE assigned_to = $1',
        [id]
      );

      // Update all their assigned tasks
      if (assignedTasks.rows.length > 0) {
        // Unassign tasks and move incomplete ones to reschedule inbox
        await client.query(
          `UPDATE tasks SET 
            assigned_to = NULL,
            status = CASE 
              WHEN status IN ('assigned', 'in-progress') THEN 'needs-rescheduling'
              ELSE status
            END,
            incomplete_reason = CASE 
              WHEN status IN ('assigned', 'in-progress') THEN CONCAT('Staff member ', $2, ' was removed from the system')
              ELSE incomplete_reason
            END,
            updated_at = NOW()
          WHERE assigned_to = $1`,
          [id, staffMember.rows[0].name]
        );

        console.log(`Unassigned ${assignedTasks.rows.length} tasks from deleted staff member: ${staffMember.rows[0].name}`);
      }

      // Delete the staff member
      const deletedStaff = await client.query(
        'DELETE FROM users WHERE id = $1 RETURNING id, name, email',
        [id]
      );

      // Commit the transaction
      await client.query('COMMIT');

      // Emit real-time updates
      io.emit('staff-deleted', { 
        id: parseInt(id),
        reassignedTasks: assignedTasks.rows.length 
      });

      // If tasks were reassigned, emit task updates too
      if (assignedTasks.rows.length > 0) {
        io.emit('tasks-reassigned', {
          count: assignedTasks.rows.length,
          reason: `Staff member ${staffMember.rows[0].name} was deleted`
        });
      }

      res.json({
        message: `Staff member deleted successfully`,
        deletedStaff: deletedStaff.rows[0],
        reassignedTasks: assignedTasks.rows.length,
        taskDetails: assignedTasks.rows.length > 0 ? 
          `${assignedTasks.rows.length} tasks were unassigned and moved to reschedule inbox` : 
          'No tasks were assigned to this staff member'
      });

    } catch (error) {
      // Rollback the transaction on error
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Delete staff error:', err);
    res.status(500).json({ error: 'Server error while deleting staff member' });
  }
});

// Get all users (including team leaders) - for admin purposes
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    // Only allow team leaders or admins to see all users
    if (req.user.role !== 'team_leader' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const users = await pool.query(`
      SELECT id, name, email, role, crew_id, phone, created_at
      FROM users 
      ORDER BY role, name
    `);
    res.json(users.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user profile (for users to update their own profile)
app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    const userId = req.user.id;

    // Check if email is already taken by another user
    const emailCheck = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2', 
      [email, userId]
    );
    
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    let updateQuery;
    let params;

    // If password is provided, hash it and update
    if (password && password.trim() !== '') {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      updateQuery = `
        UPDATE users SET 
          name = $1,
          email = $2,
          phone = $3,
          password = $4,
          updated_at = NOW()
        WHERE id = $5 
        RETURNING id, name, email, role, crew_id, phone
      `;
      params = [name, email, phone, hashedPassword, userId];
    } else {
      // Update without changing password
      updateQuery = `
        UPDATE users SET 
          name = $1,
          email = $2,
          phone = $3,
          updated_at = NOW()
        WHERE id = $4 
        RETURNING id, name, email, role, crew_id, phone
      `;
      params = [name, email, phone, userId];
    }

    const updatedUser = await pool.query(updateQuery, params);

    res.json(updatedUser.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's tasks (for mobile app) - POSTGRESQL TIMEZONE VERSION
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
      // Use PostgreSQL's timezone conversion
      query += ` AND DATE(t.scheduled_date AT TIME ZONE 'UTC' AT TIME ZONE 'Australia/Sydney') = $2`;
      params.push(date);
      
      console.log(`Filtering tasks for date: ${date} using PostgreSQL timezone conversion`);
    }

    query += ' ORDER BY t.scheduled_date ASC';

    console.log('Executing query:', query);
    console.log('With parameters:', params);

    const tasks = await pool.query(query, params);
    
    console.log(`Found ${tasks.rows.length} tasks for user ${req.user.id} on date ${date}`);
    tasks.rows.forEach(task => {
      console.log(`Task: ${task.title}, Scheduled: ${task.scheduled_date}`);
    });
    
    res.json(tasks.rows);
  } catch (err) {
    console.error('Error in /api/my-tasks:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== MACHINERY ROUTES ====================

// Get all machinery
app.get('/api/machinery', authenticateToken, async (req, res) => {
  try {
    const { classification, status, category } = req.query;
    let query = `
      SELECT e.*, 
             COUNT(tm.id) as task_count,
             COALESCE(SUM(tm.hours_used), 0) as total_task_hours
      FROM equipment e
      LEFT JOIN task_machinery tm ON e.id = tm.equipment_id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (classification) {
      query += ` AND e.classification = $${paramCount}`;
      params.push(classification);
      paramCount++;
    }

    if (status) {
      query += ` AND e.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (category) {
      query += ` AND e.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    query += ' GROUP BY e.id ORDER BY e.name ASC';

    const machinery = await pool.query(query, params);
    res.json(machinery.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get machinery task history
app.get('/api/machinery/:id/history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const history = await pool.query(`
      SELECT t.id, t.title, t.location, t.scheduled_date, t.status,
             tm.hours_used, tm.assigned_at, tm.returned_at, tm.notes,
             tm.cost_code, tm.department_code, tm.project_code,
             u.name as assigned_to_name
      FROM task_machinery tm
      JOIN tasks t ON tm.task_id = t.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE tm.equipment_id = $1
      ORDER BY tm.assigned_at DESC
      LIMIT 50
    `, [id]);

    res.json(history.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new machinery
app.post('/api/machinery', authenticateToken, async (req, res) => {
  try {
    const {
      name, type, classification, category, manufacturer, model,
      asset_number, cost_code, hourly_rate, location, notes
    } = req.body;

    const newMachinery = await pool.query(
      `INSERT INTO equipment (
        name, type, classification, category, manufacturer, model,
        asset_number, cost_code, hourly_rate, location, notes, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'available')
      RETURNING *`,
      [name, type, classification, category, manufacturer, model,
       asset_number, cost_code, hourly_rate, location, notes]
    );

    res.status(201).json(newMachinery.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update machinery
app.put('/api/machinery/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, type, classification, category, manufacturer, model,
      asset_number, cost_code, status, hourly_rate, location, notes
    } = req.body;

    const updatedMachinery = await pool.query(
      `UPDATE equipment SET 
        name = $1, type = $2, classification = $3, category = $4,
        manufacturer = $5, model = $6, asset_number = $7, cost_code = $8,
        status = $9, hourly_rate = $10, location = $11, notes = $12, 
        updated_at = NOW()
      WHERE id = $13 
      RETURNING *`,
      [name, type, classification, category, manufacturer, model,
       asset_number, cost_code, status, hourly_rate, location, notes, id]
    );

    if (updatedMachinery.rows.length === 0) {
      return res.status(404).json({ error: 'Machinery not found' });
    }

    res.json(updatedMachinery.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete machinery
app.delete('/api/machinery/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const deletedMachinery = await pool.query(
      'DELETE FROM equipment WHERE id = $1 RETURNING *',
      [id]
    );

    if (deletedMachinery.rows.length === 0) {
      return res.status(404).json({ error: 'Machinery not found' });
    }

    res.status(204).send();
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

// ==================== TEST ENDPOINT ====================

// Test deployment endpoint
app.get('/api/test-deployment', (req, res) => {
  res.json({ 
    message: 'All endpoints deployed successfully!', 
    timestamp: new Date().toISOString(),
    endpoints: {
      tasks: ['GET /api/tasks', 'GET /api/tasks/:id', 'POST /api/tasks', 'PUT /api/tasks/:id', 'DELETE /api/tasks/:id'],
      staff: ['GET /api/staff', 'GET /api/staff/:id', 'PUT /api/staff/:id', 'DELETE /api/staff/:id'],
      auth: ['POST /api/auth/login', 'POST /api/auth/register']
    }
  });
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
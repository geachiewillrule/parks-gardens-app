-- database/schema.sql
-- Parks & Gardens Database Schema

-- Create database (run this first as superuser)
-- CREATE DATABASE parks_gardens;

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('team_leader', 'field_staff', 'admin')),
    crew_id VARCHAR(50),
    phone VARCHAR(20),
    emergency_contact VARCHAR(255),
    certification_expiry DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Risk Assessments table
CREATE TABLE risk_assessments (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    document_code VARCHAR(50) UNIQUE NOT NULL,
    hazards TEXT[] NOT NULL,
    controls TEXT[] NOT NULL,
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'extreme')),
    created_by INTEGER REFERENCES users(id),
    valid_until DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SWMS (Safe Work Method Statements) table
CREATE TABLE swms (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    document_code VARCHAR(50) UNIQUE NOT NULL,
    steps TEXT[] NOT NULL,
    ppe TEXT[] NOT NULL,
    equipment_required TEXT[],
    created_by INTEGER REFERENCES users(id),
    valid_until DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Equipment table
CREATE TABLE equipment (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    serial_number VARCHAR(100),
    status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'in-use', 'maintenance', 'retired')),
    last_service_date DATE,
    next_service_due DATE,
    current_location VARCHAR(255),
    assigned_to INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255) NOT NULL,
    estimated_hours DECIMAL(4,2) NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    status VARCHAR(50) DEFAULT 'assigned' CHECK (status IN ('assigned', 'in-progress', 'completed', 'cancelled', 'needs-rescheduling')),
    assigned_to INTEGER REFERENCES users(id),
    created_by INTEGER REFERENCES users(id),
    scheduled_date TIMESTAMP NOT NULL,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    actual_hours DECIMAL(4,2),
    equipment_required TEXT[],
    risk_assessment_id INTEGER REFERENCES risk_assessments(id),
    swms_id INTEGER REFERENCES swms(id),
    incomplete_reason TEXT,
    completion_notes TEXT,
    recurring_type VARCHAR(20) CHECK (recurring_type IN ('none', 'daily', 'weekly', 'monthly')),
    recurring_until DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task Photos table (for completion evidence)
CREATE TABLE task_photos (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    photo_url VARCHAR(500) NOT NULL,
    caption TEXT,
    taken_by INTEGER REFERENCES users(id),
    taken_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Safety Acknowledgments table (track who acknowledged what documents)
CREATE TABLE safety_acknowledgments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    risk_assessment_id INTEGER REFERENCES risk_assessments(id),
    swms_id INTEGER REFERENCES swms(id),
    acknowledged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    UNIQUE(task_id, user_id, risk_assessment_id, swms_id)
);

-- Time Entries table (detailed time tracking)
CREATE TABLE time_entries (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    break_duration INTEGER DEFAULT 0, -- minutes
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Equipment Assignments table
CREATE TABLE equipment_assignments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    equipment_id INTEGER REFERENCES equipment(id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    returned_at TIMESTAMP,
    condition_notes TEXT
);

-- Notifications table
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('task_assignment', 'task_update', 'safety_alert', 'equipment_due', 'general')),
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_scheduled_date ON tasks(scheduled_date);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_equipment_status ON equipment(status);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- Insert sample data

-- Sample users
INSERT INTO users (email, password, name, role, crew_id) VALUES 
('sarah.johnson@cityparks.gov', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Sarah Johnson', 'team_leader', 'EAST'),
('john.smith@cityparks.gov', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'John Smith', 'field_staff', 'CREW2'),
('mike.chen@cityparks.gov', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Mike Chen', 'field_staff', 'CREW2'),
('lisa.wong@cityparks.gov', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Lisa Wong', 'field_staff', 'CREW3'),
('david.kim@cityparks.gov', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'David Kim', 'field_staff', 'CREW1');

-- Sample Risk Assessments
INSERT INTO risk_assessments (title, document_code, hazards, controls, risk_level, created_by, valid_until) VALUES 
(
    'Ride-on Mower Operation', 
    'RA-2024-015',
    ARRAY['Moving machinery parts', 'Noise exposure (85+ dB)', 'Fuel handling', 'Slopes and uneven terrain', 'Flying debris'],
    ARRAY['Pre-start equipment inspection', 'Wear hearing protection', 'Maintain 10m exclusion zone', 'Check slope gradient <15°', 'Wear safety glasses and closed footwear'],
    'medium',
    1,
    '2025-12-31'
),
(
    'Hedge Trimming Near Traffic', 
    'RA-2024-023',
    ARRAY['Vehicle traffic proximity', 'Power tool operation', 'Flying debris', 'Repetitive strain', 'Sharp cutting blades'],
    ARRAY['Install traffic control devices', 'Maintain 2m buffer from roadway', 'Regular tool maintenance', 'Rotate workers every 30 minutes', 'Blade guards and emergency stops'],
    'high',
    1,
    '2025-12-31'
);

-- Sample SWMS
INSERT INTO swms (title, document_code, steps, ppe, equipment_required, created_by, valid_until) VALUES 
(
    'Large Area Mowing Procedure', 
    'SWMS-2024-008',
    ARRAY['Conduct pre-start safety check of mower', 'Inspect area for obstacles, debris, and hazards', 'Set up safety barriers and signage', 'Don required PPE (hearing, eye protection)', 'Start mowing following planned pattern', 'Maintain awareness of public and other workers', 'Complete post-operation checks and cleaning'],
    ARRAY['Safety glasses', 'Hearing protection', 'High-vis vest', 'Closed shoes'],
    ARRAY['Ride-on mower', 'Fuel container', 'Safety cones', 'First aid kit'],
    1,
    '2025-12-31'
),
(
    'Roadside Hedge Maintenance', 
    'SWMS-2024-012',
    ARRAY['Set up traffic control (cones, signs)', 'Inspect hedge trimmer and safety features', 'Clear work area of pedestrians', 'Position spotter for traffic watch', 'Begin trimming from traffic-side outward', 'Collect and dispose of trimmings', 'Remove traffic control devices'],
    ARRAY['High-vis vest', 'Safety glasses', 'Cut-resistant gloves', 'Hard hat'],
    ARRAY['Hedge trimmer', 'Safety cones', 'Warning signs', 'Collection bags'],
    1,
    '2025-12-31'
);

-- Sample Equipment
INSERT INTO equipment (name, type, serial_number, status, last_service_date, next_service_due) VALUES 
('Ride-on Mower #3', 'Mower', 'RM2024-003', 'available', '2024-05-20', '2024-08-20'),
('Hedge Trimmer #2', 'Power Tool', 'HT2024-002', 'maintenance', '2024-05-15', '2024-06-15'),
('Chainsaw #1', 'Power Tool', 'CS2024-001', 'available', '2024-05-10', '2024-06-01'),
('Safety Cones (Set of 12)', 'Safety Equipment', 'SC2024-SET1', 'available', '2024-05-25', '2024-11-25');

-- Sample Tasks for today
INSERT INTO tasks (title, description, location, estimated_hours, priority, assigned_to, created_by, scheduled_date, risk_assessment_id, swms_id, equipment_required) VALUES 
(
    'Mow Riverside Park - East Section',
    'Weekly mowing of the eastern lawn areas including around playground and picnic areas',
    'Riverside Park, East Lawn',
    2.5,
    'high',
    2, -- John Smith
    1, -- Created by Sarah Johnson
    '2025-05-27 09:00:00',
    1, -- Ride-on Mower RA
    1, -- Large Area Mowing SWMS
    ARRAY['Ride-on Mower #3', 'Fuel Container']
),
(
    'Trim Hedges - Main Street Median',
    'Trim overgrown hedges along Main Street median strip for visibility and aesthetics',
    'Main Street Median Strip',
    1.5,
    'medium',
    4, -- Lisa Wong
    1, -- Created by Sarah Johnson
    '2025-05-27 13:00:00',
    2, -- Hedge Trimming RA
    2, -- Roadside Hedge SWMS
    ARRAY['Hedge Trimmer #2', 'Safety Cones']
),
(
    'Plant Maintenance - Community Garden',
    'Water, weed, and general maintenance of community garden plots A through D',
    'Community Garden, Plot A-D',
    3.0,
    'low',
    3, -- Mike Chen
    1, -- Created by Sarah Johnson
    '2025-05-27 10:00:00',
    NULL,
    NULL,
    ARRAY['Hand Tools Set', 'Watering Equipment']
);

-- Update functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON equipment FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_risk_assessments_updated_at BEFORE UPDATE ON risk_assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_swms_updated_at BEFORE UPDATE ON swms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
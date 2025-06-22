-- database/schema.sql
-- Parks & Gardens Database Schema - Updated

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
    category VARCHAR(100),
    review_date DATE,
    approval_status VARCHAR(50) DEFAULT 'draft',
    description TEXT,
    file_path VARCHAR(500),
    file_size INTEGER,
    upload_date TIMESTAMP,
    uploaded_by INTEGER REFERENCES users(id),
    created_by INTEGER REFERENCES users(id),
    valid_until DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SWMS (Safe Work Method Statements) table
CREATE TABLE swms_documents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    document_code VARCHAR(50) UNIQUE NOT NULL,
    activity_type VARCHAR(100),
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high')),
    review_date DATE,
    approval_status VARCHAR(50) DEFAULT 'draft',
    description TEXT,
    file_path VARCHAR(500),
    file_size INTEGER,
    upload_date TIMESTAMP,
    uploaded_by INTEGER REFERENCES users(id),
    steps TEXT[],
    ppe TEXT[],
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
    type VARCHAR(100),
    classification VARCHAR(50) CHECK (classification IN ('large_plant', 'small_plant')),
    category VARCHAR(100),
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    asset_number VARCHAR(100),
    cost_code VARCHAR(50),
    status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'out_of_service')),
    hourly_rate DECIMAL(8,2),
    location VARCHAR(255),
    notes TEXT,
    serial_number VARCHAR(100),
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
    large_plant_required JSONB DEFAULT '[]'::jsonb,
    small_plant_required JSONB DEFAULT '[]'::jsonb,
    risk_assessment_id INTEGER REFERENCES risk_assessments(id),
    swms_id INTEGER REFERENCES swms_documents(id),
    incomplete_reason TEXT,
    completion_notes TEXT,
    recurring_type VARCHAR(20) CHECK (recurring_type IN ('none', 'daily', 'weekdays', 'weekly', 'monthly')),
    recurring_weekdays JSONB DEFAULT '[]'::jsonb,
    recurring_until DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recurring task completions table
CREATE TABLE recurring_task_completions (
    id SERIAL PRIMARY KEY,
    base_task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    instance_date DATE NOT NULL,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_by INTEGER REFERENCES users(id),
    completion_notes TEXT,
    actual_hours DECIMAL(4,2),
    UNIQUE(base_task_id, instance_date)
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
    swms_id INTEGER REFERENCES swms_documents(id),
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

-- Task Machinery table (for large/small plant tracking)
CREATE TABLE task_machinery (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    equipment_id INTEGER REFERENCES equipment(id),
    hours_used DECIMAL(4,2),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    returned_at TIMESTAMP,
    notes TEXT,
    cost_code VARCHAR(50),
    department_code VARCHAR(50),
    project_code VARCHAR(50)
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
CREATE INDEX idx_recurring_completions_task_date ON recurring_task_completions(base_task_id, instance_date);
CREATE INDEX idx_recurring_completions_date ON recurring_task_completions(instance_date);

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
CREATE TRIGGER update_swms_documents_updated_at BEFORE UPDATE ON swms_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Price List Management System - Database Schema
-- PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Roles Table
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role_id INTEGER REFERENCES roles(id) NOT NULL,
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories Table
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Brands Table
CREATE TABLE brands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products Table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id VARCHAR(50) UNIQUE NOT NULL,
    brand_id INTEGER REFERENCES brands(id),
    category_id INTEGER REFERENCES categories(id),
    name VARCHAR(255) NOT NULL,
    model_number VARCHAR(100),
    specification TEXT,
    mrp DECIMAL(12, 2),
    dealer_price DECIMAL(12, 2),
    special_price DECIMAL(12, 2),
    stock_status VARCHAR(20) DEFAULT 'In Stock',
    available_quantity INTEGER DEFAULT 0,
    gst_percent DECIMAL(5, 2) DEFAULT 18.00,
    image_url TEXT,
    remarks TEXT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product Assignments (Portfolio mapping)
CREATE TABLE product_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_manager_id UUID REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID REFERENCES users(id),
    UNIQUE(product_manager_id, category_id)
);

-- Price Update Logs
CREATE TABLE price_update_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id),
    updated_by UUID REFERENCES users(id),
    field_name VARCHAR(50) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Login Logs
CREATE TABLE login_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    action VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Favorites (Sales Manager bookmarks)
CREATE TABLE favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id)
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    type VARCHAR(50) DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    related_product_id UUID REFERENCES products(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_name ON products USING gin(to_tsvector('english', name));
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_price_logs_product ON price_update_logs(product_id);
CREATE INDEX idx_price_logs_date ON price_update_logs(updated_at);
CREATE INDEX idx_login_logs_user ON login_logs(user_id);
CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);

-- Insert Default Roles
INSERT INTO roles (name, description) VALUES 
    ('super_admin', 'Full system access'),
    ('product_manager', 'Manages assigned product portfolio'),
    ('sales_manager', 'Read-only access to pricing');

-- Insert Default Super Admin (password: Admin@123 - change immediately)
INSERT INTO users (email, password_hash, first_name, last_name, role_id)
VALUES (
    'admin@company.com',
    '$2b$10$YourHashHereReplaceInProduction',
    'Super',
    'Admin',
    (SELECT id FROM roles WHERE name = 'super_admin')
);

-- Trigger to update 'last_updated' on product changes
CREATE OR REPLACE FUNCTION update_product_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_timestamp
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_product_timestamp();

-- Trigger to log price changes automatically
CREATE OR REPLACE FUNCTION log_price_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.dealer_price IS DISTINCT FROM NEW.dealer_price THEN
        INSERT INTO price_update_logs (product_id, updated_by, field_name, old_value, new_value)
        VALUES (NEW.id, NEW.updated_by, 'dealer_price', OLD.dealer_price::TEXT, NEW.dealer_price::TEXT);
    END IF;
    IF OLD.special_price IS DISTINCT FROM NEW.special_price THEN
        INSERT INTO price_update_logs (product_id, updated_by, field_name, old_value, new_value)
        VALUES (NEW.id, NEW.updated_by, 'special_price', OLD.special_price::TEXT, NEW.special_price::TEXT);
    END IF;
    IF OLD.mrp IS DISTINCT FROM NEW.mrp THEN
        INSERT INTO price_update_logs (product_id, updated_by, field_name, old_value, new_value)
        VALUES (NEW.id, NEW.updated_by, 'mrp', OLD.mrp::TEXT, NEW.mrp::TEXT);
    END IF;
    IF OLD.stock_status IS DISTINCT FROM NEW.stock_status THEN
        INSERT INTO price_update_logs (product_id, updated_by, field_name, old_value, new_value)
        VALUES (NEW.id, NEW.updated_by, 'stock_status', OLD.stock_status, NEW.stock_status);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_price_changes
    AFTER UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION log_price_changes();

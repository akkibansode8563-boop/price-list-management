/**
 * Database Initialization Script
 * Runs schema.sql and seeds the database with a working admin user
 */
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function initDatabase() {
  console.log('🚀 Starting database initialization...\n');

  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  // Only attempt to create database if running locally (no connection string)
  if (!connectionString) {
    const pgPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: 'postgres',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'Admin@123',
    });

    try {
      // Create database if it doesn't exist
      const dbName = process.env.DB_NAME || 'pricelist_db';
      const checkDb = await pgPool.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]
      );
      
      if (checkDb.rows.length === 0) {
        await pgPool.query(`CREATE DATABASE ${dbName}`);
        console.log(`✅ Database "${dbName}" created.`);
      } else {
        console.log(`ℹ️  Database "${dbName}" already exists.`);
      }
    } catch (err) {
      console.error('❌ Error creating database:', err.message);
    } finally {
      await pgPool.end();
    }
  }

  // Now connect to the target database
  const poolConfig = connectionString 
    ? { 
        connectionString,
        ssl: { rejectUnauthorized: false }
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'pricelist_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'Admin@123',
      };

  const pool = new Pool(poolConfig);

  try {
    // Enable UUID extension
    await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    console.log('✅ UUID extension enabled.');

    // Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
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
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS brands (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
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
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_assignments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        product_manager_id UUID REFERENCES users(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        assigned_by UUID REFERENCES users(id),
        UNIQUE(product_manager_id, category_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS price_update_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        product_id UUID REFERENCES products(id),
        updated_by UUID REFERENCES users(id),
        field_name VARCHAR(50) NOT NULL,
        old_value TEXT,
        new_value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS login_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id),
        ip_address INET,
        user_agent TEXT,
        action VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, product_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        type VARCHAR(50) DEFAULT 'info',
        is_read BOOLEAN DEFAULT false,
        related_product_id UUID REFERENCES products(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ All tables created.');

    // Create indexes (ignore errors if they already exist)
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id)`,
      `CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)`,
      `CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active)`,
      `CREATE INDEX IF NOT EXISTS idx_price_logs_product ON price_update_logs(product_id)`,
      `CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`,
    ];

    for (const idx of indexes) {
      await pool.query(idx);
    }
    console.log('✅ Indexes created.');

    // Create triggers
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_product_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.last_updated = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    // Drop and recreate trigger safely
    await pool.query(`DROP TRIGGER IF EXISTS trigger_update_product_timestamp ON products`);
    await pool.query(`
      CREATE TRIGGER trigger_update_product_timestamp
      BEFORE UPDATE ON products
      FOR EACH ROW EXECUTE FUNCTION update_product_timestamp()
    `);

    await pool.query(`
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
      $$ LANGUAGE plpgsql
    `);

    await pool.query(`DROP TRIGGER IF EXISTS trigger_log_price_changes ON products`);
    await pool.query(`
      CREATE TRIGGER trigger_log_price_changes
      AFTER UPDATE ON products
      FOR EACH ROW EXECUTE FUNCTION log_price_changes()
    `);

    console.log('✅ Triggers created.');

    // Seed roles
    await pool.query(`
      INSERT INTO roles (name, description) VALUES 
        ('super_admin', 'Full system access'),
        ('product_manager', 'Manages assigned product portfolio'),
        ('sales_manager', 'Read-only access to pricing')
      ON CONFLICT (name) DO NOTHING
    `);
    console.log('✅ Roles seeded.');

    // Seed admin user with real bcrypt hash
    const adminPassword = 'Admin@123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(adminPassword, salt);

    const adminRoleResult = await pool.query(`SELECT id FROM roles WHERE name = 'super_admin'`);
    const adminRoleId = adminRoleResult.rows[0].id;

    await pool.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role_id)
      VALUES ('admin@company.com', $1, 'Super', 'Admin', $2)
      ON CONFLICT (email) DO UPDATE SET password_hash = $1
    `, [hash, adminRoleId]);
    console.log('✅ Admin user seeded: admin@company.com / Admin@123');

    // Seed sample product manager
    const pmRoleResult = await pool.query(`SELECT id FROM roles WHERE name = 'product_manager'`);
    const pmRoleId = pmRoleResult.rows[0].id;
    const pmHash = await bcrypt.hash('Manager@123', salt);

    await pool.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role_id)
      VALUES ('pm@company.com', $1, 'Product', 'Manager', $2)
      ON CONFLICT (email) DO UPDATE SET password_hash = $1
    `, [pmHash, pmRoleId]);
    console.log('✅ Product Manager seeded: pm@company.com / Manager@123');

    // Seed sample sales manager
    const smRoleResult = await pool.query(`SELECT id FROM roles WHERE name = 'sales_manager'`);
    const smRoleId = smRoleResult.rows[0].id;
    const smHash = await bcrypt.hash('Sales@123', salt);

    await pool.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role_id)
      VALUES ('sales@company.com', $1, 'Sales', 'Manager', $2)
      ON CONFLICT (email) DO UPDATE SET password_hash = $1
    `, [smHash, smRoleId]);
    console.log('✅ Sales Manager seeded: sales@company.com / Sales@123');

    // Seed categories
    const categories = ['Laptops', 'Desktops', 'Monitors', 'Printers', 'Networking', 'Storage', 'Accessories', 'Servers'];
    for (const cat of categories) {
      await pool.query(`INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [cat]);
    }
    console.log('✅ Categories seeded.');

    // Seed brands
    const brands = ['Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'Apple', 'Samsung', 'LG', 'Epson', 'Canon', 'Cisco', 'Seagate'];
    for (const brand of brands) {
      await pool.query(`INSERT INTO brands (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [brand]);
    }
    console.log('✅ Brands seeded.');

    // Get category and brand IDs for sample products
    const catResult = await pool.query('SELECT id, name FROM categories');
    const brandResult = await pool.query('SELECT id, name FROM brands');
    const catMap = Object.fromEntries(catResult.rows.map(r => [r.name, r.id]));
    const brandMap = Object.fromEntries(brandResult.rows.map(r => [r.name, r.id]));

    // Get admin user id
    const adminUser = await pool.query(`SELECT id FROM users WHERE email = 'admin@company.com'`);
    const adminId = adminUser.rows[0].id;

    // Seed sample products
    const sampleProducts = [
      { pid: 'LAP001', brand: 'Dell', cat: 'Laptops', name: 'Dell Inspiron 15 3000', model: 'INS3511', mrp: 55000, dealer: 48000, special: 46500, qty: 50 },
      { pid: 'LAP002', brand: 'HP', cat: 'Laptops', name: 'HP Pavilion 15', model: 'PAV15-EG', mrp: 62000, dealer: 54000, special: 52000, qty: 35 },
      { pid: 'LAP003', brand: 'Lenovo', cat: 'Laptops', name: 'Lenovo IdeaPad 3', model: 'IP3-15', mrp: 48000, dealer: 41000, special: 39500, qty: 40 },
      { pid: 'DES001', brand: 'Dell', cat: 'Desktops', name: 'Dell OptiPlex 3000', model: 'OPT3000', mrp: 45000, dealer: 38000, special: 36500, qty: 20 },
      { pid: 'DES002', brand: 'HP', cat: 'Desktops', name: 'HP EliteDesk 800', model: 'ED800-G9', mrp: 72000, dealer: 63000, special: 61000, qty: 15 },
      { pid: 'MON001', brand: 'LG', cat: 'Monitors', name: 'LG 24" Full HD Monitor', model: '24MK400H', mrp: 12000, dealer: 10500, special: 10000, qty: 80 },
      { pid: 'MON002', brand: 'Samsung', cat: 'Monitors', name: 'Samsung 27" Curved Monitor', model: 'C27F396', mrp: 22000, dealer: 19000, special: 18500, qty: 30 },
      { pid: 'PRT001', brand: 'Epson', cat: 'Printers', name: 'Epson L3150 Ink Tank', model: 'L3150', mrp: 14000, dealer: 12000, special: 11500, qty: 25 },
      { pid: 'PRT002', brand: 'Canon', cat: 'Printers', name: 'Canon PIXMA G2010', model: 'G2010', mrp: 11500, dealer: 9800, special: 9500, qty: 20 },
      { pid: 'NET001', brand: 'Cisco', cat: 'Networking', name: 'Cisco RV345 Router', model: 'RV345-K9', mrp: 35000, dealer: 30000, special: 28000, qty: 10 },
      { pid: 'STO001', brand: 'Seagate', cat: 'Storage', name: 'Seagate 2TB External HDD', model: 'STEA2000400', mrp: 6500, dealer: 5800, special: 5500, qty: 100 },
      { pid: 'ACC001', brand: 'Dell', cat: 'Accessories', name: 'Dell Wireless Keyboard & Mouse', model: 'KM117', mrp: 2500, dealer: 2100, special: 2000, qty: 150 },
    ];

    for (const p of sampleProducts) {
      await pool.query(`
        INSERT INTO products (product_id, brand_id, category_id, name, model_number, mrp, dealer_price, special_price, stock_status, available_quantity, gst_percent, updated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'In Stock', $9, 18.00, $10)
        ON CONFLICT (product_id) DO NOTHING
      `, [p.pid, brandMap[p.brand], catMap[p.cat], p.name, p.model, p.mrp, p.dealer, p.special, p.qty, adminId]);
    }
    console.log('✅ Sample products seeded (12 products).');

    // Assign product manager to some categories
    const pmUser = await pool.query(`SELECT id FROM users WHERE email = 'pm@company.com'`);
    const pmId = pmUser.rows[0].id;

    const assignCategories = ['Laptops', 'Desktops', 'Monitors'];
    for (const cat of assignCategories) {
      await pool.query(`
        INSERT INTO product_assignments (product_manager_id, category_id, assigned_by)
        VALUES ($1, $2, $3)
        ON CONFLICT (product_manager_id, category_id) DO NOTHING
      `, [pmId, catMap[cat], adminId]);
    }
    console.log('✅ Product assignments created.');

    console.log('\n🎉 Database initialization complete!');
    console.log('\n📋 Demo Credentials:');
    console.log('   Admin:           admin@company.com / Admin@123');
    console.log('   Product Manager: pm@company.com / Manager@123');
    console.log('   Sales Manager:   sales@company.com / Sales@123');

  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase();

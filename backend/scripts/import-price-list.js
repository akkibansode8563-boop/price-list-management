/**
 * Price List Excel Importer
 * Imports PRICE LIST .xlsx → PostgreSQL
 *
 * Column mapping:
 *   Item Code       → product_id
 *   Item Description → name
 *   Product Group   → category (auto-created)
 *   NLC             → dealer_price
 *   MOP             → mrp (MOP = Market Operating Price)
 *   ProductManager Code → remarks + product_assignment
 */
require('dotenv').config();
const { Pool } = require('pg');
const xlsx = require('xlsx');
const path = require('path');

const BATCH_SIZE = 100;
const EXCEL_FILE = path.join(__dirname, '..', '..', 'PRICE LIST .xlsx');

// ── PM Code → email mapping (will match to DB users by remarks/code)
// We'll create PM users if they don't exist
const PM_CODE_MAP = {
  'JAYSINGH': { firstName: 'Jay',     lastName: 'Singh',   email: 'jaysingh@company.com' },
  'JEEVANM':  { firstName: 'Jeevan',  lastName: 'M',       email: 'jeevanm@company.com' },
  'SATISH':   { firstName: 'Satish',  lastName: 'Kumar',   email: 'satish@company.com' },
  'UDDHAV':   { firstName: 'Uddhav',  lastName: 'Patil',   email: 'uddhav@company.com' },
  'SANTOSH':  { firstName: 'Santosh', lastName: 'Rao',     email: 'santosh@company.com' },
  'AMIT':     { firstName: 'Amit',    lastName: 'Sharma',  email: 'amit@company.com' },
  'GANESHJ':  { firstName: 'Ganesh',  lastName: 'J',       email: 'ganeshj@company.com' },
};

// ── Brand extraction: detect from product group or description
function extractBrand(productGroup, description) {
  const brands = [
    'DELL', 'HP', 'LENOVO', 'ASUS', 'ACER', 'APPLE', 'SAMSUNG', 'LG',
    'EPSON', 'CANON', 'CISCO', 'SEAGATE', 'WESTERN DIGITAL', 'WD',
    'INTEL', 'AMD', 'NVIDIA', 'KINGSTON', 'SANDISK', 'TRANSCEND',
    'LOGITECH', 'D-LINK', 'DLINK', 'TP-LINK', 'TPLINK', 'NETGEAR',
    'UBIQUITI', 'HIKVISION', 'DAHUA', 'ZEBRA', 'HONEYWELL',
    'MICROSOFT', 'BROTHER', 'RICOH', 'KYOCERA', 'XEROX',
    'COOLER MASTER', 'CORSAIR', 'MSI', 'GIGABYTE', 'ZOTAC',
    'IBALL', 'TVS', 'GODREJ', 'APC', 'EATON', 'LUMINOUS',
  ];
  const text = `${productGroup} ${description}`.toUpperCase();
  for (const brand of brands) {
    if (text.includes(brand)) return brand === 'DLINK' ? 'D-LINK' : 
                                         brand === 'TPLINK' ? 'TP-LINK' :
                                         brand === 'WD' ? 'WESTERN DIGITAL' : brand;
  }
  return 'OTHER';
}

// ── Main importer
async function importPriceList() {
  console.log('═══════════════════════════════════════════');
  console.log('  PRICE LIST IMPORTER');
  console.log('═══════════════════════════════════════════\n');

  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
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
    // ── Step 1: Read Excel
    console.log('📂 Reading Excel file...');
    const workbook = xlsx.readFile(EXCEL_FILE);
    const ws = workbook.Sheets['Sheet2'];
    const rawData = xlsx.utils.sheet_to_json(ws, { defval: '' });
    console.log(`   ✅ Loaded ${rawData.length.toLocaleString()} rows\n`);

    // ── Step 2: Get admin user ID
    const adminResult = await pool.query(`SELECT id FROM users WHERE email = 'admin@company.com'`);
    if (adminResult.rows.length === 0) throw new Error('Admin user not found. Run npm run db:init first.');
    const adminId = adminResult.rows[0].id;

    const pmRoleResult = await pool.query(`SELECT id FROM roles WHERE name = 'product_manager'`);
    const pmRoleId = pmRoleResult.rows[0].id;

    // ── Step 3: Create Product Manager users
    console.log('👤 Creating/verifying Product Manager users...');
    const bcrypt = require('bcryptjs');
    const pmIdMap = {}; // PM_CODE → DB user UUID

    for (const [code, info] of Object.entries(PM_CODE_MAP)) {
      const existing = await pool.query(`SELECT id FROM users WHERE email = $1`, [info.email]);
      if (existing.rows.length > 0) {
        pmIdMap[code] = existing.rows[0].id;
        console.log(`   ℹ️  PM exists: ${code} → ${info.email}`);
      } else {
        const hash = await bcrypt.hash('Manager@123', 10);
        const result = await pool.query(`
          INSERT INTO users (email, password_hash, first_name, last_name, role_id)
          VALUES ($1, $2, $3, $4, $5) RETURNING id
        `, [info.email, hash, info.firstName, info.lastName, pmRoleId]);
        pmIdMap[code] = result.rows[0].id;
        console.log(`   ✅ Created PM: ${code} → ${info.email}`);
      }
    }

    // ── Step 4: Create all categories (Product Groups)
    console.log('\n📁 Creating categories from Product Groups...');
    const groups = [...new Set(rawData.map(r => (r['Product Group'] || 'UNCATEGORIZED').trim()))];
    const categoryIdMap = {}; // groupName → DB category id

    await Promise.all(groups.map(async group => {
      const result = await pool.query(
        `INSERT INTO categories (name, created_by) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
        [group, adminId]
      );
      categoryIdMap[group] = result.rows[0].id;
    }));
    console.log(`   ✅ ${groups.length} categories ready\n`);

    // ── Step 5: Create all brands
    console.log('🏷️  Creating brands...');
    const allBrands = new Set();
    rawData.forEach(r => allBrands.add(extractBrand(r['Product Group'] || '', r['Item Description'] || '')));
    const brandIdMap = {};

    await Promise.all(Array.from(allBrands).map(async brand => {
      const result = await pool.query(
        `INSERT INTO brands (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id`, 
        [brand]
      );
      brandIdMap[brand] = result.rows[0].id;
    }));
    console.log(`   ✅ ${allBrands.size} brands ready\n`);

    // ── Step 6: Import products in batches
    console.log('📦 Importing products...');
    const stats = { inserted: 0, updated: 0, skipped: 0, errors: [] };
    const startTime = Date.now();

    // Process in chunks concurrently using pool
    for (let i = 0; i < rawData.length; i += BATCH_SIZE) {
      const batch = rawData.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async row => {
        try {
          const productId = (row['Item Code '] || '').toString().trim();
          const name      = (row['Item Description'] || '').toString().trim();
          const group     = (row['Product Group'] || 'UNCATEGORIZED').toString().trim();
          const nlc       = parseFloat(row['NLC']) || 0;
          const mop       = parseFloat(row['MOP']) || 0;
          const pmCode    = (row['ProductManager Code'] || '').toString().trim();

          if (!productId || !name) {
            stats.skipped++;
            return;
          }

          const categoryId = categoryIdMap[group];
          const brand = extractBrand(group, name);
          const brandId = brandIdMap[brand];

          const dealerPrice = nlc;
          const mrp = mop > 0 ? mop : (nlc > 0 ? Math.round(nlc * 1.15) : 0);
          const specialPrice = nlc > 0 ? Math.round(nlc * 0.98) : 0; 
          const stockStatus = nlc > 0 ? 'In Stock' : 'Out of Stock';
          const pmId = pmIdMap[pmCode] || adminId;
          const remarks = pmCode || null;

          const existing = await pool.query(`SELECT id FROM products WHERE product_id = $1`, [productId]);

          if (existing.rows.length > 0) {
            await pool.query(`
              UPDATE products SET
                name = $1, brand_id = $2, category_id = $3,
                dealer_price = $4, mrp = $5, special_price = $6,
                stock_status = $7, remarks = $8, updated_by = $9,
                is_active = true
              WHERE product_id = $10
            `, [name, brandId, categoryId, dealerPrice, mrp, specialPrice,
                stockStatus, remarks, pmId, productId]);
            stats.updated++;
          } else {
            await pool.query(`
              INSERT INTO products (
                product_id, name, brand_id, category_id,
                dealer_price, mrp, special_price,
                stock_status, available_quantity,
                gst_percent, remarks, updated_by
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            `, [productId, name, brandId, categoryId,
                dealerPrice, mrp, specialPrice,
                stockStatus, 0, 18.00, remarks, pmId]);
            stats.inserted++;
          }
        } catch (rowErr) {
          stats.errors.push({ code: row['Item Code '], error: rowErr.message });
        }
      }));

      // Progress
      const done = Math.min(i + BATCH_SIZE, rawData.length);
      const pct = ((done / rawData.length) * 100).toFixed(1);
      process.stdout.write(`\r   Progress: ${done.toLocaleString()}/${rawData.length.toLocaleString()} (${pct}%) — ✅ ${stats.inserted} new | 🔄 ${stats.updated} updated | ⏭ ${stats.skipped} skipped`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n');

    // ── Step 7: Create product assignments (PM → categories they own)
    console.log('🔗 Creating product assignments...');
    const pmCatAssignments = {};
    rawData.forEach(r => {
      const pmCode = (r['ProductManager Code'] || '').trim();
      const group  = (r['Product Group'] || 'UNCATEGORIZED').trim();
      if (pmCode && pmIdMap[pmCode]) {
        if (!pmCatAssignments[pmCode]) pmCatAssignments[pmCode] = new Set();
        pmCatAssignments[pmCode].add(group);
      }
    });

    let assignCount = 0;
    for (const [pmCode, catSet] of Object.entries(pmCatAssignments)) {
      const pmId = pmIdMap[pmCode];
      for (const group of catSet) {
        const catId = categoryIdMap[group];
        if (catId) {
          await pool.query(`
            INSERT INTO product_assignments (product_manager_id, category_id, assigned_by)
            VALUES ($1, $2, $3)
            ON CONFLICT (product_manager_id, category_id) DO NOTHING
          `, [pmId, catId, adminId]);
          assignCount++;
        }
      }
    }
    console.log(`   ✅ ${assignCount} category assignments created\n`);

    // ── Final report
    const totalProducts = await pool.query(`SELECT COUNT(*) FROM products WHERE is_active = true`);
    
    console.log('═══════════════════════════════════════════');
    console.log('  IMPORT COMPLETE');
    console.log('═══════════════════════════════════════════');
    console.log(`  ⏱️  Time taken:    ${elapsed}s`);
    console.log(`  ✅ Inserted:      ${stats.inserted.toLocaleString()}`);
    console.log(`  🔄 Updated:       ${stats.updated.toLocaleString()}`);
    console.log(`  ⏭️  Skipped:       ${stats.skipped.toLocaleString()}`);
    console.log(`  ❌ Errors:        ${stats.errors.length}`);
    console.log(`  📦 Total in DB:   ${parseInt(totalProducts.rows[0].count).toLocaleString()}`);

    if (stats.errors.length > 0) {
      console.log('\n  First 10 errors:');
      stats.errors.slice(0, 10).forEach(e => console.log(`    • ${e.code}: ${e.error}`));
    }

    console.log('\n  PM Users created (login with Manager@123):');
    for (const [code, info] of Object.entries(PM_CODE_MAP)) {
      console.log(`    ${code.padEnd(12)} → ${info.email}`);
    }

  } catch (err) {
    console.error('\n❌ Import failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

importPriceList();

/**
 * Fix PM ownership:
 * 1. Remove dummy pm@company.com's stale category assignments
 * 2. Verify product_assignments match updated_by ownership
 * 3. Print final clean summary
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'pricelist_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Admin@123',
});

async function fix() {
  console.log('🔧 Fixing PM data...\n');

  // 1. Remove dummy PM's stale assignments (pm@company.com was a placeholder)
  const dummyPm = await pool.query(`SELECT id FROM users WHERE email = 'pm@company.com'`);
  if (dummyPm.rows.length > 0) {
    const dummyId = dummyPm.rows[0].id;
    const del = await pool.query(
      `DELETE FROM product_assignments WHERE product_manager_id = $1`, [dummyId]
    );
    console.log(`✅ Removed ${del.rowCount} stale assignments from dummy pm@company.com`);
  }

  // 2. Verify: for each real PM, ensure product_assignments covers all their product groups
  const realPMs = await pool.query(`
    SELECT u.id, u.email, u.first_name, u.last_name
    FROM users u JOIN roles r ON u.role_id = r.id
    WHERE r.name = 'product_manager' AND u.email != 'pm@company.com'
  `);

  const adminId = (await pool.query(`SELECT id FROM users WHERE email = 'admin@company.com'`)).rows[0].id;

  let totalFixed = 0;
  for (const pm of realPMs.rows) {
    // Get all distinct categories this PM owns products in (via updated_by)
    const cats = await pool.query(`
      SELECT DISTINCT category_id FROM products
      WHERE updated_by = $1 AND is_active = true
    `, [pm.id]);

    for (const cat of cats.rows) {
      const res = await pool.query(`
        INSERT INTO product_assignments (product_manager_id, category_id, assigned_by)
        VALUES ($1, $2, $3)
        ON CONFLICT (product_manager_id, category_id) DO NOTHING
      `, [pm.id, cat.category_id, adminId]);
      if (res.rowCount > 0) totalFixed++;
    }
  }
  console.log(`✅ ${totalFixed} missing assignments inserted`);

  // 3. Final summary per PM
  console.log('\n═══════════════════════════════════════════════');
  console.log('  FINAL PM PORTFOLIO SUMMARY');
  console.log('═══════════════════════════════════════════════');
  console.log('  Column Mapping:');
  console.log('    Item Code        → product_id (unique key)');
  console.log('    Item Description → name');
  console.log('    Product Group    → category');
  console.log('    NLC              → dealer_price (Net Landed Cost)');
  console.log('    MOP              → mrp (Market Operating Price)');
  console.log('    PM Code          → product_manager assignment');
  console.log('');

  for (const pm of realPMs.rows) {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN dealer_price > 0 THEN 1 ELSE 0 END) as priced,
        COUNT(DISTINCT category_id) as groups,
        MIN(dealer_price) FILTER (WHERE dealer_price > 0) as min_nlc,
        MAX(dealer_price) FILTER (WHERE dealer_price > 0) as max_nlc,
        ROUND(AVG(dealer_price) FILTER (WHERE dealer_price > 0)) as avg_nlc
      FROM products WHERE updated_by = $1 AND is_active = true
    `, [pm.id]);

    const assignments = await pool.query(`
      SELECT COUNT(*) FROM product_assignments WHERE product_manager_id = $1
    `, [pm.id]);

    const s = stats.rows[0];
    console.log(`\n  ${pm.first_name} ${pm.last_name}`);
    console.log(`    Login:      ${pm.email} / Manager@123`);
    console.log(`    Products:   ${s.total} total | ${s.priced} with NLC`);
    console.log(`    Categories: ${assignments.rows[0].count} assigned`);
    console.log(`    NLC Range:  ₹${parseFloat(s.min_nlc||0).toLocaleString('en-IN')} – ₹${parseFloat(s.max_nlc||0).toLocaleString('en-IN')} (avg ₹${parseFloat(s.avg_nlc||0).toLocaleString('en-IN')})`);
  }

  const total = await pool.query(`SELECT COUNT(*) FROM products WHERE is_active = true`);
  console.log(`\n  TOTAL IN DATABASE: ${parseInt(total.rows[0].count).toLocaleString()} products`);

  await pool.end();
  console.log('\n✅ Done.\n');
}

fix().catch(e => { console.error(e); process.exit(1); });

/**
 * Verify PM portfolio bifurcation — full audit
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

async function audit() {
  console.log('═══════════════════════════════════════════════');
  console.log('  PM PORTFOLIO AUDIT');
  console.log('═══════════════════════════════════════════════\n');

  // 1. All PM users
  const users = await pool.query(`
    SELECT u.id, u.email, u.first_name, u.last_name, r.name as role
    FROM users u JOIN roles r ON u.role_id = r.id
    WHERE r.name = 'product_manager'
    ORDER BY u.first_name
  `);
  console.log(`PM Users in DB: ${users.rows.length}`);
  users.rows.forEach(u => console.log(`  • ${u.first_name} ${u.last_name} | ${u.email}`));

  // 2. Per PM — product count & categories
  console.log('\n─── Per PM Portfolio ───');
  for (const pm of users.rows) {
    const products = await pool.query(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN dealer_price > 0 THEN 1 ELSE 0 END) as with_price,
             COUNT(DISTINCT category_id) as categories
      FROM products
      WHERE updated_by = $1 AND is_active = true
    `, [pm.id]);

    const cats = await pool.query(`
      SELECT DISTINCT c.name
      FROM products p JOIN categories c ON p.category_id = c.id
      WHERE p.updated_by = $1 AND p.is_active = true
      ORDER BY c.name
    `, [pm.id]);

    const p = products.rows[0];
    console.log(`\n  ${pm.first_name} ${pm.last_name} (${pm.email})`);
    console.log(`    Products: ${p.total} total | ${p.with_price} with NLC price | ${p.categories} product groups`);
    console.log(`    Groups: ${cats.rows.map(r => r.name).join(', ').substring(0, 120)}${cats.rows.length > 5 ? '...' : ''}`);
  }

  // 3. Product assignments table
  const assignments = await pool.query(`
    SELECT u.first_name || ' ' || u.last_name as pm_name,
           COUNT(pa.category_id) as assigned_categories
    FROM product_assignments pa
    JOIN users u ON pa.product_manager_id = u.id
    GROUP BY u.id, u.first_name, u.last_name
    ORDER BY assigned_categories DESC
  `);
  console.log('\n─── product_assignments table ───');
  assignments.rows.forEach(r => 
    console.log(`  ${r.pm_name}: ${r.assigned_categories} categories assigned`)
  );

  // 4. Overall stats
  const total = await pool.query(`SELECT COUNT(*) FROM products WHERE is_active = true`);
  const cats = await pool.query(`SELECT COUNT(*) FROM categories`);
  const brands = await pool.query(`SELECT COUNT(*) FROM brands`);
  console.log(`\n─── Database Summary ───`);
  console.log(`  Total products:  ${total.rows[0].count}`);
  console.log(`  Categories:      ${cats.rows[0].count}`);
  console.log(`  Brands:          ${brands.rows[0].count}`);

  // 5. Sample products per PM
  console.log('\n─── Sample Products per PM ───');
  for (const pm of users.rows.slice(0, 3)) {
    const sample = await pool.query(`
      SELECT p.product_id, p.name, p.dealer_price, p.mrp, c.name as category
      FROM products p JOIN categories c ON p.category_id = c.id
      WHERE p.updated_by = $1 AND p.is_active = true AND p.dealer_price > 0
      ORDER BY p.dealer_price DESC LIMIT 3
    `, [pm.id]);
    console.log(`\n  ${pm.first_name} ${pm.last_name}:`);
    sample.rows.forEach(r => 
      console.log(`    [${r.product_id}] ${r.name.substring(0,50)} | NLC: ₹${r.dealer_price} | MOP: ₹${r.mrp} | ${r.category}`)
    );
  }

  await pool.end();
}

audit().catch(e => { console.error(e); process.exit(1); });

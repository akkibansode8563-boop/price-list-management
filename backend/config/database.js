const { Pool } = require('pg');
require('dotenv').config();

// Prioritize Vercel Postgres URL or generic DATABASE_URL
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

const poolConfig = connectionString 
  ? {
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: process.env.NODE_ENV === 'production' && process.env.DB_SSL !== 'false' 
           ? { rejectUnauthorized: false } 
           : false,
    }
  : {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: process.env.NODE_ENV === 'production' && process.env.DB_SSL !== 'false' 
           ? { rejectUnauthorized: false } 
           : false,
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool;

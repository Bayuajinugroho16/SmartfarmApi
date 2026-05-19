const { Pool } = require('pg');

const pool = new Pool({
  host: 'aws-1-ap-southeast-2.pooler.supabase.com',
  port: 6543,
  user: 'postgres.qaavjrteoqwlnxdrpygn',  // Perhatikan user format
  password: process.env.DB_PASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

module.exports = pool;
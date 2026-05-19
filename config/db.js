const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:bayuaji161104@db.qaavjrteoqwlnxdrpygn.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

module.exports = pool;
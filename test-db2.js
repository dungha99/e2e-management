require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    host: process.env.E2E_DB_HOST,
    port: process.env.E2E_DB_PORT,
    database: process.env.E2E_DB_NAME,
    user: process.env.E2E_DB_USER,
    password: process.env.E2E_DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name ILIKE '%agent%';
    `);
    console.log("Tables containing 'agent':", res.rows.map(r => r.table_name));
    
    // Also list all tables just in case
    const all = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    console.log("All tables in E2E DB:", all.rows.map(r => r.table_name).join(', '));
  } catch (e) {
    console.error("DB Error:", e);
  } finally {
    await pool.end();
  }
}
main();

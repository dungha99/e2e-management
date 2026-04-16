
const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function checkConnectors() {
  const pool = new Pool({
    host: process.env.E2E_DB_HOST,
    port: parseInt(process.env.E2E_DB_PORT || "5432"),
    database: process.env.E2E_DB_NAME,
    user: process.env.E2E_DB_USER,
    password: process.env.E2E_DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const res = await pool.query("SELECT * FROM api_connectors WHERE base_url LIKE '%zl.vucar.vn%'");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkConnectors();

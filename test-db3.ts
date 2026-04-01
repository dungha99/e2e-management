import { Pool } from 'pg'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function main() {
  const pool = new Pool({
    host: process.env.E2E_DB_HOST,
    port: parseInt(process.env.E2E_DB_PORT || '5432'),
    database: process.env.E2E_DB_NAME,
    user: process.env.E2E_DB_USER,
    password: process.env.E2E_DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  })
  
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name ILIKE '%agent%' OR table_name ILIKE '%output%')
    `)
    console.log("Found tables:", res.rows.map(r => r.table_name))
  } catch (e) {
    console.error("DB Error:", e)
  } finally {
    await pool.end()
  }
}
main()

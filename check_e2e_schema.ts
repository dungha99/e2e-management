import { Client } from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const client = new Client({
    host: process.env.E2E_DB_HOST,
    port: parseInt(process.env.E2E_DB_PORT || "5432"),
    user: process.env.E2E_DB_USER,
    password: process.env.E2E_DB_PASSWORD,
    database: process.env.E2E_DB_NAME,
    ssl: false,
  });

  try {
    await client.connect();
    console.log("Connected to E2E_DB");
    
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('summary_properties', 'chat_summary')
    `);
    console.log("Tables found:", res.rows);

    if (res.rows.length > 0) {
        const colRes = await client.query(`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name IN ('summary_properties', 'chat_summary')
            ORDER BY table_name, ordinal_position
        `);
        console.log("Columns:", colRes.rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

// Manually parse .env.local
const envFile = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf-8");
const env = {};
envFile.split("\n").forEach(line => {
    const [key, value] = line.split("=");
    if (key && value) env[key.trim()] = value.trim();
});

async function main() {
  const client = new Client({
    host: env.E2E_DB_HOST,
    port: parseInt(env.E2E_DB_PORT || "5432"),
    user: env.E2E_DB_USER,
    password: env.E2E_DB_PASSWORD,
    database: env.E2E_DB_NAME,
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

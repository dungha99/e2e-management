const { Client } = require('pg');

async function checkSlowValue() {
    const client = new Client({
        host: 'vucar-prod-read-replica.c9i2a86e2gfp.ap-southeast-1.rds.amazonaws.com',
        port: 5432,
        database: 'vucar-v2',
        user: 'postgres',
        password: 'vucar2023**',
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const res2 = await client.query(`
      SELECT metadata, created_at, lead_id
      FROM sale_activities
      WHERE metadata->>'field_name' = 'intentionLead'
      ORDER BY created_at DESC
      LIMIT 10
    `);

        console.log("\\nRecent intentionLead sale_activities:");
        console.dir(res2.rows, { depth: null });
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkSlowValue();

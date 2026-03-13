import { e2eQuery } from '../lib/db';

async function createTable() {
  try {
    await e2eQuery(`CREATE TABLE IF NOT EXISTS ai_process_blacklist (
      car_id UUID PRIMARY KEY, 
      created_at TIMESTAMP DEFAULT NOW()
    );`);
    console.log('Table ai_process_blacklist created');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

createTable();

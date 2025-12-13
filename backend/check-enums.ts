import 'dotenv/config';
import { Client } from 'pg';

async function checkEnums() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('🔌 Connected to database');

  try {
    const result = await client.query(`
      SELECT n.nspname as schema, t.typname as name, e.enumlabel as value
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid  
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      ORDER BY t.typname, e.enumsortorder;
    `);
    
    console.log('\n📊 Existing enum types:');
    let currentEnum = '';
    for (const row of result.rows) {
      if (row.name !== currentEnum) {
        console.log(`\n${row.name}:`);
        currentEnum = row.name;
      }
      console.log(`  - ${row.value}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkEnums();

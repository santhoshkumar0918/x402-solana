import 'dotenv/config';
import { Client } from 'pg';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

async function dropAndReseed() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('🔌 Connected to database');

  try {
    // Drop zk_keys table to allow TypeORM to recreate it
    console.log('🗑️  Dropping zk_keys table...');
    await client.query('DROP TABLE IF EXISTS zk_keys CASCADE');
    console.log('✅ Table dropped');

    // Also drop other tables that have schema mismatches
    console.log('🗑️  Dropping other tables with schema mismatches...');
    await client.query('DROP TABLE IF EXISTS payment_sessions CASCADE');
    await client.query('DROP TABLE IF EXISTS audit_events CASCADE');
    await client.query('DROP TABLE IF EXISTS content_listings CASCADE');
    await client.query('DROP TABLE IF EXISTS credential_issuers CASCADE');
    await client.query('DROP TABLE IF EXISTS merkle_roots CASCADE');
    await client.query('DROP TABLE IF EXISTS cross_chain_transactions CASCADE');
    
    // Drop enum types
    console.log('🗑️  Dropping enum types...');
    await client.query('DROP TYPE IF EXISTS payment_sessions_status_enum CASCADE');
    await client.query('DROP TYPE IF EXISTS cross_chain_transactions_status_enum CASCADE');
    await client.query('DROP TYPE IF EXISTS audit_events_event_type_enum CASCADE');
    await client.query('DROP TYPE IF EXISTS zk_keys_circuit_name_enum CASCADE');
    console.log('✅ All tables and enums dropped - TypeORM will recreate them');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

dropAndReseed()
  .then(() => {
    console.log('\n✅ Database reset complete! Restart the backend to recreate tables.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Failed:', err);
    process.exit(1);
  });

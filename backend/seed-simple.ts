import 'dotenv/config';
import { createConnection } from 'typeorm';
import { ZKKey } from './src/database/entities/zk-key.entity';
import { CircuitType } from './src/database/entities/zk-key.entity';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

async function seedZKKeys() {
  console.log('🌱 Seeding ZK verification keys...');

  const connection = await createConnection({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [ZKKey],
    synchronize: false,
    ssl: { rejectUnauthorized: false },
  });

  const zkKeyRepository = connection.getRepository(ZKKey);
  const CIRCUITS_PATH = join(__dirname, '..', 'contracts', 'circuits', 'build');

  async function seedCircuit(
    circuitType: CircuitType,
    version: string,
    active: boolean
  ) {
    const baseName = circuitType.toLowerCase();
    const versionSuffix = version === 'v2' ? '_v2' : '';
    
    const vkeyPath = join(CIRCUITS_PATH, `verification_key_${baseName}${versionSuffix}.json`);
    
    if (!existsSync(vkeyPath)) {
      console.log(`⚠️  Skipping ${circuitType} ${version} - verification key not found`);
      return;
    }

    try {
      const vkeyData = JSON.parse(readFileSync(vkeyPath, 'utf-8'));
      
      const relativePaths = {
        vkeyPath: `circuits/build/verification_key_${baseName}${versionSuffix}.json`,
        zkeyPath: `circuits/build/${baseName}_0001${versionSuffix}.zkey`,
        wasmPath: `circuits/build/${baseName}_js/${baseName}.wasm`,
      };

      const existingKey = await connection.query(
        'SELECT * FROM zk_keys WHERE circuit_name = $1 AND version = $2',
        [circuitType, version]
      );

      if (existingKey.length > 0) {
        console.log(`⏭️  ${circuitType} ${version} already exists, skipping...`);
        return;
      }

      await connection.query(
        `INSERT INTO zk_keys (circuit_name, version, vkey_path, zkey_path, wasm_path, vkey_data, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          circuitType,
          version,
          relativePaths.vkeyPath,
          relativePaths.zkeyPath,
          relativePaths.wasmPath,
          vkeyData,
          active,
        ]
      );

      console.log(`✅ Seeded ${circuitType} ${version} (active: ${active})`);
    } catch (error) {
      console.error(`❌ Failed to seed ${circuitType} ${version}:`, error.message);
    }
  }

  try {
    await seedCircuit(CircuitType.SPEND, 'v2', true);
    await seedCircuit(CircuitType.CREDENTIAL, 'v2', true);
    await seedCircuit(CircuitType.SPEND, 'v1', false);
    await seedCircuit(CircuitType.CREDENTIAL, 'v1', false);

    console.log('🎉 ZK keys seeding completed!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  } finally {
    await connection.close();
  }
}

seedZKKeys()
  .then(() => {
    console.log('✨ Seed script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seed script failed:', error);
    process.exit(1);
  });

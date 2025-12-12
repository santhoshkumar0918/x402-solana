import 'dotenv/config';
import { createConnection } from 'typeorm';
import { ZKKey } from './src/database/entities/zk-key.entity';
import { CircuitType } from './src/database/entities/zk-key.entity';
import { readFileSync } from 'fs';
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

  try {
    // Spend v2
    const spendVkeyPath = join(CIRCUITS_PATH, 'verification_key_spend_v2.json');
    const spendVkeyData = JSON.parse(readFileSync(spendVkeyPath, 'utf-8'));
    
    await zkKeyRepository.save({
      circuitName: CircuitType.SPEND,
      version: 'v2',
      vkeyPath: spendVkeyPath,
      zkeyPath: join(CIRCUITS_PATH, 'spend_0001_v2.zkey'),
      wasmPath: join(CIRCUITS_PATH, 'spend_js', 'spend.wasm'),
      vkeyData: spendVkeyData,
      active: true,
    });
    console.log('✅ Seeded spend circuit v2');

    // Credential v2
    const credentialVkeyPath = join(CIRCUITS_PATH, 'verification_key_credential_v2.json');
    const credentialVkeyData = JSON.parse(readFileSync(credentialVkeyPath, 'utf-8'));
    
    await zkKeyRepository.save({
      circuitName: CircuitType.CREDENTIAL,
      version: 'v2',
      vkeyPath: credentialVkeyPath,
      zkeyPath: join(CIRCUITS_PATH, 'credential_0001_v2.zkey'),
      wasmPath: join(CIRCUITS_PATH, 'credential_js', 'credential.wasm'),
      vkeyData: credentialVkeyData,
      active: true,
    });
    console.log('✅ Seeded credential circuit v2');

    console.log('🎉 ZK keys seeding completed!');
  } catch (error) {
    console.error('❌ Error seeding ZK keys:', error);
    throw error;
  } finally {
    await connection.close();
  }
}

seedZKKeys()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { ZKKey } from './database/entities/zk-key.entity';
import { CircuitType } from './database/entities/zk-key.entity';
import { readFile } from 'fs/promises';
import { join } from 'path';

async function seedZKKeys() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  const zkKeyRepository = dataSource.getRepository(ZKKey);

  const CIRCUITS_PATH = join(__dirname, '..', '..', 'contracts', 'circuits', 'build');

  console.log('🌱 Seeding ZK verification keys...');

  try {
    // Seed spend circuit keys (v2)
    const spendVkeyPath = join(CIRCUITS_PATH, 'verification_key_spend_v2.json');
    const spendVkeyData = JSON.parse(await readFile(spendVkeyPath, 'utf-8'));
    
    const spendKey = zkKeyRepository.create({
      circuit_name: CircuitType.SPEND,
      version: 'v2',
      vkey_path: spendVkeyPath,
      zkey_path: join(CIRCUITS_PATH, 'spend_0001_v2.zkey'),
      wasm_path: join(CIRCUITS_PATH, 'spend_js', 'spend.wasm'),
      vkey_data: spendVkeyData,
      active: true,
    } as any);
    await zkKeyRepository.save(spendKey);
    console.log('✅ Seeded spend circuit verification key (v2)');

    // Seed credential circuit keys (v2)
    const credentialVkeyPath = join(CIRCUITS_PATH, 'verification_key_credential_v2.json');
    const credentialVkeyData = JSON.parse(await readFile(credentialVkeyPath, 'utf-8'));
    
    const credentialKey = zkKeyRepository.create({
      circuit_name: CircuitType.CREDENTIAL,
      version: 'v2',
      vkey_path: credentialVkeyPath,
      zkey_path: join(CIRCUITS_PATH, 'credential_0001_v2.zkey'),
      wasm_path: join(CIRCUITS_PATH, 'credential_js', 'credential.wasm'),
      vkey_data: credentialVkeyData,
      active: true,
    } as any);
    await zkKeyRepository.save(credentialKey);
    console.log('✅ Seeded credential circuit verification key (v2)');

    // Also seed v1 keys as inactive (for backward compatibility)
    const spendVkeyV1Path = join(CIRCUITS_PATH, 'verification_key_spend.json');
    const spendVkeyV1Data = JSON.parse(await readFile(spendVkeyV1Path, 'utf-8'));
    
    const spendKeyV1 = zkKeyRepository.create({
      circuit_name: CircuitType.SPEND,
      version: 'v1',
      vkey_path: spendVkeyV1Path,
      zkey_path: join(CIRCUITS_PATH, 'spend_0001.zkey'),
      wasm_path: join(CIRCUITS_PATH, 'spend_js', 'spend.wasm'),
      vkey_data: spendVkeyV1Data,
      active: false,
    } as any);
    await zkKeyRepository.save(spendKeyV1);
    console.log('✅ Seeded spend circuit verification key (v1 - inactive)');

    const credentialVkeyV1Path = join(CIRCUITS_PATH, 'verification_key_credential.json');
    const credentialVkeyV1Data = JSON.parse(await readFile(credentialVkeyV1Path, 'utf-8'));
    
    const credentialKeyV1 = zkKeyRepository.create({
      circuit_name: CircuitType.CREDENTIAL,
      version: 'v1',
      vkey_path: credentialVkeyV1Path,
      zkey_path: join(CIRCUITS_PATH, 'credential_0001.zkey'),
      wasm_path: join(CIRCUITS_PATH, 'credential_js', 'credential.wasm'),
      vkey_data: credentialVkeyV1Data,
      active: false,
    } as any);
    await zkKeyRepository.save(credentialKeyV1);
    console.log('✅ Seeded credential circuit verification key (v1 - inactive)');

    console.log('🎉 ZK keys seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding ZK keys:', error);
    throw error;
  } finally {
    await app.close();
  }
}

seedZKKeys()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

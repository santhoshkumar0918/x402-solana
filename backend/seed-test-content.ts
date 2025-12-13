#!/usr/bin/env bun
/**
 * Seed test content for payment flow testing
 */

import { DataSource } from 'typeorm';
import * as crypto from 'crypto';

async function main() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: 'postgresql://postgres:Santhosh0918@db.ouawxjbbxejxmfvjfumz.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false },
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('✅ Connected to database');

  try {
    // Test content 1: News article with journalist discount
    const contentId1 = crypto.randomBytes(32);
    await dataSource.query(`
      INSERT INTO content_listings (
        content_id_hash,
        creator_pubkey,
        price_default,
        price_journalist,
        token_mint,
        recipient_pubkey,
        credential_policy,
        storage_cid,
        encryption_key_hash,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (content_id_hash) DO NOTHING
    `, [
      contentId1,
      'G1dcMZ9EXXqDLFX2zQYYCPzAHLuBGr5jE3tJcGS9zGxy', // Creator wallet
      '1000000', // 0.001 SOL default price
      '500000',  // 0.0005 SOL journalist price  
      'So11111111111111111111111111111111111111112', // Native SOL
      'G1dcMZ9EXXqDLFX2zQYYCPzAHLuBGr5jE3tJcGS9zGxy', // Recipient
      1, // Credential policy: journalist verification required
      'QmTest1234567890abcdefghijklmnopqrstuvwxyz', // IPFS CID
      crypto.randomBytes(32).toString('hex'),
      JSON.stringify({
        title: 'Breaking: Solana Privacy Protocol Launches',
        description: 'Exclusive investigation into x402 privacy-preserving payments',
        category: 'investigative-journalism',
        publishedAt: new Date().toISOString(),
      }),
    ]);
    console.log(`✅ Seeded content 1: ${contentId1.toString('hex')}`);

    // Test content 2: Premium research report (no journalist discount)
    const contentId2 = crypto.randomBytes(32);
    await dataSource.query(`
      INSERT INTO content_listings (
        content_id_hash,
        creator_pubkey,
        price_default,
        price_journalist,
        token_mint,
        recipient_pubkey,
        credential_policy,
        storage_cid,
        encryption_key_hash,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (content_id_hash) DO NOTHING
    `, [
      contentId2,
      'G1dcMZ9EXXqDLFX2zQYYCPzAHLuBGr5jE3tJcGS9zGxy',
      '5000000', // 0.005 SOL
      null,      // No journalist discount
      'So11111111111111111111111111111111111111112',
      'G1dcMZ9EXXqDLFX2zQYYCPzAHLuBGr5jE3tJcGS9zGxy',
      0, // No credential required
      'QmTest9876543210zyxwvutsrqponmlkjihgfedcba',
      crypto.randomBytes(32).toString('hex'),
      JSON.stringify({
        title: 'Zero-Knowledge Proofs in Financial Systems: A Technical Deep Dive',
        description: '150-page research report on ZK implementations',
        category: 'research',
        publishedAt: new Date().toISOString(),
      }),
    ]);
    console.log(`✅ Seeded content 2: ${contentId2.toString('hex')}`);

    // Test content 3: Free content (price 0)
    const contentId3 = crypto.randomBytes(32);
    await dataSource.query(`
      INSERT INTO content_listings (
        content_id_hash,
        creator_pubkey,
        price_default,
        price_journalist,
        token_mint,
        recipient_pubkey,
        credential_policy,
        storage_cid,
        encryption_key_hash,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (content_id_hash) DO NOTHING
    `, [
      contentId3,
      'G1dcMZ9EXXqDLFX2zQYYCPzAHLuBGr5jE3tJcGS9zGxy',
      '0',       // Free
      null,
      'So11111111111111111111111111111111111111112',
      'G1dcMZ9EXXqDLFX2zQYYCPzAHLuBGr5jE3tJcGS9zGxy',
      0,
      'QmTestFreeContentABCDEF123456789',
      crypto.randomBytes(32).toString('hex'),
      JSON.stringify({
        title: 'Introduction to x402 Privacy Protocol',
        description: 'Public whitepaper and technical overview',
        category: 'documentation',
        publishedAt: new Date().toISOString(),
      }),
    ]);
    console.log(`✅ Seeded content 3 (free): ${contentId3.toString('hex')}`);

    // Query and display all content for testing
    const allContent = await dataSource.query(`
      SELECT 
        encode(content_id_hash, 'hex') as content_id_hash,
        price_default,
        price_journalist,
        metadata->>'title' as title
      FROM content_listings
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log('\n📋 Test content available:');
    allContent.forEach((c: any, idx: number) => {
      console.log(`\n${idx + 1}. ${c.title}`);
      console.log(`   Content ID: ${c.content_id_hash}`);
      console.log(`   Default price: ${c.price_default} lamports`);
      console.log(`   Journalist price: ${c.price_journalist || 'N/A'} lamports`);
    });

    console.log('\n🎉 Test content seeding completed!');
  } catch (error) {
    console.error('❌ Error seeding content:', error);
    throw error;
  } finally {
    await dataSource.destroy();
  }
}

main().catch(console.error);

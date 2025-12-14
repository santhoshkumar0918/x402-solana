/**
 * Solana Program Configuration
 * 
 * Contains deployed program addresses and network configuration
 * Synced with contracts/Anchor.toml [programs.testnet]
 */

export const SOLANA_CONFIG = {
  // Network configuration
  network: 'testnet',
  rpcEndpoint: 'https://api.testnet.solana.com',
  
  // Deployed program addresses (Testnet)
  programs: {
    accessController: 'E668aMe8qjKg6jpTvdTbZiXf1MGNAmvtPv122wJCxuuP',
    shieldedPool: '7xJmW9tmnAZWyyYzyQW1sQHy1rRF9Vq2hoWhdqwU2CPD',
    spendVerifier: 'HRpmTzRVZ9aELt6wT4urDArD8CnrJ6xpFaBVFqmJscbj',
    tokenHooks: '5JM2rS68RLJbQG35b2sGmQCZ1d6zksoszwVMAeM69PcE',
    x402Registry: '6Mznzqj4hLgB58xfhv1rFhYQ5zWRKwcXc8Y7qUxADDPp',
    zkMetaRegistry: 'C6DR9nABrxAt4k4YKLXUhWaRJNVAMzdXvtSsJT82bcZz',
  },
  
  // IDL file paths (relative to backend root)
  idlPaths: {
    accessController: '../contracts/idl/access_controller.json',
    shieldedPool: '../contracts/idl/shielded_pool.json',
    spendVerifier: '../contracts/idl/spend_verifier.json',
    tokenHooks: '../contracts/idl/token_hooks.json',
    x402Registry: '../contracts/idl/x402_registry.json',
    zkMetaRegistry: '../contracts/idl/zk_meta_registry.json',
  },
  
  // Transaction confirmation settings
  confirmation: {
    commitment: 'confirmed' as const,
    maxRetries: 3,
    timeout: 60000, // 60 seconds
  },
} as const;

export type ProgramName = keyof typeof SOLANA_CONFIG.programs;

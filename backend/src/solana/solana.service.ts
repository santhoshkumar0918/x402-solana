import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
  SystemProgram,
} from '@solana/web3.js';
import { Program, AnchorProvider, setProvider, web3, Wallet } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as path from 'path';
import BN from 'bn.js';

// Program IDs from deployed contracts (Testnet)
// Synced with contracts/Anchor.toml [programs.testnet]
const PROGRAM_IDS = {
  ACCESS_CONTROLLER: 'E668aMe8qjKg6jpTvdTbZiXf1MGNAmvtPv122wJCxuuP',
  SHIELDED_POOL: '7xJmW9tmnAZWyyYzyQW1sQHy1rRF9Vq2hoWhdqwU2CPD',
  SPEND_VERIFIER: 'HRpmTzRVZ9aELt6wT4urDArD8CnrJ6xpFaBVFqmJscbj',
  TOKEN_HOOKS: '5JM2rS68RLJbQG35b2sGmQCZ1d6zksoszwVMAeM69PcE',
  X402_REGISTRY: '6Mznzqj4hLgB58xfhv1rFhYQ5zWRKwcXc8Y7qUxADDPp',
  ZK_META_REGISTRY: 'C6DR9nABrxAt4k4YKLXUhWaRJNVAMzdXvtSsJT82bcZz',
};

@Injectable()
export class SolanaService implements OnModuleInit {
  private readonly logger = new Logger(SolanaService.name);
  private connection: Connection;
  private provider: AnchorProvider;
  private wallet: Wallet;
  
  // Program instances (loaded from IDL files)
  private programs: Map<string, Program> = new Map();

  constructor() {
    // Use testnet for development - switches to mainnet after deployment
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.testnet.solana.com';
    this.connection = new Connection(rpcUrl, 'confirmed');
  }
  
  async onModuleInit() {
    try {
      // Initialize provider (will be updated with actual wallet when needed)
      this.initializeProvider();
      
      // Load all programs from IDL files
      await this.loadPrograms();
      
      this.logger.log('Solana service initialized with deployed programs');
    } catch (error) {
      this.logger.error('Failed to initialize Solana service:', error);
      // Don't throw - allow backend to start even if Solana integration fails
    }
  }

  private initializeProvider() {
    try {
      // Try loading relayer keypair (already exists in backend/)
      const keypairPath = path.join(process.cwd(), 'relayer-keypair.json');
      
      if (fs.existsSync(keypairPath)) {
        const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
        const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
        this.wallet = new Wallet(keypair);
        this.logger.log(`Loaded relayer wallet: ${keypair.publicKey.toBase58()}`);
      } else {
        // Fallback: create ephemeral wallet for testing
        this.logger.warn('No relayer keypair found, using ephemeral wallet');
        this.wallet = new Wallet(Keypair.generate());
      }
      
      this.provider = new AnchorProvider(
        this.connection,
        this.wallet,
        { commitment: 'confirmed' }
      );
      setProvider(this.provider);
      
    } catch (error) {
      this.logger.error('Failed to initialize provider:', error);
      throw error;
    }
  }
  
  private async loadPrograms() {
    const programConfigs = [
      { name: 'x402Registry', id: PROGRAM_IDS.X402_REGISTRY, idlPath: '../contracts/idl/x402_registry.json' },
      { name: 'shieldedPool', id: PROGRAM_IDS.SHIELDED_POOL, idlPath: '../contracts/idl/shielded_pool.json' },
      { name: 'spendVerifier', id: PROGRAM_IDS.SPEND_VERIFIER, idlPath: '../contracts/idl/spend_verifier.json' },
      { name: 'accessController', id: PROGRAM_IDS.ACCESS_CONTROLLER, idlPath: '../contracts/idl/access_controller.json' },
      { name: 'zkMetaRegistry', id: PROGRAM_IDS.ZK_META_REGISTRY, idlPath: '../contracts/idl/zk_meta_registry.json' },
      { name: 'tokenHooks', id: PROGRAM_IDS.TOKEN_HOOKS, idlPath: '../contracts/idl/token_hooks.json' },
    ];

    for (const { name, id, idlPath } of programConfigs) {
      try {
        const idlFile = path.join(process.cwd(), idlPath);
        
        if (!fs.existsSync(idlFile)) {
          this.logger.warn(`IDL file not found: ${idlPath}`);
          continue;
        }
        
        const idl = JSON.parse(fs.readFileSync(idlFile, 'utf-8'));
        const program = new Program(idl, this.provider);
        
        this.programs.set(name, program);
        this.logger.log(`✓ Loaded ${name}: ${id}`);
        
      } catch (error) {
        this.logger.warn(`Failed to load ${name} program:`, error.message);
      }
    }
    
    if (this.programs.size === 0) {
      this.logger.warn('No Solana programs loaded - IDL integration disabled');
    }
  }
  
  getProgram(name: string): Program | null {
    return this.programs.get(name) || null;
  }

  /**
   * Submit a ZK proof transaction for payment verification
   */
  async submitProof(proof: {
    nullifier: string;
    commitment: string;
    amount: BN;
    recipient: PublicKey;
    merkleProof: any;
    zkProof: any;
  }): Promise<string> {
    this.logger.debug('Submitting ZK proof transaction');
    
    try {
      // This would interact with the shielded-pool program
      // For now, return a mock transaction signature
      const mockTxSignature = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      this.logger.log(`ZK proof transaction submitted: ${mockTxSignature}`);
      return mockTxSignature;
    } catch (error) {
      this.logger.error('Failed to submit ZK proof', error);
      throw new Error(`Proof submission failed: ${error.message}`);
    }
  }

  /**
   * Confirm transaction completion
   */
  async confirmTransaction(signature: string, commitment: any = 'confirmed'): Promise<boolean> {
    this.logger.debug(`Confirming transaction: ${signature}`);
    
    try {
      if (signature.startsWith('tx_')) {
        // Mock transaction - simulate confirmation delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        this.logger.log(`Transaction confirmed: ${signature}`);
        return true;
      }

      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash: await this.connection.getLatestBlockhash().then(r => r.blockhash),
        lastValidBlockHeight: await this.connection.getLatestBlockhash().then(r => r.lastValidBlockHeight),
      }, commitment);
      const success = !confirmation.value.err;
      
      if (success) {
        this.logger.log(`Transaction confirmed: ${signature}`);
      } else {
        this.logger.error(`Transaction failed: ${signature}`, confirmation.value.err);
      }
      
      return success;
    } catch (error) {
      this.logger.error(`Error confirming transaction: ${signature}`, error);
      return false;
    }
  }

  /**
   * Get account balance
   */
  async getBalance(publicKey: PublicKey): Promise<number> {
    try {
      const balance = await this.connection.getBalance(publicKey);
      return balance / web3.LAMPORTS_PER_SOL;
    } catch (error) {
      this.logger.error(`Error fetching balance for ${publicKey.toBase58()}`, error);
      throw error;
    }
  }

  /**
   * Get program account from registry
   */
  async getContentMetadata(contentHash: string): Promise<any> {
    this.logger.debug(`Fetching content metadata for hash: ${contentHash}`);
    
    try {
      // This would query the x402-registry program
      // Mock data for development
      return {
        price: new BN(1000000), // 1 USDC in smallest units
        recipient: new PublicKey('84XyuC1HN7UzE4QQT53PvG5zQYFU59SFGRNZcA76hAgp'),
        metadata: {
          title: 'Sample Content',
          description: 'Protected content requiring payment',
          contentType: 'application/json',
        },
        zkRequirements: {
          credentialType: 'journalist',
          minimumReputation: 100,
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching content metadata: ${contentHash}`, error);
      throw error;
    }
  }

  /**
   * Verify a credential proof
   */
  async verifyCredentialProof(proof: any): Promise<boolean> {
    this.logger.debug('Verifying credential proof');
    
    try {
      // This would interact with the spend-verifier program
      // Mock verification for development
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const isValid = proof && proof.proof && proof.publicSignals;
      this.logger.log(`Credential proof verification: ${isValid ? 'VALID' : 'INVALID'}`);
      
      return isValid;
    } catch (error) {
      this.logger.error('Error verifying credential proof', error);
      return false;
    }
  }

  /**
   * Get recent payment events
   */
  async getRecentPaymentEvents(limit = 10): Promise<any[]> {
    this.logger.debug('Fetching recent payment events');
    
    try {
      // This would parse program logs from the shielded-pool program
      // Mock events for development
      return Array.from({ length: limit }, (_, i) => ({
        signature: `event_${Date.now() - i * 1000}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(Date.now() - i * 60000),
        eventType: 'PaymentProcessed',
        amount: new BN(Math.floor(Math.random() * 10000000)),
        nullifier: `null_${Math.random().toString(36).substr(2, 16)}`,
        recipient: new PublicKey('84XyuC1HN7UzE4QQT53PvG5zQYFU59SFGRNZcA76hAgp'),
      }));
    } catch (error) {
      this.logger.error('Error fetching payment events', error);
      throw error;
    }
  }

  /**
   * Purchase content via x402_registry program (on-chain settlement)
   */
  async purchaseContentOnChain(params: {
    contentId: string;
    sessionId: string;
    amount: number;
  }): Promise<{ success: boolean; signature?: string; error?: string }> {
    try {
      const program = this.getProgram('x402Registry');
      if (!program) {
        this.logger.warn('x402Registry program not loaded, skipping on-chain settlement');
        return { success: false, error: 'Program not loaded' };
      }
      
      // Derive PDAs
      const [registry] = PublicKey.findProgramAddressSync(
        [Buffer.from('x402_registry')],
        program.programId,
      );
      
      const [listing] = PublicKey.findProgramAddressSync(
        [Buffer.from('listing'), Buffer.from(params.contentId)],
        program.programId,
      );
      
      const [purchase] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('purchase'),
          Buffer.from(params.sessionId),
          Buffer.from(params.contentId),
        ],
        program.programId,
      );
      
      // Call purchase_content instruction
      const tx = await program.methods
        .purchaseContent(
          params.contentId,
          params.sessionId,
          new BN(params.amount),
        )
        .accounts({
          registry,
          listing,
          purchase,
          authority: this.wallet.publicKey,
        })
        .rpc();
      
      this.logger.log(`✓ Content purchased on-chain: ${tx}`);
      
      return {
        success: true,
        signature: tx,
      };
      
    } catch (error) {
      this.logger.error('Failed to purchase content on-chain:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  /**
   * Grant access via access_controller program
   */
  async grantAccessOnChain(params: {
    contentId: string;
    sessionId: string;
    expiresAt: Date;
  }): Promise<{ success: boolean; signature?: string; error?: string }> {
    try {
      const program = this.getProgram('accessController');
      if (!program) {
        this.logger.warn('accessController program not loaded');
        return { success: false, error: 'Program not loaded' };
      }
      
      const [accessGrant] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('access'),
          Buffer.from(params.sessionId),
          Buffer.from(params.contentId),
        ],
        program.programId,
      );
      
      const expiresTs = new BN(Math.floor(params.expiresAt.getTime() / 1000));
      
      const tx = await program.methods
        .grantAccess(
          params.sessionId,
          params.contentId,
          expiresTs,
        )
        .accounts({
          accessGrant,
          authority: this.wallet.publicKey,
        })
        .rpc();
      
      this.logger.log(`✓ Access granted on-chain: ${tx}`);
      
      return {
        success: true,
        signature: tx,
      };
      
    } catch (error) {
      this.logger.error('Failed to grant access on-chain:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Health check for Solana connection
   */
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; blockHeight?: number }> {
    try {
      const startTime = Date.now();
      const blockHeight = await this.connection.getBlockHeight();
      const latency = Date.now() - startTime;
      
      return {
        healthy: true,
        latency,
        blockHeight,
      };
    } catch (error) {
      this.logger.error('Solana health check failed', error);
      return { healthy: false };
    }
  }
}
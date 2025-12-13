import { Injectable, Logger } from '@nestjs/common';
import { Connection, PublicKey, Keypair, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { RedisService } from '../redis/redis.service';
import BN from 'bn.js';

interface TransactionRequest {
  type: 'spend' | 'record_payment' | 'combined';
  proof?: any;
  publicSignals?: string[];
  contentId?: string;
  recipient?: PublicKey;
  amount?: BN;
  priority?: 'low' | 'normal' | 'high';
}

interface TransactionResult {
  signature: string;
  status: 'submitted' | 'confirmed' | 'failed';
  slot?: number;
  blockTime?: number;
  error?: string;
  retries?: number;
}

@Injectable()
export class RelayerService {
  private readonly logger = new Logger(RelayerService.name);
  private relayerKeypair: Keypair;
  private connection: Connection;
  private provider: AnchorProvider;

  // Fee management
  private readonly BASE_FEE_LAMPORTS = 5000; // 0.000005 SOL
  private readonly PRIORITY_MULTIPLIERS = {
    low: 1.0,
    normal: 1.5,
    high: 2.0,
  };

  constructor(private readonly redisService: RedisService) {
    this.initializeRelayer();
  }

  /**
   * Initialize relayer with secure keypair
   * In production: Load from HSM, KMS, or Vault
   */
  private initializeRelayer(): void {
    try {
      const privateKey = process.env.RELAYER_PRIVATE_KEY;
      
      if (privateKey) {
        // Decode base64 keypair
        const keypairBytes = Buffer.from(privateKey, 'base64');
        this.relayerKeypair = Keypair.fromSecretKey(keypairBytes);
      } else {
        // Development: Generate ephemeral keypair
        this.relayerKeypair = Keypair.generate();
        this.logger.warn('Using ephemeral relayer keypair (development only)');
      }

      // Initialize connection
      const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.testnet.solana.com';
      this.connection = new Connection(rpcUrl, 'confirmed');

      // Initialize provider
      this.provider = new AnchorProvider(
        this.connection,
        {
          publicKey: this.relayerKeypair.publicKey,
          signTransaction: async (tx) => {
            tx.sign(this.relayerKeypair);
            return tx;
          },
          signAllTransactions: async (txs) => {
            txs.forEach(tx => tx.sign(this.relayerKeypair));
            return txs;
          },
        } as any,
        { commitment: 'confirmed' }
      );

      this.logger.log(`Relayer initialized: ${this.relayerKeypair.publicKey.toString()}`);
    } catch (error) {
      this.logger.error('Failed to initialize relayer:', error);
      throw error;
    }
  }

  /**
   * Build and submit combined transaction (spend + record_payment)
   * This is the main entry point for payment processing
   */
  async submitPaymentTransaction(request: TransactionRequest): Promise<TransactionResult> {
    this.logger.log(`Submitting payment transaction for content: ${request.contentId}`);

    try {
      // 1. Build combined transaction
      const transaction = await this.buildCombinedTransaction(request);

      // 2. Add priority fees if needed
      const priorityFee = this.calculatePriorityFee(request.priority || 'normal');
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: this.relayerKeypair.publicKey,
          toPubkey: this.relayerKeypair.publicKey, // Self-transfer for priority
          lamports: priorityFee,
        })
      );

      // 3. Set recent blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = this.relayerKeypair.publicKey;

      // 4. Sign transaction
      transaction.sign(this.relayerKeypair);

      // 5. Submit with retry logic
      const result = await this.submitWithRetry(transaction, request);

      // 6. Track in Redis
      await this.redisService.trackPaymentStatus(result.signature, 'confirmed', {
        contentId: request.contentId,
        priority: request.priority,
        submittedAt: new Date().toISOString(),
      });

      return result;

    } catch (error) {
      this.logger.error('Transaction submission failed:', error);
      
      return {
        signature: 'failed',
        status: 'failed',
        error: error.message,
      };
    }
  }

  /**
   * Build combined transaction (spend + record_payment)
   */
  private async buildCombinedTransaction(request: TransactionRequest): Promise<Transaction> {
    const transaction = new Transaction();

    // TODO: Add actual Anchor instructions
    // This is where you'd compose:
    // 1. shielded_pool::spend instruction (with ZK proof)
    // 2. x402_registry::record_payment instruction
    
    // For now, return empty transaction structure
    // const spendProgram = new Program(ShieldedPoolIDL, SHIELDED_POOL_ID, this.provider);
    // const x402Program = new Program(X402RegistryIDL, X402_REGISTRY_ID, this.provider);
    
    // const spendIx = await spendProgram.methods
    //   .spend(
    //     request.proof.nullifier,
    //     request.proof.commitment,
    //     request.amount,
    //     request.proof.merkleRoot,
    //     request.proof.zkProof
    //   )
    //   .accounts({...})
    //   .instruction();
    
    // const recordIx = await x402Program.methods
    //   .recordPayment(
    //     request.contentId,
    //     request.amount,
    //     request.recipient
    //   )
    //   .accounts({...})
    //   .instruction();
    
    // transaction.add(spendIx, recordIx);

    return transaction;
  }

  /**
   * Submit transaction with exponential backoff retry
   */
  private async submitWithRetry(
    transaction: Transaction,
    request: TransactionRequest,
    maxRetries: number = 3
  ): Promise<TransactionResult> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        this.logger.debug(`Transaction attempt ${attempt + 1}/${maxRetries}`);

        // Submit transaction
        const signature = await this.connection.sendRawTransaction(
          transaction.serialize(),
          {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
            maxRetries: 0, // Handle retries ourselves
          }
        );

        this.logger.log(`Transaction submitted: ${signature}`);

        // Wait for confirmation
        const confirmation = await this.connection.confirmTransaction({
          signature,
          blockhash: transaction.recentBlockhash!,
          lastValidBlockHeight: transaction.lastValidBlockHeight!,
        }, 'confirmed');

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }

        // Get transaction details
        const txDetails = await this.connection.getTransaction(signature, {
          maxSupportedTransactionVersion: 0,
        });

        return {
          signature,
          status: 'confirmed',
          slot: txDetails?.slot,
          blockTime: txDetails?.blockTime || undefined,
          retries: attempt,
        };

      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Transaction attempt ${attempt + 1} failed: ${error.message}`);

        // Exponential backoff
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, delay));

          // Update blockhash for retry
          const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
          transaction.recentBlockhash = blockhash;
          transaction.lastValidBlockHeight = lastValidBlockHeight;
          transaction.sign(this.relayerKeypair);
        }
      }
    }

    throw lastError || new Error('Transaction failed after retries');
  }

  /**
   * Calculate priority fee based on network conditions
   */
  private calculatePriorityFee(priority: 'low' | 'normal' | 'high'): number {
    // In production: Query recent priority fees from RPC
    // For now: Use static multipliers
    return Math.floor(this.BASE_FEE_LAMPORTS * this.PRIORITY_MULTIPLIERS[priority]);
  }

  /**
   * Check relayer balance and alert if low
   */
  async checkRelayerBalance(): Promise<{
    balance: number;
    healthy: boolean;
    minRequired: number;
  }> {
    try {
      const balance = await this.connection.getBalance(this.relayerKeypair.publicKey);
      const minRequired = 100_000_000; // 0.1 SOL minimum

      const healthy = balance >= minRequired;

      if (!healthy) {
        this.logger.error(`Relayer balance LOW: ${balance / 1e9} SOL (minimum: ${minRequired / 1e9} SOL)`);
        
        // Enqueue alert
        await this.redisService.enqueueEvent({
          type: 'relayer_low_balance',
          payload: {
            balance: balance / 1e9,
            minRequired: minRequired / 1e9,
            address: this.relayerKeypair.publicKey.toString(),
          },
          priority: 'high',
        });
      }

      return {
        balance: balance / 1e9,
        healthy,
        minRequired: minRequired / 1e9,
      };

    } catch (error) {
      this.logger.error('Failed to check relayer balance:', error);
      return {
        balance: 0,
        healthy: false,
        minRequired: 0.1,
      };
    }
  }

  /**
   * Get relayer public key
   */
  getRelayerPublicKey(): PublicKey {
    return this.relayerKeypair.publicKey;
  }

  /**
   * Estimate transaction fee
   */
  async estimateTransactionFee(request: TransactionRequest): Promise<number> {
    try {
      // Build transaction
      const transaction = await this.buildCombinedTransaction(request);
      
      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.relayerKeypair.publicKey;

      // Get fee for transaction
      const fee = await this.connection.getFeeForMessage(
        transaction.compileMessage(),
        'confirmed'
      );

      const priorityFee = this.calculatePriorityFee(request.priority || 'normal');
      const totalFee = (fee.value || 5000) + priorityFee;

      return totalFee / 1e9; // Convert to SOL

    } catch (error) {
      this.logger.error('Failed to estimate transaction fee:', error);
      return 0.00001; // Default estimate
    }
  }

  /**
   * Health check for relayer service
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    balance: number;
    connection: boolean;
    recentTransactions: number;
  }> {
    try {
      const balanceCheck = await this.checkRelayerBalance();
      const slot = await this.connection.getSlot();
      
      // Get recent transaction count from Redis
      const recentTxCount = await this.redisService.getClient().dbSize();

      return {
        status: balanceCheck.healthy ? 'healthy' : 'degraded',
        balance: balanceCheck.balance,
        connection: slot > 0,
        recentTransactions: recentTxCount,
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        balance: 0,
        connection: false,
        recentTransactions: 0,
      };
    }
  }
}
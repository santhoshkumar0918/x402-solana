import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { BN } from 'bn.js';

// Import your contract IDLs (these would be generated from your deployed contracts)
// import { ShieldedPoolIDL } from '../idl/shielded_pool';
// import { SpendVerifierIDL } from '../idl/spend_verifier';
// import { X402RegistryIDL } from '../idl/x402_registry';

interface ZKProof {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
}

interface PaymentProof {
  nullifier: string;
  commitment: string;
  amount: BN;
  recipient: PublicKey;
  merkleRoot: string;
  zkProof: ZKProof;
  publicSignals: string[];
}

@Injectable()
export class ContractIntegrationService {
  private readonly logger = new Logger(ContractIntegrationService.name);
  
  // Program IDs from your deployed contracts
  private readonly PROGRAM_IDS = {
    SHIELDED_POOL: new PublicKey('75cH7CRmvDyy7o3mGuWvJhffT7ZyLmYdvv7x36ZVhio1'),
    X402_REGISTRY: new PublicKey('2a65ey6veP6vqa54K1AHg4fidM2YMH8cBLxacHNz8KCR'),
    SPEND_VERIFIER: new PublicKey('CwJ5s1e69mv5uAnTyaAxos9DVVQ2kWcz53BQm6krzDG9'),
    ZK_META_REGISTRY: new PublicKey('Fst8HV7eM3jNg4VjQWWHJUYxPr6E7AYz9hizZnsKUBT9'),
    ACCESS_CONTROLLER: new PublicKey('6TjVZeXZiRxVQBHoMvNzCYraRekbM16jJj6ycg8fFggZ'),
    TOKEN_HOOKS: new PublicKey('6s5H6xDDWymGRtGN4Vpr5AqyvfRZ4cMhrZq5yJkQQrYU'),
  };

  constructor(
    private readonly redisService: RedisService,
    private readonly connection: Connection,
    private readonly provider: AnchorProvider,
  ) {}

  /**
   * Submit and verify a shielded payment with ZK proof
   */
  async submitShieldedPayment(proof: PaymentProof, contentId?: string): Promise<string> {
    this.logger.log('Submitting shielded payment with ZK proof verification');

    try {
      // 1. First verify the ZK proof off-chain (cache result)
      const proofHash = this.hashProof(proof);
      let verificationResult = await this.redisService.getCachedProofResult(proofHash);
      
      if (!verificationResult) {
        verificationResult = await this.verifyZKProofOffChain(proof);
        await this.redisService.cacheProofResult(proofHash, verificationResult, 3600);
      }

      if (!verificationResult.valid) {
        throw new Error(`Invalid ZK proof: ${verificationResult.error}`);
      }

      // 2. Check nullifier hasn't been used
      const nullifierUsed = await this.isNullifierUsed(proof.nullifier);
      if (nullifierUsed) {
        throw new Error(`Nullifier already used: ${proof.nullifier}`);
      }

      // 3. Build and submit transaction to spend-verifier program
      const transaction = await this.buildSpendTransaction(proof, contentId);
      
      // 4. Submit transaction
      const signature = await this.connection.sendTransaction(transaction, {
        preflightCommitment: 'confirmed',
      });

      // 5. Track payment status
      await this.redisService.trackPaymentStatus(signature, 'processing', {
        nullifier: proof.nullifier,
        amount: proof.amount.toString(),
        recipient: proof.recipient.toString(),
        contentId,
      });

      // 6. Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      // 7. Update status to confirmed
      await this.redisService.trackPaymentStatus(signature, 'confirmed', {
        blockTime: Date.now(),
        slot: confirmation.context.slot,
      });

      this.logger.log(`Shielded payment confirmed: ${signature}`);
      return signature;

    } catch (error) {
      this.logger.error('Failed to submit shielded payment:', error);
      throw new Error(`Payment submission failed: ${error.message}`);
    }
  }

  /**
   * Verify ZK proof off-chain before submission
   */
  private async verifyZKProofOffChain(proof: PaymentProof): Promise<{ valid: boolean; error?: string }> {
    try {
      // This would use snarkjs or similar library to verify the proof
      // For now, return mock verification
      
      // Basic validation
      if (!proof.zkProof || !proof.publicSignals || proof.publicSignals.length === 0) {
        return { valid: false, error: 'Missing proof components' };
      }

      if (!proof.nullifier || !proof.commitment) {
        return { valid: false, error: 'Missing nullifier or commitment' };
      }

      // TODO: Implement actual Groth16 verification
      // const snarkjs = require('snarkjs');
      // const vKey = await snarkjs.zKey.exportVerificationKey('spend_0001.zkey');
      // const valid = await snarkjs.groth16.verify(vKey, proof.publicSignals, proof.zkProof);

      this.logger.debug(`ZK proof verification: valid for nullifier ${proof.nullifier}`);
      return { valid: true };

    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Build spend transaction for on-chain verification
   */
  private async buildSpendTransaction(proof: PaymentProof, contentId?: string): Promise<Transaction> {
    try {
      // This would use Anchor to build the transaction
      // For now, return a mock transaction
      
      const transaction = new Transaction();
      
      // TODO: Add actual instruction building using Anchor program
      // const spendProgram = new Program(SpendVerifierIDL, this.PROGRAM_IDS.SPEND_VERIFIER, this.provider);
      
      // const instruction = await spendProgram.methods
      //   .verifySpend(
      //     proof.nullifier,
      //     proof.commitment,
      //     proof.amount,
      //     proof.merkleRoot,
      //     proof.zkProof,
      //     proof.publicSignals
      //   )
      //   .accounts({
      //     spendVerifier: spendVerifierPDA,
      //     shieldedPool: this.PROGRAM_IDS.SHIELDED_POOL,
      //     nullifierSet: nullifierSetPDA,
      //     recipient: proof.recipient,
      //     systemProgram: SystemProgram.programId,
      //   })
      //   .instruction();
      
      // transaction.add(instruction);

      // Add content registration if contentId provided
      if (contentId) {
        // const x402Instruction = await this.buildContentRegistrationInstruction(contentId, proof.recipient);
        // transaction.add(x402Instruction);
      }

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.provider.publicKey;

      return transaction;

    } catch (error) {
      this.logger.error('Error building spend transaction:', error);
      throw error;
    }
  }

  /**
   * Check if nullifier has been used before
   */
  private async isNullifierUsed(nullifier: string): Promise<boolean> {
    try {
      // Check Redis cache first
      const cached = await this.redisService.getClient().get(`nullifier:${nullifier}`);
      if (cached) {
        return true;
      }

      // TODO: Check on-chain nullifier set
      // const nullifierAccount = await this.getNullifierAccount(nullifier);
      // return nullifierAccount !== null;

      return false; // Mock: assume not used
    } catch (error) {
      this.logger.error('Error checking nullifier:', error);
      return true; // Fail safe: assume used if error
    }
  }

  /**
   * Register content with payment requirements
   */
  async registerContent(
    contentId: string,
    metadata: {
      title: string;
      description: string;
      price: BN;
      credentialRequirements?: string[];
      accessDuration?: number;
    }
  ): Promise<string> {
    this.logger.log(`Registering content: ${contentId}`);

    try {
      // TODO: Build X402 registry transaction
      // const x402Program = new Program(X402RegistryIDL, this.PROGRAM_IDS.X402_REGISTRY, this.provider);
      
      // const instruction = await x402Program.methods
      //   .registerContent(
      //     contentId,
      //     metadata.title,
      //     metadata.description,
      //     metadata.price,
      //     metadata.credentialRequirements || [],
      //     metadata.accessDuration || 86400
      //   )
      //   .accounts({
      //     content: contentPDA,
      //     authority: this.provider.publicKey,
      //     systemProgram: SystemProgram.programId,
      //   })
      //   .rpc();

      const mockSignature = `content_reg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Cache content metadata
      await this.redisService.getClient().setEx(
        `content:${contentId}`,
        86400,
        JSON.stringify(metadata)
      );

      this.logger.log(`Content registered: ${contentId} with signature: ${mockSignature}`);
      return mockSignature;

    } catch (error) {
      this.logger.error('Failed to register content:', error);
      throw new Error(`Content registration failed: ${error.message}`);
    }
  }

  /**
   * Get content metadata and payment requirements
   */
  async getContentInfo(contentId: string): Promise<any> {
    try {
      // Check cache first
      const cached = await this.redisService.getClient().get(`content:${contentId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // TODO: Fetch from X402 registry program
      // const contentPDA = await this.getContentPDA(contentId);
      // const contentAccount = await x402Program.account.content.fetch(contentPDA);

      // Mock content info for development
      return {
        title: 'Whistleblower Documents',
        description: 'Leaked corporate emails from Fortune 500 company',
        price: new BN('1000000'), // 1 USDC
        credentialRequirements: ['journalist'],
        accessDuration: 86400,
        createdAt: new Date().toISOString(),
      };

    } catch (error) {
      this.logger.error('Error getting content info:', error);
      return null;
    }
  }

  /**
   * Grant content access after payment verification
   */
  async grantContentAccess(contentId: string, recipient: PublicKey, signature: string): Promise<void> {
    this.logger.log(`Granting content access: ${contentId} to ${recipient.toString()}`);

    try {
      // TODO: Build access controller transaction
      // const accessProgram = new Program(AccessControllerIDL, this.PROGRAM_IDS.ACCESS_CONTROLLER, this.provider);
      
      // await accessProgram.methods
      //   .grantAccess(contentId)
      //   .accounts({
      //     accessController: accessControllerPDA,
      //     content: contentPDA,
      //     recipient: recipient,
      //     paymentProof: signature,
      //     systemProgram: SystemProgram.programId,
      //   })
      //   .rpc();

      // Grant access in Redis (immediate)
      await this.redisService.grantContentAccess(contentId, recipient.toString(), 86400);

      this.logger.log(`Access granted for content ${contentId}`);

    } catch (error) {
      this.logger.error('Failed to grant content access:', error);
      throw error;
    }
  }

  /**
   * Utility function to hash proof for caching
   */
  private hashProof(proof: PaymentProof): string {
    const proofString = JSON.stringify({
      nullifier: proof.nullifier,
      commitment: proof.commitment,
      zkProof: proof.zkProof,
      publicSignals: proof.publicSignals,
    });
    
    // Simple hash - in production use crypto.createHash
    return Buffer.from(proofString).toString('base64').slice(0, 16);
  }

  /**
   * Get recent payment events from blockchain
   */
  async getRecentPayments(limit: number = 10): Promise<any[]> {
    try {
      // TODO: Query spend-verifier program accounts
      // const spendProgram = new Program(SpendVerifierIDL, this.PROGRAM_IDS.SPEND_VERIFIER, this.provider);
      // const payments = await spendProgram.account.payment.all();

      // Mock recent payments for development
      return [
        {
          signature: 'mock_payment_1',
          nullifier: 'null_abc123',
          amount: '1000000',
          recipient: 'wallet_def456',
          contentId: 'whistleblower-docs',
          timestamp: new Date().toISOString(),
          status: 'confirmed',
        },
        {
          signature: 'mock_payment_2',
          nullifier: 'null_xyz789',
          amount: '500000',
          recipient: 'wallet_ghi012',
          contentId: 'leaked-emails',
          timestamp: new Date(Date.now() - 300000).toISOString(),
          status: 'confirmed',
        },
      ];

    } catch (error) {
      this.logger.error('Error getting recent payments:', error);
      return [];
    }
  }

  /**
   * Health check for contract integration
   */
  async getIntegrationHealth(): Promise<{
    connection: boolean;
    programs: { [key: string]: boolean };
    lastTransaction: string | null;
  }> {
    const health = {
      connection: false,
      programs: {} as { [key: string]: boolean },
      lastTransaction: null as string | null,
    };

    try {
      // Check RPC connection
      const slot = await this.connection.getSlot();
      health.connection = slot > 0;

      // Check each program
      for (const [name, programId] of Object.entries(this.PROGRAM_IDS)) {
        try {
          const accountInfo = await this.connection.getAccountInfo(programId);
          health.programs[name] = accountInfo !== null;
        } catch {
          health.programs[name] = false;
        }
      }

      // Get last transaction from Redis
      health.lastTransaction = await this.redisService.getClient().get('monitor:last_signature');

    } catch (error) {
      this.logger.error('Error checking integration health:', error);
    }

    return health;
  }
}
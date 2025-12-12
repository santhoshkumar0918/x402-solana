import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
// import * as snarkjs from 'snarkjs';

interface ZKProof {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
}

interface ProofRequest {
  circuitType: 'spend' | 'credential';
  privateInputs: any;
  publicSignals: string[];
  contentId?: string;
}

interface ProofResult {
  valid: boolean;
  proof?: ZKProof;
  publicSignals?: string[];
  error?: string;
  verificationTime?: number;
  vkeyVersion?: string;
}

@Injectable()
export class ProofOrchestratorService {
  private readonly logger = new Logger(ProofOrchestratorService.name);
  
  // Verification key versions for audit trail
  private readonly VKEY_VERSIONS = {
    spend: 'v1.0.0',
    credential: 'v1.0.0',
  };

  constructor(private readonly redisService: RedisService) {}

  /**
   * Generate proof (coordinates WASM prover)
   * In production: This would call client-side WASM or server-side prover
   */
  async generateProof(request: ProofRequest): Promise<ProofResult> {
    this.logger.log(`Generating ${request.circuitType} proof`);
    
    const startTime = Date.now();

    try {
      // Check cache first
      const proofHash = this.hashProofRequest(request);
      const cached = await this.redisService.getCachedProofResult(proofHash);
      
      if (cached) {
        this.logger.debug(`Using cached proof: ${proofHash}`);
        return cached;
      }

      // TODO: Call actual prover
      // For MVP: This would coordinate with:
      // 1. Client-side WASM prover (preferred for privacy)
      // 2. Server-side prover (for agents without WASM support)
      
      // const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      //   request.privateInputs,
      //   `${request.circuitType}.wasm`,
      //   `${request.circuitType}_0001.zkey`
      // );

      // Mock proof generation for now
      const mockProof: ZKProof = {
        a: ['0x1', '0x2'],
        b: [['0x3', '0x4'], ['0x5', '0x6']],
        c: ['0x7', '0x8'],
      };

      const result: ProofResult = {
        valid: true,
        proof: mockProof,
        publicSignals: request.publicSignals,
        verificationTime: Date.now() - startTime,
        vkeyVersion: this.VKEY_VERSIONS[request.circuitType],
      };

      // Cache the result (proofs are expensive to generate)
      await this.redisService.cacheProofResult(proofHash, result, 3600);

      this.logger.log(`Proof generated in ${result.verificationTime}ms`);
      return result;

    } catch (error) {
      this.logger.error('Proof generation failed:', error);
      return {
        valid: false,
        error: error.message,
        verificationTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Verify proof off-chain (Groth16 verification)
   * This is the CRITICAL security check before submitting to chain
   */
  async verifyProof(
    circuitType: 'spend' | 'credential',
    proof: ZKProof,
    publicSignals: string[]
  ): Promise<ProofResult> {
    this.logger.log(`Verifying ${circuitType} proof`);
    
    const startTime = Date.now();

    try {
      // Check cache first
      const proofHash = this.hashProof({ proof, publicSignals });
      const cached = await this.redisService.getCachedProofResult(proofHash);
      
      if (cached) {
        this.logger.debug(`Using cached verification: ${proofHash}`);
        return cached;
      }

      // Load verification key from cache or S3
      const vkey = await this.loadVerificationKey(circuitType);
      
      if (!vkey) {
        throw new Error(`Verification key not found for ${circuitType}`);
      }

      // TODO: Actual Groth16 verification with snarkjs
      // const valid = await snarkjs.groth16.verify(vkey, publicSignals, proof);

      // For MVP: Basic validation
      const valid = this.validateProofStructure(proof, publicSignals);

      const result: ProofResult = {
        valid,
        verificationTime: Date.now() - startTime,
        vkeyVersion: this.VKEY_VERSIONS[circuitType],
        error: valid ? undefined : 'Proof verification failed',
      };

      // Cache verification result
      await this.redisService.cacheProofResult(proofHash, result, 3600);

      this.logger.log(`Proof verification: ${valid ? 'VALID' : 'INVALID'} (${result.verificationTime}ms)`);
      return result;

    } catch (error) {
      this.logger.error('Proof verification error:', error);
      return {
        valid: false,
        error: error.message,
        verificationTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Load verification key (from Redis cache or S3)
   */
  private async loadVerificationKey(circuitType: string): Promise<any> {
    try {
      // Check Redis cache
      const cached = await this.redisService.getClient().get(`vkey:${circuitType}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // TODO: Load from S3 or local filesystem
      // const vkey = await this.loadFromS3(`verification_keys/${circuitType}_vkey.json`);
      
      // Mock verification key structure
      const mockVkey = {
        protocol: 'groth16',
        curve: 'bn128',
        nPublic: circuitType === 'spend' ? 4 : 2,
        vk_alpha_1: ['0x1', '0x2'],
        vk_beta_2: [['0x3', '0x4'], ['0x5', '0x6']],
        vk_gamma_2: [['0x7', '0x8'], ['0x9', '0xa']],
        vk_delta_2: [['0xb', '0xc'], ['0xd', '0xe']],
        IC: [['0xf', '0x10']],
      };

      // Cache in Redis (no expiry for vkeys)
      await this.redisService.getClient().set(`vkey:${circuitType}`, JSON.stringify(mockVkey));

      return mockVkey;

    } catch (error) {
      this.logger.error(`Failed to load verification key for ${circuitType}:`, error);
      return null;
    }
  }

  /**
   * Basic proof structure validation
   */
  private validateProofStructure(proof: ZKProof, publicSignals: string[]): boolean {
    // Check proof structure
    if (!proof || !proof.a || !proof.b || !proof.c) {
      return false;
    }

    // Check array lengths
    if (proof.a.length !== 2) return false;
    if (proof.b.length !== 2 || proof.b[0].length !== 2 || proof.b[1].length !== 2) return false;
    if (proof.c.length !== 2) return false;

    // Check public signals exist
    if (!publicSignals || publicSignals.length === 0) {
      return false;
    }

    // All elements should be valid hex strings
    const allElements = [
      ...proof.a,
      ...proof.b.flat(),
      ...proof.c,
    ];

    return allElements.every(elem => /^0x[0-9a-fA-F]+$/.test(elem));
  }

  /**
   * Hash proof for caching
   */
  private hashProof(data: any): string {
    const dataString = JSON.stringify(data);
    return Buffer.from(dataString).toString('base64').slice(0, 32);
  }

  /**
   * Hash proof request for caching
   */
  private hashProofRequest(request: ProofRequest): string {
    const requestString = JSON.stringify({
      circuitType: request.circuitType,
      publicSignals: request.publicSignals,
    });
    return Buffer.from(requestString).toString('base64').slice(0, 32);
  }

  /**
   * Enqueue heavy proof generation job
   */
  async enqueueProofGeneration(request: ProofRequest): Promise<string> {
    const jobId = `proof_job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.redisService.enqueueEvent({
      type: 'proof_generation',
      payload: {
        jobId,
        ...request,
      },
      priority: 'high',
    });

    this.logger.log(`Proof generation job enqueued: ${jobId}`);
    return jobId;
  }

  /**
   * Get verification key version for audit
   */
  getVkeyVersion(circuitType: 'spend' | 'credential'): string {
    return this.VKEY_VERSIONS[circuitType];
  }

  /**
   * Health check for proof orchestrator
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    vkeysLoaded: boolean;
    cacheAvailable: boolean;
  }> {
    try {
      const spendVkey = await this.redisService.getClient().get('vkey:spend');
      const credentialVkey = await this.redisService.getClient().get('vkey:credential');
      const redisHealthy = await this.redisService.ping();

      return {
        status: (spendVkey && credentialVkey && redisHealthy) ? 'healthy' : 'degraded',
        vkeysLoaded: !!(spendVkey && credentialVkey),
        cacheAvailable: redisHealthy,
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        vkeysLoaded: false,
        cacheAvailable: false,
      };
    }
  }
}
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../redis/redis.service';
import * as snarkjs from 'snarkjs';
import { ZKKey, CircuitType } from '../database/entities/zk-key.entity';
import * as crypto from 'crypto';

interface ProofInput {
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
  };
  publicSignals: string[];
}

interface VerificationResult {
  valid: boolean;
  error?: string;
  vkeyVersion?: string;
  timestamp: number;
}

@Injectable()
export class ProofOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(ProofOrchestratorService.name);
  private vkeyCache = new Map<string, any>();

  constructor(
    @InjectRepository(ZKKey)
    private readonly zkKeyRepository: Repository<ZKKey>,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit() {
    await this.loadVerificationKeys();
  }

  /**
   * Load verification keys from database on startup
   */
  private async loadVerificationKeys(): Promise<void> {
    try {
      const activeKeys = await this.zkKeyRepository.find({ 
        where: { active: true } as any
      });
      
      for (const key of activeKeys) {
        const cacheKey = `${key.circuitName}_${key.version}`;
        this.vkeyCache.set(cacheKey, key.vkeyData);
        this.logger.log(`Loaded verification key: ${cacheKey}`);
      }

      if (activeKeys.length === 0) {
        this.logger.warn('No active verification keys found in database. Run seed script.');
      }
    } catch (error) {
      this.logger.error('Failed to load verification keys:', error);
    }
  }

  /**
   * Verify spend proof (payment verification)
   */
  async verifySpendProof(proofInput: ProofInput): Promise<VerificationResult> {
    return this.verifyProof(CircuitType.SPEND, proofInput);
  }

  /**
   * Verify credential proof (journalist credential)
   */
  async verifyCredentialProof(proofInput: ProofInput): Promise<VerificationResult> {
    return this.verifyProof(CircuitType.CREDENTIAL, proofInput);
  }

  /**
   * Generic proof verification with caching
   */
  async verifyProof(
    circuitType: CircuitType,
    proofInput: ProofInput,
  ): Promise<VerificationResult> {
    const startTime = Date.now();
    
    try {
      const proofHash = this.hashProof(proofInput);
      
      const cachedResult = await this.redisService.getCachedProofResult(proofHash);
      if (cachedResult) {
        this.logger.debug(`Proof verification cache hit`);
        return cachedResult;
      }

      const activeKey = await this.getActiveVerificationKey(circuitType);
      if (!activeKey) {
        return {
          valid: false,
          error: `No active verification key found for circuit: ${circuitType}`,
          timestamp: Date.now(),
        };
      }

      const formattedProof = this.formatProofForSnarkjs(proofInput.proof);
      
      const isValid = await snarkjs.groth16.verify(
        activeKey.vkeyData,
        proofInput.publicSignals,
        formattedProof,
      );

      const result: VerificationResult = {
        valid: isValid,
        vkeyVersion: activeKey.version,
        timestamp: Date.now(),
      };

      if (!isValid) {
        result.error = 'Proof verification failed';
      }

      const cacheTtl = isValid ? 3600 : 300;
      await this.redisService.cacheProofResult(proofHash, result, cacheTtl);

      const duration = Date.now() - startTime;
      this.logger.log(
        `Proof verified (${circuitType}): ${isValid} in ${duration}ms, vkey: ${activeKey.version}`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Proof verification error (${circuitType}):`, error);
      return {
        valid: false,
        error: error.message || 'Verification error',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get active verification key from cache or database
   */
  private async getActiveVerificationKey(circuitType: CircuitType): Promise<ZKKey | null> {
    const activeKey = await this.zkKeyRepository.findOne({
      where: { circuitName: circuitType, active: true } as any,
    });

    if (activeKey && !this.vkeyCache.has(`${circuitType}_${activeKey.version}`)) {
      this.vkeyCache.set(`${circuitType}_${activeKey.version}`, activeKey.vkeyData);
    }

    return activeKey;
  }

  /**
   * Format proof from contract format to snarkjs format
   */
  private formatProofForSnarkjs(proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
  }): any {
    return {
      pi_a: proof.pi_a.slice(0, 2),
      pi_b: [
        [proof.pi_b[0][1], proof.pi_b[0][0]],
        [proof.pi_b[1][1], proof.pi_b[1][0]],
      ],
      pi_c: proof.pi_c.slice(0, 2),
      protocol: 'groth16',
      curve: 'bn128',
    };
  }

  /**
   * Generate deterministic hash for proof caching
   */
  private hashProof(proofInput: ProofInput): string {
    const proofString = JSON.stringify({
      proof: proofInput.proof,
      signals: proofInput.publicSignals,
    });
    return crypto.createHash('sha256').update(proofString).digest('hex');
  }

  /**
   * Validate proof structure before verification
   */
  validateProofStructure(proof: any): boolean {
    if (!proof || typeof proof !== 'object') return false;
    
    if (!proof.pi_a || !Array.isArray(proof.pi_a) || proof.pi_a.length < 2) return false;
    if (!proof.pi_b || !Array.isArray(proof.pi_b) || proof.pi_b.length < 2) return false;
    if (!proof.pi_c || !Array.isArray(proof.pi_c) || proof.pi_c.length < 2) return false;
    
    if (!Array.isArray(proof.pi_b[0]) || !Array.isArray(proof.pi_b[1])) return false;
    
    return true;
  }

  /**
   * Reload verification keys (called when new keys are added)
   */
  async reloadVerificationKeys(): Promise<void> {
    this.vkeyCache.clear();
    await this.loadVerificationKeys();
  }
}

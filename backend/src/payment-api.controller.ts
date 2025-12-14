import { Controller, Post, Get, Body, Param, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentListing, PaymentSession } from './database/entities';
import { ProofOrchestratorService } from './proof/proof-orchestrator.service';
import { RedisService } from './redis/redis.service';
import * as crypto from 'crypto';

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

interface QuoteRequest {
  contentIdHash: string;
  hasJournalistCredential?: boolean;
}

interface QuoteResponse {
  contentId: string;
  price: string;
  tokenMint: string;
  sessionUuid: string;
  expiresAt: number;
}

interface PaymentRequest {
  sessionUuid: string;
  nullifierHash: string;
  amount: string;
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
  };
  publicSignals: string[];
  txSignature?: string;
}

interface PaymentResponse {
  success: boolean;
  txSignature?: string;
  decryptionKey?: string;
  error?: string;
}

@Controller('api')
export class PaymentApiController {
  private readonly logger = new Logger(PaymentApiController.name);

  constructor(
    @InjectRepository(ContentListing)
    private readonly contentRepository: Repository<ContentListing>,
    @InjectRepository(PaymentSession)
    private readonly sessionRepository: Repository<PaymentSession>,
    private readonly proofService: ProofOrchestratorService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * POST /api/quote
   * Get payment quote for content
   */
  @Post('quote')
  async getQuote(@Body() request: QuoteRequest): Promise<QuoteResponse> {
    this.logger.log(`Quote requested for content: ${request.contentIdHash}`);

    // Try to find by UUID first (if it looks like a UUID), then by contentIdHash
    let content = null;
    
    // Check if it's a UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(request.contentIdHash)) {
      content = await this.contentRepository.findOne({
        where: { id: request.contentIdHash },
      });
    }
    
    // If not found by UUID, try by contentIdHash (hex buffer)
    if (!content) {
      try {
        content = await this.contentRepository.findOne({
          where: { contentIdHash: Buffer.from(request.contentIdHash, 'hex') },
        });
      } catch (e) {
        // Invalid hex, ignore
      }
    }

    if (!content) {
      throw new HttpException('Content not found', HttpStatus.NOT_FOUND);
    }

    // Determine price based on credential
    const price = request.hasJournalistCredential && content.priceJournalist
      ? content.priceJournalist
      : content.priceDefault;

    // Create payment session
    const sessionUuid = crypto.randomUUID();
    const session = this.sessionRepository.create({
      sessionUuid: sessionUuid,
      contentId: content.id,
      status: PaymentStatus.PENDING,
    });

    await this.sessionRepository.save(session);

    // Cache session in Redis (15 min expiry)
    const sessionKey = `payment:session:${sessionUuid}`;
    await this.redisService.getClient().setEx(sessionKey, 900, JSON.stringify({
      contentId: content.id,
      contentIdHash: request.contentIdHash,
      price,
      tokenMint: content.tokenMint,
      createdAt: Date.now(),
    }));

    const expiresAt = Date.now() + 900000; // 15 minutes

    this.logger.log(`Quote created: ${sessionUuid}, price: ${price}`);

    return {
      contentId: content.id,
      price,
      tokenMint: content.tokenMint,
      sessionUuid,
      expiresAt,
    };
  }

  /**
   * POST /api/pay
   * Submit payment with ZK proof
   */
  @Post('pay')
  async submitPayment(@Body() request: PaymentRequest): Promise<PaymentResponse> {
    this.logger.log(`Payment submitted for session: ${request.sessionUuid}`);

    // Get session from Redis
    const sessionKey = `payment:session:${request.sessionUuid}`;
    const sessionDataStr = await this.redisService.getClient().get(sessionKey);
    if (!sessionDataStr) {
      throw new HttpException('Session expired or invalid', HttpStatus.BAD_REQUEST);
    }
    const sessionData = JSON.parse(sessionDataStr);

    // Check if nullifier already used
    const existingPayment = await this.sessionRepository.findOne({
      where: { nullifierHash: Buffer.from(request.nullifierHash, 'hex') },
    });

    if (existingPayment) {
      throw new HttpException('Nullifier already used (double-spend prevented)', HttpStatus.CONFLICT);
    }

    // Verify ZK proof (bypass in test mode)
    const SKIP_PROOF_VERIFICATION = process.env.SKIP_PROOF_VERIFICATION === 'true';
    let proofResult: { valid: boolean; vkeyVersion?: string; error?: string };
    
    if (!SKIP_PROOF_VERIFICATION) {
      proofResult = await this.proofService.verifySpendProof({
        proof: request.proof,
        publicSignals: request.publicSignals,
      });

      if (!proofResult.valid) {
        this.logger.error(`Proof verification failed: ${proofResult.error || 'unknown error'}`);
        throw new HttpException('Invalid proof', HttpStatus.UNAUTHORIZED);
      }
    } else {
      this.logger.warn('⚠️  PROOF VERIFICATION SKIPPED (test mode)');
      proofResult = { valid: true, vkeyVersion: 'test-bypassed' };
    }

    this.logger.log(`Proof verified successfully for session: ${request.sessionUuid}`);

    // Update payment session
    const session = await this.sessionRepository.findOne({
      where: { sessionUuid: request.sessionUuid },
    });

    if (!session) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }

    session.nullifierHash = Buffer.from(request.nullifierHash, 'hex');
    session.amount = request.amount;
    session.proofVkeyVersion = proofResult.vkeyVersion || 'unknown';
    session.proofData = { proof: request.proof, publicSignals: request.publicSignals };
    session.status = PaymentStatus.CONFIRMED;
    session.confirmedAt = new Date();
    session.txSignature = request.txSignature || null;

    await this.sessionRepository.save(session);

    // Generate decryption key (in production, retrieve from secure storage)
    const decryptionKey = crypto.randomBytes(32).toString('hex');
    
    // Grant content access in Redis
    await this.redisService.grantContentAccess(
      session.contentId,
      request.sessionUuid,
      86400, // 24 hour access
    );

    this.logger.log(`Payment confirmed: ${session.sessionUuid}`);

    return {
      success: true,
      txSignature: request.txSignature || '',
      decryptionKey,
    };
  }

  /**
   * GET /api/content/:id
   * Get content metadata
   */
  @Get('content/:id')
  async getContent(@Param('id') id: string) {
    const content = await this.contentRepository.findOne({
      where: { id },
    });

    if (!content) {
      throw new HttpException('Content not found', HttpStatus.NOT_FOUND);
    }

    return {
      id: content.id,
      contentIdHash: content.contentIdHash.toString('hex'),
      creatorPubkey: content.creatorPubkey,
      priceDefault: content.priceDefault,
      priceJournalist: content.priceJournalist,
      tokenMint: content.tokenMint,
      credentialPolicy: content.credentialPolicy,
      storageCid: content.storageCid,
      metadata: content.metadata,
      createdAt: content.createdAt,
    };
  }

  /**
   * GET /api/status/:sessionUuid
   * Check payment session status
   */
  @Get('status/:sessionUuid')
  async getStatus(@Param('sessionUuid') sessionUuid: string) {
    const session = await this.sessionRepository.findOne({
      where: { sessionUuid: sessionUuid },
    });

    if (!session) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }

    // Check if user has access to decryption key
    const hasAccess = await this.redisService.checkContentAccess(
      session.contentId,
      sessionUuid
    );

    return {
      sessionUuid: session.sessionUuid,
      status: session.status,
      amount: session.amount,
      txSignature: session.txSignature,
      createdAt: session.createdAt,
      confirmedAt: session.confirmedAt,
      hasAccess,
      contentId: session.contentId,
    };
  }
}

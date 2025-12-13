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

    const content = await this.contentRepository.findOne({
      where: { contentIdHash: Buffer.from(request.contentIdHash, 'hex') },
    });

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
      sessionUuid,
      contentId: content.id,
      status: PaymentStatus.PENDING,
    });

    await this.sessionRepository.save(session);

    // Cache session in Redis (15 min expiry)
    await this.redisService.createAgentSession(sessionUuid, {
      contentId: content.id,
      contentIdHash: request.contentIdHash,
      price,
      tokenMint: content.tokenMint,
      createdAt: Date.now(),
    }, 900);

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
    const sessionData = await this.redisService.getAgentSession(request.sessionUuid);
    if (!sessionData) {
      throw new HttpException('Session expired or invalid', HttpStatus.BAD_REQUEST);
    }

    // Check if nullifier already used
    const existingPayment = await this.sessionRepository.findOne({
      where: { nullifierHash: Buffer.from(request.nullifierHash, 'hex') },
    });

    if (existingPayment) {
      throw new HttpException('Nullifier already used (double-spend prevented)', HttpStatus.CONFLICT);
    }

    // Verify ZK proof
    const proofResult = await this.proofService.verifySpendProof({
      proof: request.proof,
      publicSignals: request.publicSignals,
    });

    if (!proofResult.valid) {
      this.logger.error(`Proof verification failed: ${proofResult.error}`);
      throw new HttpException('Invalid proof', HttpStatus.UNAUTHORIZED);
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
    
    // Store decryption key in session's encrypted field (simplified - should use proper encryption)
    session.decryptionKeyEncrypted = decryptionKey;
    await this.sessionRepository.save(session);
    
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
      where: { sessionUuid },
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

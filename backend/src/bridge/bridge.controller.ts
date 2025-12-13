import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Req,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { BridgeService } from './bridge.service';

/**
 * BridgeController
 * HTTP API for cross-chain payment verification via Wormhole
 * 
 * Endpoints:
 * - POST /api/bridge/verify - Verify and process a VAA
 * - GET /api/bridge/status/:vaaHash - Check VAA processing status
 * - GET /api/bridge/emitters/:chainId - Get whitelisted emitters
 */
@Controller('api/bridge')
export class BridgeController {
  private readonly logger = new Logger(BridgeController.name);

  constructor(private readonly bridgeService: BridgeService) {}

  /**
   * Verify and process a Wormhole VAA
   * 
   * POST /api/bridge/verify
   * Body: {
   *   emitterChain: number,      // Wormhole chain ID (30 = Base, 2 = Ethereum)
   *   emitterAddress: string,    // X402PaymentEmitter contract address
   *   sequence: string           // Wormhole message sequence number
   * }
   * 
   * Response 200: {
   *   success: true,
   *   sessionId: string,
   *   contentId: string,
   *   status: "CONFIRMED",
   *   vaaHash: string
   * }
   * 
   * Response 400: {
   *   statusCode: 400,
   *   message: "VAA not found - Guardians may not have signed yet"
   * }
   * 
   * Response 429: {
   *   statusCode: 429,
   *   message: "Rate limit exceeded"
   * }
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyVAA(
    @Body()
    body: {
      emitterChain: number;
      emitterAddress: string;
      sequence: string;
    },
    @Req() req: Request,
  ) {
    const { emitterChain, emitterAddress, sequence } = body;

    // Validation
    if (!emitterChain || !emitterAddress || !sequence) {
      throw new BadRequestException('Missing required fields');
    }

    // Rate limiting
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const allowed = await this.bridgeService.checkRateLimit(clientIp);
    
    if (!allowed) {
      throw new BadRequestException('Rate limit exceeded (10 requests/minute)');
    }

    try {
      // 1. Fetch and verify VAA
      const vaaData = await this.bridgeService.fetchAndVerifyVAA(
        emitterChain,
        emitterAddress,
        sequence,
      );

      // 2. Process VAA and create session
      const session = await this.bridgeService.processVAA(
        emitterChain,
        emitterAddress,
        sequence,
        vaaData,
      );

      this.logger.log(
        `VAA processed successfully: session=${session.id}, content=${session.contentId}`
      );

      return {
        success: true,
        sessionId: session.sessionUuid,
        contentId: session.contentId,
        status: session.status,
        vaaHash: vaaData.vaaHash,
        guardianSignatures: vaaData.guardianSignatures,
        confirmedAt: session.confirmedAt,
      };
      
    } catch (error) {
      this.logger.error(`VAA verification failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get whitelisted emitter contracts for a chain
   * 
   * GET /api/bridge/emitters/:chainId
   * Params: chainId (30 = Base, 2 = Ethereum)
   * 
   * Response: {
   *   chainId: number,
   *   emitters: string[]
   * }
   */
  @Get('emitters/:chainId')
  async getEmitters(@Param('chainId') chainId: string) {
    const emitters = this.bridgeService.getAllowedEmitters(Number(chainId));

    return {
      chainId: Number(chainId),
      emitters,
      count: emitters.length,
    };
  }

  /**
   * Health check endpoint
   * 
   * GET /api/bridge/health
   */
  @Get('health')
  async health() {
    return {
      status: 'ok',
      service: 'wormhole-bridge',
      timestamp: new Date().toISOString(),
    };
  }
}

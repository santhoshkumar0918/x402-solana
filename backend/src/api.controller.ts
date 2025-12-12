import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { PaymentService } from './payment/payment.service';
import { SolanaService } from './solana/solana.service';

@Controller('api')
export class ApiController {
  constructor(
    private paymentService: PaymentService,
    private solanaService: SolanaService,
  ) {}

  @Get('health')
  async health() {
    const solanaHealth = await this.solanaService.healthCheck();
    
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        solana: solanaHealth,
      },
    };
  }

  @Get('content/:endpoint/payment-info')
  async getPaymentInfo(@Param('endpoint') endpoint: string) {
    try {
      const fullEndpoint = `/api/content/${endpoint}`;
      
      if (!this.paymentService.isContentProtected(fullEndpoint)) {
        throw new HttpException('Content not found or not protected', HttpStatus.NOT_FOUND);
      }
      
      const contentInfo = await this.paymentService.getContentInfo(fullEndpoint);
      
      return {
        endpoint: fullEndpoint,
        payment_required: true,
        amount: contentInfo.price.toString(),
        token: 'USDC',
        recipient: contentInfo.recipient.toBase58(),
        metadata: contentInfo.metadata,
        zk_requirements: contentInfo.zkRequirements,
        zk_attestations: contentInfo.proofs,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('events/payments')
  async getRecentPayments() {
    try {
      const events = await this.solanaService.getRecentPaymentEvents(20);
      return {
        events,
        count: events.length,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
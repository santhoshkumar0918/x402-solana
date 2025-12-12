import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { X402Middleware } from './x402.middleware';
import { SolanaModule } from '../solana/solana.module';

@Module({
  imports: [SolanaModule],
  providers: [PaymentService, X402Middleware],
  exports: [PaymentService, X402Middleware],
})
export class PaymentModule {}
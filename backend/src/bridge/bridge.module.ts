import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BridgeService } from './bridge.service';
import { BridgeController } from './bridge.controller';
import { CrossChainPayment } from '../database/entities/CrossChainPayment';
import { PaymentSession, ContentListing } from '../database/entities';
import { RedisModule } from '../redis/redis.module';
import { SolanaModule } from '../solana/solana.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CrossChainPayment,
      PaymentSession,
      ContentListing,
    ]),
    RedisModule,
    SolanaModule,
  ],
  controllers: [BridgeController],
  providers: [BridgeService],
  exports: [BridgeService],
})
export class BridgeModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentApiController } from './payment-api.controller';
import { ContentListing, PaymentSession, AuditEvent } from './database/entities';
import { ProofModule } from './proof/proof.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContentListing, PaymentSession, AuditEvent]),
    ProofModule,
    RedisModule,
  ],
  controllers: [PaymentApiController],
})
export class PaymentApiModule {}

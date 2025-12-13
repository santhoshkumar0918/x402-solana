import { Module } from '@nestjs/common';
import { ContractIntegrationService } from './contract-integration.service';
import { RedisModule } from '../redis/redis.module';
import { SolanaModule } from '../solana/solana.module';

@Module({
  imports: [RedisModule, SolanaModule],
  providers: [ContractIntegrationService],
  exports: [ContractIntegrationService],
})
export class ContractsModule {}
import { Module } from '@nestjs/common';
import { ContractIntegrationService } from './contract-integration.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [ContractIntegrationService],
  exports: [ContractIntegrationService],
})
export class ContractsModule {}
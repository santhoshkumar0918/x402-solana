import { Module } from '@nestjs/common';
import { ProofOrchestratorService } from './proof-orchestrator.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [ProofOrchestratorService],
  exports: [ProofOrchestratorService],
})
export class ProofModule {}
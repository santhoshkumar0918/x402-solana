import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProofOrchestratorService } from './proof-orchestrator.service';
import { RedisModule } from '../redis/redis.module';
import { ZKKey } from '../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([ZKKey]),
    RedisModule,
  ],
  providers: [ProofOrchestratorService],
  exports: [ProofOrchestratorService],
})
export class ProofModule {}
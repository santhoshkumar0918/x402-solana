import { Module } from '@nestjs/common';
import { EventMonitorService } from './event-monitor.service';
import { RedisModule } from '../redis/redis.module';
import { SolanaModule } from '../solana/solana.module';

@Module({
  imports: [RedisModule, SolanaModule],
  providers: [EventMonitorService],
  exports: [EventMonitorService],
})
export class MonitoringModule {}
import { Module } from '@nestjs/common';
import { EventMonitorService } from './event-monitor.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [EventMonitorService],
  exports: [EventMonitorService],
})
export class MonitoringModule {}
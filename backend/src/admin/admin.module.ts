import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { RedisModule } from '../redis/redis.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { ContractsModule } from '../contracts/contracts.module';

@Module({
  imports: [RedisModule, MonitoringModule, ContractsModule],
  controllers: [AdminController],
})
export class AdminModule {}
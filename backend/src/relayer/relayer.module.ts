import { Module } from '@nestjs/common';
import { RelayerService } from './relayer.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [RelayerService],
  exports: [RelayerService],
})
export class RelayerModule {}
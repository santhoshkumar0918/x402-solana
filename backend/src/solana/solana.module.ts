import { Module } from '@nestjs/common';
import { SolanaService } from './solana.service';
import { ListenerService } from './listener.service';

@Module({
  providers: [SolanaService, ListenerService],
  exports: [SolanaService, ListenerService],
})
export class SolanaModule {}
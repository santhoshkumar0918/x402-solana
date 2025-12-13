import { Module } from '@nestjs/common';
import { Connection } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { SolanaService } from './solana.service';
import { ListenerService } from './listener.service';

@Module({
  providers: [
    {
      provide: Connection,
      useFactory: () => {
        return new Connection(
          process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
          'confirmed',
        );
      },
    },
    {
      provide: anchor.AnchorProvider,
      useFactory: (connection: Connection) => {
        // Readonly provider for contract reads (no wallet needed)
        return new anchor.AnchorProvider(
          connection,
          null as any, // No wallet for server-side reads
          { commitment: 'confirmed' },
        );
      },
      inject: [Connection],
    },
    SolanaService,
    ListenerService,
  ],
  exports: [Connection, anchor.AnchorProvider, SolanaService, ListenerService],
})
export class SolanaModule {}
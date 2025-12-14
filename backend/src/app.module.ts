import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApiController } from './api.controller';
import { ContentController } from './content.controller';
import { ContentManagementController } from './content-management.controller';
import { SupabaseService } from './storage/supabase.service';
import { SolanaModule } from './solana/solana.module';
import { PaymentModule } from './payment/payment.module';
import { PaymentApiModule } from './payment-api.module';
import { RedisModule } from './redis/redis.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { ContractsModule } from './contracts/contracts.module';
import { AdminModule } from './admin/admin.module';
import { ProofModule } from './proof/proof.module';
import { BridgeModule } from './bridge/bridge.module';
import { X402Middleware } from './payment/x402.middleware';
import { 
  ContentListing, 
  PaymentSession, 
  AuditEvent, 
  ZKKey, 
  CredentialIssuer, 
  MerkleRoot,
  // CrossChainTransaction  // Disabled due to TypeORM enum bug
} from './database/entities';
import { CrossChainPayment } from './database/entities/CrossChainPayment';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [
        ContentListing,
        PaymentSession,
        AuditEvent,
        ZKKey,
        CredentialIssuer,
        MerkleRoot,
        CrossChainPayment,
        // CrossChainTransaction, // Disabled due to TypeORM enum bug
      ],
      synchronize: process.env.NODE_ENV === 'development',
      logging: process.env.NODE_ENV === 'development',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    }),
    TypeOrmModule.forFeature([ContentListing, PaymentSession]),
    MulterModule.register({
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
      },
    }),
    RedisModule,
    SolanaModule,
    PaymentModule,
    PaymentApiModule,
    ProofModule,
    MonitoringModule,
    ContractsModule,
    AdminModule,
    BridgeModule,
  ],
  controllers: [
    AppController, 
    ApiController, 
    // ContentController, // Disabled - Using ContentManagementController instead
    ContentManagementController,
  ],
  providers: [AppService, SupabaseService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply x402 middleware to all API routes that might serve protected content
    consumer
      .apply(X402Middleware)
      .forRoutes('api/content/*');
  }
}

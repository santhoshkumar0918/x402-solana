import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApiController } from './api.controller';
import { ContentController } from './content.controller';
import { SolanaModule } from './solana/solana.module';
import { PaymentModule } from './payment/payment.module';
import { RedisModule } from './redis/redis.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { ContractsModule } from './contracts/contracts.module';
import { AdminModule } from './admin/admin.module';
import { X402Middleware } from './payment/x402.middleware';

@Module({
  imports: [
    RedisModule,
    SolanaModule,
    PaymentModule,
    MonitoringModule,
    ContractsModule,
    AdminModule,
  ],
  controllers: [AppController, ApiController, ContentController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply x402 middleware to all API routes that might serve protected content
    consumer
      .apply(X402Middleware)
      .forRoutes('api/content/*');
  }
}

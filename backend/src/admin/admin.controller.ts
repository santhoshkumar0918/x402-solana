import { Controller, Get, Post, Param, Body, HttpException, HttpStatus } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { EventMonitorService } from '../monitoring/event-monitor.service';
import { ContractIntegrationService } from '../contracts/contract-integration.service';

@Controller('api/admin')
export class AdminController {
  constructor(
    private readonly redisService: RedisService,
    private readonly eventMonitor: EventMonitorService,
    private readonly contractService: ContractIntegrationService,
  ) {}

  /**
   * System health check with detailed status
   */
  @Get('health')
  async getSystemHealth(): Promise<any> {
    try {
      const redisHealth = await this.redisService.ping();
      const monitoringStatus = await this.eventMonitor.getMonitoringStatus();
      const contractHealth = await this.contractService.getIntegrationHealth();

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          redis: {
            status: redisHealth ? 'up' : 'down',
            connected: redisHealth,
          },
          monitoring: {
            status: monitoringStatus.isRunning ? 'up' : 'down',
            ...monitoringStatus,
          },
          contracts: {
            status: contractHealth.connection ? 'up' : 'down',
            ...contractHealth,
          },
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'System health check failed',
          error: error.message,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Start event monitoring
   */
  @Post('monitoring/start')
  async startMonitoring(): Promise<{ message: string }> {
    try {
      await this.eventMonitor.startMonitoring();
      return { message: 'Event monitoring started' };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to start monitoring',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Stop event monitoring
   */
  @Post('monitoring/stop')
  async stopMonitoring(): Promise<{ message: string }> {
    try {
      await this.eventMonitor.stopMonitoring();
      return { message: 'Event monitoring stopped' };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to stop monitoring',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get monitoring status
   */
  @Get('monitoring/status')
  async getMonitoringStatus(): Promise<any> {
    return await this.eventMonitor.getMonitoringStatus();
  }

  /**
   * Get recent payments
   */
  @Get('payments/recent/:limit?')
  async getRecentPayments(@Param('limit') limit?: string): Promise<any[]> {
    const limitNum = limit ? parseInt(limit) : 10;
    return await this.contractService.getRecentPayments(limitNum);
  }

  /**
   * Register new content
   */
  @Post('content/register')
  async registerContent(
    @Body() data: {
      contentId: string;
      title: string;
      description: string;
      price: string;
      credentialRequirements?: string[];
      accessDuration?: number;
    }
  ): Promise<{ signature: string }> {
    try {
      const signature = await this.contractService.registerContent(data.contentId, {
        title: data.title,
        description: data.description,
        price: new (require('bn.js'))(data.price),
        credentialRequirements: data.credentialRequirements,
        accessDuration: data.accessDuration,
      });

      return { signature };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Content registration failed',
          error: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Clear Redis cache
   */
  @Post('cache/clear')
  async clearCache(): Promise<{ message: string }> {
    try {
      await this.redisService.getClient().flushDb();
      return { message: 'Cache cleared successfully' };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to clear cache',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get cache statistics
   */
  @Get('cache/stats')
  async getCacheStats(): Promise<any> {
    try {
      const info = await this.redisService.getClient().info('memory');
      const dbSize = await this.redisService.getClient().dbSize();
      
      return {
        databaseSize: dbSize,
        memoryInfo: info,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to get cache stats',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get payment status by signature
   */
  @Get('payment/status/:signature')
  async getPaymentStatus(@Param('signature') signature: string): Promise<any> {
    const status = await this.redisService.getPaymentStatus(signature);
    if (!status) {
      throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
    }
    return status;
  }

  /**
   * Grant manual content access (admin override)
   */
  @Post('content/:contentId/grant-access')
  async grantContentAccess(
    @Param('contentId') contentId: string,
    @Body() data: { walletAddress: string; duration?: number }
  ): Promise<{ message: string }> {
    try {
      await this.redisService.grantContentAccess(
        contentId,
        data.walletAddress,
        data.duration || 86400
      );

      return {
        message: `Access granted to ${data.walletAddress} for content ${contentId}`,
      };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to grant access',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Revoke content access
   */
  @Post('content/:contentId/revoke-access')
  async revokeContentAccess(
    @Param('contentId') contentId: string,
    @Body() data: { walletAddress: string }
  ): Promise<{ message: string }> {
    try {
      await this.redisService.revokeContentAccess(contentId, data.walletAddress);
      return {
        message: `Access revoked for ${data.walletAddress} from content ${contentId}`,
      };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to revoke access',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { Connection, PublicKey, ConfirmedSignatureInfo } from '@solana/web3.js';
import BN from 'bn.js';

interface PaymentEvent {
  signature: string;
  slot: number;
  blockTime: number | null;
  nullifier: string;
  amount: BN;
  recipient: string;
  contentId?: string;
}

@Injectable()
export class EventMonitorService {
  private readonly logger = new Logger(EventMonitorService.name);
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly redisService: RedisService,
    private readonly connection: Connection,
  ) {}

  /**
   * Start monitoring blockchain events for payments
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      this.logger.warn('Event monitoring already running');
      return;
    }

    this.logger.log('Starting blockchain event monitoring...');
    this.isMonitoring = true;

    // Monitor every 10 seconds
    this.monitoringInterval = setInterval(async () => {
      await this.scanForPaymentEvents();
    }, 10000);

    // Do initial scan
    await this.scanForPaymentEvents();
  }

  /**
   * Stop monitoring blockchain events
   */
  async stopMonitoring(): Promise<void> {
    this.logger.log('Stopping blockchain event monitoring...');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Scan for new payment events on the blockchain
   */
  private async scanForPaymentEvents(): Promise<void> {
    try {
      // Get the last processed signature from Redis
      const lastSignature = await this.redisService.getClient().get('monitor:last_signature');
      
      // Get recent transactions for spend-verifier program
      const signatures = await this.connection.getSignaturesForAddress(
        new PublicKey('CwJ5s1e69mv5uAnTyaAxos9DVVQ2kWcz53BQm6krzDG9'), // spend-verifier program
        {
          limit: 50,
          before: lastSignature || undefined,
        }
      );

      if (signatures.length === 0) {
        return;
      }

      // Process signatures in reverse order (oldest first)
      for (const signatureInfo of signatures.reverse()) {
        await this.processPaymentTransaction(signatureInfo);
      }

      // Update last processed signature
      if (signatures.length > 0) {
        await this.redisService.getClient().set(
          'monitor:last_signature', 
          signatures[0].signature
        );
      }

    } catch (error) {
      this.logger.error('Error scanning for payment events:', error);
    }
  }

  /**
   * Process individual payment transaction
   */
  private async processPaymentTransaction(signatureInfo: ConfirmedSignatureInfo): Promise<void> {
    try {
      const { signature } = signatureInfo;
      
      // Check if we've already processed this transaction
      const alreadyProcessed = await this.redisService.getClient().get(`processed:${signature}`);
      if (alreadyProcessed) {
        return;
      }

      // Get full transaction details
      const transaction = await this.connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!transaction || transaction.meta?.err) {
        this.logger.debug(`Skipping failed/invalid transaction: ${signature}`);
        return;
      }

      // Parse payment event from transaction logs
      const paymentEvent = await this.parsePaymentEvent(transaction, signatureInfo);
      if (!paymentEvent) {
        return;
      }

      // Process the payment
      await this.handlePaymentEvent(paymentEvent);
      
      // Mark as processed
      await this.redisService.getClient().setEx(`processed:${signature}`, 3600, 'true');
      
      this.logger.log(`Processed payment event: ${signature}`);

    } catch (error) {
      this.logger.error(`Error processing transaction ${signatureInfo.signature}:`, error);
    }
  }

  /**
   * Parse payment event from transaction data
   */
  private async parsePaymentEvent(transaction: any, signatureInfo: ConfirmedSignatureInfo): Promise<PaymentEvent | null> {
    try {
      // Look for program logs from spend-verifier
      const logs = transaction.meta?.logMessages || [];
      
      for (const log of logs) {
        // Look for payment verification success log
        if (log.includes('Program log: Payment verified')) {
          // Parse the log to extract payment details
          const paymentData = this.parsePaymentLog(log);
          if (paymentData) {
            return {
              signature: signatureInfo.signature,
              slot: signatureInfo.slot,
              blockTime: signatureInfo.blockTime ?? null,
              ...paymentData,
            };
          }
        }
      }

      return null;
    } catch (error) {
      this.logger.error('Error parsing payment event:', error);
      return null;
    }
  }

  /**
   * Parse payment details from program log
   */
  private parsePaymentLog(log: string): { nullifier: string; amount: BN; recipient: string; contentId?: string } | null {
    try {
      // This would parse the actual log format from your spend-verifier program
      // For now, return mock data structure
      
      // Example log format: "Program log: Payment verified: nullifier=abc123, amount=1000000, recipient=xyz789"
      const nullifierMatch = log.match(/nullifier=([a-f0-9]+)/);
      const amountMatch = log.match(/amount=(\d+)/);
      const recipientMatch = log.match(/recipient=([A-Za-z0-9]+)/);
      const contentMatch = log.match(/content=([a-zA-Z0-9-]+)/);

      if (!nullifierMatch || !amountMatch || !recipientMatch) {
        return null;
      }

      return {
        nullifier: nullifierMatch[1],
        amount: new BN(amountMatch[1]),
        recipient: recipientMatch[1],
        contentId: contentMatch ? contentMatch[1] : undefined,
      };
    } catch (error) {
      this.logger.error('Error parsing payment log:', error);
      return null;
    }
  }

  /**
   * Handle a verified payment event
   */
  private async handlePaymentEvent(event: PaymentEvent): Promise<void> {
    try {
      this.logger.log(`Processing payment event for nullifier: ${event.nullifier}`);

      // Update payment status in Redis
      await this.redisService.trackPaymentStatus(
        event.signature,
        'confirmed',
        {
          nullifier: event.nullifier,
          amount: event.amount.toString(),
          recipient: event.recipient,
          contentId: event.contentId,
          blockTime: event.blockTime,
          slot: event.slot,
        }
      );

      // If content ID is specified, grant access
      if (event.contentId) {
        await this.redisService.grantContentAccess(
          event.contentId,
          event.recipient,
          86400 // 24 hours access
        );

        this.logger.log(`Granted access to content ${event.contentId} for ${event.recipient}`);
      }

      // Enqueue notification event
      await this.redisService.enqueueEvent({
        type: 'payment_confirmed',
        payload: {
          signature: event.signature,
          nullifier: event.nullifier,
          amount: event.amount.toString(),
          recipient: event.recipient,
          contentId: event.contentId,
          timestamp: new Date().toISOString(),
        },
        priority: 'high',
      });

      // Emit webhook or notification if configured
      await this.notifyPaymentConfirmed(event);

    } catch (error) {
      this.logger.error('Error handling payment event:', error);
      
      // Enqueue retry event
      await this.redisService.enqueueEvent({
        type: 'payment_retry',
        payload: { event, error: error.message },
        priority: 'low',
      });
    }
  }

  /**
   * Send notifications for confirmed payments
   */
  private async notifyPaymentConfirmed(event: PaymentEvent): Promise<void> {
    try {
      // This would send notifications via:
      // - WebSocket to connected clients
      // - Webhook to registered endpoints  
      // - Email/SMS if configured
      // - MCP notifications to AI agents

      this.logger.debug(`Payment notification sent for ${event.signature}`);
    } catch (error) {
      this.logger.error('Error sending payment notification:', error);
    }
  }

  /**
   * Get recent payment events
   */
  async getRecentPayments(limit: number = 10): Promise<any[]> {
    try {
      // This would return processed payment events from database
      // For now, return mock data
      return [
        {
          signature: 'tx_example_1',
          nullifier: 'null_123',
          amount: '1000000',
          recipient: 'wallet_abc',
          contentId: 'whistleblower-docs',
          timestamp: new Date().toISOString(),
        },
        {
          signature: 'tx_example_2', 
          nullifier: 'null_456',
          amount: '500000',
          recipient: 'wallet_def',
          contentId: 'leaked-emails',
          timestamp: new Date(Date.now() - 60000).toISOString(),
        },
      ];
    } catch (error) {
      this.logger.error('Error getting recent payments:', error);
      return [];
    }
  }

  /**
   * Health check for monitoring service
   */
  async getMonitoringStatus(): Promise<{
    isRunning: boolean;
    lastScan: string | null;
    processedCount: number;
  }> {
    const lastSignature = await this.redisService.getClient().get('monitor:last_signature');
    const processedCount = await this.redisService.getClient().dbSize(); // Approximate

    return {
      isRunning: this.isMonitoring,
      lastScan: lastSignature ? new Date().toISOString() : null,
      processedCount,
    };
  }
}
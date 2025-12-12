import { Injectable, Logger } from '@nestjs/common';
import { SolanaService } from './solana.service';

@Injectable()
export class ListenerService {
  private readonly logger = new Logger(ListenerService.name);
  private isListening = false;
  private listeners: Map<string, any> = new Map();

  constructor(private solanaService: SolanaService) {}

  /**
   * Start listening for payment events from shielded-pool program
   */
  async startListening(): Promise<void> {
    if (this.isListening) {
      this.logger.warn('Listener already started');
      return;
    }

    this.logger.log('Starting Solana event listener...');
    this.isListening = true;

    try {
      // Start payment event listener
      await this.startPaymentEventListener();
      
      // Start nullifier event listener
      await this.startNullifierEventListener();
      
      this.logger.log('Solana event listeners started successfully');
    } catch (error) {
      this.logger.error('Failed to start event listeners', error);
      this.isListening = false;
      throw error;
    }
  }

  /**
   * Stop all event listeners
   */
  async stopListening(): Promise<void> {
    if (!this.isListening) {
      return;
    }

    this.logger.log('Stopping Solana event listeners...');
    
    // Stop all active listeners
    for (const [name, listener] of this.listeners) {
      try {
        if (listener && typeof listener.removeListener === 'function') {
          listener.removeListener();
        }
        this.logger.debug(`Stopped listener: ${name}`);
      } catch (error) {
        this.logger.error(`Error stopping listener ${name}`, error);
      }
    }

    this.listeners.clear();
    this.isListening = false;
    this.logger.log('All event listeners stopped');
  }

  /**
   * Listen for payment processed events
   */
  private async startPaymentEventListener(): Promise<void> {
    this.logger.debug('Starting payment event listener...');
    
    // Mock event listener for development
    // In production, this would use WebSocket subscription to program logs
    const mockListener = setInterval(async () => {
      try {
        const recentEvents = await this.solanaService.getRecentPaymentEvents(5);
        
        for (const event of recentEvents) {
          await this.handlePaymentEvent(event);
        }
      } catch (error) {
        this.logger.error('Error processing payment events', error);
      }
    }, 5000); // Check every 5 seconds

    this.listeners.set('paymentEvents', {
      removeListener: () => clearInterval(mockListener)
    });
  }

  /**
   * Listen for nullifier usage events
   */
  private async startNullifierEventListener(): Promise<void> {
    this.logger.debug('Starting nullifier event listener...');
    
    // Mock nullifier listener
    const mockListener = setInterval(() => {
      // In production, this would monitor nullifier state changes
      this.logger.debug('Monitoring nullifier state...');
    }, 10000); // Check every 10 seconds

    this.listeners.set('nullifierEvents', {
      removeListener: () => clearInterval(mockListener)
    });
  }

  /**
   * Handle a payment event
   */
  private async handlePaymentEvent(event: any): Promise<void> {
    this.logger.debug(`Processing payment event: ${event.signature}`);
    
    try {
      // Emit event for other services to handle
      // In production, this would trigger content unlocking
      this.logger.log(`Payment processed - Amount: ${event.amount.toString()}, Signature: ${event.signature}`);
      
      // Example: Unlock content for the user
      await this.unlockContentForPayment(event);
      
    } catch (error) {
      this.logger.error(`Error handling payment event ${event.signature}`, error);
    }
  }

  /**
   * Unlock content after successful payment
   */
  private async unlockContentForPayment(event: any): Promise<void> {
    try {
      // This would integrate with the payment service to unlock content
      this.logger.log(`Content unlocked for payment: ${event.signature}`);
      
      // Mock content unlocking
      const unlockResult = {
        paymentSignature: event.signature,
        contentId: `content_${event.nullifier}`,
        unlockedAt: new Date(),
        recipient: event.recipient.toBase58(),
      };
      
      this.logger.debug('Content unlock result:', unlockResult);
      
    } catch (error) {
      this.logger.error('Error unlocking content', error);
    }
  }

  /**
   * Get listener status
   */
  getStatus(): { listening: boolean; activeListeners: string[] } {
    return {
      listening: this.isListening,
      activeListeners: Array.from(this.listeners.keys()),
    };
  }
}
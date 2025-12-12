import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'redis';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: ReturnType<typeof Redis.createClient>;
  private readonly config: RedisConfig;

  constructor() {
    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      keyPrefix: 'x402:',
    };
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      this.client = Redis.createClient({
        socket: {
          host: this.config.host,
          port: this.config.port,
        },
        password: this.config.password,
        database: this.config.db,
      });

      this.client.on('error', (err) => {
        this.logger.error('Redis connection error:', err);
      });

      this.client.on('connect', () => {
        this.logger.log('Connected to Redis');
      });

      this.client.on('ready', () => {
        this.logger.log('Redis client ready');
      });

      await this.client.connect();
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  private async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Disconnected from Redis');
    }
  }

  /**
   * Cache ZK proof results (expensive to compute)
   */
  async cacheProofResult(proofHash: string, result: any, ttl: number = 3600): Promise<void> {
    const key = `proof:${proofHash}`;
    await this.client.setEx(key, ttl, JSON.stringify(result));
    this.logger.debug(`Cached proof result: ${key}`);
  }

  async getCachedProofResult(proofHash: string): Promise<any | null> {
    const key = `proof:${proofHash}`;
    const result = await this.client.get(key);
    return result ? JSON.parse(result) : null;
  }

  /**
   * AI Agent Session Management
   */
  async createAgentSession(agentId: string, sessionData: any, ttl: number = 86400): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const key = `agent:session:${sessionId}`;
    
    await this.client.setEx(key, ttl, JSON.stringify({
      agentId,
      createdAt: new Date().toISOString(),
      ...sessionData,
    }));
    
    // Also index by agent ID for lookup
    await this.client.setEx(`agent:active:${agentId}`, ttl, sessionId);
    
    this.logger.log(`Created agent session: ${sessionId} for agent: ${agentId}`);
    return sessionId;
  }

  async getAgentSession(sessionId: string): Promise<any | null> {
    const key = `agent:session:${sessionId}`;
    const result = await this.client.get(key);
    return result ? JSON.parse(result) : null;
  }

  async updateAgentSession(sessionId: string, updates: any): Promise<void> {
    const existing = await this.getAgentSession(sessionId);
    if (!existing) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    const key = `agent:session:${sessionId}`;
    const ttl = await this.client.ttl(key);
    
    await this.client.setEx(key, ttl > 0 ? ttl : 86400, JSON.stringify(updated));
  }

  async deleteAgentSession(sessionId: string): Promise<void> {
    const session = await this.getAgentSession(sessionId);
    if (session) {
      await this.client.del(`agent:session:${sessionId}`);
      await this.client.del(`agent:active:${session.agentId}`);
      this.logger.log(`Deleted agent session: ${sessionId}`);
    }
  }

  /**
   * Payment Status Tracking
   */
  async trackPaymentStatus(
    paymentId: string, 
    status: 'pending' | 'processing' | 'confirmed' | 'failed',
    details: any = {}
  ): Promise<void> {
    const key = `payment:${paymentId}`;
    const paymentData = {
      status,
      timestamp: new Date().toISOString(),
      ...details,
    };
    
    // Store current status
    await this.client.setEx(key, 3600, JSON.stringify(paymentData));
    
    // Add to payment history
    await this.client.lPush(`payment:history:${paymentId}`, JSON.stringify(paymentData));
    await this.client.expire(`payment:history:${paymentId}`, 86400 * 7); // 7 days
  }

  async getPaymentStatus(paymentId: string): Promise<any | null> {
    const key = `payment:${paymentId}`;
    const result = await this.client.get(key);
    return result ? JSON.parse(result) : null;
  }

  async getPaymentHistory(paymentId: string): Promise<any[]> {
    const history = await this.client.lRange(`payment:history:${paymentId}`, 0, -1);
    return history.map(item => JSON.parse(item));
  }

  /**
   * Content Access Control
   */
  async grantContentAccess(
    contentId: string, 
    walletAddress: string, 
    ttl: number = 86400
  ): Promise<void> {
    const key = `access:${contentId}:${walletAddress}`;
    await this.client.setEx(key, ttl, JSON.stringify({
      granted: true,
      grantedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    }));
    
    this.logger.log(`Granted access to ${contentId} for ${walletAddress}`);
  }

  async checkContentAccess(contentId: string, walletAddress: string): Promise<boolean> {
    const key = `access:${contentId}:${walletAddress}`;
    const result = await this.client.get(key);
    return !!result;
  }

  async revokeContentAccess(contentId: string, walletAddress: string): Promise<void> {
    const key = `access:${contentId}:${walletAddress}`;
    await this.client.del(key);
    this.logger.log(`Revoked access to ${contentId} for ${walletAddress}`);
  }

  /**
   * Rate Limiting
   */
  async isRateLimited(
    identifier: string, 
    windowMs: number = 60000, 
    maxRequests: number = 100
  ): Promise<boolean> {
    const key = `ratelimit:${identifier}`;
    const current = await this.client.incr(key);
    
    if (current === 1) {
      await this.client.expire(key, Math.ceil(windowMs / 1000));
    }
    
    return current > maxRequests;
  }

  /**
   * Event Queue for Background Processing
   */
  async enqueueEvent(event: {
    type: string;
    payload: any;
    priority?: 'low' | 'normal' | 'high';
  }): Promise<void> {
    const queueKey = `queue:${event.priority || 'normal'}`;
    const eventData = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...event,
    };
    
    await this.client.lPush(queueKey, JSON.stringify(eventData));
    this.logger.debug(`Enqueued event: ${eventData.id}`);
  }

  async dequeueEvent(priority: 'low' | 'normal' | 'high' = 'normal'): Promise<any | null> {
    const queueKey = `queue:${priority}`;
    const result = await this.client.rPop(queueKey);
    return result ? JSON.parse(result) : null;
  }

  /**
   * Cross-Chain Bridge Monitoring
   */
  async trackBridgeTransaction(
    sourceChain: string,
    sourceTxHash: string,
    targetChain: string,
    paymentId: string
  ): Promise<void> {
    const key = `bridge:${sourceTxHash}`;
    await this.client.setEx(key, 86400, JSON.stringify({
      sourceChain,
      sourceTxHash,
      targetChain,
      paymentId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }));
  }

  async getBridgeTransaction(sourceTxHash: string): Promise<any | null> {
    const key = `bridge:${sourceTxHash}`;
    const result = await this.client.get(key);
    return result ? JSON.parse(result) : null;
  }

  async updateBridgeStatus(
    sourceTxHash: string,
    status: 'pending' | 'vaa_signed' | 'completed' | 'failed',
    vaaData?: any
  ): Promise<void> {
    const existing = await this.getBridgeTransaction(sourceTxHash);
    if (!existing) return;

    const updated = {
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
      ...(vaaData && { vaaData }),
    };

    const key = `bridge:${sourceTxHash}`;
    await this.client.setEx(key, 86400, JSON.stringify(updated));
  }

  /**
   * Health Check
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Get Redis client for advanced operations
   */
  getClient(): ReturnType<typeof Redis.createClient> {
    return this.client;
  }
}
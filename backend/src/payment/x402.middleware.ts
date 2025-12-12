import { Injectable, NestMiddleware, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PaymentService } from './payment.service';

interface X402PaymentInfo {
  amount: string;
  token: string;
  recipient: string;
  network: string;
  endpoint: string;
  zkRequirements?: any;
  zkAttestations?: any[];
}

@Injectable()
export class X402Middleware implements NestMiddleware {
  private readonly logger = new Logger(X402Middleware.name);

  constructor(private paymentService: PaymentService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const endpoint = req.path;
    
    // Check if this endpoint requires payment
    if (!this.paymentService.isContentProtected(endpoint)) {
      return next();
    }

    this.logger.debug(`x402 check for protected endpoint: ${endpoint}`);

    try {
      // Check for payment proof in request
      const paymentProof = this.extractPaymentProof(req);
      
      if (paymentProof) {
        // Verify and process the payment
        const txSignature = await this.paymentService.verifyAndProcessPayment(endpoint, paymentProof);
        
        // Confirm transaction
        const confirmed = await this.paymentService['solanaService'].confirmTransaction(txSignature);
        
        if (confirmed) {
          // Payment successful, unlock content
          const content = await this.paymentService.unlockContent(endpoint, txSignature);
          
          // Add payment receipt to response headers
          res.setHeader('X-Payment-Receipt', txSignature);
          res.setHeader('X-Payment-Confirmed', 'true');
          
          // Attach content to request for controller to use
          (req as any).unlockedContent = content;
          
          this.logger.log(`Payment verified, content unlocked: ${endpoint}`);
          return next();
        }
      }

      // No valid payment found, return 402 Payment Required
      await this.sendPaymentRequired(res, endpoint);
      
    } catch (error) {
      this.logger.error(`x402 middleware error for ${endpoint}`, error);
      
      if (error.message.includes('not confirmed')) {
        // Payment pending confirmation
        this.sendPaymentPending(res, error.message);
      } else {
        // Payment verification failed
        await this.sendPaymentRequired(res, endpoint, error.message);
      }
    }
  }

  /**
   * Extract payment proof from request headers or body
   */
  private extractPaymentProof(req: Request): any | null {
    try {
      // Check for payment proof in headers
      const proofHeader = req.headers['x-payment-proof'] as string;
      if (proofHeader) {
        return JSON.parse(proofHeader);
      }

      // Check for payment proof in body
      if (req.body && req.body.paymentProof) {
        return req.body.paymentProof;
      }

      return null;
    } catch (error) {
      this.logger.error('Error extracting payment proof', error);
      return null;
    }
  }

  /**
   * Send HTTP 402 Payment Required response
   */
  private async sendPaymentRequired(
    res: Response,
    endpoint: string,
    error?: string
  ): Promise<void> {
    try {
      // Get content info and payment requirements
      const contentInfo = await this.paymentService.getContentInfo(endpoint);
      
      const paymentInfo: X402PaymentInfo = {
        amount: contentInfo.price.toString(),
        token: 'USDC',
        recipient: contentInfo.recipient.toBase58(),
        network: 'solana',
        endpoint: endpoint,
        zkRequirements: contentInfo.zkRequirements,
        zkAttestations: contentInfo.proofs,
      };

      // Set x402 headers
      res.setHeader('WWW-Authenticate', `x402-solana realm="${endpoint}"`);
      res.setHeader('X-Payment-Required', 'true');
      res.setHeader('X-Payment-Amount', paymentInfo.amount);
      res.setHeader('X-Payment-Token', paymentInfo.token);
      res.setHeader('X-Payment-Recipient', paymentInfo.recipient);
      res.setHeader('X-Payment-Network', paymentInfo.network);
      
      if (contentInfo.zkRequirements) {
        res.setHeader('X-Credential-Requirements', JSON.stringify(contentInfo.zkRequirements));
      }
      
      if (contentInfo.proofs.length > 0) {
        res.setHeader('X-ZK-Attestations', JSON.stringify(contentInfo.proofs));
      }

      // Send 402 response with payment information
      res.status(402).json({
        error: 'Payment Required',
        message: error || 'This content requires payment to access',
        payment: paymentInfo,
        instructions: {
          step1: 'Generate ZK proof with your payment and credentials',
          step2: 'Include proof in X-Payment-Proof header or request body',
          step3: 'Retry request with valid payment proof',
        },
      });
      
    } catch (error) {
      this.logger.error('Error sending payment required response', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Unable to process payment requirements',
      });
    }
  }

  /**
   * Send payment pending response
   */
  private sendPaymentPending(res: Response, message: string): void {
    res.status(202).json({
      status: 'Payment Pending',
      message: message,
      instructions: 'Please wait for transaction confirmation and retry',
    });
  }

  /**
   * Validate payment proof structure
   */
  private isValidPaymentProof(proof: any): boolean {
    return (
      proof &&
      typeof proof.nullifier === 'string' &&
      typeof proof.commitment === 'string' &&
      proof.amount &&
      proof.recipient &&
      proof.merkleProof &&
      proof.zkProof
    );
  }
}
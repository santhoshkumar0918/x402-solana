'use client';

import { useState } from 'react';
import { X, Loader2, CheckCircle, AlertCircle, Shield, Zap } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentId: string;
  contentTitle: string;
  price: number;
  credentialType: string;
}

type PaymentStep = 'quote' | 'proof' | 'payment' | 'polling' | 'success' | 'error';

export default function PaymentModal({ 
  isOpen, 
  onClose, 
  contentId, 
  contentTitle, 
  price,
  credentialType 
}: PaymentModalProps) {
  const { publicKey, connected } = useWallet();
  const [step, setStep] = useState<PaymentStep>('quote');
  const [sessionUuid, setSessionUuid] = useState<string>('');
  const [decryptionKey, setDecryptionKey] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState(0);

  if (!isOpen) return null;

  const handleStartPayment = async () => {
    if (!connected || !publicKey) {
      setError('Please connect your wallet first');
      setStep('error');
      return;
    }

    try {
      // Step 1: Get Quote
      setStep('quote');
      setProgress(25);
      
      // Mock quote API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockSessionUuid = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionUuid(mockSessionUuid);

      // Step 2: Generate ZK Proof
      setStep('proof');
      setProgress(50);
      
      // Mock ZK proof generation (in production, this would use snarkjs)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 3: Submit Payment
      setStep('payment');
      setProgress(75);
      
      // Mock payment submission
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Step 4: Poll for Status
      setStep('polling');
      setProgress(90);
      
      // Mock status polling
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 5: Success
      const mockDecryptionKey = `0x${Math.random().toString(16).substr(2, 64)}`;
      setDecryptionKey(mockDecryptionKey);
      setStep('success');
      setProgress(100);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setStep('error');
    }
  };

  const handleClose = () => {
    setStep('quote');
    setProgress(0);
    setError('');
    setSessionUuid('');
    setDecryptionKey('');
    onClose();
  };

  const renderStepContent = () => {
    switch (step) {
      case 'quote':
        return (
          <div className="text-center py-8">
            <div className="text-6xl mb-6">💳</div>
            <h3 className="text-2xl font-bold mb-4">Ready to Purchase?</h3>
            <p className="text-[#a8b8c8] mb-6">
              You're about to purchase access to:
            </p>
            <div className="card-modern p-6 mb-6">
              <p className="font-semibold text-lg mb-3 text-[#f0f4f8]">{contentTitle}</p>
              <p className="text-[#00d4ff] text-4xl font-bold tracking-tight">${price.toFixed(2)} USDC</p>
            </div>
            
            {credentialType !== 'none' && (
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 mb-6 backdrop-blur-sm">
                <div className="flex items-center space-x-2 text-[#00d4ff] mb-2">
                  <Shield className="h-5 w-5" />
                  <span className="font-semibold">Credential Discount Applied</span>
                </div>
                <p className="text-sm text-[#a8b8c8]">
                  You're saving 50% with your verified {credentialType} credential
                </p>
              </div>
            )}

            <div className="space-y-4 text-left mb-8">
              <div className="flex items-start space-x-3 group">
                <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 group-hover:scale-110 transition-transform" />
                <div>
                  <p className="font-medium text-[#f0f4f8]">Zero-Knowledge Privacy</p>
                  <p className="text-sm text-[#a8b8c8]">Your payment is completely anonymous</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 group">
                <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 group-hover:scale-110 transition-transform" />
                <div>
                  <p className="font-medium text-[#f0f4f8]">Instant Access</p>
                  <p className="text-sm text-[#a8b8c8]">Decryption key delivered immediately</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 group">
                <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 group-hover:scale-110 transition-transform" />
                <div>
                  <p className="font-medium text-[#f0f4f8]">Cross-Chain Settlement</p>
                  <p className="text-sm text-[#a8b8c8]">Pay on Base, settle on Solana</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleStartPayment}
              className="btn-premium w-full py-4 text-lg font-semibold"
            >
              Generate ZK Proof & Pay
            </button>
          </div>
        );

      case 'proof':
        return (
          <div className="text-center py-8">
            <Loader2 className="h-16 w-16 mx-auto mb-6 text-[#00d4ff] animate-spin" />
            <h3 className="text-2xl font-bold mb-4 text-[#f0f4f8]">Generating Zero-Knowledge Proof</h3>
            <p className="text-[#a8b8c8] mb-6">
              Creating proof of payment without revealing your identity...
            </p>
            <div className="w-full bg-[#1e3a4a]/50 rounded-full h-3 mb-4 overflow-hidden">
              <div 
                className="h-3 rounded-full transition-all duration-500 bg-gradient-to-r from-[#00d4ff] to-[#00a8cc] shadow-lg shadow-cyan-500/50"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-[#a8b8c8]/70">This may take 10-20 seconds</p>
          </div>
        );

      case 'payment':
        return (
          <div className="text-center py-8">
            <Loader2 className="h-16 w-16 mx-auto mb-6 text-[#00d4ff] animate-spin" />
            <h3 className="text-2xl font-bold mb-4 text-[#f0f4f8]">Submitting Payment</h3>
            <p className="text-[#a8b8c8] mb-6">
              Sending your ZK proof to the payment network...
            </p>
            <div className="w-full bg-[#1e3a4a]/50 rounded-full h-3 mb-6 overflow-hidden">
              <div 
                className="h-3 rounded-full transition-all duration-500 bg-gradient-to-r from-[#00d4ff] to-[#00a8cc] shadow-lg shadow-cyan-500/50"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="card-modern p-4">
              <p className="text-sm text-[#a8b8c8] mb-2">Session ID:</p>
              <p className="text-xs font-mono text-[#00d4ff] break-all">{sessionUuid}</p>
            </div>
          </div>
        );

      case 'polling':
        return (
          <div className="text-center py-8">
            <Zap className="h-16 w-16 mx-auto mb-6 text-[#ff7f3f] animate-pulse drop-shadow-[0_0_15px_rgba(255,127,63,0.5)]" />
            <h3 className="text-2xl font-bold mb-4 text-[#f0f4f8]">Waiting for Confirmation</h3>
            <p className="text-[#a8b8c8] mb-6">
              Cross-chain settlement in progress...
            </p>
            <div className="w-full bg-[#1e3a4a]/50 rounded-full h-3 mb-6 overflow-hidden">
              <div 
                className="h-3 rounded-full transition-all duration-500 bg-gradient-to-r from-[#00d4ff] to-[#00a8cc] shadow-lg shadow-cyan-500/50"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-[#a8b8c8] font-mono">Base → Wormhole → Solana</p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 mx-auto mb-6 text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.6)]" />
            <h3 className="text-2xl font-bold mb-4 text-[#f0f4f8]">Payment Successful!</h3>
            <p className="text-[#a8b8c8] mb-6">
              Your content has been unlocked. Here's your decryption key:
            </p>
            
            <div className="card-modern p-6 mb-6 border-emerald-500/20">
              <p className="text-sm text-[#a8b8c8] mb-3">Decryption Key:</p>
              <div className="bg-black/40 p-4 rounded-lg border border-emerald-500/30 font-mono text-xs break-all text-emerald-400 mb-4 backdrop-blur-sm">
                {decryptionKey}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(decryptionKey)}
                className="text-sm text-[#00d4ff] hover:text-[#00a8cc] transition-colors font-medium"
              >
                📋 Copy to Clipboard
              </button>
            </div>

            <div className="space-y-2 text-sm text-[#a8b8c8] mb-8">
              <p className="flex items-center justify-center space-x-2">
                <span className="text-emerald-400">✓</span>
                <span>Payment verified on Solana</span>
              </p>
              <p className="flex items-center justify-center space-x-2">
                <span className="text-emerald-400">✓</span>
                <span>Access granted for 30 days</span>
              </p>
              <p className="flex items-center justify-center space-x-2">
                <span className="text-emerald-400">✓</span>
                <span>Content ready to view</span>
              </p>
            </div>

            <button
              onClick={() => window.location.href = `/content/${contentId}?key=${decryptionKey}`}
              className="btn-premium w-full py-4 text-lg font-semibold mb-3"
            >
              View Content Now
            </button>
            
            <button
              onClick={handleClose}
              className="w-full card-modern py-3 font-semibold hover:bg-[#1e3a4a]/70 transition-all text-[#f0f4f8]"
            >
              Close
            </button>
          </div>
        );

      case 'error':
        return (
          <div className="text-center py-8">
            <AlertCircle className="h-16 w-16 mx-auto mb-6 text-red-400 drop-shadow-[0_0_15px_rgba(248,113,113,0.4)]" />
            <h3 className="text-2xl font-bold mb-4 text-[#f0f4f8]">Payment Failed</h3>
            <p className="text-[#a8b8c8] mb-6">
              {error || 'An unexpected error occurred'}
            </p>
            
            <div className="card-modern p-5 mb-6 border-red-500/20">
              <p className="text-sm text-[#a8b8c8] mb-3">Common issues:</p>
              <ul className="text-sm text-[#a8b8c8]/80 text-left space-y-2">
                <li className="flex items-start">
                  <span className="text-red-400 mr-2">•</span>
                  <span>Insufficient wallet balance</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-400 mr-2">•</span>
                  <span>Network congestion</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-400 mr-2">•</span>
                  <span>Invalid ZK proof generation</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => {
                setStep('quote');
                setError('');
              }}
              className="btn-premium w-full py-4 text-lg font-semibold mb-3"
            >
              Try Again
            </button>
            
            <button
              onClick={handleClose}
              className="w-full card-modern py-3 font-semibold hover:bg-[#1e3a4a]/70 transition-all text-[#f0f4f8]"
            >
              Cancel
            </button>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="card-modern max-w-lg w-full rounded-2xl p-8 relative shadow-2xl shadow-cyan-500/10 border border-cyan-500/10">
        {/* Close Button */}
        {!['proof', 'payment', 'polling'].includes(step) && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-[#a8b8c8] hover:text-[#f0f4f8] transition-colors hover:bg-[#1e3a4a]/50 rounded-lg p-2"
          >
            <X className="h-6 w-6" />
          </button>
        )}

        {renderStepContent()}
      </div>
    </div>
  );
}

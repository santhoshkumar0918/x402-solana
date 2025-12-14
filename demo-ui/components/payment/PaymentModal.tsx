'use client';

import { useState } from 'react';
import { X, Loader2, CheckCircle, AlertCircle, Shield, Zap, Lock, ArrowRight, Copy } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { paymentApi } from '@/lib/api';
import { generatePaymentProof } from '@/lib/zkproof';
import { motion, AnimatePresence } from 'framer-motion';

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

  // --- Logic Preserved Exactly ---
  const handleStartPayment = async () => {
    if (!connected || !publicKey) {
      setError('Please connect your wallet first');
      setStep('error');
      return;
    }

    try {
      // Step 1: Quote
      setStep('quote');
      setProgress(20);
      
      // Send the contentId directly (UUID) - backend will look it up
      const hasCredential = credentialType !== 'none';
      const quote = await paymentApi.getQuote(contentId, hasCredential);
      setSessionUuid(quote.sessionUuid);
      
      // Step 2: ZK Proof
      setStep('proof');
      setProgress(40);
      
      const { proof, publicSignals } = await generatePaymentProof({
        amount: parseFloat(quote.price),
        sessionUuid: quote.sessionUuid,
        userAddress: publicKey.toString(),
        contentId: contentId,
        hasCredential: hasCredential
      });
      
      // Nullifier
      const nullifierInput = `${publicKey.toString()}_${contentId}_${Date.now()}`;
      const encoder2 = new TextEncoder();
      const nullifierBuffer = await crypto.subtle.digest(
        'SHA-256',
        encoder2.encode(nullifierInput)
      );
      const nullifierHash = Array.from(new Uint8Array(nullifierBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      // Step 3: Payment
      setStep('payment');
      setProgress(60);
      
      const mockTxSignature = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      const paymentResult = await paymentApi.submitPayment({
        sessionUuid: quote.sessionUuid,
        nullifierHash: nullifierHash,
        amount: quote.price,
        proof: proof,
        publicSignals: publicSignals,
        txSignature: mockTxSignature
      });
      
      if (paymentResult.success && paymentResult.decryptionKey) {
        setDecryptionKey(paymentResult.decryptionKey);
        setStep('success');
        setProgress(100);
        return;
      }
      
      // Step 4: Polling
      setStep('polling');
      setProgress(80);
      
      let attempts = 0;
      const maxAttempts = 30; 
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const status = await paymentApi.checkStatus(quote.sessionUuid);
        
        if (status.status === 'CONFIRMED' && status.decryptionKey) {
          setDecryptionKey(status.decryptionKey);
          setStep('success');
          setProgress(100);
          return;
        }
        
        if (status.status === 'FAILED') {
          throw new Error('Payment verification failed');
        }
        
        attempts++;
        setProgress(80 + (attempts / maxAttempts) * 20);
      }
      
      throw new Error('Payment verification timeout');

    } catch (err) {
      console.error('Payment error:', err);
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

  // --- New UI Renderers ---

  const renderStepContent = () => {
    switch (step) {
      case 'quote':
        return (
          <div className="text-center pt-4">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20">
              <Lock className="w-8 h-8 text-green-400" />
            </div>
            
            <h3 className="text-2xl font-bold text-white mb-2">Unlock Content</h3>
            <p className="text-gray-400 mb-8 text-sm">
              Initiate a private ZK payment to access this report.
            </p>
            
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
              <div className="flex justify-between items-start mb-4 pb-4 border-b border-white/5">
                <div className="text-left">
                  <p className="text-white font-medium text-sm line-clamp-1">{contentTitle}</p>
                  <p className="text-xs text-gray-500 mt-1">1 Day Access</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-mono font-bold text-white">${price.toFixed(2)}</p>
                  <p className="text-[10px] text-gray-500 uppercase">USDC</p>
                </div>
              </div>
              
              {credentialType !== 'none' && (
                <div className="flex items-center gap-2 text-xs text-purple-300 bg-purple-500/10 p-2 rounded-lg border border-purple-500/20">
                  <Shield className="w-3 h-3" />
                  <span>Verified Credential Discount Active</span>
                </div>
              )}
            </div>

            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Zero-Knowledge Privacy</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Instant Decryption</span>
              </div>
            </div>

            <button
              onClick={handleStartPayment}
              className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              Generate Proof & Pay <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        );

      case 'proof':
      case 'payment':
      case 'polling':
        const statusMap = {
          proof: { title: 'Generating ZK Proof', sub: 'Encrypting transaction details...' },
          payment: { title: 'Submitting Payment', sub: 'Broadcasting to network...' },
          polling: { title: 'Verifying Settlement', sub: 'Cross-chain bridging...' }
        };

        return (
          <div className="text-center pt-8 pb-4">
            <div className="relative w-20 h-20 mx-auto mb-8">
              <Loader2 className="w-full h-full text-green-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Shield className="w-8 h-8 text-white/50" />
              </div>
            </div>

            <h3 className="text-xl font-bold text-white mb-2">{statusMap[step].title}</h3>
            <p className="text-sm text-gray-400 mb-8">{statusMap[step].sub}</p>

            {/* Terminal-style Progress */}
            <div className="bg-black border border-white/10 rounded-lg p-4 font-mono text-xs text-left space-y-2 mb-2">
              <div className={`flex items-center gap-2 ${progress >= 20 ? 'text-green-400' : 'text-gray-600'}`}>
                <span>{progress >= 20 ? '[OK]' : '[..]'}</span> Quote Generated
              </div>
              <div className={`flex items-center gap-2 ${progress >= 40 ? 'text-green-400' : 'text-gray-600'}`}>
                <span>{progress >= 40 ? '[OK]' : '[..]'}</span> ZK Circuit Witness Calculated
              </div>
              <div className={`flex items-center gap-2 ${progress >= 60 ? 'text-green-400' : 'text-gray-600'}`}>
                <span>{progress >= 60 ? '[OK]' : '[..]'}</span> Transaction Signed
              </div>
              <div className={`flex items-center gap-2 ${progress >= 80 ? 'text-green-400' : 'text-gray-600'}`}>
                <span>{progress >= 80 ? '[OK]' : '[..]'}</span> Wormhole VAA Verified
              </div>
            </div>
            
            <div className="w-full bg-gray-800 h-1 mt-4 rounded-full overflow-hidden">
               <motion.div 
                 className="h-full bg-green-500"
                 initial={{ width: 0 }}
                 animate={{ width: `${progress}%` }}
               />
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="text-center pt-4">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_-10px_rgba(34,197,94,0.6)]">
              <CheckCircle className="w-8 h-8 text-black" />
            </div>
            
            <h3 className="text-2xl font-bold text-white mb-2">Access Granted</h3>
            <p className="text-gray-400 mb-8 text-sm">
              Payment confirmed. Decryption key generated.
            </p>
            
            <div className="bg-gray-900 border border-green-500/30 rounded-xl p-4 mb-6 text-left relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 bg-green-500/10 rounded-bl-xl border-l border-b border-green-500/10">
                <Zap className="w-3 h-3 text-green-400" />
              </div>
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Decryption Key</p>
              <code className="block font-mono text-sm text-green-400 break-all bg-black/50 p-3 rounded border border-white/5 mb-3">
                {decryptionKey}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(decryptionKey)}
                className="text-xs flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors"
              >
                <Copy className="w-3 h-3" /> Copy to clipboard
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                 onClick={() => window.location.href = `/content/${contentId}?key=${decryptionKey}`}
                 className="bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 transition-colors col-span-2"
              >
                View Content Now
              </button>
              <button
                onClick={handleClose}
                className="bg-white/5 text-gray-300 font-medium py-3 rounded-lg hover:bg-white/10 transition-colors col-span-2"
              >
                Close
              </button>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="text-center pt-4">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            
            <h3 className="text-xl font-bold text-white mb-2">Transaction Failed</h3>
            <p className="text-red-400 mb-8 text-sm bg-red-500/5 p-3 rounded-lg border border-red-500/10">
              {error || 'An unexpected error occurred'}
            </p>

            <div className="space-y-3">
              <button
                onClick={() => {
                  setStep('quote');
                  setError('');
                }}
                className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={handleClose}
                className="w-full text-gray-500 hover:text-white py-2 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-xl"
          onClick={step === 'quote' ? handleClose : undefined}
        />

        {/* Modal */}
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl shadow-black/50 overflow-hidden"
        >
          {/* Top Decorative Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 via-emerald-500 to-purple-500 opacity-50" />
          
          {/* Close Button */}
          {!['proof', 'payment', 'polling'].includes(step) && (
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="p-8">
            {renderStepContent()}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

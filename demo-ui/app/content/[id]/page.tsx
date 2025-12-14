'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, Shield, Clock, Tag, Loader2, CheckCircle, Eye, Download } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import Navbar from '@/components/Navbar';
import PaymentModal from '@/components/payment/PaymentModal';

interface ContentData {
  id: string;
  title: string;
  creator: string;
  price: number;
  discountedPrice: number;
  credentialType: string;
  category: string;
  description: string;
  fullDescription: string;
  createdAt: string;
  tags: string[];
  contentHash: string;
  encrypted: boolean;
}

// Mock content data
const MOCK_CONTENT: Record<string, ContentData> = {
  '1': {
    id: '1',
    title: 'Investigative Report: Corporate Fraud in Tech Giants',
    creator: 'Anonymous Whistleblower',
    price: 5.00,
    discountedPrice: 2.50,
    credentialType: 'journalist',
    category: 'Investigative Journalism',
    description: 'Detailed investigation into financial irregularities at major tech companies.',
    fullDescription: `This comprehensive investigative report exposes systematic financial fraud across multiple major technology corporations. 

Based on leaked internal documents and testimony from insider sources, this report reveals:

• Falsified revenue reporting schemes worth over $2 billion
• Coordinated efforts to hide losses from shareholders  
• Regulatory capture and manipulation of oversight bodies
• International money laundering networks

The investigation includes:
- 250+ pages of source documents
- Financial transaction records
- Internal communications
- Expert analysis from forensic accountants
- Timeline of fraudulent activities

This report is essential reading for journalists, regulators, investors, and anyone concerned about corporate accountability in the tech sector.

**WARNING**: This content contains sensitive information. Access is logged anonymously via zero-knowledge proofs to protect both readers and sources.`,
    createdAt: '2024-01-15',
    tags: ['fraud', 'tech', 'investigation'],
    contentHash: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
    encrypted: true
  },
  '2': {
    id: '2',
    title: 'Quantum Computing: Breakthrough in Error Correction',
    creator: 'Dr. Sarah Chen',
    price: 3.00,
    discountedPrice: 3.00,
    credentialType: 'none',
    category: 'Academic Research',
    description: 'Novel approach to quantum error correction using topological qubits.',
    fullDescription: `# Quantum Error Correction Using Topological Qubits

## Abstract
We present a novel approach to quantum error correction that achieves significantly lower error rates through the use of topological qubit encoding.

## Key Findings
- Error rate reduction of 73% compared to surface code
- Scalable to 1000+ qubit systems
- Compatible with existing quantum hardware

## Methodology
Our approach leverages anyonic braiding...

[Full 45-page research paper with experimental data, mathematical proofs, and implementation details]`,
    createdAt: '2024-01-14',
    tags: ['quantum', 'research', 'physics'],
    contentHash: 'bafybeih2w2dhjkd7xt5q5nf5q5cq7q5q5q5q5q5q5q5q5q5q5q5q5q5qad',
    encrypted: true
  }
};

export default function ContentDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { connected } = useWallet();
  
  const contentId = params.id as string;
  const decryptionKey = searchParams.get('key');
  
  const [content, setContent] = useState<ContentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [decryptedContent, setDecryptedContent] = useState<string>('');

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      const mockContent = MOCK_CONTENT[contentId];
      if (mockContent) {
        setContent(mockContent);
        
        // If decryption key is present, unlock content
        if (decryptionKey && decryptionKey.startsWith('0x')) {
          setIsUnlocked(true);
          setDecryptedContent(mockContent.fullDescription);
        }
      }
      setLoading(false);
    }, 600);
  }, [contentId, decryptionKey]);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-12 w-12 text-[#00d4ff] animate-spin" />
        </div>
      </>
    );
  }

  if (!content) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center text-center">
          <div>
            <div className="text-6xl mb-4">❌</div>
            <h2 className="text-2xl font-bold mb-2 text-[#f0f4f8]">Content Not Found</h2>
            <p className="text-[#a8b8c8] mb-6">This content doesn't exist or has been removed</p>
            <Link href="/marketplace" className="text-[#00d4ff] hover:text-[#00d4ff]/80 transition-colors">
              ← Back to Marketplace
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 min-h-screen">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <Link 
            href="/marketplace"
            className="inline-flex items-center space-x-2 text-[#a8b8c8] hover:text-[#00d4ff] mb-8 transition-colors group"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Marketplace</span>
          </Link>

          {/* Content Header */}
          <div className="card-modern p-10 mb-8">
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-4">
                  <span className="text-sm px-4 py-1.5 bg-[#00d4ff]/10 text-[#00d4ff] rounded-full font-medium">
                    {content.category}
                  </span>
                  {content.discountedPrice < content.price && (
                    <span className="text-sm px-4 py-1.5 bg-[#ff7f3f]/10 text-[#ff7f3f] rounded-full font-semibold">
                      50% OFF
                    </span>
                  )}
                  {isUnlocked && (
                    <span className="text-sm px-4 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-full font-semibold flex items-center space-x-1.5">
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span>Unlocked</span>
                    </span>
                  )}
                </div>
                
                <h1 className="text-4xl font-bold mb-4 text-[#f0f4f8] leading-tight">{content.title}</h1>
                
                <p className="text-[#a8b8c8] mb-5 text-lg">by {content.creator}</p>
                
                <div className="flex flex-wrap gap-2 mb-5">
                  {content.tags.map(tag => (
                    <span key={tag} className="text-sm px-3 py-1.5 bg-[#1e3a4a] text-[#a8b8c8] rounded-lg hover:bg-[#1e3a4a]/80 transition-colors">
                      <Tag className="inline h-3 w-3 mr-1" />
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center space-x-6 text-sm text-[#a8b8c8]">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4" />
                    <span>{new Date(content.createdAt).toLocaleDateString()}</span>
                  </div>
                  {content.credentialType !== 'none' && (
                    <div className="flex items-center space-x-2 text-[#00d4ff]">
                      <Shield className="h-4 w-4" />
                      <span>Verified {content.credentialType}s get 50% off</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Price Card */}
              <div className="card-modern p-8 text-center min-w-[200px] bg-gradient-to-br from-[#00d4ff]/5 to-transparent">
                {content.discountedPrice < content.price && (
                  <p className="text-[#a8b8c8] line-through text-sm mb-2">
                    ${content.price.toFixed(2)}
                  </p>
                )}
                <p className="text-5xl font-bold text-[#00d4ff] mb-3">
                  ${content.discountedPrice.toFixed(2)}
                </p>
                <p className="text-xs text-[#a8b8c8] uppercase tracking-wide">USDC</p>
              </div>
            </div>

            {/* Description */}
            <div className="mt-8 pt-8 border-t border-[#1e3a4a]">
              <p className="text-[#a8b8c8] leading-relaxed text-lg">{content.description}</p>
            </div>

            {/* Action Button */}
            {!isUnlocked && (
              <div className="mt-8">
                {connected ? (
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    className="btn-premium w-full py-5 text-lg flex items-center justify-center space-x-3"
                  >
                    <Lock className="h-5 w-5" />
                    <span>Purchase & Unlock Content</span>
                  </button>
                ) : (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 text-center">
                    <Shield className="inline h-5 w-5 mr-2 text-amber-400" />
                    <span className="text-amber-400 font-medium">Connect your wallet to purchase</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Content Body */}
          <div className="card-modern p-10">
            {isUnlocked ? (
              <div>
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-3xl font-bold flex items-center space-x-3 text-[#f0f4f8]">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                      <Eye className="h-5 w-5 text-emerald-400" />
                    </div>
                    <span>Full Content</span>
                  </h2>
                  <button className="btn-secondary flex items-center space-x-2">
                    <Download className="h-4 w-4" />
                    <span>Download</span>
                  </button>
                </div>

                <div className="prose prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-[#a8b8c8] leading-relaxed text-lg">
                    {decryptedContent}
                  </div>
                </div>

                {/* IPFS Info */}
                <div className="mt-10 pt-8 border-t border-[#1e3a4a]">
                  <p className="text-sm text-[#a8b8c8] mb-3 font-medium">Decrypted from IPFS:</p>
                  <p className="text-xs font-mono text-[#a8b8c8]/60 break-all bg-[#1a2332] p-4 rounded-lg">
                    {content.contentHash}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="w-20 h-20 rounded-2xl bg-[#1e3a4a] flex items-center justify-center mx-auto mb-8">
                  <Lock className="h-10 w-10 text-[#a8b8c8]" />
                </div>
                <h3 className="text-3xl font-bold mb-4 text-[#f0f4f8]">Content is Encrypted</h3>
                <p className="text-[#a8b8c8] mb-10 text-lg max-w-lg mx-auto">
                  This content is stored encrypted on IPFS. Purchase access to receive the decryption key.
                </p>
                
                <div className="card-modern p-8 max-w-lg mx-auto bg-gradient-to-br from-[#00d4ff]/5 to-transparent">
                  <p className="text-sm text-[#a8b8c8] mb-6 font-semibold uppercase tracking-wide">What you'll get:</p>
                  <ul className="text-left space-y-4">
                    <li className="flex items-start space-x-3">
                      <div className="shrink-0 w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center mt-0.5">
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                      </div>
                      <span className="text-[#f0f4f8] text-base">Full access to encrypted content</span>
                    </li>
                    <li className="flex items-start space-x-3">
                      <div className="shrink-0 w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center mt-0.5">
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                      </div>
                      <span className="text-[#f0f4f8] text-base">Decryption key delivered instantly</span>
                    </li>
                    <li className="flex items-start space-x-3">
                      <div className="shrink-0 w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center mt-0.5">
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                      </div>
                      <span className="text-[#f0f4f8] text-base">30-day access period</span>
                    </li>
                    <li className="flex items-start space-x-3">
                      <div className="shrink-0 w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center mt-0.5">
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                      </div>
                      <span className="text-[#f0f4f8] text-base">Download capability</span>
                    </li>
                  </ul>
                </div>

                {connected && (
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    className="mt-10 btn-premium px-12 py-5 text-lg inline-flex items-center space-x-3"
                  >
                    <span>Unlock Now for ${content.discountedPrice.toFixed(2)}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        contentId={content.id}
        contentTitle={content.title}
        price={content.discountedPrice}
        credentialType={content.credentialType}
      />
    </>
  );
}

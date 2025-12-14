'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, Shield, Clock, Tag, Loader2, CheckCircle, Eye, Download, FileText, ChevronRight, Key } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import Navbar from '@/components/Navbar';
import PaymentModal from '@/components/payment/PaymentModal';
import { contentApi } from '@/lib/api';
// import { importKey, decryptString } from '@/lib/crypto'; // Uncomment if you have this lib

// --- Types & Mock Data (Preserved) ---
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
    fullDescription: `This comprehensive investigative report exposes systematic financial fraud across multiple major technology corporations.\n\nBased on leaked internal documents and testimony from insider sources, this report reveals:\n\n• Falsified revenue reporting schemes worth over $2 billion\n• Coordinated efforts to hide losses from shareholders\n• Regulatory capture and manipulation of oversight bodies\n• International money laundering networks\n\nThe investigation includes:\n- 250+ pages of source documents\n- Financial transaction records\n- Internal communications\n- Expert analysis from forensic accountants\n- Timeline of fraudulent activities\n\nThis report is essential reading for journalists, regulators, investors, and anyone concerned about corporate accountability in the tech sector.\n\n**WARNING**: This content contains sensitive information. Access is logged anonymously via zero-knowledge proofs to protect both readers and sources.`,
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
    fullDescription: `# Quantum Error Correction Using Topological Qubits\n\n## Abstract\nWe present a novel approach to quantum error correction that achieves significantly lower error rates through the use of topological qubit encoding.\n\n## Key Findings\n- Error rate reduction of 73% compared to surface code\n- Scalable to 1000+ qubit systems\n- Compatible with existing quantum hardware\n\n## Methodology\nOur approach leverages anyonic braiding...\n\n[Full 45-page research paper with experimental data, mathematical proofs, and implementation details]`,
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
    const loadContent = async () => {
      try {
        setLoading(true);
        // Fetch real content from API
        const data = await contentApi.getById(contentId); 
        setContent(data);
        
        // If user has decryption key, unlock content
        if (decryptionKey && decryptionKey.length > 0) {
          setIsUnlocked(true);
          setDecryptedContent(data.fullDescription || data.description);
        }

      } catch (err) {
        console.error('Failed to load content:', err);
        setContent(null);
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [contentId, decryptionKey]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-green-500 animate-spin" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center text-center">
        <div>
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
            <Lock className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-white">Content Unavailable</h2>
          <Link href="/marketplace" className="text-gray-400 hover:text-white transition-colors text-sm">
            ← Return to Base
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#030303] min-h-screen text-gray-300 selection:bg-green-500/30 font-sans">
      <Navbar />
      
      {/* Background Ambience */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
      
      <div className="relative pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          
          {/* Breadcrumb / Back */}
          <Link 
            href="/marketplace"
            className="inline-flex items-center space-x-2 text-sm text-gray-500 hover:text-white mb-8 transition-colors group"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            <span>Marketplace</span>
          </Link>

          {/* MAIN CARD: Header Section */}
          <div className="relative border border-white/10 bg-gray-900/40 rounded-3xl p-8 md:p-10 backdrop-blur-sm overflow-hidden mb-8">
             {/* Glow Effect */}
             <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-500/5 blur-[100px] rounded-full pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row items-start justify-between gap-8">
              <div className="flex-1">
                {/* Badges */}
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <span className="px-3 py-1 bg-white/5 border border-white/10 text-gray-300 text-xs font-medium rounded-full uppercase tracking-wider">
                    {content.category}
                  </span>
                  
                  {isUnlocked ? (
                    <span className="px-3 py-1 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle className="w-3 h-3" />
                      Decrypted
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5">
                      <Lock className="w-3 h-3" />
                      Encrypted
                    </span>
                  )}
                </div>
                
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight tracking-tight">
                  {content.title}
                </h1>
                
                <div className="flex items-center gap-3 text-sm text-gray-400 mb-6">
                  <span className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-700 to-black border border-white/10 flex items-center justify-center text-[10px] text-white">
                      {content.creator?.[0] || '?'}
                    </div>
                    {content.creator || 'Unknown'}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-gray-700" />
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {new Date(content.createdAt).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {(content.tags || []).map(tag => (
                    <span key={tag} className="text-xs px-2.5 py-1 bg-black/40 border border-white/5 text-gray-500 rounded hover:text-gray-300 transition-colors cursor-default">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Price Block */}
              <div className="shrink-0 flex flex-col items-end">
                <div className="bg-black/50 border border-white/10 rounded-2xl p-6 text-right backdrop-blur-md">
                   {(content.discountedPrice || 0) < (content.price || 0) && (
                    <div className="text-xs text-gray-500 line-through mb-1">
                      ${(content.price || 0).toFixed(2)}
                    </div>
                  )}
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-mono font-bold text-white tracking-tighter">
                      ${(content.discountedPrice || content.price || 0).toFixed(2)}
                    </span>
                    <span className="text-sm text-gray-500 font-medium">USDC</span>
                  </div>
                  
                  {content.credentialType !== 'none' && (
                    <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-end gap-1.5 text-xs text-purple-400">
                      <Shield className="w-3 h-3" />
                      <span>{content.credentialType} verified</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* CONTENT BODY: Locked vs Unlocked */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Description & Metadata */}
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-gray-900/20 border border-white/5 rounded-2xl p-8">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-green-400" />
                  Overview
                </h3>
                <p className="text-gray-400 leading-relaxed text-lg">
                  {content.description}
                </p>
              </div>

              {/* Secure Vault / Content View */}
              <div className={`relative border rounded-2xl overflow-hidden transition-all duration-500 ${isUnlocked ? 'bg-black/40 border-green-500/20' : 'bg-black/40 border-white/10'}`}>
                
                {isUnlocked ? (
                  // UNLOCKED STATE
                  <div className="p-8">
                    <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/10 rounded-lg text-green-400">
                          <Eye className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-white font-semibold">Decrypted Payload</h3>
                          <p className="text-xs text-gray-500 font-mono">HASH: {(content.contentHash || 'unknown').substring(0, 12)}...</p>
                        </div>
                      </div>
                      <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-xs font-medium text-white rounded-lg transition-colors flex items-center gap-2">
                        <Download className="w-3 h-3" />
                        Save
                      </button>
                    </div>

                    <div className="prose prose-invert prose-p:text-gray-400 prose-headings:text-white max-w-none">
                      <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                        {decryptedContent}
                      </div>
                    </div>
                    
                    <div className="mt-8 p-4 bg-green-900/10 border border-green-500/10 rounded-lg flex items-start gap-3">
                      <Key className="w-4 h-4 text-green-400 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-green-400 mb-1">DECRYPTION KEY ACTIVE</p>
                        <p className="text-[10px] text-green-500/60 font-mono break-all">{decryptionKey}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  // LOCKED STATE
                  <div className="relative p-12 text-center">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
                    
                    <div className="relative z-10">
                      <div className="w-20 h-20 bg-gray-800/50 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/10 shadow-2xl">
                        <Lock className="w-8 h-8 text-gray-400" />
                      </div>
                      
                      <h3 className="text-2xl font-bold text-white mb-2">Encrypted Content</h3>
                      <p className="text-gray-400 max-w-md mx-auto mb-8">
                        This intelligence is stored on IPFS and encrypted. Purchase a key to decrypt and view instantly.
                      </p>

                      <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mb-8">
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-left">
                          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Access</div>
                          <div className="text-white font-medium text-sm">30 Days</div>
                        </div>
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-left">
                          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Privacy</div>
                          <div className="text-white font-medium text-sm">ZK Proof</div>
                        </div>
                      </div>

                      {connected ? (
                        <button
                          onClick={() => setShowPaymentModal(true)}
                          className="group relative w-full max-w-sm mx-auto overflow-hidden rounded-xl bg-white p-[1px] focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 focus:ring-offset-black"
                        >
                          <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2E8F0_0%,#500724_50%,#E2E8F0_100%)]" />
                          <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-xl bg-black px-8 py-4 text-sm font-bold text-white backdrop-blur-3xl transition-all group-hover:bg-gray-900 group-hover:text-green-400">
                            Unlock for ${(content.discountedPrice || content.price || 0).toFixed(2)}
                            <ChevronRight className="ml-2 h-4 w-4" />
                          </span>
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-500/10 text-yellow-500 rounded-xl border border-yellow-500/20 text-sm font-medium">
                          <Shield className="w-4 h-4" />
                          Connect Wallet to Unlock
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: IPFS Metadata */}
            <div className="space-y-6">
               <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
                <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Storage Details</h4>
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Protocol</div>
                    <div className="text-sm text-gray-300 font-mono">IPFS / Filecoin</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Content ID (CID)</div>
                    <div className="text-xs text-gray-400 font-mono break-all bg-white/5 p-2 rounded">
                      {content.contentHash}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Encryption</div>
                    <div className="text-sm text-green-400 font-mono flex items-center gap-2">
                      <Lock className="w-3 h-3" />
                      AES-256-GCM
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        contentId={content.id}
        contentTitle={content.title || 'Untitled'}
        price={content.discountedPrice || content.price || 0}
        credentialType={content.credentialType || 'none'}
      />
    </div>
  );
}
'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { Upload, FileText, Lock, DollarSign, Shield, Image as ImageIcon, Loader2, CheckCircle, AlertCircle, X, ChevronRight } from 'lucide-react';
import { contentApi } from '@/lib/api';
import { generateEncryptionKey, exportKey, encryptFile } from '@/lib/crypto';
import { motion } from 'framer-motion';

type UploadStep = 'details' | 'encrypting' | 'uploading' | 'success' | 'error';

export default function UploadPage() {
  const { connected, publicKey } = useWallet();
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Investigative Journalism');
  const [price, setPrice] = useState('5.00');
  const [credentialType, setCredentialType] = useState('none');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  
  // Upload state
  const [uploadStep, setUploadStep] = useState<UploadStep>('details');
  const [ipfsHash, setIpfsHash] = useState('');
  const [contentId, setContentId] = useState('');
  const [error, setError] = useState('');

  const categories = [
    'Investigative Journalism',
    'Academic Research',
    'Whistleblower Report',
    'Legal Documents',
    'Technical Research',
    'Financial Analysis',
    'Other'
  ];

  const credentialTypes = [
    { value: 'none', label: 'No Credential Required' },
    { value: 'journalist', label: 'Verified Journalist' },
    { value: 'academic', label: 'Academic Researcher' },
    { value: 'legal', label: 'Legal Professional' },
    { value: 'government', label: 'Government Official' }
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCoverImage(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!connected || !publicKey) {
      setError('Please connect your wallet first');
      setUploadStep('error');
      return;
    }

    if (!file) {
      setError('Please select a file to upload');
      setUploadStep('error');
      return;
    }

    try {
      // Step 1: Encrypt content
      setUploadStep('encrypting');
      
      const encryptionKey = await generateEncryptionKey();
      const keyHex = await exportKey(encryptionKey);
      
      const { encrypted, iv } = await encryptFile(file, encryptionKey);
      
      // Step 2: Upload to IPFS via backend
      setUploadStep('uploading');
      
      const formData = new FormData();
      formData.append('file', new Blob([encrypted]), file.name + '.enc');
      formData.append('iv', Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''));
      formData.append('title', title);
      formData.append('description', description);
      formData.append('category', category);
      formData.append('price', price);
      formData.append('credentialType', credentialType);
      formData.append('tags', tags);
      formData.append('creatorAddress', publicKey.toString());
      formData.append('encryptionKey', keyHex);
      
      if (coverImage) {
        formData.append('coverImage', coverImage);
      }
      
      const response = await contentApi.upload(formData);
      
      setIpfsHash(response.ipfsHash);
      setContentId(response.contentId);
      setUploadStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploadStep('error');
    }
  };

  // --- Render States ---

  if (!connected) {
    return (
      <div className="min-h-screen bg-[#030303] text-white">
        <Navbar />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center p-10 border border-white/10 bg-white/5 rounded-3xl backdrop-blur-md max-w-md mx-4">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10">
              <Shield className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
            <p className="text-gray-400 mb-6">Authentication required to access the encrypted upload gateway.</p>
          </div>
        </div>
      </div>
    );
  }

  if (uploadStep === 'encrypting' || uploadStep === 'uploading') {
    return (
      <div className="min-h-screen bg-[#030303] text-white">
        <Navbar />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center p-12 border border-green-500/20 bg-black rounded-3xl max-w-md mx-4 relative overflow-hidden">
            {/* Scanning Line Animation */}
            <div className="absolute top-0 left-0 w-full h-1 bg-green-500/50 shadow-[0_0_20px_#22c55e] animate-[scan_2s_linear_infinite]" />
            
            <Loader2 className="h-16 w-16 mx-auto mb-6 text-green-500 animate-spin" />
            <h2 className="text-2xl font-bold mb-2 font-mono">
              {uploadStep === 'encrypting' ? 'ENCRYPTING PAYLOAD' : 'UPLOADING TO IPFS'}
            </h2>
            <p className="text-green-500/60 font-mono text-sm">
              {uploadStep === 'encrypting' 
                ? '> AES-256-GCM encryption in progress...'
                : '> Distributing chunks to decentralized storage...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (uploadStep === 'success') {
    return (
      <div className="min-h-screen bg-[#030303] text-white">
        <Navbar />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center p-10 border border-green-500/20 bg-green-500/5 rounded-3xl max-w-xl mx-4">
            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20 shadow-[0_0_30px_-5px_rgba(34,197,94,0.3)]">
              <CheckCircle className="h-10 w-10 text-green-400" />
            </div>
            <h2 className="text-3xl font-bold mb-4">Transmission Complete</h2>
            <p className="text-gray-400 mb-8">
              Your content is now encrypted and live on the marketplace.
            </p>
            
            <div className="bg-black/40 border border-white/5 p-6 rounded-xl mb-8 text-left font-mono text-xs space-y-4">
              <div>
                <p className="text-gray-500 mb-1 uppercase tracking-wider">IPFS Hash</p>
                <p className="text-green-400 break-all">{ipfsHash}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1 uppercase tracking-wider">Content ID</p>
                <p className="text-green-400">{contentId}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => window.location.href = `/content/${contentId}`} className="px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors">
                View Content
              </button>
              <button onClick={() => { setUploadStep('details'); setFile(null); setTitle(''); }} className="px-6 py-3 bg-white/5 text-white font-medium rounded-xl hover:bg-white/10 transition-colors">
                Upload New
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Main Form ---

  return (
    <div className="min-h-screen bg-[#030303] text-gray-300 selection:bg-green-500/30">
      <Navbar />
      
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      <div className="fixed top-20 right-0 w-[500px] h-[500px] bg-purple-900/20 opacity-20 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          
          <div className="mb-10">
            <h1 className="text-4xl font-bold mb-4 text-white">Upload Intelligence</h1>
            <p className="text-gray-500">
              Encrypt sensitive data. Set your price. Distribute anonymously.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Section 1: File Upload */}
            <div className="bg-gray-900/40 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-400" />
                Payload
              </h2>

              <div className="mb-6">
                <div className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 ${file ? 'border-green-500/50 bg-green-500/5' : 'border-white/10 hover:border-white/20 hover:bg-white/5'}`}>
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                    accept=".pdf,.doc,.docx,.txt,.md"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer block">
                    {file ? (
                      <div>
                        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                          <FileText className="h-8 w-8 text-green-400" />
                        </div>
                        <p className="text-white font-medium mb-1">{file.name}</p>
                        <p className="text-xs text-green-400 font-mono">
                          {(file.size / 1024 / 1024).toFixed(2)} MB • READY FOR ENCRYPTION
                        </p>
                        <button 
                          onClick={(e) => { e.preventDefault(); setFile(null); }}
                          className="mt-4 text-xs text-red-400 hover:text-red-300 underline"
                        >
                          Remove File
                        </button>
                      </div>
                    ) : (
                      <div className="group">
                        <Upload className="h-12 w-12 mx-auto mb-4 text-gray-500 group-hover:text-green-400 transition-colors" />
                        <p className="text-gray-300 font-medium mb-2">
                          Drop sensitive files here
                        </p>
                        <p className="text-sm text-gray-600">
                          PDF, DOC, TXT, MD (Max 100MB)
                        </p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Cover Image */}
              <div className="flex items-center gap-4">
                 <div className="shrink-0 w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center border border-white/10">
                    <ImageIcon className="h-5 w-5 text-gray-500" />
                 </div>
                 <div className="flex-1">
                    <label className="text-sm text-gray-400 mb-1 block">Cover Image (Optional)</label>
                    <input
                      type="file"
                      onChange={handleCoverImageChange}
                      className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 transition-all cursor-pointer"
                      accept="image/*"
                    />
                 </div>
              </div>
            </div>

            {/* Section 2: Metadata */}
            <div className="bg-gray-900/40 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Shield className="h-5 w-5 text-purple-400" />
                Metadata
              </h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-green-500/50 text-white placeholder-gray-600 transition-colors"
                    placeholder="e.g. Project Titan Leaked Memos"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    rows={4}
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-green-500/50 text-white placeholder-gray-600 transition-colors"
                    placeholder="Provide context for the encrypted data..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Category</label>
                    <div className="relative">
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-green-500/50 text-white appearance-none cursor-pointer"
                      >
                        {categories.map(cat => <option key={cat} value={cat} className="bg-gray-900">{cat}</option>)}
                      </select>
                      <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 rotate-90 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tags</label>
                    <input
                      type="text"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-green-500/50 text-white placeholder-gray-600 transition-colors"
                      placeholder="finance, leak, 2024"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Economics */}
            <div className="bg-gray-900/40 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-yellow-400" />
                Economics
              </h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Price (USDC)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      required
                      className="w-full pl-8 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-green-500/50 text-white font-mono text-lg"
                      placeholder="5.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Access Control</label>
                  <div className="relative">
                    <select
                      value={credentialType}
                      onChange={(e) => setCredentialType(e.target.value)}
                      className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-green-500/50 text-white appearance-none cursor-pointer"
                    >
                      {credentialTypes.map(cred => <option key={cred.value} value={cred.value} className="bg-gray-900">{cred.label}</option>)}
                    </select>
                    <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 rotate-90 pointer-events-none" />
                  </div>
                  {credentialType !== 'none' && (
                    <div className="mt-3 flex items-start gap-2 text-xs text-purple-400 bg-purple-500/10 p-3 rounded-lg border border-purple-500/20">
                      <Shield className="w-4 h-4 mt-0.5 shrink-0" />
                      <p>Smart Contract will automatically apply a 50% discount for wallets verifying as <strong>{credentialType}</strong> via Reclaim Protocol.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
                 <AlertCircle className="w-5 h-5" />
                 {error}
              </div>
            )}

            {/* COOL ANIMATED SUBMIT BUTTON */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={!file}
                className="group relative w-full overflow-hidden rounded-xl bg-gray-800 p-[1px] focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#000000_0%,#22c55e_50%,#000000_100%)]" />
                <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-xl bg-black px-8 py-5 text-sm font-bold text-white backdrop-blur-3xl transition-all group-hover:bg-gray-900">
                  <Lock className="mr-2 h-5 w-5 group-hover:text-green-400 transition-colors" />
                  Encrypt & Publish to Marketplace
                </span>
              </button>
              <p className="text-center text-xs text-gray-600 mt-4">
                By publishing, you agree to the decentralized protocol terms. Content is immutable on IPFS.
              </p>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
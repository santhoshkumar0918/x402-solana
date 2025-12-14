'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { FileText, DollarSign, Eye, Download, TrendingUp, Shield, Clock, Plus, ChevronRight, Loader2 } from 'lucide-react';
import { contentApi } from '@/lib/api';

interface ContentItem {
  id: string;
  title: string;
  category: string;
  price: number;
  views: number;
  purchases: number;
  earnings: number;
  createdAt: string;
  status: 'active' | 'pending' | 'removed';
}

export default function DashboardPage() {
  const { connected, publicKey } = useWallet();
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEarnings: 0,
    totalViews: 0,
    totalPurchases: 0,
    activeContent: 0
  });

  useEffect(() => {
    const loadCreatorContent = async () => {
      if (!connected || !publicKey) return;
      
      try {
        setLoading(true);
        // const data = await contentApi.getByCreator(publicKey.toString());
        // Mock data for UI demo
        const mockContents: ContentItem[] = [
          {
            id: '1',
            title: 'Investigative Report: Corporate Fraud in Tech Giants',
            category: 'Investigative Journalism',
            price: 5.00,
            views: 1250,
            purchases: 42,
            earnings: 210.00,
            createdAt: '2024-01-15',
            status: 'active'
          },
           {
            id: '2',
            title: 'Quantum Entanglement Data Set',
            category: 'Academic Research',
            price: 15.00,
            views: 400,
            purchases: 12,
            earnings: 180.00,
            createdAt: '2024-01-20',
            status: 'active'
          }
        ];
        
        const data = mockContents;
        setContents(data);
        
        const totalEarnings = data.reduce((sum, c) => sum + c.earnings, 0);
        const totalViews = data.reduce((sum, c) => sum + c.views, 0);
        const totalPurchases = data.reduce((sum, c) => sum + c.purchases, 0);
        const activeContent = data.filter(c => c.status === 'active').length;
        
        setStats({ totalEarnings, totalViews, totalPurchases, activeContent });
      } catch (err) {
        console.error('Failed to load content:', err);
      } finally {
        setLoading(false);
      }
    };

    loadCreatorContent();
  }, [connected, publicKey]);

  if (!connected) {
    return (
      <div className="min-h-screen bg-[#030303] text-white">
        <Navbar />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center">
             <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10">
              <Shield className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Dashboard Locked</h2>
            <p className="text-gray-400">Connect wallet to view earnings and manage content.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030303] text-gray-300 selection:bg-green-500/30">
      <Navbar />
      
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      <div className="fixed top-20 left-0 w-[500px] h-[500px] bg-green-900/10 opacity-20 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
            <div>
              <h1 className="text-4xl font-bold mb-2 text-white">Command Center</h1>
              <p className="text-gray-500">
                Welcome back, {publicKey?.toString().slice(0, 4)}...{publicKey?.toString().slice(-4)}
              </p>
            </div>
            
            {/* COOL ANIMATED UPLOAD BUTTON */}
            <Link href="/upload" className="group relative overflow-hidden rounded-xl bg-gray-800 p-[1px] focus:outline-none w-full md:w-auto">
                <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#000000_0%,#22c55e_50%,#000000_100%)]" />
                <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-xl bg-black px-6 py-3 text-sm font-bold text-white backdrop-blur-3xl transition-all group-hover:bg-gray-900">
                  <Plus className="mr-2 h-5 w-5 group-hover:text-green-400 transition-colors" />
                  Upload New Content
                </span>
            </Link>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            
            <div className="relative group p-6 bg-gray-900/40 border border-white/10 rounded-2xl backdrop-blur-sm overflow-hidden hover:border-white/20 transition-all">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <DollarSign className="w-16 h-16 text-green-500" />
              </div>
              <div className="relative z-10">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Total Revenue</p>
                <div className="flex items-baseline gap-1 text-white">
                  <span className="text-3xl font-bold">${stats.totalEarnings.toFixed(2)}</span>
                  <span className="text-xs text-gray-500">USDC</span>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 h-1 bg-green-500 w-full opacity-50" />
            </div>

            <div className="relative group p-6 bg-gray-900/40 border border-white/10 rounded-2xl backdrop-blur-sm overflow-hidden hover:border-white/20 transition-all">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Eye className="w-16 h-16 text-blue-500" />
              </div>
              <div className="relative z-10">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Total Views</p>
                <p className="text-3xl font-bold text-white">{stats.totalViews.toLocaleString()}</p>
              </div>
               <div className="absolute bottom-0 left-0 h-1 bg-blue-500 w-full opacity-50" />
            </div>

            <div className="relative group p-6 bg-gray-900/40 border border-white/10 rounded-2xl backdrop-blur-sm overflow-hidden hover:border-white/20 transition-all">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Download className="w-16 h-16 text-purple-500" />
              </div>
              <div className="relative z-10">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Unlock Count</p>
                <p className="text-3xl font-bold text-white">{stats.totalPurchases}</p>
              </div>
               <div className="absolute bottom-0 left-0 h-1 bg-purple-500 w-full opacity-50" />
            </div>

             <div className="relative group p-6 bg-gray-900/40 border border-white/10 rounded-2xl backdrop-blur-sm overflow-hidden hover:border-white/20 transition-all">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <FileText className="w-16 h-16 text-gray-500" />
              </div>
              <div className="relative z-10">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Active Files</p>
                <p className="text-3xl font-bold text-white">{stats.activeContent}</p>
              </div>
               <div className="absolute bottom-0 left-0 h-1 bg-gray-500 w-full opacity-50" />
            </div>
          </div>

          {/* Content List */}
          <div className="bg-gray-900/20 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white mb-6">Published Intelligence</h2>
            
            {loading ? (
              <div className="text-center py-12">
                 <Loader2 className="h-8 w-8 text-green-500 animate-spin mx-auto" />
              </div>
            ) : contents.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400 mb-6">No intelligence uploaded yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {contents.map(content => (
                  <div
                    key={content.id}
                    className="group bg-black/40 border border-white/5 rounded-xl p-6 hover:border-white/20 transition-all hover:bg-white/5"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-white group-hover:text-green-400 transition-colors">
                            {content.title}
                          </h3>
                           <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${
                            content.status === 'active' 
                              ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                              : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                          }`}>
                            {content.status}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-6 text-sm text-gray-500">
                          <span>{content.category}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(content.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Metrics Mini-Grid */}
                      <div className="flex items-center gap-8 bg-black/50 p-3 rounded-lg border border-white/5">
                        <div className="text-center min-w-[60px]">
                          <div className="text-xs text-gray-500 mb-1">Views</div>
                          <div className="text-white font-mono">{content.views}</div>
                        </div>
                        <div className="w-px h-8 bg-white/10" />
                         <div className="text-center min-w-[60px]">
                          <div className="text-xs text-gray-500 mb-1">Sales</div>
                          <div className="text-white font-mono">{content.purchases}</div>
                        </div>
                        <div className="w-px h-8 bg-white/10" />
                         <div className="text-center min-w-[60px]">
                          <div className="text-xs text-gray-500 mb-1">Revenue</div>
                          <div className="text-green-400 font-mono font-bold">${content.earnings.toFixed(2)}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/content/${content.id}`}
                          className="p-3 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg transition-colors"
                          title="View Page"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button className="p-3 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg transition-colors" title="Edit Metadata">
                           <FileText className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
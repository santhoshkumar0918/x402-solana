'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, useMotionTemplate, useMotionValue, AnimatePresence } from 'framer-motion';
import { Search, Filter, Shield, Clock, Loader2, Tag, ChevronDown, Check, Activity, Zap } from 'lucide-react';
import Navbar from '@/components/Navbar';

// --- Types & Data ---

interface Content {
  id: string;
  title: string;
  creator: string;
  price: number;
  discountedPrice: number;
  credentialType: string;
  category: string;
  description: string;
  createdAt: string;
  tags: string[];
}

const MOCK_CONTENT: Content[] = [
  { id: '1', title: 'Investigative Report: Corporate Fraud in Tech Giants', creator: 'Anonymous Whistleblower', price: 5.00, discountedPrice: 2.50, credentialType: 'journalist', category: 'Investigative Journalism', description: 'Detailed investigation into financial irregularities at major tech companies.', createdAt: '2024-01-15', tags: ['fraud', 'tech', 'investigation'] },
  { id: '2', title: 'Quantum Computing: Breakthrough in Error Correction', creator: 'Dr. Sarah Chen', price: 3.00, discountedPrice: 3.00, credentialType: 'none', category: 'Academic Research', description: 'Novel approach to quantum error correction using topological qubits.', createdAt: '2024-01-14', tags: ['quantum', 'research'] },
  { id: '3', title: 'AI Market Analysis: Competitive Intelligence 2024', creator: 'TechInsights Research', price: 10.00, discountedPrice: 10.00, credentialType: 'none', category: 'Corporate Intelligence', description: 'Comprehensive analysis of AI market trends.', createdAt: '2024-01-13', tags: ['AI', 'market'] },
  { id: '4', title: 'Cryptocurrency Money Laundering Networks', creator: 'BlockchainWatch', price: 7.50, discountedPrice: 3.75, credentialType: 'journalist', category: 'Investigative Journalism', description: 'In-depth investigation into cryptocurrency laundering operations.', createdAt: '2024-01-11', tags: ['crypto', 'compliance'] },
];

// --- Components ---

function SpotlightCard({ children, className = "", href }: { children: React.ReactNode; className?: string; href: string }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <Link
      href={href}
      className={`group relative border border-white/10 bg-gray-900/40 overflow-hidden rounded-xl ${className}`}
      onMouseMove={handleMouseMove}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              650px circle at ${mouseX}px ${mouseY}px,
              rgba(74, 222, 128, 0.10),
              transparent 80%
            )
          `,
        }}
      />
      <div className="relative h-full p-6">{children}</div>
    </Link>
  );
}

function LiveTicker() {
  return (
    <div className="w-full bg-green-900/10 border-b border-green-500/10 py-2 overflow-hidden flex items-center">
      <div className="flex items-center gap-2 px-6 text-green-500 text-xs font-mono font-bold uppercase tracking-wider shrink-0 border-r border-green-500/10">
        <Activity className="w-3 h-3 animate-pulse" /> Live Feed
      </div>
      <div className="flex gap-8 animate-marquee whitespace-nowrap px-4">
        {[...Array(5)].map((_, i) => (
          <span key={i} className="text-xs font-mono text-gray-500 flex items-center gap-2">
            <span className="text-gray-300">0x7a...3b9</span> unlocked <span className="text-white">File #8832</span> 
            <span className="text-green-500/50">via Base</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// --- Main Page ---

export default function MarketplacePage() {
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // New UI: Pill Selection State
  const categories = ['All', 'Investigative Journalism', 'Academic Research', 'Corporate Intelligence'];

  useEffect(() => {
    setTimeout(() => { setContent(MOCK_CONTENT); setLoading(false); }, 800);
  }, []);

  const filteredContent = content.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="bg-[#030303] min-h-screen text-gray-300 selection:bg-green-500/30 font-sans">
      <Navbar />
      <div className="pt-20"> {/* Offset for Navbar */}
        <LiveTicker />
      </div>

      <div className="relative pt-12 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Marketplace</h1>
              <p className="text-gray-400">Discover verified intelligence.</p>
            </div>
            
            {/* Search Bar */}
            <div className="relative w-full md:w-96 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-green-400 transition-colors" />
              <input
                type="text"
                placeholder="Search by keyword or tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500/50 focus:border-transparent text-white placeholder-gray-600 transition-all"
              />
            </div>
          </div>

          {/* Pill Filters */}
          <div className="flex flex-wrap gap-2 mb-8">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-medium border transition-all ${
                  selectedCategory === cat 
                    ? 'bg-white text-black border-white' 
                    : 'bg-transparent text-gray-500 border-white/10 hover:border-white/30 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Content Grid */}
          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-64 bg-white/5 rounded-xl animate-pulse border border-white/5" />
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredContent.map(item => (
                <SpotlightCard key={item.id} href={`/content/${item.id}`}>
                  
                  {/* Top Metadata */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-2">
                       <span className="text-[10px] font-mono text-gray-500 bg-white/5 px-2 py-1 rounded border border-white/5">
                        {item.category}
                      </span>
                      {item.discountedPrice < item.price && (
                        <span className="text-[10px] font-bold text-green-400 bg-green-500/10 px-2 py-1 rounded border border-green-500/20 flex items-center gap-1">
                          <Zap className="w-3 h-3" /> VERIFIED
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Content Info */}
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-green-400 transition-colors line-clamp-2">
                    {item.title}
                  </h3>
                  <p className="text-xs text-gray-500 mb-4 line-clamp-2">
                    {item.description}
                  </p>

                  {/* Creator */}
                  <div className="flex items-center gap-2 mb-6 text-xs text-gray-400">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-700 to-black border border-white/10" />
                    {item.creator}
                  </div>

                  {/* Footer Price */}
                  <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>

                    <div className="text-right">
                      {item.discountedPrice < item.price && (
                        <span className="text-xs text-gray-600 line-through mr-2">${item.price}</span>
                      )}
                      <span className="text-lg font-mono font-bold text-white">
                        ${item.discountedPrice}
                      </span>
                    </div>
                  </div>

                </SpotlightCard>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
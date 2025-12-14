'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Filter, Tag, Clock, Shield, Loader2 } from 'lucide-react';
import Navbar from '@/components/Navbar';

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

// Mock data for demo - will be replaced with API call
const MOCK_CONTENT: Content[] = [
  {
    id: '1',
    title: 'Investigative Report: Corporate Fraud in Tech Giants',
    creator: 'Anonymous Whistleblower',
    price: 5.00,
    discountedPrice: 2.50,
    credentialType: 'journalist',
    category: 'Investigative Journalism',
    description: 'Detailed investigation into financial irregularities at major tech companies. Contains leaked documents and insider testimony.',
    createdAt: '2024-01-15',
    tags: ['fraud', 'tech', 'investigation']
  },
  {
    id: '2',
    title: 'Quantum Computing: Breakthrough in Error Correction',
    creator: 'Dr. Sarah Chen',
    price: 3.00,
    discountedPrice: 3.00,
    credentialType: 'none',
    category: 'Academic Research',
    description: 'Novel approach to quantum error correction using topological qubits. Full research paper with experimental results.',
    createdAt: '2024-01-14',
    tags: ['quantum', 'research', 'physics']
  },
  {
    id: '3',
    title: 'AI Market Analysis: Competitive Intelligence 2024',
    creator: 'TechInsights Research',
    price: 10.00,
    discountedPrice: 10.00,
    credentialType: 'none',
    category: 'Corporate Intelligence',
    description: 'Comprehensive analysis of AI market trends, competitor strategies, and investment opportunities.',
    createdAt: '2024-01-13',
    tags: ['AI', 'market', 'analysis']
  },
  {
    id: '4',
    title: 'Political Dissent in Authoritarian Regimes',
    creator: 'Freedom Press',
    price: 0.50,
    discountedPrice: 0.50,
    credentialType: 'none',
    category: 'Educational Content',
    description: 'Educational materials on civil resistance and democratic movements. Essential reading for students of political science.',
    createdAt: '2024-01-12',
    tags: ['politics', 'education', 'freedom']
  },
  {
    id: '5',
    title: 'Cryptocurrency Money Laundering Networks Exposed',
    creator: 'BlockchainWatch',
    price: 7.50,
    discountedPrice: 3.75,
    credentialType: 'journalist',
    category: 'Investigative Journalism',
    description: 'In-depth investigation into cryptocurrency laundering operations. Includes transaction graphs and entity analysis.',
    createdAt: '2024-01-11',
    tags: ['crypto', 'investigation', 'compliance']
  },
  {
    id: '6',
    title: 'Machine Learning for Drug Discovery',
    creator: 'Prof. Michael Zhang',
    price: 4.00,
    discountedPrice: 4.00,
    credentialType: 'none',
    category: 'Academic Research',
    description: 'Research paper on using transformer models for protein folding prediction and drug target identification.',
    createdAt: '2024-01-10',
    tags: ['ML', 'biotech', 'research']
  }
];

export default function MarketplacePage() {
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedCredential, setSelectedCredential] = useState<string>('All');

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setContent(MOCK_CONTENT);
      setLoading(false);
    }, 800);
  }, []);

  const categories = ['All', 'Investigative Journalism', 'Academic Research', 'Corporate Intelligence', 'Educational Content'];
  const credentials = ['All', 'Journalist', 'Researcher', 'None Required'];

  const filteredContent = content.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    
    const matchesCredential = selectedCredential === 'All' || 
                             (selectedCredential === 'None Required' && item.credentialType === 'none') ||
                             (selectedCredential === 'Journalist' && item.credentialType === 'journalist') ||
                             (selectedCredential === 'Researcher' && item.credentialType === 'researcher');
    
    return matchesSearch && matchesCategory && matchesCredential;
  });

  return (
    <>
      <Navbar />
      
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4 text-[#f0f4f8]">
              Content <span className="gradient-text">Marketplace</span>
            </h1>
            <p className="text-xl text-[#a8b8c8]">
              Browse premium content. Pay privately. Read freely.
            </p>
          </div>

          {/* Search and Filters */}
          <div className="glass p-6 rounded-2xl mb-8">
            {/* Search Bar */}
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#a8b8c8]" />
              <input
                type="text"
                placeholder="Search content, tags, or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-[#1e3a4a]/30 border border-cyan-500/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00d4ff] text-[#f0f4f8] placeholder-[#a8b8c8] transition-all"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
              {/* Category Filter */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-[#a8b8c8] mb-2">
                  <Filter className="inline h-4 w-4 mr-1" />
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-2 bg-[#1e3a4a]/30 border border-cyan-500/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00d4ff] text-[#f0f4f8] transition-all"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat} className="bg-[#0f1419]">{cat}</option>
                  ))}
                </select>
              </div>

              {/* Credential Filter */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-[#a8b8c8] mb-2">
                  <Shield className="inline h-4 w-4 mr-1" />
                  Credential Required
                </label>
                <select
                  value={selectedCredential}
                  onChange={(e) => setSelectedCredential(e.target.value)}
                  className="w-full px-4 py-2 bg-[#1e3a4a]/30 border border-cyan-500/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00d4ff] text-[#f0f4f8] transition-all"
                >
                  {credentials.map(cred => (
                    <option key={cred} value={cred} className="bg-[#0f1419]">{cred}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Results Count */}
          <div className="mb-6 text-gray-400">
            {loading ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading content...</span>
              </div>
            ) : (
              <span>Found {filteredContent.length} {filteredContent.length === 1 ? 'item' : 'items'}</span>
            )}
          </div>

          {/* Content Grid */}
          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="glass p-6 rounded-2xl animate-pulse">
                  <div className="h-6 bg-white/10 rounded mb-4"></div>
                  <div className="h-4 bg-white/10 rounded mb-2"></div>
                  <div className="h-4 bg-white/10 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : filteredContent.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-2xl font-semibold mb-2">No content found</h3>
              <p className="text-gray-400">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredContent.map(item => (
                <Link
                  key={item.id}
                  href={`/content/${item.id}`}
                  className="glass p-6 rounded-2xl hover:bg-white/10 transition-all group cursor-pointer"
                >
                  {/* Category Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs px-3 py-1 bg-cyan-500/10 text-[#00d4ff] rounded-full border border-cyan-500/20">
                      {item.category}
                    </span>
                    {item.discountedPrice < item.price && (
                      <span className="text-xs px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full font-semibold border border-emerald-500/20">
                        50% OFF
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-semibold mb-2 group-hover:text-[#00d4ff] transition-colors line-clamp-2 text-[#f0f4f8]">
                    {item.title}
                  </h3>

                  {/* Creator */}
                  <p className="text-sm text-gray-400 mb-3">by {item.creator}</p>

                  {/* Description */}
                  <p className="text-gray-400 text-sm mb-4 line-clamp-3">
                    {item.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {item.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-xs px-2 py-1 bg-white/5 text-gray-400 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-cyan-500/10">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-[#a8b8c8]" />
                      <span className="text-sm text-[#a8b8c8]">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {item.discountedPrice < item.price && (
                        <span className="text-sm text-[#a8b8c8] line-through">${item.price.toFixed(2)}</span>
                      )}
                      <span className="text-xl font-bold text-[#00d4ff]">
                        ${item.discountedPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Credential Badge */}
                  {item.credentialType !== 'none' && (
                    <div className="mt-4 flex items-center space-x-2 text-xs text-[#00d4ff]">
                      <Shield className="h-3 w-3" />
                      <span>Requires {item.credentialType} credential</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

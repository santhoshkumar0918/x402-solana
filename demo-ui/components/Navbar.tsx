'use client';

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';
import { Shield } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#1e3a4a] bg-[#0f1419]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="relative w-10 h-10 bg-gradient-to-br from-[#00d4ff] to-[#0099cc] rounded-lg flex items-center justify-center shadow-lg group-hover:shadow-[0_0_20px_rgba(0,212,255,0.4)] transition-all">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-[#f0f4f8] group-hover:text-[#00d4ff] transition-colors">
              x402
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link 
              href="/marketplace" 
              className="text-[#a8b8c8] hover:text-[#00d4ff] transition-colors font-medium"
            >
              Marketplace
            </Link>
            <a 
              href="/#how-it-works" 
              className="text-[#a8b8c8] hover:text-[#00d4ff] transition-colors font-medium"
            >
              How It Works
            </a>
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[#a8b8c8] hover:text-[#00d4ff] transition-colors font-medium"
            >
              GitHub
            </a>
          </div>

          {/* Wallet Connect Button */}
          <div className="flex items-center space-x-4">
            <WalletMultiButton />
          </div>
        </div>
      </div>
    </nav>
  );
}

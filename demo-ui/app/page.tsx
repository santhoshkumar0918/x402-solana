
'use client';

import Link from 'next/link';
import { Shield, Lock, Zap, Eye, Globe, ArrowRight, Check, Github, Smartphone, Cpu, Terminal } from 'lucide-react';
import Navbar from '@/components/Navbar';

export default function Home() {
  return (
    <>
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-40 pb-32 px-6 relative overflow-hidden">
        <div className="max-w-5xl mx-auto text-center relative z-10">
          
          {/* Badge */}
          <div className="inline-flex items-center space-x-2 bg-white/5 border border-white/10 px-3 py-1 rounded-full mb-8 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs font-medium text-gray-400 tracking-wide uppercase">Protocol Live on Mainnet</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-7xl md:text-8xl font-bold mb-8 tracking-tight leading-none animate-slide-up delay-100">
            <span className="text-white">Invisible</span><br />
            <span className="text-gray-500">Payments.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed animate-slide-up delay-200 font-light">
            x402 is the privacy layer for the information economy. 
            Access premium content with zero-knowledge proofs. 
            <span className="text-white"> No tracking. No traces. Just access.</span>
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 animate-slide-up delay-300">
            <Link 
              href="/marketplace"
              className="btn-primary px-8 py-4 rounded-full text-lg flex items-center space-x-2"
            >
              <span>Enter Marketplace</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
            
            <a 
              href="https://github.com"
              target="_blank"
              className="btn-secondary px-8 py-4 rounded-full text-lg flex items-center space-x-2"
            >
              <Github className="h-5 w-5" />
              <span>Documentation</span>
            </a>
          </div>
        </div>
        
        {/* Background Grid */}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
      </section>

      {/* Bento Grid Features */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Large Card */}
            <div className="md:col-span-2 glass-panel p-10 rounded-3xl card-hover relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:opacity-20 transition-opacity">
                <Shield className="w-64 h-64" />
              </div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-6">
                  <Lock className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-white mb-4">Zero-Knowledge Architecture</h3>
                <p className="text-gray-400 text-lg max-w-md leading-relaxed">
                  We use Groth16 proofs to verify payments without revealing your identity. 
                  The merchant knows they were paid, but not by whom.
                </p>
              </div>
            </div>

            {/* Tall Card */}
            <div className="md:row-span-2 glass-panel p-10 rounded-3xl card-hover flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-6">
                  <Globe className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-white mb-4">Universal Settlement</h3>
                <p className="text-gray-400 text-lg leading-relaxed">
                  Powered by Wormhole. Pay on Solana, settle on Base. The chain doesn't matter anymore.
                </p>
              </div>
              <div className="mt-10 border-t border-white/10 pt-6">
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>Supported Chains</span>
                  <span>12+</span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-500 mt-2">
                  <span>Avg. Time</span>
                  <span>~2s</span>
                </div>
              </div>
            </div>

            {/* Small Card 1 */}
            <div className="glass-panel p-8 rounded-3xl card-hover group">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center mb-4">
                <Terminal className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Developer First</h3>
              <p className="text-gray-400">Simple SDKs for easy integration.</p>
            </div>

            {/* Small Card 2 */}
            <div className="glass-panel p-8 rounded-3xl card-hover group">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center mb-4">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Instant Finality</h3>
              <p className="text-gray-400">No waiting for block confirmations.</p>
            </div>

          </div>
        </div>
      </section>

      {/* Minimal Stats */}
      <section className="py-20 border-y border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
            {[
              { label: 'Total Volume', value: '.2M+' },
              { label: 'Privacy Preserved', value: '100%' },
              { label: 'Active Nodes', value: '840' },
              { label: 'Uptime', value: '99.99%' },
            ].map((stat, i) => (
              <div key={i}>
                <div className="text-4xl font-bold text-white mb-2 tracking-tight">{stat.value}</div>
                <div className="text-sm text-gray-500 uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center text-gray-500 text-sm">
          <p>© 2025 x402 Protocol. All rights reserved.</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Twitter</a>
          </div>
        </div>
      </footer>
    </>
  );
}


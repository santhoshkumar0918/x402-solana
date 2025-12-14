'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform, useMotionTemplate, useMotionValue } from 'framer-motion';
import { Shield, Lock, Zap, ArrowRight, Github, Terminal, ChevronRight, Globe, Cpu, Activity, Server } from 'lucide-react';
import Navbar from '@/components/Navbar';

// --- VISUAL COMPONENTS ---

/**
 * 3D Retro Grid Background
 */
function RetroGrid() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Horizon Fade */}
      <div className="absolute top-0 left-0 w-full h-[60%] bg-gradient-to-b from-[#030303] via-[#030303] to-transparent z-10" />
      
      {/* Moving Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] [transform:perspective(500px)_rotateX(60deg)_scale(3)] origin-top animate-[grid_20s_linear_infinite]" />
    </div>
  );
}

function SpotlightCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <div
      className={`group relative border border-white/10 bg-black/40 overflow-hidden rounded-2xl ${className}`}
      onMouseMove={handleMouseMove}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              650px circle at ${mouseX}px ${mouseY}px,
              rgba(34, 197, 94, 0.1),
              transparent 80%
            )
          `,
        }}
      />
      <div className="relative h-full backdrop-blur-sm">{children}</div>
    </div>
  );
}

function TechBadge({ icon: Icon, label }: { icon: any, label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-400 font-mono">
      <Icon className="w-3 h-3" />
      {label}
    </div>
  );
}

export default function Home() {
  const { scrollY } = useScroll();
  const yHero = useTransform(scrollY, [0, 500], [0, 150]);
  const opacityHero = useTransform(scrollY, [0, 300], [1, 0]);

  return (
    <div className="bg-[#030303] min-h-screen text-white selection:bg-green-500/30 overflow-x-hidden">
      <Navbar />
      
      {/* --- HERO SECTION --- */}
      <section className="relative h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
        <RetroGrid />
        
        {/* Glows */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-green-500/10 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />

        <motion.div 
          style={{ y: yHero, opacity: opacityHero }}
          className="relative z-10 max-w-5xl mx-auto text-center"
        >
          {/* Status Pill */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-8 hover:bg-white/10 transition-colors cursor-default"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs font-mono text-gray-400">MAINNET LIVE</span>
          </motion.div>

          {/* Headline */}
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold tracking-tighter leading-[0.9] mb-8 bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-gray-600">
            Invisible<br />Payments.
          </h1>

          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            The privacy layer for the information economy. 
            Access premium intelligence with <span className="text-green-400">zero-knowledge proofs</span>.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/marketplace" className="group relative px-8 py-4 bg-white text-black rounded-lg font-bold text-lg hover:bg-gray-200 transition-all flex items-center gap-2">
              Enter Marketplace
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            
            <a href="https://github.com" target="_blank" className="px-8 py-4 bg-black border border-white/20 text-white rounded-lg font-bold text-lg hover:bg-white/5 transition-all flex items-center gap-2">
              <Terminal className="w-4 h-4 text-gray-400" />
              Build with SDK
            </a>
          </div>

          {/* Tech Stack Ticker */}
          <div className="mt-16 flex items-center justify-center gap-4 animate-fade-in opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
             <TechBadge icon={Shield} label="Circom 2.1" />
             <TechBadge icon={Zap} label="Solana" />
             <TechBadge icon={Globe} label="Wormhole" />
             <TechBadge icon={Server} label="IPFS" />
          </div>
        </motion.div>
      </section>

      {/* --- ARCHITECTURE GRID --- */}
      <section className="py-32 px-6 relative z-10 bg-[#030303]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl md:text-5xl font-bold mb-4">Protocol Architecture</h2>
              <p className="text-gray-500 max-w-md">Engineered for autonomy. Verified by math.</p>
            </div>
            <Link href="/docs" className="hidden md:flex items-center text-sm text-green-400 hover:text-green-300 transition-colors">
              Read the Whitepaper <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 grid-rows-2 gap-4 h-[800px] md:h-[600px]">
            
            {/* ZK Core (Large Left) */}
            <SpotlightCard className="md:col-span-4 md:row-span-2 p-10 flex flex-col justify-between group">
              <div className="absolute right-0 top-0 w-96 h-96 bg-green-500/5 blur-[100px] rounded-full group-hover:bg-green-500/10 transition-all duration-700" />
              
              <div>
                <div className="w-12 h-12 bg-green-900/20 border border-green-500/20 rounded-lg flex items-center justify-center mb-6">
                  <Shield className="w-6 h-6 text-green-400" />
                </div>
                <h3 className="text-3xl font-bold text-white mb-2">Zero-Knowledge Settlement</h3>
                <p className="text-gray-400 text-lg max-w-md leading-relaxed">
                  Decoupling identity from value. We use Groth16 proofs to verify payments on-chain without revealing the sender's history.
                </p>
              </div>

              {/* Code Snippet Visualization */}
              <div className="mt-8 font-mono text-xs text-gray-500 bg-black/50 border border-white/5 p-4 rounded-lg">
                <div className="flex gap-2 mb-2 border-b border-white/5 pb-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/20" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/20" />
                  <div className="w-3 h-3 rounded-full bg-green-500/20" />
                </div>
                <p><span className="text-purple-400">const</span> proof = <span className="text-blue-400">await</span> zk.prove(secret, nullifier);</p>
                <p><span className="text-purple-400">await</span> solana.verify(proof); <span className="text-gray-600">// {'->'} true</span></p>
              </div>
            </SpotlightCard>

            {/* Cross Chain (Top Right) */}
            <SpotlightCard className="md:col-span-2 p-8 flex flex-col justify-between">
              <div>
                <Globe className="w-8 h-8 text-purple-400 mb-4" />
                <h3 className="text-xl font-bold text-white">Omnichain</h3>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Settlement via Wormhole. Pay on Base, settle on Solana instantly.
              </p>
            </SpotlightCard>

            {/* AI Native (Bottom Right) */}
            <SpotlightCard className="md:col-span-2 p-8 flex flex-col justify-between">
              <div>
                <Cpu className="w-8 h-8 text-blue-400 mb-4" />
                <h3 className="text-xl font-bold text-white">Agent Native</h3>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                MCP standards built-in. AI agents can negotiate and pay autonomously.
              </p>
            </SpotlightCard>

          </div>
        </div>
      </section>

      {/* --- STATS RIBBON --- */}
      <section className="py-20 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
            {[
              { label: 'Total Volume', value: '$14.2M' },
              { label: 'Privacy Score', value: '100%' },
              { label: 'Latency', value: '400ms' },
              { label: 'Active Agents', value: '12k+' },
            ].map((stat, i) => (
              <div key={i} className="text-center md:text-left">
                <div className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-2">{stat.value}</div>
                <div className="text-xs font-mono text-gray-500 uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="py-12 px-6 bg-black">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center text-gray-600 text-sm">
          <p>© 2025 Specter Protocol. Built for the shadows.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-white transition-colors">Docs</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
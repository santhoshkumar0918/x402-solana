'use client';

import { useState, useEffect } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Handle scroll effect for glassmorphism
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Marketplace', href: '/marketplace' },
    { name: 'Upload', href: '/upload' },
    { name: 'Dashboard', href: '/dashboard' },
  ];

  // Mobile Menu Animation Variants
  const menuVariants = {
    closed: {
      opacity: 0,
      y: -100,
      transition: { staggerChildren: 0.05, staggerDirection: -1 }
    },
    open: {
      opacity: 1,
      y: 0,
      transition: { staggerChildren: 0.07, delayChildren: 0.2, type: "spring" as const, stiffness: 80 }
    }
  };

  const itemVariants = {
    closed: { opacity: 0, x: -20 },
    open: { opacity: 1, x: 0 }
  };

  return (
    <>
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-black/80 backdrop-blur-xl border-b border-white/5 py-3'
            : 'bg-transparent border-b border-transparent py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between">
            
            {/* --- LOGO --- */}
            <Link href="/" className="relative z-50 flex items-center group">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative"
              >
                 {/* Glow Effect behind logo */}
                <div className="absolute -inset-4 bg-green-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-40 transition-opacity duration-500" />
                
                <Image 
                  src="/specterx402.png" 
                  alt="Specter x402 Logo" 
                  width={140} 
                  height={40} 
                  className="object-contain h-10 w-auto relative z-10" 
                  priority 
                />
              </motion.div>
            </Link>

            {/* --- DESKTOP NAVIGATION (THE PILL) --- */}
            <div className="hidden md:flex items-center p-1.5 bg-white/5 border border-white/5 rounded-full backdrop-blur-md relative">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={`relative px-6 py-2 text-sm font-medium transition-colors z-10 ${
                      isActive ? 'text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="nav-pill"
                        className="absolute inset-0 bg-white/10 rounded-full shadow-lg border border-white/5"
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    )}
                    {link.name}
                  </Link>
                );
              })}
            </div>

            {/* --- WALLET & ACTIONS --- */}
            <div className="hidden md:flex items-center space-x-4">
               <motion.div 
                 whileHover={{ scale: 1.02 }}
                 whileTap={{ scale: 0.98 }}
                 className="wallet-adapter-dropdown-wrapper"
               >
                <WalletMultiButton style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    height: '40px',
                    borderRadius: '9999px',
                    fontFamily: 'inherit',
                    fontWeight: '600',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    transition: 'all 0.2s ease',
                    padding: '0 24px'
                }} />
              </motion.div>
            </div>

            {/* --- MOBILE MENU TOGGLE --- */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-400 hover:text-white transition-colors relative z-50"
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* --- MOBILE MENU OVERLAY --- */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial="closed"
            animate="open"
            exit="closed"
            variants={menuVariants}
            className="fixed inset-0 z-40 bg-black/98 backdrop-blur-3xl pt-28 px-6 md:hidden flex flex-col"
          >
            <div className="flex flex-col space-y-8">
              {navLinks.map((link) => (
                <motion.div key={link.name} variants={itemVariants}>
                  <Link
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`text-4xl font-bold tracking-tight ${
                        pathname === link.href ? 'text-green-400' : 'text-gray-500'
                    }`}
                  >
                    {link.name}
                  </Link>
                </motion.div>
              ))}
              
              <motion.div variants={itemVariants} className="pt-8 mt-4 border-t border-white/10">
                <WalletMultiButton style={{ width: '100%', justifyContent: 'center' }} />
              </motion.div>
            </div>

            {/* Mobile Background Decoration */}
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-green-500/10 blur-[100px] rounded-full pointer-events-none" />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
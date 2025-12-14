import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/components/providers/WalletProvider";

export const metadata: Metadata = {
  title: "x402 - Private Content Payments",
  description: "Privacy-preserving cross-chain payments for premium content using Zero-Knowledge proofs",
  keywords: ["blockchain", "privacy", "payments", "zero-knowledge", "solana", "wormhole"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#0f1419] text-white min-h-screen">
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}

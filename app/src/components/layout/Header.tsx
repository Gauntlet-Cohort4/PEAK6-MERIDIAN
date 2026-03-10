'use client';

import Link from 'next/link';
import { WalletButton } from '@/components/wallet/WalletButton';
import { SettlementTimer } from '@/components/shared/SettlementTimer';
import { TrendingUp } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center px-4">
        <Link href="/" className="flex items-center gap-2 mr-6">
          <TrendingUp className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">Meridian</span>
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/markets"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Markets
          </Link>
          <Link
            href="/portfolio"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Portfolio
          </Link>
          <Link
            href="/history"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            History
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <SettlementTimer className="hidden md:flex" />
          <WalletButton />
        </div>
      </div>
    </header>
  );
}

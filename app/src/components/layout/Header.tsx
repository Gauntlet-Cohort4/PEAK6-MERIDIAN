'use client';

import Link from 'next/link';
import { WalletButton } from '@/components/wallet/WalletButton';
import { UsdcBalance } from '@/components/wallet/UsdcBalance';
import { SettlementTimer } from '@/components/shared/SettlementTimer';
import { DemoToolbar } from '@/components/shared/DemoControls';
import { IS_DEMO_MODE } from '@/lib/demo';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#1e2a3a] bg-[#0d1117]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0d1117]/80">
      <div className="container mx-auto flex h-12 items-center px-4">
        <Link href="/" className="flex items-center gap-2 mr-8">
          <span className="font-bold text-lg tracking-tight">
            <span className="text-[#00d26a]">Bin</span><span className="text-[#e2e8f0]">Bar</span>
          </span>
        </Link>

        <nav className="flex items-center gap-6 text-xs font-medium uppercase tracking-wider">
          <Link
            href="/markets"
            className="text-[#64748b] hover:text-[#e2e8f0] transition-colors"
          >
            Markets
          </Link>
          <Link
            href="/portfolio"
            className="text-[#64748b] hover:text-[#e2e8f0] transition-colors"
          >
            Portfolio
          </Link>
          <Link
            href="/history"
            className="text-[#64748b] hover:text-[#e2e8f0] transition-colors"
          >
            History
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {IS_DEMO_MODE && (
            <>
              <div className="bg-[#f59e0b]/10 text-[#f59e0b] text-[10px] font-semibold px-2.5 py-0.5 rounded-full border border-[#f59e0b]/30 uppercase tracking-wider">
                Demo
              </div>
              <DemoToolbar />
            </>
          )}
          <SettlementTimer className="hidden md:flex" />
          <UsdcBalance />
          <WalletButton />
        </div>
      </div>
    </header>
  );
}

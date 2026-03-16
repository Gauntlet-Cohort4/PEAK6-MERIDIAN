import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TrendingUp, BarChart3, Shield } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-[calc(100vh-5.5rem)]">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#3b82f6]/5 via-transparent to-transparent" />
        <div className="container mx-auto px-4 pt-20 pb-16 relative">
          <p className="text-sm font-medium uppercase tracking-widest text-[#00d26a] mb-4">Binary Options on Solana</p>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-tight text-[#e2e8f0]">
            Will the price close
            <br />
            above the strike?
          </h1>
          <p className="mt-4 text-[#94a3b8] text-base max-w-lg">
            Yes or No. $1 payout per contract. Real stock prices from Pyth,
            matched on Phoenix order book, settled daily at market close.
          </p>
          <div className="flex gap-3 mt-8">
            <Link href="/markets">
              <Button size="lg" className="bg-[#00d26a] hover:bg-[#00b85c] text-[#0a0e17] font-semibold px-8">
                Start Trading
              </Button>
            </Link>
            <Link href="/portfolio">
              <Button variant="outline" size="lg" className="border-[#1e2a3a] text-[#e2e8f0] hover:bg-[#1a2035]">
                My Portfolio
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* How It Works Strip */}
      <div className="border-y border-[#1e2a3a] bg-[#111827]/50">
        <div className="container mx-auto px-4 py-5 grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#00d26a]/15 text-[#00d26a] flex items-center justify-center text-xs font-bold">1</span>
            <span className="text-[#94a3b8]">Pick a stock &amp; strike</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#00d26a]/15 text-[#00d26a] flex items-center justify-center text-xs font-bold">2</span>
            <span className="text-[#94a3b8]">Buy YES or NO contracts</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#00d26a]/15 text-[#00d26a] flex items-center justify-center text-xs font-bold">3</span>
            <span className="text-[#94a3b8]">Market settles at 4:05 PM ET</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#00d26a]/15 text-[#00d26a] flex items-center justify-center text-xs font-bold">4</span>
            <span className="text-[#94a3b8]">Winners collect $1 per contract</span>
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#111827] border border-[#1e2a3a] rounded-md p-5 border-l-[3px] border-l-[#3b82f6]">
            <TrendingUp className="h-6 w-6 text-[#3b82f6] mb-3" />
            <h2 className="text-sm font-semibold text-[#e2e8f0] mb-1">Real-Time Pricing</h2>
            <p className="text-xs text-[#64748b] leading-relaxed">
              Live stock prices from Pyth Network oracle with sub-second updates.
            </p>
          </div>
          <div className="bg-[#111827] border border-[#1e2a3a] rounded-md p-5 border-l-[3px] border-l-[#00d26a]">
            <BarChart3 className="h-6 w-6 text-[#00d26a] mb-3" />
            <h2 className="text-sm font-semibold text-[#e2e8f0] mb-1">Phoenix Order Book</h2>
            <p className="text-xs text-[#64748b] leading-relaxed">
              On-chain order matching via Phoenix DEX for transparent price discovery.
            </p>
          </div>
          <div className="bg-[#111827] border border-[#1e2a3a] rounded-md p-5 border-l-[3px] border-l-[#f59e0b]">
            <Shield className="h-6 w-6 text-[#f59e0b] mb-3" />
            <h2 className="text-sm font-semibold text-[#e2e8f0] mb-1">Automated Settlement</h2>
            <p className="text-xs text-[#64748b] leading-relaxed">
              Daily settlement at market close with oracle-verified outcomes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

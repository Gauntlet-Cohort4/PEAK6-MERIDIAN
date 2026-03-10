import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TrendingUp, BarChart3, Shield } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center space-y-6 max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Binary Options on{' '}
          <span className="text-primary">Solana</span>
        </h1>
        <p className="text-lg text-muted-foreground">
          Trade predictions on stock closing prices. Each contract pays $1 if
          you&apos;re right, $0 if you&apos;re wrong. Powered by Phoenix order
          book and Pyth oracle.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/markets">
            <Button size="lg">View Markets</Button>
          </Link>
          <Link href="/portfolio">
            <Button variant="outline" size="lg">
              My Portfolio
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
        <div className="text-center space-y-3">
          <TrendingUp className="h-10 w-10 mx-auto text-primary" />
          <h3 className="text-lg font-semibold">Real-Time Pricing</h3>
          <p className="text-sm text-muted-foreground">
            Live stock prices from Pyth Network oracle with sub-second updates.
          </p>
        </div>
        <div className="text-center space-y-3">
          <BarChart3 className="h-10 w-10 mx-auto text-primary" />
          <h3 className="text-lg font-semibold">Phoenix Order Book</h3>
          <p className="text-sm text-muted-foreground">
            On-chain order matching via Phoenix DEX for transparent price
            discovery.
          </p>
        </div>
        <div className="text-center space-y-3">
          <Shield className="h-10 w-10 mx-auto text-primary" />
          <h3 className="text-lg font-semibold">Automated Settlement</h3>
          <p className="text-sm text-muted-foreground">
            Daily settlement at market close with oracle-verified outcomes.
          </p>
        </div>
      </div>
    </div>
  );
}

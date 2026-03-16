import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { WalletProvider } from '@/providers/WalletProvider';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { DemoStateProvider } from '@/providers/DemoStateProvider';
import { ToastProvider } from '@/providers/ToastProvider';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Meridian - Binary Options on Solana',
  description: 'Trade binary options on stock prices, powered by Solana.',
};

export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-[#0a0e17] text-[#e2e8f0]`}>
        <WalletProvider>
          <ThemeProvider>
            <DemoStateProvider>
              <ToastProvider>
                <div className="flex min-h-screen flex-col">
                  <Header />
                  <main className="flex-1">{children}</main>
                  <Footer />
                </div>
              </ToastProvider>
            </DemoStateProvider>
          </ThemeProvider>
        </WalletProvider>
      </body>
    </html>
  );
}

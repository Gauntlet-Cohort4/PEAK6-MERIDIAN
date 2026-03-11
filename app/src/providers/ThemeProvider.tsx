'use client';

import React from 'react';

interface ThemeProviderProps {
  readonly children: React.ReactNode;
}

/**
 * Theme provider for dark/light mode support.
 * Stage A: basic implementation. Can be extended with next-themes later.
 */
export function ThemeProvider({ children }: ThemeProviderProps): React.JSX.Element {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}

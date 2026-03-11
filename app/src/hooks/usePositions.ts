'use client';

import { useState, useEffect } from 'react';
import type { Position } from '@meridian/shared/types';
import { MOCK_POSITIONS } from '@/lib/mock-data';

export interface UsePositionsResult {
  readonly positions: readonly Position[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly getPosition: (marketAddress: string) => Position | null;
}

/**
 * Hook to fetch user positions.
 * Stage A: returns mock data.
 */
export function usePositions(): UsePositionsResult {
  const [positions, setPositions] = useState<readonly Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, _setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate async fetch
    const timer = setTimeout(() => {
      setPositions(MOCK_POSITIONS);
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  const getPosition = (marketAddress: string): Position | null => {
    return (
      positions.find((p) => p.marketAddress === marketAddress) ?? null
    );
  };

  return { positions, isLoading, error, getPosition };
}

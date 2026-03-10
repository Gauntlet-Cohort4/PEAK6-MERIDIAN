'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  shouldSkipConfirmation,
  setSkipConfirmation,
} from '@/lib/trade-confirmation';

export interface TradeConfirmationData {
  readonly side: string;
  readonly size: number;
  readonly price: number;
  readonly ticker: string;
  readonly strikePrice: number;
}

export interface UseTradeConfirmationResult {
  readonly isOpen: boolean;
  readonly confirmationData: TradeConfirmationData | null;
  readonly skipConfirmation: boolean;
  readonly requestConfirmation: (data: TradeConfirmationData) => boolean;
  readonly confirm: () => void;
  readonly cancel: () => void;
  readonly setSkip: (skip: boolean) => void;
}

/**
 * Hook to manage trade confirmation dialog state and localStorage.
 * Returns true from requestConfirmation if confirmation is needed.
 */
export function useTradeConfirmation(
  onConfirm: () => void,
): UseTradeConfirmationResult {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmationData, setConfirmationData] =
    useState<TradeConfirmationData | null>(null);
  const [skipConfirmation, setSkipState] = useState(false);
  const skipRef = useRef(false);

  useEffect(() => {
    const initial = shouldSkipConfirmation();
    setSkipState(initial);
    skipRef.current = initial;
  }, []);

  const requestConfirmation = useCallback(
    (data: TradeConfirmationData): boolean => {
      if (skipRef.current) {
        onConfirm();
        return false;
      }
      setConfirmationData(data);
      setIsOpen(true);
      return true;
    },
    [onConfirm],
  );

  const confirm = useCallback(() => {
    setIsOpen(false);
    setConfirmationData(null);
    onConfirm();
  }, [onConfirm]);

  const cancel = useCallback(() => {
    setIsOpen(false);
    setConfirmationData(null);
  }, []);

  const setSkip = useCallback((skip: boolean) => {
    setSkipConfirmation(skip);
    setSkipState(skip);
    skipRef.current = skip;
  }, []);

  return {
    isOpen,
    confirmationData,
    skipConfirmation,
    requestConfirmation,
    confirm,
    cancel,
    setSkip,
  };
}

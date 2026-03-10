import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTradeConfirmation } from '../../src/hooks/useTradeConfirmation';
import {
  setSkipConfirmation,
  resetConfirmationPreference,
} from '../../src/lib/trade-confirmation';

describe('useTradeConfirmation', () => {
  beforeEach(() => {
    resetConfirmationPreference();
  });

  const mockData = {
    side: 'BUY_YES',
    size: 10,
    price: 0.65,
    ticker: 'AAPL',
    strikePrice: 230,
  };

  it('opens confirmation dialog when requested', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useTradeConfirmation(onConfirm));

    act(() => {
      result.current.requestConfirmation(mockData);
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.confirmationData).toEqual(mockData);
  });

  it('calls onConfirm when confirmed', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useTradeConfirmation(onConfirm));

    act(() => {
      result.current.requestConfirmation(mockData);
    });

    act(() => {
      result.current.confirm();
    });

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(result.current.isOpen).toBe(false);
  });

  it('closes dialog on cancel', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useTradeConfirmation(onConfirm));

    act(() => {
      result.current.requestConfirmation(mockData);
    });

    act(() => {
      result.current.cancel();
    });

    expect(result.current.isOpen).toBe(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('skips dialog when skip is enabled via setSkip', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useTradeConfirmation(onConfirm));

    // Enable skip through the hook's setSkip method
    act(() => {
      result.current.setSkip(true);
    });

    act(() => {
      result.current.requestConfirmation(mockData);
    });

    // When skip is enabled, onConfirm is called immediately without dialog
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(result.current.isOpen).toBe(false);
  });

  it('persists skip preference', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() => useTradeConfirmation(onConfirm));

    act(() => {
      result.current.setSkip(true);
    });

    expect(result.current.skipConfirmation).toBe(true);
  });
});
